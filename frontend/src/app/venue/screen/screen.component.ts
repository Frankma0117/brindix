import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api } from '../../core/api.service';
import { Banner, Screen } from '../../core/models';
import { MoneyPipe, duration } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { MascotComponent } from '../../shared/mascot.component';
import { IconComponent } from '../../shared/icon.component';

// API del reproductor oficial de YouTube (se carga bajo demanda).
// Reproductor web de Spotify (Web Playback SDK, también bajo demanda).
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; Spotify?: any; onSpotifyWebPlaybackSDKReady?: () => void; }
}

interface ScreenSpotify { token?: string; canPlay: boolean; reason?: string; }

/**
 * Pantalla del TV del bar: lo que suena, lo que sigue y publicidad rotando.
 * Con /pantalla?k=<llave> además es el reproductor: con YouTube reproduce los videos; con Spotify se vuelve
 * un parlante de Spotify (Web Playback SDK) y Brindix le manda la cola.
 */
@Component({
  selector: 'bx-screen',
  standalone: true,
  imports: [MoneyPipe, MascotComponent, IconComponent],
  templateUrl: './screen.component.html',
  styleUrl: './screen.component.scss',
})
export class ScreenComponent implements OnInit {
  private api = inject(Api);
  private destroyRef = inject(DestroyRef);
  ctx = inject(VenueContext);
  private key = inject(ActivatedRoute).snapshot.queryParamMap.get('k');

  data = signal<Screen | null>(null);
  offline = signal(false);
  bannerIndex = signal(0);
  clock = signal(new Date());
  progress = signal(0);
  needsTap = signal(false);
  private progressBase = { ms: 0, at: Date.now() };
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private player: any = null;
  private playerSong: number | null = null;
  private reporting = false;
  duration = duration;
  /** Estado del reproductor de Spotify en esta pantalla. */
  spotifyState = signal<'off' | 'loading' | 'ready' | 'error'>('off');
  spotifyMsg = signal('');
  private spotifyPlayer: any = null;
  private spotifyActivated = false;
  /** Cuántas canciones de «Lo que sigue» caben sin cortar. */
  rows = signal(4);
  private nextBox = viewChild<ElementRef<HTMLElement>>('nextBox');

  banner = computed<Banner | null>(() => {
    const list = this.data()?.banners ?? [];
    return list.length ? list[this.bannerIndex() % list.length] : null;
  });
  now = computed(() => this.data()?.music.nowPlaying ?? null);
  allNext = computed(() => this.data()?.music.upNext ?? []);
  upNext = computed(() => this.allNext().slice(0, this.allNext().length > this.rows() ? Math.max(1, this.rows() - 1) : this.rows()));
  moreNext = computed(() => this.allNext().length - this.upNext().length);
  youtube = computed(() => !!this.data()?.controller && this.data()?.music.provider === 'YOUTUBE');
  spotifyScreen = computed(() => !!this.data()?.controller && this.data()?.music.provider === 'SPOTIFY');
  percent = computed(() => {
    const d = this.now()?.durationMs;
    return d ? Math.min(100, (this.progress() / d) * 100) : 0;
  });

