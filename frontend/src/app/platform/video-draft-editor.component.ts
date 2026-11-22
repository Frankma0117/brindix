import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api, errorMessage } from '../core/api.service';
import { Toasts } from '../core/ui';
import { IconComponent } from '../shared/icon.component';
import type { PromoVideo } from './videos.component';

interface Callout { text: string; x: number; y: number }
interface Scene {
  image: string; title: string; sub?: string; seconds?: number | null; say?: string;
  callouts: Callout[]; mascot: { pose: string; side: string };
}
interface Spec {
  guide?: boolean;
  intro: { title: string; sub?: string; seconds?: number; say?: string };
  scenes: Scene[];
  outro: { title: string; cta: string; seconds?: number; say?: string };
  [k: string]: unknown;
}

/** Editor del borrador de un video con recuadros: guion, previa y aprobación. */
@Component({
  selector: 'bx-video-draft',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="draft">
      @if (video.status === 'PREVIEWING' || video.status === 'RUNNING') {
        <p class="grabando small"><bx-icon name="refresh-cw" [size]="16" /> Grabando… {{ video.detail }}. Puede tardar unos minutos.</p>
      }

      @if (video.status === 'REVIEW') {
        <div class="preview">
          @if (previewUrl(); as u) {
            <video [src]="u" controls playsinline preload="metadata"></video>
          } @else if (previewError()) {
            <p class="small muted">{{ previewError() }}</p>
          } @else {
            <p class="small muted">Cargando la versión previa…</p>
          }
          <p class="small muted">Es una versión rápida y de menor calidad. Si te gusta, apruébala para generar la final.</p>
        </div>
      }

      @if (editable()) {
        <button type="button" class="btn sm" (click)="open.set(!open())" [attr.aria-expanded]="open()">
          <bx-icon name="pencil" [size]="16" /> {{ open() ? 'Ocultar guion' : 'Revisar y corregir el guion' }}
        </button>

        @if (open() && draft) {
          @if (video.status === 'REVIEW') {
            <p class="warn small">Al guardar, la previa se descarta y hay que grabarla de nuevo.</p>
          }
          <div class="form">
            <fieldset>
              <legend>Intro</legend>
              <label>Título<input type="text" maxlength="50" [(ngModel)]="draft.intro.title"></label>
              <label>Subtítulo<input type="text" maxlength="90" [(ngModel)]="draft.intro.sub"></label>
              <label>Lo que dice la mascota<textarea rows="2" maxlength="300" [(ngModel)]="draft.intro.say" [placeholder]="introSay()"></textarea></label>
            </fieldset>

            <fieldset>
              <legend>Voz y música de la versión final</legend>
              <label>Voz
                <select [ngModel]="voice" (ngModelChange)="voice = $event; audioDirty = true">
                  <option value="">Sin voz (solo música)</option>
                  @for (v of voices(); track v.key) { <option [value]="v.key">{{ v.name }} · {{ v.style }}</option> }
                </select>
              </label>
              <label>Música
                <select [ngModel]="music" (ngModelChange)="music = $event; audioDirty = true">
                  <option value="">Ninguna</option>
                  @for (m of musics(); track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </label>
              <p class="small muted">Se guardan al guardar o grabar. La previa siempre va muda.</p>
            </fieldset>

            <label class="guide-opt"><input type="checkbox" [(ngModel)]="draft.guide"> Guía paso a paso (insignia «Paso N de M» y barra de progreso)</label>

            @for (s of draft.scenes; track s; let i = $index) {
              <fieldset>
                <legend>Escena {{ i + 1 }}</legend>
                <label>Imagen
                  <select [(ngModel)]="s.image">
                    @if (!hasAsset(s.image)) { <option [ngValue]="s.image">{{ short(s.image) }}</option> }
                    @for (a of assets; track a) { <option [ngValue]="a">{{ short(a) }}</option> }
                  </select>
                </label>
                <label>Título<input type="text" maxlength="60" [(ngModel)]="s.title"></label>
                <label>Subtítulo<input type="text" maxlength="90" [(ngModel)]="s.sub"></label>
                <label>Lo que dice la mascota<textarea rows="2" maxlength="300" [(ngModel)]="s.say" [placeholder]="sceneSay(s)"></textarea></label>
                <div class="row">
                  <label>Segundos (opcional)<input type="number" min="1.5" max="15" step="0.5" [(ngModel)]="s.seconds"></label>
                  <label>Mascota
                    <select [(ngModel)]="s.mascot.pose">
                      <option value="none">Sin mascota</option>
                      <option value="wave">Saluda</option>
                      <option value="point">Señala</option>
                      <option value="celebrate">Celebra</option>
                    </select>
                  </label>
                  <label>Lado
                    <select [(ngModel)]="s.mascot.side">
                      <option value="left">Izquierda</option>
                      <option value="right">Derecha</option>
                    </select>
                  </label>
                </div>

                <div class="callouts">
                  <span class="lbl">Recuadros ({{ s.callouts.length }}/5)</span>
                  @for (c of s.callouts; track c; let j = $index) {
                    <div class="callout">
                      <input type="text" maxlength="60" placeholder="Texto del recuadro" [(ngModel)]="c.text" [attr.aria-label]="'Texto del recuadro ' + (j + 1)">
                      <label class="num">X %<input type="number" min="0" max="100" [(ngModel)]="c.x"></label>
                      <label class="num">Y %<input type="number" min="0" max="100" [(ngModel)]="c.y"></label>
                      <button type="button" class="btn sm ghost" (click)="s.callouts.splice(j, 1)" aria-label="Quitar recuadro"><bx-icon name="x" [size]="16" /></button>
                    </div>
                  }
                  @if (s.callouts.length < 5) {
                    <button type="button" class="btn sm" (click)="s.callouts.push({ text: '', x: 50, y: 50 })"><bx-icon name="plus" [size]="16" /> Añadir recuadro</button>
                  }
                </div>

                <button type="button" class="btn sm ghost danger" [disabled]="draft.scenes.length <= 1" (click)="draft.scenes.splice(i, 1)">Quitar esta escena</button>
              </fieldset>
            }
            @if (draft.scenes.length < 12) {
              <button type="button" class="btn sm" (click)="addScene()"><bx-icon name="plus" [size]="16" /> Añadir escena</button>
            }

            <fieldset>
              <legend>Cierre</legend>
              <label>Título<input type="text" maxlength="60" [(ngModel)]="draft.outro.title"></label>
              <label>Llamado a la acción<input type="text" maxlength="60" [(ngModel)]="draft.outro.cta"></label>
              <label>Lo que dice la mascota<textarea rows="2" maxlength="300" [(ngModel)]="draft.outro.say" [placeholder]="outroSay()"></textarea></label>
            </fieldset>
          </div>
        }

        <div class="actions">
          @if (open()) {
            <button type="button" class="btn sm" [disabled]="busy()" (click)="save()">Guardar cambios</button>
          }
          @if (video.status === 'DRAFT') {
            <button type="button" class="btn sm primary" [disabled]="busy()" (click)="preview()"><bx-icon name="play" [size]="16" /> Grabar versión previa</button>
          }
          @if (video.status === 'REVIEW') {
            <button type="button" class="btn sm primary" [disabled]="busy()" (click)="approve()"><bx-icon name="check" [size]="16" /> Aprobar y generar versión final</button>
            @if (voice) { <span class="small muted">Genera la voz con Fish (tiene costo).</span> }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .draft { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .grabando { display: flex; align-items: center; gap: 8px; color: var(--muted); }
    .preview video { width: 100%; max-height: 360px; border-radius: 12px; background: #000; }
    .warn { color: var(--amber, #b45309); background: color-mix(in srgb, var(--amber, #f59e0b) 14%, transparent); padding: 8px 10px; border-radius: 10px; }
    .form { display: flex; flex-direction: column; gap: 12px; }
    fieldset { border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    legend { font-weight: 700; font-size: 13px; padding: 0 6px; }
    label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--muted); min-width: 0; }
    label.guide-opt { flex-direction: row; align-items: center; gap: 8px; } label.guide-opt input { width: auto; }
    textarea { font: inherit; font-size: 14px; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; width: 100%; box-sizing: border-box; resize: vertical; }
    input, select { font: inherit; font-size: 14px; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; min-width: 0; width: 100%; box-sizing: border-box; }
    .row { display: grid; grid-template-columns: 1fr; gap: 8px; }
    @media (min-width: 560px) { .row { grid-template-columns: repeat(3, 1fr); } }
    .callouts { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
    .callouts .lbl { font-size: 12px; color: var(--muted); }
    .callout { display: grid; grid-template-columns: 1fr 64px 64px auto; gap: 6px; align-items: end; width: 100%; }
    .callout > input[type=text] { grid-column: 1 / -1; }
    @media (min-width: 560px) { .callout { grid-template-columns: 1fr 70px 70px auto; } .callout > input[type=text] { grid-column: auto; } }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  `],
})
export class VideoDraftEditorComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) video!: PromoVideo;
  @Input() assets: string[] = [];
  @Output() changed = new EventEmitter<PromoVideo>();
  @Output() removed = new EventEmitter<void>();

  private api = inject(Api);
  private http = inject(HttpClient);
  private toasts = inject(Toasts);

  draft: Spec | null = null;
  open = signal(false);
  busy = signal(false);
  previewUrl = signal<string | null>(null);
  previewError = signal('');
  private loadedKey = '';
  voice = '';
  music = '';
  audioDirty = false;
  voices = signal<{ key: string; name: string; style: string }[]>([]);
  musics = signal<string[]>([]);

  introSay(): string { return [this.draft?.intro.title, this.draft?.intro.sub].filter(Boolean).join('. '); }
  outroSay(): string { return [this.draft?.outro.title, this.draft?.outro.cta].filter(Boolean).join('. '); }
  sceneSay(s: Scene): string { return [s.title, s.sub, ...s.callouts.map(c => c.text)].filter(Boolean).join('. '); }

  private async loadOptions(): Promise<void> {
    if (this.voices().length || this.musics().length) return;
    try {
      const o = await this.api.run(this.api.get<{ voices?: { key: string; name: string; style: string }[]; music?: string[] }>('/platform/videos/options'));
      this.voices.set(o.voices ?? []);
      this.musics.set(o.music ?? []);
    } catch { /* sin opciones: los selects quedan en "sin voz / ninguna" */ }
  }

  editable(): boolean { return this.video.status === 'DRAFT' || this.video.status === 'REVIEW'; }
  hasAsset(p: string): boolean { return this.assets.includes(p); }
  short(p: string): string { return (p.split('/').pop() ?? p).replace(/^frontend_public_demo-assets_/, ''); }

  ngOnChanges(_c: SimpleChanges): void {
    // El borrador local solo se reinicia al cambiar de video o de etapa; así el refresco automático no pisa lo que se está escribiendo.
    const key = `${this.video.id}:${this.video.status}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    this.voice = this.video.voice ?? '';
    this.music = this.video.music ?? '';
    this.audioDirty = false;
    if (this.editable()) void this.loadOptions();
    this.draft = this.video.spec ? (JSON.parse(JSON.stringify(this.video.spec)) as Spec) : null;
    this.revokePreview();
    if (this.video.status === 'REVIEW') void this.loadPreview(this.video.id);
  }

  ngOnDestroy(): void { this.revokePreview(); }

  private revokePreview(): void {
    const u = this.previewUrl();
    if (u) URL.revokeObjectURL(u);
    this.previewUrl.set(null);
    this.previewError.set('');
  }

  private async loadPreview(id: number): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`/api/platform/videos/${id}/preview`, { responseType: 'blob' }));
      if (this.video.id !== id || this.video.status !== 'REVIEW') return;
      this.previewUrl.set(URL.createObjectURL(blob));
    } catch {
      this.previewError.set('No se pudo cargar la versión previa. Vuelve a abrir la sección en unos segundos.');
    }
  }

  addScene(): void {
    const first = this.assets[0] ?? this.draft?.scenes[0]?.image ?? '';
    this.draft?.scenes.push({ image: first, title: 'Nueva escena', sub: '', seconds: null, callouts: [], mascot: { pose: 'none', side: 'right' } });
  }

  /** Copia limpia del borrador: sin textos vacíos opcionales ni segundos en blanco. */
  private clean(): Spec {
    const d = JSON.parse(JSON.stringify(this.draft)) as Spec;
    if (!d.intro.sub) delete d.intro.sub;
    if (!d.intro.say?.trim()) delete d.intro.say;
    if (!d.outro.say?.trim()) delete d.outro.say;
    for (const s of d.scenes) {
      if (!s.sub) delete s.sub;
      if (s.seconds === null || s.seconds === undefined || (s.seconds as unknown) === '') delete s.seconds;
      if (!s.say?.trim()) delete s.say;
      for (const c of s.callouts) { c.x = Number(c.x); c.y = Number(c.y); }
    }
    return d;
  }

  private async persistAudio(): Promise<void> {
    if (!this.audioDirty) return;
    const v = await this.api.run(this.api.put<PromoVideo>(`/platform/videos/${this.video.id}/audio`, { voice: this.voice, music: this.music }));
    this.audioDirty = false;
    this.changed.emit(v);
  }

  private async persist(): Promise<boolean> {
    if (!this.draft) return true;
    try {
      await this.persistAudio();
      const v = await this.api.run(this.api.put<PromoVideo>(`/platform/videos/${this.video.id}/spec`, { spec: this.clean() }));
      this.changed.emit(v);
      return true;
    } catch (e) {
      this.toasts.error(errorMessage(e));
      return false;
    }
  }

  async save(): Promise<void> {
    this.busy.set(true);
    if (await this.persist()) this.toasts.ok('Cambios guardados.');
    this.busy.set(false);
  }

  async preview(): Promise<void> {
    this.busy.set(true);
    try {
      if (this.open() && !(await this.persist())) return;
      const v = await this.api.run(this.api.post<PromoVideo>(`/platform/videos/${this.video.id}/preview`, {}));
      this.changed.emit(v);
      this.open.set(false);
      this.toasts.ok('Grabando la versión previa. Te aviso aquí cuando esté lista.');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async approve(): Promise<void> {
    this.busy.set(true);
    try {
      await this.persistAudio();
      const v = await this.api.run(this.api.post<PromoVideo>(`/platform/videos/${this.video.id}/approve`, {}));
      this.changed.emit(v);
      this.toasts.ok('Grabando la versión final. Tarda unos minutos.');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
