import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api.service';
import { Toasts } from '../core/ui';
import { Dialogs } from '../shared/dialogs';
import { IconComponent } from '../shared/icon.component';
import { MascotComponent } from '../shared/mascot.component';

type Status = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

export interface PromoVideo {
  id: number; jobId?: string; kind: string; kindName?: string; format: 'vertical' | 'horizontal' | 'cuadrado'; voice: string; music: string; idea?: string;
  status: Status; progress: number; detail?: string; title?: string; caption?: string;
  script?: { shot: string; headline: string; say: string }[]; videoUrl?: string; posterUrl?: string; seconds?: number;
  createdAt: string; finishedAt?: string;
}

interface Options {
  enabled: boolean;
  kinds?: { key: string; name: string; about: string; seconds: number }[];
  formats?: { key: string; width: number; height: number }[];
  voices?: { key: string; name: string; style: string; gender?: 'male' | 'female' }[];
  music?: string[];
  voiceReady?: boolean;
  aiReady?: boolean;
}

const FORMAT_NAMES: Record<string, { name: string; where: string }> = {
  vertical: { name: 'Vertical', where: 'Reels, TikTok, estados' },
  horizontal: { name: 'Horizontal', where: 'YouTube, TV, computador' },
  cuadrado: { name: 'Cuadrado', where: 'Feed de Instagram y Facebook' },
};
const MUSIC_NAMES: Record<string, string> = {
  fiesta: 'Fiesta', lounge: 'Lounge', salsa: 'Salsa', vallenato: 'Vallenato', reggaeton: 'Reguetón', tropical: 'Tropical',
  rock: 'Rock', jazz: 'Jazz', acustico: 'Acústico', electronica: 'Electrónica', romantico: 'Romántico', urbano: 'Urbano',
  bachata: 'Bachata', merengue: 'Merengue', champeta: 'Champeta', lofi: 'Lo-fi', funk: 'Funk', bolero: 'Bolero', ninguna: 'Sin música',
};

/**
 * Estudio de videos del súper administrador: elige el tipo, el formato y la voz, escribe la idea y el estudio
 * arma un video con la copa de Brindix hablando sobre pantallas reales de la demo. La galería se actualiza sola.
 */
