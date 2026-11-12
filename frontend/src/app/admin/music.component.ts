import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap, timer } from 'rxjs';
import { Api, errorMessage } from '../core/api.service';
import { Queue, Song, Track } from '../core/models';
import { AgoPipe, Toasts, duration } from '../core/ui';
import { MascotComponent } from '../shared/mascot.component';

interface SpotifyStatus { configured: boolean; connected: boolean; account: string; redirectUri: string; }

@Component({
  selector: 'bx-music',
  standalone: true,
  imports: [FormsModule, AgoPipe, MascotComponent],
  templateUrl: './music.component.html',
  styles: [`
    .layout { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; }
    @media (max-width: 980px) { .layout { grid-template-columns: 1fr; } }
    .now { display: flex; gap: 16px; align-items: center; }
    .cover { width: 110px; height: 110px; border-radius: 16px; overflow: hidden; flex: none; background: var(--surface-2); display: grid; place-items: center; }
    .cover img { width: 100%; height: 100%; object-fit: cover; }
    .controls { margin-top: 12px; }
    .song { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .song:last-child { border-bottom: 0; }
    .song img, .ph { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex: none; background: var(--surface-2); display: grid; place-items: center; color: var(--faint); }
    .pos { width: 22px; text-align: center; color: var(--faint); font-weight: 800; }
    .acts { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
    .sec { margin: 0 0 10px; }
    .spot { border-color: rgba(30,215,96,.35); }
    .spot-btn { background: #1ed760; color: #06210f; border-color: transparent; font-weight: 800; }
    ol { list-style: decimal; padding-left: 18px; }
    code { background: var(--bg-2); padding: 2px 6px; border-radius: 6px; font-size: 12.5px; word-break: break-all; }
  `],
})
export class MusicComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  queue = signal<Queue | null>(null);
  history = signal<Song[]>([]);
  spotify = signal<SpotifyStatus | null>(null);
  tracks = signal<Track[]>([]);
  q = '';
  manualTitle = '';
  manualArtist = '';
  private search$ = new Subject<string>();
  duration = duration;

  ngOnInit(): void {
    const result = this.route.snapshot.queryParamMap.get('spotify');
    if (result === 'ok') this.toasts.ok('¡Spotify conectado!');
    if (result === 'error') this.toasts.error('No se pudo conectar Spotify. Revisa la guía e intenta otra vez.');
    this.loadSpotify();
    this.loadHistory();
    timer(0, 4000).pipe(
      switchMap(() => this.api.get<Queue>('/admin/music/queue').pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(q => q && this.queue.set(q));
    this.search$.pipe(
      debounceTime(350),
      switchMap(q => q.trim().length < 2 ? of([]) : this.api.get<Track[]>('/admin/music/search', { q }).pipe(catchError(() => of([])))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(t => this.tracks.set(t));
  }

  loadSpotify(): void {
    this.api.get<SpotifyStatus>('/admin/spotify/status').subscribe(s => this.spotify.set(s));
  }

  loadHistory(): void {
    this.api.get<Song[]>('/admin/music/history', { hours: 12 }).subscribe(h => this.history.set(h));
  }

  onSearch(q: string): void {
    this.q = q;
    this.search$.next(q);
  }

  async act(s: Song, action: string): Promise<void> {
    await this.post(`/admin/music/songs/${s.id}/${action}`);
  }

  async next(): Promise<void> {
    await this.post('/admin/music/next');
    this.loadHistory();
  }

  async stop(): Promise<void> {
    await this.post('/admin/music/stop');
    this.loadHistory();
  }

  async player(action: 'pause' | 'play'): Promise<void> {
    await this.post(`/admin/spotify/${action}`);
  }

  async addTrack(t: Track, next: boolean): Promise<void> {
    await this.post(`/admin/music/songs?next=${next}`, { title: t.title, artist: t.artist, spotifyUri: t.uri, albumImage: t.image, durationMs: t.durationMs });
    this.q = '';
    this.tracks.set([]);
  }

  async addManual(next: boolean): Promise<void> {
    if (!this.manualTitle.trim()) return;
    await this.post(`/admin/music/songs?next=${next}`, { title: this.manualTitle.trim(), artist: this.manualArtist.trim() || null });
    this.manualTitle = '';
    this.manualArtist = '';
  }

  async connect(): Promise<void> {
    try {
      const { url } = await this.api.run(this.api.get<{ url: string }>('/admin/spotify/authorize'));
      location.href = url;
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async disconnect(): Promise<void> {
    if (!confirm('¿Desconectar la cuenta de Spotify?')) return;
    await this.post('/admin/spotify/disconnect');
    this.loadSpotify();
  }

  private async post(path: string, body?: unknown): Promise<void> {
    try {
      await this.api.run(this.api.post(path, body));
      this.queue.set(await this.api.run(this.api.get<Queue>('/admin/music/queue')));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
