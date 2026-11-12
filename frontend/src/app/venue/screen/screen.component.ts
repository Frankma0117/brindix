import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
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
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; }
}

/**
 * Pantalla del TV del bar: lo que suena, lo que sigue y publicidad rotando.
 * Con /pantalla?k=<llave> y el bar en modo YouTube, además reproduce la cola.
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

  banner = computed<Banner | null>(() => {
    const list = this.data()?.banners ?? [];
    return list.length ? list[this.bannerIndex() % list.length] : null;
  });
  now = computed(() => this.data()?.music.nowPlaying ?? null);
  upNext = computed(() => (this.data()?.music.upNext ?? []).slice(0, 5));
  youtube = computed(() => !!this.data()?.controller && this.data()?.music.provider === 'YOUTUBE');
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
    });
    timer(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.clock.set(new Date());
      const np = this.now();
      this.progress.set(np?.playing === false ? this.progressBase.ms : this.progressBase.ms + (Date.now() - this.progressBase.at));
    });
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.bannerTimer);
      try { this.player?.destroy(); } catch { /* */ }
    });
  }

  fullscreen(): void {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  /** Los navegadores no dejan sonar sin un toque: el primer toque activa la música. */
  start(): void {
    this.needsTap.set(false);
    this.fullscreen();
    if (this.player?.unMute) {
      this.player.unMute();
      this.player.playVideo();
    }
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