@Component({
  selector: 'bx-platform-videos',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent, MascotComponent],
  template: `
  <div class="page-head">
    <div><h1>Videos y publicidad</h1><p>La copa de Brindix explica el producto sobre pantallas reales de la demo. Listos para redes, WhatsApp o una reunión.</p></div>
  </div>

  @if (options(); as o) {
    @if (!o.enabled) {
      <div class="empty"><h3>El estudio no está configurado</h3><p>En el servidor corre <code>bash scripts/set-studio.sh</code> y vuelve aquí.</p></div>
    } @else {
      <section class="studio card">
        <div class="studio-head">
          <bx-mascot [size]="56" mood="party" />
          <div class="grow"><h2>Nuevo video</h2><p class="small muted">Entre 2 y 6 minutos por video. Guion por IA, voz de Fish Audio y capturas de brindix.cania.app/demo.</p></div>
          @if (!o.voiceReady) { <span class="badge red">Sin voz (FISH_API_KEY)</span> }
          @else if (!o.aiReady) { <span class="badge amber">Guion de plantilla (sin IA)</span> }
        </div>

        <div class="pick">
          <span class="lbl">Qué video</span>
          <div class="kinds" role="radiogroup" aria-label="Tipo de video">
            @for (k of o.kinds; track k.key) {
              <button type="button" role="radio" class="kind" [attr.aria-checked]="kind() === k.key" [class.on]="kind() === k.key" (click)="kind.set(k.key)">
                <bx-icon [name]="kindIcon(k.key)" [size]="18" />
                <b>{{ k.name }}</b>
                <span>{{ k.about }}</span>
                <em>~{{ k.seconds }} s</em>
              </button>
            }
          </div>
        </div>

        <div class="pick two">
          <div>
            <span class="lbl">Formatos <span class="muted">(uno o varios: sale un video por cada uno)</span></span>
            <div class="formats" role="group" aria-label="Formatos">
              @for (f of o.formats; track f.key) {
                <button type="button" role="checkbox" class="fmt" [attr.aria-checked]="hasFormat(f.key)" [class.on]="hasFormat(f.key)" (click)="toggleFormat(f.key)">
                  <i [class]="'shape ' + f.key"></i>
                  <b>{{ fmtName(f.key).name }}</b><span>{{ fmtName(f.key).where }}</span>
                  <bx-icon class="tick" name="check" [size]="14" />
                </button>
              }
            </div>
          </div>
          <div>
            <span class="lbl">Música</span>
            <div class="chips">
              @for (m of o.music; track m) {
                <button type="button" class="chip" [class.active]="music() === m" (click)="music.set(m)">{{ musicName(m) }}</button>
              }
            </div>
            <span class="lbl" style="margin-top: 14px">Voz de la copa ({{ visibleVoices().length }})</span>
            <div class="chips" role="group" aria-label="Filtrar voces">
              <button type="button" class="chip" [class.active]="voiceFilter() === 'all'" (click)="voiceFilter.set('all')">Todas</button>
              <button type="button" class="chip" [class.active]="voiceFilter() === 'male'" (click)="voiceFilter.set('male')">Hombres</button>
              <button type="button" class="chip" [class.active]="voiceFilter() === 'female'" (click)="voiceFilter.set('female')">Mujeres</button>
            </div>
            <div class="voices">
              @for (v of visibleVoices(); track v.key) {
                <div class="voice" [class.on]="voice() === v.key">
                  <button type="button" class="pick-voice" (click)="voice.set(v.key)" [attr.aria-pressed]="voice() === v.key">
                    <b>{{ v.name }}</b><span>{{ v.style }}</span>
                  </button>
                  <button type="button" class="hear" (click)="hear(v.key)" [disabled]="!o.voiceReady"
                          [attr.aria-label]="(playingVoice() === v.key ? 'Detener ' : 'Escuchar a ') + v.name" [title]="playingVoice() === v.key ? 'Detener' : 'Escuchar'">
                    @if (loadingVoice() === v.key) { <span class="dotty"></span> }
                    @else { <bx-icon [name]="playingVoice() === v.key ? 'pause' : 'play'" [size]="15" /> }
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        <label class="field">
          <span>Idea o enfoque <span class="muted">(opcional)</span></span>
          <textarea class="input" rows="2" maxlength="600" [(ngModel)]="idea" [placeholder]="ideaHint()"></textarea>
        </label>

        <div class="row between wrap foot">
          <p class="small muted">{{ activeJobs() }} pedidos en proceso · máximo 3 a la vez</p>
          <button class="btn primary lg" [disabled]="busy() || !o.voiceReady || activeJobs() >= 3 || !formats().length" (click)="create()">
            <bx-icon name="sparkles" [size]="18" /> {{ busy() ? 'Enviando…' : (formats().length > 1 ? 'Crear ' + formats().length + ' videos' : 'Crear el video') }}
          </button>
        </div>
      </section>
    }
  }

  <section class="gallery">
    @for (v of videos(); track v.id) {
      <article class="vcard" [class.done]="v.status === 'DONE'" [class.failed]="v.status === 'FAILED'">
        <div class="poster" [class]="'poster ' + v.format">
          @if (v.status === 'DONE' && v.videoUrl) {
            @if (playing() === v.id) {
              <video [src]="v.videoUrl" [poster]="v.posterUrl" controls autoplay playsinline (ended)="playing.set(null)"></video>
            } @else {
              <button type="button" class="play" (click)="playing.set(v.id)" [attr.aria-label]="'Reproducir ' + (v.title || 'video')">
                @if (v.posterUrl) { <img [src]="v.posterUrl" alt=""> }
                <span class="play-btn"><bx-icon name="play" [size]="26" /></span>
                @if (v.seconds) { <span class="dur">{{ dur(v.seconds) }}</span> }
              </button>
            }
          } @else if (v.status === 'FAILED') {
            <div class="state fail">
              <bx-icon name="triangle-alert" [size]="28" />
              <p>{{ v.detail || 'No se pudo armar el video' }}</p>
            </div>
          } @else {
            <div class="state working">
              <bx-mascot [size]="64" mood="happy" />
              <div class="bar" role="progressbar" [attr.aria-valuenow]="v.progress" aria-valuemin="0" aria-valuemax="100"><i [style.width.%]="v.progress"></i></div>
              <p>{{ v.detail || 'En cola' }} · {{ v.progress }} %</p>
            </div>
          }
        </div>
        <div class="vbody">
          <h3>{{ v.title || v.kindName || kindName(v.kind) }}</h3>
          <p class="meta tiny muted">{{ v.kindName || kindName(v.kind) }} · {{ fmtName(v.format).name }} · {{ voiceName(v.voice) }} · {{ musicName(v.music) }} · {{ v.createdAt | date: 'd MMM, HH:mm' }}</p>
          @if (v.idea) { <p class="idea small">{{ v.idea }}</p> }
          <div class="actions">
            @if (v.status === 'DONE') {
              <a class="btn sm primary" [href]="v.videoUrl" download target="_blank" rel="noopener"><bx-icon name="upload" [size]="16" /> Descargar</a>
              <button class="btn sm" (click)="copyCaption(v)"><bx-icon name="sticky-note" [size]="16" /> Copiar texto</button>
              <button class="btn sm" (click)="toggleScript(v.id)" [attr.aria-expanded]="openScript() === v.id">Guion</button>
            } @else if (v.status === 'FAILED') {
              <button class="btn sm primary" (click)="retry(v)"><bx-icon name="refresh-cw" [size]="16" /> Reintentar</button>
            }
            <button class="btn sm ghost icon-end" (click)="remove(v)" [disabled]="v.status === 'RUNNING'" aria-label="Eliminar video"><bx-icon name="x" [size]="16" /></button>
          </div>
          @if (openScript() === v.id) {
            <div class="script">
              @if (v.caption) { <p class="caption">{{ v.caption }}</p> }
              @for (s of v.script; track $index) {
                <div class="line"><b>{{ s.headline }}</b><span>{{ s.say }}</span></div>
              }
            </div>
          }
        </div>
      </article>
    } @empty {
      @if (options()?.enabled) { <div class="empty"><h3>Aún no hay videos</h3><p>Crea el primero arriba: un anuncio para redes o el tutorial del mesero.</p></div> }
    }
  </section>`,
  styles: [`
    .studio { display: flex; flex-direction: column; gap: 20px; margin-bottom: 28px; }
    .studio-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .studio-head h2 { font-size: 20px; }
    .studio-head .badge { white-space: nowrap; }
    @media (max-width: 640px) { .studio-head .badge { flex-basis: 100%; width: fit-content; } }
    .lbl { display: block; font-size: 13px; font-weight: 700; color: var(--muted); margin-bottom: 8px; }
    .pick.two { display: grid; gap: 20px; grid-template-columns: 1.3fr 1fr; }
    @media (max-width: 760px) { .pick.two { grid-template-columns: 1fr; } }
    .kinds { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
    .kind, .fmt, .voice { text-align: left; cursor: pointer; border: 1px solid var(--line-2); background: var(--bg-2); color: var(--text); border-radius: 14px;
      font-family: var(--font); transition: border-color 150ms ease, background-color 150ms ease, transform 140ms var(--ease-out); }
    .kind:hover, .fmt:hover, .voice:hover { border-color: var(--faint); }
    .kind:active, .fmt:active, .voice:active { transform: scale(.985); }
    .kind.on, .fmt.on, .voice.on { border-color: var(--amber); background: rgba(255, 178, 56, .1); }
    .kind { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 10px; padding: 12px 14px; align-items: center; }
    .kind bx-icon { grid-row: 1 / 3; color: var(--ink-amber); }
    .kind b { font-size: 14px; }
    .kind span { grid-column: 2; font-size: 12.5px; color: var(--muted); line-height: 1.35; }
    .kind em { grid-column: 2; font-style: normal; font-size: 11.5px; color: var(--faint); margin-top: 4px; font-variant-numeric: tabular-nums; }
    .formats { display: grid; gap: 8px; grid-template-columns: repeat(3, 1fr); }
    .fmt { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; text-align: center; }
    .fmt .tick { position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: var(--amber); color: #1c0f08; opacity: 0; transform: scale(.6); transition: opacity 150ms ease, transform 180ms var(--ease-out); }
    .fmt.on .tick { opacity: 1; transform: scale(1); }
    .fmt b { font-size: 13.5px; }
    .fmt span { font-size: 11.5px; color: var(--muted); line-height: 1.3; }
    .shape { display: block; border: 2px solid currentColor; border-radius: 4px; opacity: .55; }
    .fmt.on .shape { opacity: 1; color: var(--ink-amber); }
    .shape.vertical { width: 18px; height: 30px; }
    .shape.horizontal { width: 34px; height: 20px; margin: 5px 0; }
    .shape.cuadrado { width: 26px; height: 26px; margin: 2px 0; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .voices { display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
    .voice { display: flex; align-items: stretch; border-radius: 11px; overflow: hidden; }
    .pick-voice { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border: 0; background: transparent; color: inherit; text-align: left; font-family: var(--font); cursor: pointer; }
    .pick-voice b { font-size: 13px; }
    .pick-voice span { font-size: 11px; color: var(--muted); line-height: 1.3; }
    .hear { flex: none; width: 36px; border: 0; border-left: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center; transition: background-color 150ms ease, color 150ms ease; }
    .hear:hover { background: var(--surface-3); color: var(--text); }
    .hear:disabled { opacity: .4; cursor: default; }
    .voice.on .hear { color: var(--ink-amber); }
    .dotty { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--line-2); border-top-color: var(--ink-amber); animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .field textarea { resize: vertical; min-height: 56px; line-height: 1.45; }
    .foot { gap: 10px; }
    .btn bx-icon { margin-right: 6px; }

    .gallery { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }
    .vcard { border: 1px solid var(--line); border-radius: 18px; background: var(--surface); overflow: hidden; display: flex; flex-direction: column; }
    .poster { position: relative; background: #0f0d0b; aspect-ratio: 16 / 10; display: grid; place-items: center; overflow: hidden; }
    .poster.vertical { aspect-ratio: 16 / 11; }
    .poster video, .poster .play { position: absolute; inset: 0; width: 100%; height: 100%; }
    .poster video { object-fit: contain; background: #000; }
    .play { border: 0; padding: 0; background: #0f0d0b; cursor: pointer; display: grid; place-items: center; }
    .play img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .play-btn { position: relative; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.92); color: #1c0f08;
      box-shadow: 0 8px 24px rgba(0,0,0,.45); transition: transform 160ms var(--ease-out); }
    .play:hover .play-btn { transform: scale(1.06); }
    .play-btn bx-icon { margin-left: 3px; }
    .dur { position: absolute; right: 10px; bottom: 10px; padding: 2px 8px; border-radius: 99px; background: rgba(15,13,11,.8); color: #fff; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px; text-align: center; color: #f7f1ea; width: 100%; }
    .state p { font-size: 13px; color: #b5a99b; max-width: 32ch; }
    .state.fail { color: #ff8a7a; }
    .state.fail p { color: #f7f1ea; }
    .bar { width: min(220px, 80%); height: 6px; border-radius: 99px; background: rgba(255,255,255,.12); overflow: hidden; }
    .bar i { display: block; height: 100%; background: linear-gradient(90deg, #ffb238, #ff5c6c); border-radius: 99px; transition: width 600ms var(--ease-out); }
    .vbody { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; }
    .vbody h3 { font-size: 16px; line-height: 1.25; text-wrap: balance; }
    .idea { color: var(--muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
    .icon-end { margin-left: auto; }
    .script { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
    .caption { font-size: 13px; line-height: 1.45; white-space: pre-line; padding: 10px 12px; border-radius: 10px; background: var(--bg-2); }
    .line { display: grid; gap: 2px; font-size: 13px; }
    .line b { color: var(--ink-amber); }
    .line span { color: var(--muted); line-height: 1.4; }
  `],
})
export class PlatformVideosComponent implements OnInit, OnDestroy {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private dialogs = inject(Dialogs);
  options = signal<Options | null>(null);
  videos = signal<PromoVideo[]>([]);
  kind = signal('anuncio');
  formats = signal<string[]>(['vertical', 'horizontal', 'cuadrado']);
  voice = signal('H3');
  voiceFilter = signal<'all' | 'male' | 'female'>('all');
  visibleVoices = computed(() => (this.options()?.voices ?? []).filter(v => this.voiceFilter() === 'all' || v.gender === this.voiceFilter()));
  music = signal('fiesta');
  idea = '';
  busy = signal(false);
  playing = signal<number | null>(null);
  openScript = signal<number | null>(null);
  activeCount = computed(() => this.videos().filter(v => v.status === 'QUEUED' || v.status === 'RUNNING').length);
  /** Pedidos (no videos) en proceso: un clic con tres formatos es un solo pedido. */
  activeJobs = computed(() => new Set(this.videos().filter(v => v.status === 'QUEUED' || v.status === 'RUNNING').map(v => v.jobId ?? String(v.id))).size);
  playingVoice = signal<string | null>(null);
  loadingVoice = signal<string | null>(null);
  private audio: HTMLAudioElement | null = null;
  private samples = new Map<string, string>();
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.api.get<Options>('/platform/videos/options').subscribe({
      next: o => {
        this.options.set(o);
        if (o.voices?.length && !o.voices.some(v => v.key === this.voice())) this.voice.set(o.voices[0].key);
      },
      error: e => { this.options.set({ enabled: false }); this.toasts.error(errorMessage(e)); },
    });
    this.load();
    // Mientras haya videos en proceso, la galería se refresca sola (el backend pregunta al estudio cada 8 s).
    this.timer = setInterval(() => { if (this.activeCount() > 0 && !document.hidden) this.load(); }, 6000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.stopVoice();
  }

