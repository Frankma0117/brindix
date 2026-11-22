import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api, errorMessage } from '../core/api.service';
import { Toasts } from '../core/ui';
import { Callout, Scene, StudioResponse, StudioStatus, StudioVideo, VideoSpec } from './video-studio.types';

const STATUS_LABEL: Record<StudioStatus, string> = {
  draft: 'Borrador', rendering: 'Generando…', review: 'Para revisar', approved: 'Aprobado', error: 'Con error',
};
const BASE = '/platform/video-studio';

interface Draft { id?: number; title: string; spec: VideoSpec }

/** Taller de video del súper administrador: edita el guion (escenas, recuadros), genera el mp4, lo revisa y lo aprueba. */
@Component({
  selector: 'bx-video-studio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe],
  template: `
  <div class="page-head">
    <div><h1>Taller de video</h1><p>Arma el guion con capturas reales, genera el video, revísalo y apruébalo para publicarlo.</p></div>
    @if (available() && !draft()) { <button class="btn primary" (click)="newFromTemplate()">＋ Nuevo desde plantilla</button> }
  </div>

  @if (loaded() && !available()) {
    <div class="empty"><h3>El taller de video no está conectado en este servidor.</h3></div>
  } @else if (draft()) {
    @let d = draft()!;
    <section class="card ed">
      <div class="ed-head">
        <h2>{{ d.id ? 'Editar video' : 'Nuevo video' }}</h2>
        <button type="button" class="btn" (click)="closeEditor()">Volver a la lista</button>
      </div>
      @if (current(); as c) {
        @if (c.status === 'rendering') { <p class="note">Generando el video… esto tarda unos minutos. Puedes seguir aquí.</p> }
        @if (c.status === 'error') { <p class="note bad">No se pudo generar: {{ c.detail || 'error desconocido' }}</p> }
      }

      <div class="grid2">
        <label class="field"><span>Título</span><input class="input" name="t" [(ngModel)]="draft()!.title" maxlength="120"></label>
        <label class="field"><span>Formato</span>
          <select class="input" name="f" [(ngModel)]="draft()!.spec.format">
            <option value="9x16">Vertical 9:16 (Reels, TikTok)</option>
            <option value="16x9">Horizontal 16:9 (YouTube)</option>
            <option value="1x1">Cuadrado 1:1 (Feed)</option>
          </select></label>
      </div>

      <h3 class="sec">Intro</h3>
      <div class="grid2">
        <label class="field"><span>Título de la intro</span><input class="input" name="it" [(ngModel)]="draft()!.spec.intro.title" maxlength="80"></label>
        <label class="field"><span>Subtítulo</span><input class="input" name="is" [(ngModel)]="draft()!.spec.intro.sub" maxlength="120"></label>
      </div>

      <h3 class="sec">Escenas ({{ d.spec.scenes.length }}/12)</h3>
      @for (s of d.spec.scenes; track s; let i = $index) {
        <article class="scene">
          <header class="scene-head">
            <b>Escena {{ i + 1 }}</b>
            <span class="grow"></span>
            <button type="button" class="btn sm" [disabled]="i === 0" (click)="move(i, -1)" aria-label="Subir escena">↑</button>
            <button type="button" class="btn sm" [disabled]="i === d.spec.scenes.length - 1" (click)="move(i, 1)" aria-label="Bajar escena">↓</button>
            <button type="button" class="btn sm" [disabled]="d.spec.scenes.length <= 1" (click)="removeScene(i)" aria-label="Quitar escena">Quitar</button>
          </header>
          <div class="scene-body">
            <div class="preview-col">
              <div class="preview" [class.empty-img]="!imgUrl(s.image)" (click)="placeCallout($event, s)" (keydown.enter)="$event.preventDefault()"
                   role="button" tabindex="0" [attr.aria-label]="'Vista previa de la escena ' + (i + 1) + ': clic para colocar un recuadro'">
                @if (imgUrl(s.image); as u) { <img [src]="u" alt="" draggable="false"> } @else { <span class="muted small">Elige una imagen</span> }
                @for (c of s.callouts ?? []; track c; let n = $index) {
                  <span class="dot" [style.left.%]="c.x" [style.top.%]="c.y">{{ n + 1 }}</span>
                }
              </div>
              <p class="tiny muted">Haz clic sobre la imagen para colocar un recuadro (máx. 5).</p>
            </div>
            <div class="fields">
              <label class="field"><span>Imagen</span>
                <select class="input" [name]="'im' + i" [ngModel]="s.image" (ngModelChange)="setImage(s, $event)">
                  <option value="">— elegir —</option>
                  @for (a of assets(); track a.path) { <option [value]="a.path">{{ a.path }}</option> }
                </select></label>
              <label class="field"><span>Título</span><input class="input" [name]="'st' + i" [(ngModel)]="s.title" maxlength="80"></label>
              <label class="field"><span>Subtítulo</span><input class="input" [name]="'ss' + i" [(ngModel)]="s.sub" maxlength="140"></label>
              <div class="grid2">
                <label class="field"><span>Mascota</span>
                  <select class="input" [name]="'mp' + i" [ngModel]="s.mascot?.pose ?? 'none'" (ngModelChange)="setPose(s, $event)">
                    <option value="none">Sin mascota</option><option value="wave">Saluda</option><option value="point">Señala</option>
                    <option value="celebrate">Celebra</option><option value="idle">Quieta</option>
                  </select></label>
                <label class="field"><span>Lado</span>
                  <select class="input" [name]="'ms' + i" [ngModel]="s.mascot?.side ?? 'right'" (ngModelChange)="setSide(s, $event)" [disabled]="!s.mascot || s.mascot.pose === 'none'">
                    <option value="left">Izquierda</option><option value="right">Derecha</option>
                  </select></label>
              </div>
              @for (c of s.callouts ?? []; track c; let n = $index) {
                <div class="callout-row">
                  <span class="num">{{ n + 1 }}</span>
                  <input class="input" [name]="'ct' + i + '-' + n" [(ngModel)]="c.text" maxlength="80" placeholder="Texto del recuadro" [attr.aria-label]="'Texto del recuadro ' + (n + 1)">
                  <button type="button" class="btn sm" (click)="removeCallout(s, n)" [attr.aria-label]="'Quitar recuadro ' + (n + 1)">✕</button>
                </div>
              }
            </div>
          </div>
        </article>
      }
      <button type="button" class="btn" [disabled]="d.spec.scenes.length >= 12" (click)="addScene()">＋ Agregar escena</button>

      <h3 class="sec">Cierre</h3>
      <div class="grid2">
        <label class="field"><span>Título del cierre</span><input class="input" name="ot" [(ngModel)]="draft()!.spec.outro.title" maxlength="80"></label>
        <label class="field"><span>Llamado a la acción</span><input class="input" name="oc" [(ngModel)]="draft()!.spec.outro.cta" maxlength="120"></label>
      </div>

      <div class="bar">
        <button type="button" class="btn" [disabled]="busy()" (click)="save()">Guardar</button>
        <button type="button" class="btn primary" [disabled]="busy() || !d.title.trim() || current()?.status === 'rendering'" (click)="generate()">
          {{ busy() ? 'Trabajando…' : 'Generar video' }}</button>
      </div>

      @if (current(); as c) {
        @if (c.status === 'review' || c.status === 'approved') {
          <section class="result">
            <h3 class="sec">{{ c.status === 'approved' ? 'Video aprobado' : 'Video para revisar' }}</h3>
            @if (c.status === 'review') {
              @if (videoUrl(); as u) { <video [src]="u" controls playsinline preload="metadata"></video> } @else { <p class="muted small">Cargando el video…</p> }
              <div class="bar">
                <button type="button" class="btn primary" [disabled]="busy()" (click)="approve(c)">Aprobar y subir</button>
                <button type="button" class="btn" [disabled]="busy()" (click)="discard(c)">Descartar</button>
              </div>
            } @else {
              <p>Subido a Spaces: <a [href]="c.url" target="_blank" rel="noopener">{{ c.url }}</a></p>
            }
          </section>
        }
        <div class="bar">
          @if (confirmDel() === c.id) {
            <span class="small">¿Seguro?</span>
            <button type="button" class="btn danger" [disabled]="busy()" (click)="remove(c)">Sí</button>
            <button type="button" class="btn" (click)="confirmDel.set(null)">No</button>
          } @else {
            <button type="button" class="btn" (click)="confirmDel.set(c.id)">Eliminar</button>
          }
        </div>
      }
    </section>
  } @else if (loaded()) {
    <div class="list">
      @for (v of items(); track v.id) {
        <article class="card item">
          <div class="grow">
            <b>{{ v.title }}</b>
            <p class="tiny muted">{{ v.spec.format }} · {{ v.spec.scenes.length }} escenas · {{ v.updatedAt | date: 'd MMM, HH:mm' }}</p>
            @if (v.status === 'error' && v.detail) { <p class="small bad">{{ v.detail }}</p> }
          </div>
          <span class="badge" [class.green]="v.status === 'approved'" [class.red]="v.status === 'error'" [class.amber]="v.status === 'rendering' || v.status === 'review'">{{ label(v.status) }}</span>
          <button type="button" class="btn sm" (click)="edit(v)">{{ v.status === 'review' || v.status === 'approved' ? 'Abrir' : 'Editar' }}</button>
          @if (confirmDel() === v.id) {
            <span class="small">¿Seguro?</span>
            <button type="button" class="btn sm danger" (click)="remove(v)">Sí</button>
            <button type="button" class="btn sm" (click)="confirmDel.set(null)">No</button>
          } @else {
            <button type="button" class="btn sm" (click)="confirmDel.set(v.id)">Eliminar</button>
          }
        </article>
      } @empty {
        <div class="empty"><h3>Aún no hay videos en el taller</h3><p>Crea el primero con «Nuevo desde plantilla».</p></div>
      }
    </div>
  }`,
  styles: [`
    :host { display: block; }
    .ed { display: flex; flex-direction: column; gap: 14px; }
    .ed-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .grid2 { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
    @media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
    .sec { margin: 6px 0 0; font-size: 15px; color: var(--ink-amber); }
    .note { padding: 10px 12px; border-radius: 10px; background: var(--bg-2); font-weight: 600; }
    .bad { color: var(--ink-red); font-weight: 600; }
    .scene { border: 1px solid var(--line-2); border-radius: 14px; padding: 12px; background: var(--bg-2); display: flex; flex-direction: column; gap: 10px; }
    .scene-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .scene-body { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    @media (max-width: 760px) { .scene-body { grid-template-columns: 1fr; } }
    .fields { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .preview { position: relative; width: 100%; border: 1px solid var(--line-2); border-radius: 12px; overflow: hidden; background: #0f0d0b; cursor: crosshair; min-height: 120px; display: grid; place-items: center; }
    .preview:focus-visible, .btn:focus-visible, .input:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
    .preview img { display: block; width: 100%; height: auto; user-select: none; pointer-events: none; }
    .preview .muted { padding: 30px 10px; }
    .dot, .num { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--amber); color: #1c0f08; font: 800 13px var(--font); }
    .dot { position: absolute; transform: translate(-50%, -50%); box-shadow: 0 2px 8px rgba(0,0,0,.5); pointer-events: none; }
    .callout-row { display: flex; align-items: center; gap: 8px; }
    .callout-row .input { flex: 1; min-width: 0; }
    .num { flex: none; }
    .btn, .input, select.input { min-height: 40px; }
    .btn.sm { min-height: 40px; min-width: 40px; }
    .bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    @media (max-width: 640px) { .bar .btn.primary { flex: 1 1 100%; } }
    .result video { width: 100%; max-height: 70vh; border-radius: 12px; background: #000; }
    .result { display: flex; flex-direction: column; gap: 10px; }
    .list { display: flex; flex-direction: column; gap: 10px; }
    .item { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .item .grow { min-width: 180px; }
    .danger { color: var(--ink-red); }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; scroll-behavior: auto !important; } }
  `],
})
export class VideoStudioComponent implements OnInit, OnDestroy {
  private api = inject(Api);
  private http = inject(HttpClient);
  private toasts = inject(Toasts);
  private cdr = inject(ChangeDetectorRef);