  ngOnInit(): void {
    timer(0, 4000).pipe(
      switchMap(() => this.api.get<Screen>(this.ctx.pub('/screen'), { key: this.key }).pipe(catchError(() => { this.offline.set(true); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(s => {
      if (!s) return;
      this.offline.set(false);
      const prevTitle = this.now()?.title;
      this.data.set(s);
      const np = s.music.nowPlaying;
      if (np?.progressMs != null && (np.title !== prevTitle || Math.abs(np.progressMs - this.progress()) > 4000 || !np.playing)) {
        this.progressBase = { ms: np.progressMs, at: Date.now() };
      }
      if (!this.bannerTimer) this.scheduleBanner();
      if (this.youtube()) this.syncPlayer();
      if (this.spotifyScreen() && this.spotifyState() === 'off') this.initSpotify();
    });
    // «Lo que sigue» muestra solo las filas que caben (nunca hay que desplazarse).
    const ro = new ResizeObserver(() => this.fitRows());
    setTimeout(() => { const el = this.nextBox()?.nativeElement; if (el) { ro.observe(el); this.fitRows(); } });
    this.destroyRef.onDestroy(() => ro.disconnect());
    timer(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.clock.set(new Date());
      const np = this.now();
      this.progress.set(np?.playing === false ? this.progressBase.ms : this.progressBase.ms + (Date.now() - this.progressBase.at));
    });
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.bannerTimer);
      try { this.player?.destroy(); } catch { /* */ }
      try { this.spotifyPlayer?.disconnect(); } catch { /* */ }
    });
  }

  fullscreen(): void {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  /** Los navegadores no dejan sonar sin un toque: el primer toque activa la música. */
  start(): void {
    this.needsTap.set(false);
    this.fullscreen();
    if (this.spotifyPlayer) {
      this.spotifyActivated = true;
      try { this.spotifyPlayer.activateElement?.(); } catch { /* */ }
      this.spotifyPlayer.resume?.().catch?.(() => {});
    }
    if (this.player?.unMute) {
      this.player.unMute();
      this.player.playVideo();
    }
  }

  private fitRows(): void {
    const el = this.nextBox()?.nativeElement;
    if (!el) return;
    const vw = window.innerWidth / 100;
    const portrait = window.innerHeight > window.innerWidth;
    const row = (portrait ? 40 : Math.max(3.4 * vw, 44)) + (portrait ? 10 : 0.8 * vw);
    this.rows.set(Math.max(1, Math.floor((el.clientHeight + 0.8 * vw) / row)));
  }

  // ---------- Spotify: la pantalla es el parlante ----------

  private async initSpotify(): Promise<void> {
    this.spotifyState.set('loading');
    const first = await this.spotifyToken();
    if (!first) return;
    await this.loadSpotifySdk();
    const name = `${this.data()?.venue?.name ?? 'Bar'} · Pantalla (Brindix)`;
    const p = new window.Spotify.Player({
      name,
      volume: 0.85,
      getOAuthToken: (cb: (t: string) => void) => { this.spotifyToken().then(t => t && cb(t)); },
    });
    this.spotifyPlayer = p;
    p.addListener('ready', ({ device_id }: { device_id: string }) => {
      this.api.post(this.ctx.pub('/screen/spotify/ready'), { key: this.key, deviceId: device_id }).subscribe({
        next: () => { this.spotifyState.set('ready'); this.spotifyMsg.set(''); if (!this.spotifyActivated) this.needsTap.set(true); },
        error: e => this.spotifyFail(e?.error?.error ?? 'Spotify no aceptó esta pantalla como reproductor.'),
      });
    });
    p.addListener('not_ready', () => this.spotifyState.set('loading'));
    p.addListener('autoplay_failed', () => this.needsTap.set(true));
    p.addListener('initialization_error', () => this.spotifyFail('Este navegador no puede reproducir Spotify. Usa Chrome o Edge en un computador o TV Box.'));
    p.addListener('authentication_error', () => this.spotifyFail('La conexión con Spotify venció. Vuelve a conectar Spotify en Configuración → Música.'));
    p.addListener('account_error', () => this.spotifyFail('Para que suene en la pantalla la cuenta de Spotify debe ser Premium.'));
    p.addListener('playback_error', () => this.spotifyMsg.set('Spotify no pudo reproducir esa canción; pasa a la siguiente.'));
    p.connect();
  }

  private spotifyFail(msg: string): void {
    this.spotifyState.set('error');
    this.spotifyMsg.set(msg);
  }

  private spotifyToken(): Promise<string | null> {
    return new Promise(resolve => {
      this.api.get<ScreenSpotify>(this.ctx.pub('/screen/spotify'), { key: this.key }).subscribe({
        next: r => {
          if (!r.canPlay || !r.token) { this.spotifyFail(r.reason ?? 'Spotify no está listo para sonar aquí.'); resolve(null); return; }
          resolve(r.token);
        },
        error: e => { this.spotifyFail(e?.error?.error ?? 'No se pudo conectar con Spotify.'); resolve(null); },
      });
    });
  }

  private loadSpotifySdk(): Promise<void> {
    if (window.Spotify?.Player) return Promise.resolve();
    return new Promise(resolve => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const s = document.createElement('script');
      s.src = 'https://sdk.scdn.co/spotify-player.js';
      document.head.appendChild(s);
    });
  }

  private syncPlayer(): void {
    const cmd = this.data()?.player;
    if (!cmd) return;
    if (!this.player) {
      this.loadApi().then(() => this.createPlayer(cmd.videoId, cmd.songId));
      return;
    }
    if (this.playerSong !== cmd.songId && this.player.loadVideoById) {
      this.playerSong = cmd.songId;
      this.player.loadVideoById(cmd.videoId);
    }
  }

  private createPlayer(videoId: string, songId: number): void {
    if (this.player) return;
    this.playerSong = songId;
    this.player = new window.YT.Player('yt-player', {
      videoId,
      playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: (e: any) => {
          e.target.playVideo();
          // Si el navegador bloqueó el sonido, se arranca en silencio y se pide un toque.
          setTimeout(() => {
            const state = e.target.getPlayerState?.();
            if (state !== 1) { this.needsTap.set(true); e.target.mute(); e.target.playVideo(); }
          }, 1500);
        },
        onStateChange: (e: any) => { if (e.data === 0) this.ended(); },
        onError: () => this.ended(),
      },
    });
  }

  /** El video terminó o no se pudo reproducir: se avisa al servidor para pasar a la siguiente. */
  private ended(): void {
    if (this.reporting || this.playerSong == null) return;
    this.reporting = true;
    this.api.post(this.ctx.pub('/screen/ended'), { key: this.key, songId: this.playerSong }).subscribe({
      complete: () => { this.reporting = false; this.refreshNow(); },
      error: () => { this.reporting = false; },
    });
  }

  private refreshNow(): void {
    this.api.get<Screen>(this.ctx.pub('/screen'), { key: this.key }).subscribe(s => {
      this.data.set(s);
      if (s.player) this.syncPlayer();
      else try { this.player?.stopVideo(); this.playerSong = null; } catch { /* */ }
    });
  }

  private loadApi(): Promise<void> {
    if (window.YT?.Player) return Promise.resolve();
    return new Promise(resolve => {
      window.onYouTubeIframeAPIReady = () => resolve();
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }

  private scheduleBanner(): void {
    const b = this.banner();
    this.bannerTimer = setTimeout(() => {
      const n = this.data()?.banners.length ?? 0;
      if (n > 1) this.bannerIndex.update(i => (i + 1) % n);
      this.scheduleBanner();
    }, Math.max(3, b?.durationSeconds ?? 10) * 1000);
  }
}