  hasFormat(key: string): boolean {
    return this.formats().includes(key);
  }

  toggleFormat(key: string): void {
    this.formats.update(f => (f.includes(key) ? f.filter(x => x !== key) : [...f, key]));
  }

  /** Reproduce la muestra de una voz (se trae una vez del estudio); el mismo botón la detiene. */
  async hear(key: string): Promise<void> {
    if (this.playingVoice() === key) { this.stopVoice(); return; }
    this.stopVoice();
    this.loadingVoice.set(key);
    try {
      let url = this.samples.get(key);
      if (!url) {
        const r = await this.api.run(this.api.get<{ url: string }>(`/platform/videos/voices/${key}/sample`));
        url = r.url;
        this.samples.set(key, url);
      }
      const a = new Audio(url);
      this.audio = a;
      a.onended = () => { if (this.audio === a) this.playingVoice.set(null); };
      await a.play();
      this.playingVoice.set(key);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.loadingVoice.set(null);
    }
  }

  private stopVoice(): void {
    try { this.audio?.pause(); } catch { /* */ }
    this.audio = null;
    this.playingVoice.set(null);
  }

  load(): void {
    this.api.get<PromoVideo[]>('/platform/videos').subscribe({ next: v => this.videos.set(v), error: () => {} });
  }

