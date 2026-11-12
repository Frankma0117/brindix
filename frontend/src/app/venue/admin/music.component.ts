import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap, timer } from 'rxjs';
import { Api, errorMessage } from '../../core/api.service';
import { Queue, Song, Track } from '../../core/models';
import { AgoPipe, Toasts, duration } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { MascotComponent } from '../../shared/mascot.component';
import { IconComponent } from '../../shared/icon.component';

/** Control de la cola de música. La conexión con Spotify/YouTube se hace en Configuración. */
@Component({
  selector: 'bx-music',
  standalone: true,
  imports: [IconComponent, FormsModule, RouterLink, AgoPipe, MascotComponent],
  template: `
  <div class="page-head">
    <div><h1>Música</h1><p>Tú decides el orden: prioriza, mueve o quita lo que piden las mesas.</p></div>
    <div class="row">
      <span class="badge" [class.green]="queue()?.provider !== 'MANUAL'">{{ providerName() }}</span>
      <a class="btn sm" routerLink="../configuracion" fragment="musica">Configurar</a>
      <a class="btn sm" [href]="'/' + ctx.slug() + '/pantalla'" target="_blank"><bx-icon name="tv" /> Pantalla</a>
    </div>
  </div>

  <div class="layout">
    <div class="col gap-lg">
      <div class="card glow">
        <div class="now">
          <div class="cover">@if (queue()?.nowPlaying?.image) { <img [src]="queue()!.nowPlaying!.image" alt=""> } @else { <bx-mascot [size]="70" mood="party" /> }</div>
          <div class="grow">
            <span class="badge pink">{{ queue()?.nowPlaying ? (queue()!.nowPlaying!.playing ? 'Sonando' : 'En pausa') : 'Nada sonando' }}</span>
            <h2 class="ellipsis">{{ queue()?.nowPlaying?.title ?? '—' }}</h2>
            <p class="muted ellipsis">{{ queue()?.nowPlaying?.artist }}</p>
            @if (queue()?.nowPlaying?.tableName) { <p class="tiny faint">Pedida por {{ queue()!.nowPlaying!.requestedBy || queue()!.nowPlaying!.tableName }}</p> }
          </div>
        </div>
        <div class="row wrap controls">
          <button class="btn primary" (click)="post('/admin/music/next')"><bx-icon name="skip-forward" /> Siguiente de la lista</button>
          @if (queue()?.provider === 'SPOTIFY' && queue()?.spotifyConnected) {
            <button class="btn" (click)="post('/admin/spotify/player/pause')"><bx-icon name="pause" /> Pausa</button>
            <button class="btn" (click)="post('/admin/spotify/player/play')"><bx-icon name="play" /> Reanudar</button>
          } @else {
            <button class="btn" (click)="post('/admin/music/stop')"><bx-icon name="square" /> Terminar actual</button>
          }
        </div>
        <p class="tiny faint hint">
          @switch (queue()?.provider) {
            @case ('YOUTUBE') { YouTube: la pantalla del bar reproduce la cola sola. Ábrela desde Configuración → Pantalla (enlace con llave). }
            @case ('SPOTIFY') { Spotify: abre la <b>Pantalla</b> del TV (enlace con llave en Configuración) y toca «Activar la música»: esa pantalla es el parlante y Brindix le manda la cola. También sirve Spotify abierto en el computador del bar. }
            @default { Modo manual: pon la canción en tu reproductor y pulsa «Siguiente» para que la pantalla muestre la que sigue. }
          }
        </p>
      </div>

      @if (queue()?.pending?.length) {
        <div class="card" style="border-color: rgba(255,79,139,.45)">
          <h3 class="sec">Por aprobar ({{ queue()!.pending.length }})</h3>
          @for (s of queue()!.pending; track s.id) {
            <div class="song">
              @if (s.albumImage) { <img [src]="s.albumImage" alt=""> } @else { <span class="ph">♪</span> }
              <div class="grow"><p class="strong ellipsis">{{ s.title }}</p><p class="small muted ellipsis">{{ s.artist }} · {{ s.tableName }} @if (s.requestedBy) { ({{ s.requestedBy }}) } · {{ s.createdAt | ago }}</p></div>
              <div class="acts"><button class="btn xs danger" (click)="act(s, 'reject')">No</button><button class="btn xs success" (click)="act(s, 'approve')">Aprobar</button></div>
            </div>
          }
        </div>
      }

      <div class="card">
        <h3 class="sec">En cola ({{ queue()?.upNext?.length ?? 0 }})</h3>
        @for (s of queue()?.upNext ?? []; track s.id; let i = $index; let last = $last) {
          <div class="song">
            <span class="pos">{{ i + 1 }}</span>
            @if (s.albumImage) { <img [src]="s.albumImage" alt=""> } @else { <span class="ph">♪</span> }
            <div class="grow">
              <p class="strong ellipsis">@if (s.pinned) { <bx-icon name="pin" /> }{{ s.title }}</p>
              <p class="small muted ellipsis">{{ s.artist }} · {{ s.tableName || s.requestedBy || 'Bar' }} @if (s.durationMs) { · {{ duration(s.durationMs) }} }
                @if (s.sentToPlayer) { · <span class="badge teal">En Spotify</span> } @if (s.provider === 'MANUAL' && queue()?.provider !== 'MANUAL') { · <span class="badge">manual</span> }</p>
            </div>
            <div class="acts">
              <button class="btn xs" [disabled]="i === 0" (click)="act(s, 'top')" title="Que suene después" aria-label="Que suene después"><bx-icon name="chevrons-up" /></button>
              <button class="btn xs" [disabled]="i === 0" (click)="act(s, 'up')" title="Subir">▲</button>
              <button class="btn xs" [disabled]="last" (click)="act(s, 'down')" title="Bajar">▼</button>
              <button class="btn xs" (click)="act(s, 'pin')" title="Fijar" aria-label="Fijar"><bx-icon name="pin" /></button>
              <button class="btn xs danger" (click)="act(s, 'remove')" title="Quitar" aria-label="Quitar"><bx-icon name="x" /></button>
            </div>
          </div>
        } @empty { <p class="muted">La cola está vacía. Las mesas pueden pedir desde su QR.</p> }
      </div>

      <div class="card">
        <h3 class="sec">Sonaron en las últimas 12 horas</h3>
        @for (s of history(); track s.id) {
          <div class="song"><div class="grow"><p class="ellipsis">{{ s.title }} <span class="muted">· {{ s.artist }}</span></p></div><span class="tiny faint">{{ s.tableName }}</span></div>
        } @empty { <p class="muted small">Todavía nada.</p> }
      </div>
    </div>

    <div class="card add">
      <h3 class="sec">Agregar canción</h3>
      @if (queue()?.searchEnabled) {
        <label class="search"><input class="input" [placeholder]="queue()?.provider === 'YOUTUBE' ? 'Buscar en YouTube' : 'Buscar en Spotify'" [ngModel]="q" (ngModelChange)="onSearch($event)"></label>
        @for (t of tracks(); track t.ref) {
          <div class="song">
            @if (t.image) { <img [src]="t.image" alt=""> }
            <div class="grow"><p class="strong ellipsis">{{ t.title }}</p><p class="small muted ellipsis">{{ t.artist }}</p></div>
            <div class="acts"><button class="btn xs" (click)="addTrack(t, false)">A la cola</button><button class="btn xs primary" (click)="addTrack(t, true)">Siguiente</button></div>
          </div>
        }
      }
      <p class="tiny muted" style="margin-top: 12px">O escríbela a mano:</p>
      <div class="col" style="margin-top: 6px">
        <input class="input" [(ngModel)]="manualTitle" placeholder="Canción">
        <input class="input" [(ngModel)]="manualArtist" placeholder="Artista">
        <div class="row"><button class="btn grow" (click)="addManual(false)" [disabled]="!manualTitle.trim()">A la cola</button><button class="btn primary grow" (click)="addManual(true)" [disabled]="!manualTitle.trim()">Que suene después</button></div>
      </div>
    </div>
  </div>`,
  styles: [`
    .layout { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); align-items: start; }
    @media (max-width: 980px) { .layout { grid-template-columns: 1fr; } }
    .now { display: flex; gap: 16px; align-items: center; }
    .cover { width: 110px; height: 110px; border-radius: 16px; overflow: hidden; flex: none; background: var(--surface-2); display: grid; place-items: center; }
    .cover img { width: 100%; height: 100%; object-fit: cover; }
    .controls { margin-top: 12px; }
    .hint { margin-top: 10px; }
    .song { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .song:last-child { border-bottom: 0; }
    .song img, .ph { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; flex: none; background: var(--surface-2); display: grid; place-items: center; color: var(--faint); }
    .pos { width: 22px; text-align: center; color: var(--faint); font-weight: 800; }
    .acts { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
    .sec { margin: 0 0 10px; }
    .add { position: sticky; top: 16px; }
  `],
})
export class MusicComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private destroyRef = inject(DestroyRef);
  ctx = inject(VenueContext);

  queue = signal<Queue | null>(null);
  history = signal<Song[]>([]);
  tracks = signal<Track[]>([]);
  q = '';
  manualTitle = '';
  manualArtist = '';
  private search$ = new Subject<string>();
  duration = duration;

  providerName(): string {
    return { SPOTIFY: 'Spotify', YOUTUBE: 'YouTube', MANUAL: 'Manual' }[this.queue()?.provider ?? 'MANUAL'];
  }

  ngOnInit(): void {
    this.api.get<Song[]>('/admin/music/history', { hours: 12 }).subscribe(h => this.history.set(h));
    timer(0, 4000).pipe(
      switchMap(() => this.api.get<Queue>('/admin/music/queue').pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(q => q && this.queue.set(q));
    this.search$.pipe(
      debounceTime(400),
      switchMap(q => q.trim().length < 2 ? of([]) : this.api.get<Track[]>('/admin/music/search', { q }).pipe(catchError(e => { this.toasts.error(errorMessage(e)); return of([]); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(t => this.tracks.set(t));
  }

  onSearch(q: string): void {
    this.q = q;
    this.search$.next(q);
  }

  async act(s: Song, action: string): Promise<void> {
    await this.post(`/admin/music/songs/${s.id}/${action}`);
  }

  async addTrack(t: Track, next: boolean): Promise<void> {
    await this.post(`/admin/music/songs?next=${next}`, { title: t.title, artist: t.artist, ref: t.ref, albumImage: t.image, durationMs: t.durationMs });
    this.q = '';
    this.tracks.set([]);
  }

  async addManual(next: boolean): Promise<void> {
    if (!this.manualTitle.trim()) return;
    await this.post(`/admin/music/songs?next=${next}`, { title: this.manualTitle.trim(), artist: this.manualArtist.trim() || null });
    this.manualTitle = '';
    this.manualArtist = '';
  }

  async post(path: string, body?: unknown): Promise<void> {
    try {
      await this.api.run(this.api.post(path, body));
      this.queue.set(await this.api.run(this.api.get<Queue>('/admin/music/queue')));
      this.api.get<Song[]>('/admin/music/history', { hours: 12 }).subscribe(h => this.history.set(h));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