  loaded = signal(false);
  available = signal(false);
  items = signal<StudioVideo[]>([]);
  assets = signal<{ path: string }[]>([]);
  private template: VideoSpec | null = null;
  draft = signal<Draft | null>(null);
  busy = signal(false);
  confirmDel = signal<number | null>(null);
  videoUrl = signal('');
  private images = signal<Record<string, string>>({});
  private pending = new Set<string>();
  private objectUrls: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private videoFor: number | null = null;

  current = computed(() => {
    const id = this.draft()?.id;
    return id ? this.items().find(v => v.id === id) ?? null : null;
  });

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => {
      if (!document.hidden && this.items().some(v => v.status === 'rendering')) this.load();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    for (const u of this.objectUrls) URL.revokeObjectURL(u);
    this.objectUrls = [];
  }

  label(s: StudioStatus): string { return STATUS_LABEL[s] ?? s; }

  load(): void {
    this.api.get<StudioResponse>(BASE).subscribe({
      next: r => {
        this.available.set(r.available);
        this.items.set(r.items);
        this.assets.set(r.assets);
        this.template = r.template;
        this.loaded.set(true);
        this.syncCurrent();
      },
      error: e => { this.loaded.set(true); this.toasts.error(errorMessage(e)); },
    });
  }

  /** Cuando el video abierto pasa a revisión, carga su mp4; si ya no está en revisión, lo suelta. */
  private syncCurrent(): void {
    const c = this.current();
    if (c?.status === 'review') {
      if (this.videoFor !== c.id) { this.videoFor = c.id; void this.loadVideo(c.id); }
    } else if (this.videoFor !== null) { this.videoFor = null; this.videoUrl.set(''); }
  }