  ideaHint(): string {
    switch (this.kind()) {
      case 'anuncio': return 'Ej.: para bares de Bogotá que todavía anotan en papel; resalta las rondas por tandas y la caja cuadrada';
      case 'funcion': return 'Ej.: la música a pedido: el cliente pone su canción desde la mesa y el TV muestra lo que suena';
      default: return 'Ej.: paso a paso, con calma, para alguien que nunca ha usado un sistema';
    }
  }

  kindIcon(key: string): 'megaphone' | 'qr-code' | 'hand' | 'chart-column' | 'calculator' | 'music' | 'sparkles' {
    return ({ anuncio: 'megaphone', tutorial_cliente: 'qr-code', tutorial_mesero: 'hand', tutorial_admin: 'chart-column',
      tutorial_caja: 'calculator', tutorial_musica: 'music' } as const)[key] ?? 'sparkles';
  }

  kindName(key: string): string {
    return this.options()?.kinds?.find(k => k.key === key)?.name ?? key;
  }

  voiceName(key: string): string {
    return this.options()?.voices?.find(v => v.key === key)?.name ?? key;
  }

  fmtName(key: string): { name: string; where: string } {
    return FORMAT_NAMES[key] ?? { name: key, where: '' };
  }

  musicName(key: string): string {
    return MUSIC_NAMES[key] ?? key;
  }