  private async loadVideo(id: number): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get('/api' + BASE + `/${id}/file`, { responseType: 'blob' }));
      const u = URL.createObjectURL(blob);
      this.objectUrls.push(u);
      if (this.videoFor === id) this.videoUrl.set(u);
    } catch (e) {
      this.toasts.error('No se pudo cargar el video: ' + errorMessage(e));
    }
  }

  imgUrl(path: string): string { return path ? this.images()[path] ?? '' : ''; }

  private async loadImage(path: string): Promise<void> {
    if (!path || this.images()[path] || this.pending.has(path)) return;
    this.pending.add(path);
    try {
      const blob = await firstValueFrom(this.http.get('/api' + BASE + '/asset', { params: { path }, responseType: 'blob' }));
      const u = URL.createObjectURL(blob);
      this.objectUrls.push(u);
      this.images.update(m => ({ ...m, [path]: u }));
    } catch { /* la vista previa queda vacía */ } finally { this.pending.delete(path); }
  }

  private open(d: Draft): void {
    this.confirmDel.set(null);
    this.draft.set(d);
    for (const s of d.spec.scenes) void this.loadImage(s.image);
    this.syncCurrent();
  }

  newFromTemplate(): void {
    if (!this.template) return;
    const spec = structuredClone(this.template);
    this.open({ title: 'Video nuevo', spec });
  }

  edit(v: StudioVideo): void { this.open({ id: v.id, title: v.title, spec: structuredClone(v.spec) }); }

  closeEditor(): void {
    this.draft.set(null);
    this.confirmDel.set(null);
    this.videoFor = null;
    this.videoUrl.set('');
  }

  private touch(): void { this.draft.update(d => (d ? { ...d } : d)); this.cdr.markForCheck(); }

  addScene(): void {
    const d = this.draft();
    if (!d || d.spec.scenes.length >= 12) return;
    const first = this.assets()[0]?.path ?? '';
    d.spec.scenes.push({ image: first, title: '', sub: '', callouts: [], mascot: { pose: 'none', side: 'right' } });
    void this.loadImage(first);
    this.touch();
  }

  removeScene(i: number): void {
    const d = this.draft();
    if (!d || d.spec.scenes.length <= 1) return;
    d.spec.scenes.splice(i, 1);
    this.touch();
  }

  move(i: number, dir: -1 | 1): void {
    const d = this.draft();
    const j = i + dir;
    if (!d || j < 0 || j >= d.spec.scenes.length) return;
    [d.spec.scenes[i], d.spec.scenes[j]] = [d.spec.scenes[j], d.spec.scenes[i]];
    this.touch();
  }

  setImage(s: Scene, path: string): void { s.image = path; void this.loadImage(path); this.touch(); }
  setPose(s: Scene, pose: string): void { s.mascot = { pose: pose as never, side: s.mascot?.side ?? 'right' }; this.touch(); }
  setSide(s: Scene, side: string): void { s.mascot = { pose: s.mascot?.pose ?? 'none', side: side as 'left' | 'right' }; this.touch(); }

  placeCallout(ev: MouseEvent, s: Scene): void {
    const el = ev.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    if (!s.image || !r.width || !r.height) return;
    s.callouts ??= [];
    if (s.callouts.length >= 5) { this.toasts.error('Máximo 5 recuadros por escena'); return; }
    const pct = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
    const c: Callout = { x: pct(((ev.clientX - r.left) / r.width) * 100), y: pct(((ev.clientY - r.top) / r.height) * 100), text: '' };
    s.callouts.push(c);
    this.touch();
  }

  removeCallout(s: Scene, n: number): void { s.callouts?.splice(n, 1); this.touch(); }

  /** Guarda (crea o actualiza) y devuelve el id. */
  private async persist(): Promise<number | null> {
    const d = this.draft();
    if (!d) return null;
    const body = { title: d.title.trim() || 'Video sin título', spec: d.spec };
    const saved = d.id
      ? await this.api.run(this.api.put<StudioVideo>(`${BASE}/${d.id}`, body))
      : await this.api.run(this.api.post<StudioVideo>(BASE, body));
    const id = saved?.id ?? d.id ?? null;
    if (id && !d.id) this.draft.update(x => (x ? { ...x, id } : x));
    return id;
  }

  async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.persist();
      this.toasts.ok('Video guardado');
      this.load();
    } catch (e) { this.toasts.error(errorMessage(e)); } finally { this.busy.set(false); }
  }

  async generate(): Promise<void> {
    this.busy.set(true);
    try {
      const id = await this.persist();
      if (!id) return;
      await this.api.run(this.api.post(`${BASE}/${id}/render`, {}));
      this.toasts.ok('Empezó a generarse el video. Tarda unos minutos.');
      this.load();
    } catch (e) { this.toasts.error(errorMessage(e)); } finally { this.busy.set(false); }
  }

  async approve(v: StudioVideo): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.run(this.api.post(`${BASE}/${v.id}/approve`, {}));
      this.toasts.ok('Video aprobado y subido a Spaces');
      this.load();
    } catch (e) { this.toasts.error(errorMessage(e)); } finally { this.busy.set(false); }
  }

  async discard(v: StudioVideo): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.run(this.api.post(`${BASE}/${v.id}/discard`, {}));
      this.toasts.ok('Video descartado: vuelve a borrador');
      this.load();
    } catch (e) { this.toasts.error(errorMessage(e)); } finally { this.busy.set(false); }
  }

  async remove(v: StudioVideo): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.run(this.api.delete(`${BASE}/${v.id}`));
      this.confirmDel.set(null);
      if (this.draft()?.id === v.id) this.closeEditor();
      this.toasts.ok('Video eliminado');
      this.load();
    } catch (e) { this.toasts.error(errorMessage(e)); } finally { this.busy.set(false); }
  }
}