  dur(s: number): string {
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
  }

  toggleScript(id: number): void {
    this.openScript.update(o => (o === id ? null : id));
  }

  async create(): Promise<void> {
    this.busy.set(true);
    try {
      const made = await this.api.run(this.api.post<PromoVideo[]>('/platform/videos', {
        kind: this.kind(), formats: this.formats(), voice: this.voice(), music: this.music(), idea: this.idea.trim() || null,
      }));
      this.videos.update(list => [...made, ...list]);
      this.idea = '';
      this.toasts.ok(made.length > 1 ? `El estudio empezó a armar ${made.length} videos. Tardan unos minutos.` : 'El estudio empezó a armar el video. Tarda unos minutos.');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async retry(v: PromoVideo): Promise<void> {
    try {
      const n = await this.api.run(this.api.post<PromoVideo[]>(`/platform/videos/${v.id}/retry`, {}));
      this.videos.update(list => [...n, ...list.filter(x => x.id !== v.id)]);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async copyCaption(v: PromoVideo): Promise<void> {
    const text = v.caption || v.title || '';
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.ok('Texto copiado para la publicación');
    } catch {
      this.toasts.error('No se pudo copiar. Abre el guion y cópialo a mano.');
    }
  }

  async remove(v: PromoVideo): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Eliminar este video', message: 'Se borra el archivo del almacenamiento y no se puede recuperar.',
      confirm: 'Eliminar video', tone: 'danger', icon: 'triangle-alert',
    });
    if (!ok) return;
    try {
      await this.api.run(this.api.delete(`/platform/videos/${v.id}`));
      this.videos.update(list => list.filter(x => x.id !== v.id));
      if (this.playing() === v.id) this.playing.set(null);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
