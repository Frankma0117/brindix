import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api.service';
import { Toasts } from '../core/ui';
import { Dialogs } from '../shared/dialogs';
import { IconComponent } from '../shared/icon.component';
import { MascotComponent } from '../shared/mascot.component';
import { FalVoicesComponent } from './fal-voices.component';
import { VideoDraftEditorComponent } from './video-draft-editor.component';

type Role = 'mascot' | 'tutorial';
type Status = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'DRAFT' | 'PREVIEWING' | 'REVIEW';

export interface PromoVideo {
  id: number; jobId?: string; kind: string; kindName?: string; format: 'vertical' | 'horizontal' | 'cuadrado'; voice: string; music: string; idea?: string;
  status: Status; progress: number; detail?: string; title?: string; caption?: string;
  script?: { shot: string; headline: string; say: string }[]; videoUrl?: string; posterUrl?: string; seconds?: number;
  createdAt: string; finishedAt?: string;
  /** Guion editable (solo videos con recuadros). */
  spec?: any;
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
/** Lowercase without accents, to search "Andrés" with "andres". */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const MUSIC_GROUPS: { name: string; keys: string[] }[] = [
  { name: 'Latina y de fiesta', keys: ['fiesta', 'salsa', 'merengue', 'vallenato', 'champeta', 'tropical', 'bachata', 'reggaeton', 'urbano'] },
  { name: 'Tranquila', keys: ['lounge', 'jazz', 'acustico', 'lofi', 'bolero', 'romantico'] },
  { name: 'Con energía', keys: ['rock', 'electronica', 'funk'] },
  { name: 'Sin música', keys: ['ninguna'] },
];

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
  imports: [FormsModule, DatePipe, IconComponent, MascotComponent, VideoDraftEditorComponent, FalVoicesComponent],
  template: `
  <div class="page-head">
    <div><h1>Videos y publicidad</h1><p>La copa de Brindix explica el producto sobre pantallas reales de la demo. Listos para redes, WhatsApp o una reunión.</p></div>
  </div>

  <bx-fal-voices />

  @if (options(); as o) {
    @if (!o.enabled) {
      <div class="empty"><h3>El estudio no está configurado</h3><p>En el servidor corre <code>bash scripts/set-studio.sh</code> y vuelve aquí.</p></div>
    } @else {
      <section class="studio card">
        <div class="studio-head">
          <bx-mascot [size]="56" mood="party" />
          <div class="grow"><h2>Nuevo video</h2><p class="small muted">Entre 2 y 6 minutos por video. Guion por IA, voz de Fish Audio y capturas de brindix.cania.app/demo.</p></div>
          @if (!o.voiceReady) { <span class="badge red">Sin voz (FAL_KEY o FISH_API_KEY)</span> }
          @else if (!o.aiReady) { <span class="badge amber">Guion de plantilla (sin IA)</span> }
        </div>

        <ol class="steps">
          <li class="step">
            <div class="step-head"><span class="num">1</span><h3>¿Qué video?</h3></div>
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
          </li>

          <li class="step">
            <div class="step-head"><span class="num">2</span><h3>Formatos</h3><span class="hint">{{ kind() === 'recuadros' ? 'Automático' : 'Sale un video por cada uno' }}</span></div>
            @if (kind() === 'recuadros') {
              <p class="small muted">Se crean 3 videos: Reel (vertical), Instagram (cuadrado) y Tutorial guiado (horizontal)</p>
            } @else {
            <div class="formats" role="group" aria-label="Formatos">
              @for (f of o.formats; track f.key) {
                <button type="button" role="checkbox" class="fmt" [attr.aria-checked]="hasFormat(f.key)" [class.on]="hasFormat(f.key)" (click)="toggleFormat(f.key)">
                  <i [class]="'shape ' + f.key"></i>
                  <b>{{ fmtName(f.key).name }}</b><span>{{ fmtName(f.key).where }}</span>
                  <bx-icon class="tick" name="check" [size]="14" />
                </button>
              }
            </div>
            }
          </li>

          <li class="step">
            <div class="step-head"><span class="num">3</span><h3>Música</h3><span class="hint">{{ musicName(music()) }}</span></div>
            <div class="mgroups">
              @for (g of musicGroups(); track g.name) {
                <div class="mgroup">
                  <span class="mlabel">{{ g.name }}</span>
                  <div class="chips" role="radiogroup" [attr.aria-label]="'Música: ' + g.name">
                    @for (m of g.keys; track m) {
                      <button type="button" role="radio" class="chip" [attr.aria-checked]="music() === m" [class.active]="music() === m" (click)="music.set(m)">{{ musicName(m) }}</button>
                    }
                  </div>
                </div>
              }
            </div>
          </li>

          <li class="step">
            <div class="step-head"><span class="num">4</span><h3>Voces</h3><span class="hint">Se usa la de {{ role() === 'tutorial' ? 'tutorial' : 'la mascota' }}</span></div>
            <div class="vroles">
              @for (r of roles; track r) {
                <div class="vrole" [class.on]="role() === r">
                  <div class="vrole-text">
                    <span class="tiny muted">{{ roleLabel(r) }}</span>
                    <b>{{ voiceName(roleVoice(r)) }}</b>
                  </div>
                  @if (role() === r) { <span class="badge">En este video</span> }
                  @if (pickerRole() !== r) {
                    <button type="button" class="chip" (click)="startEdit(r)">Cambiar</button>
                  }
                </div>
              }
            </div>
            @if (pickerRole(); as pr) {
            <p class="small muted vcount">Elige la voz {{ pr === 'tutorial' ? 'de los tutoriales' : 'de la mascota (anuncios y funciones)' }}.</p>
            <div class="vtools">
              <label class="vsearch">
                <bx-icon name="search" [size]="16" />
                <input class="input" type="search" placeholder="Buscar: paisa, locutor, narradora, mexicana…" aria-label="Buscar voz"
                       [ngModel]="voiceQuery()" (ngModelChange)="voiceQuery.set($event)" />
              </label>
              <div class="seg" role="group" aria-label="Filtrar voces">
                <button type="button" [attr.aria-pressed]="voiceFilter() === 'all'" [class.on]="voiceFilter() === 'all'" (click)="voiceFilter.set('all')">Todas</button>
                <button type="button" [attr.aria-pressed]="voiceFilter() === 'male'" [class.on]="voiceFilter() === 'male'" (click)="voiceFilter.set('male')">Hombres</button>
                <button type="button" [attr.aria-pressed]="voiceFilter() === 'female'" [class.on]="voiceFilter() === 'female'" (click)="voiceFilter.set('female')">Mujeres</button>
              </div>
            </div>
            <div class="voices" role="radiogroup" aria-label="Voces">
              @for (v of visibleVoices(); track v.key) {
                <div class="voice" [class.on]="roleVoice(pr) === v.key">
                  <button type="button" role="radio" class="pick-voice" (click)="pickVoice(pr, v.key)" [attr.aria-checked]="roleVoice(pr) === v.key">
                    <b>@if (recommended.has(v.key)) { <bx-icon name="star" [size]="13" /> }{{ v.name }}</b><span>{{ v.style }}</span>
                  </button>
                  <button type="button" class="hear" (click)="hear(v.key)" [disabled]="!o.voiceReady"
                          [attr.aria-label]="(playingVoice() === v.key ? 'Detener ' : 'Escuchar a ') + v.name" [title]="playingVoice() === v.key ? 'Detener' : 'Escuchar'">
                    @if (loadingVoice() === v.key) { <span class="dotty"></span> }
                    @else { <bx-icon [name]="playingVoice() === v.key ? 'pause' : 'play'" [size]="15" /> }
                  </button>
                </div>
              } @empty {
                <p class="small muted vnone">Ninguna voz coincide. Prueba con otra palabra o quita el filtro.</p>
              }
            </div>
            <p class="small muted vcount">{{ visibleVoices().length }} de {{ o.voices?.length ?? 0 }} voces · toca ▶ para escuchar una muestra</p>
            <p class="small muted vcount"><bx-icon name="star" [size]="13" /> = recomendadas para la línea de marca (narradora clara y cálida, locutor ágil).
              <button type="button" class="chip" (click)="saveVoice(pr)">Usar esta voz siempre</button>
              @if (isSaved(pr)) { <button type="button" class="chip" (click)="cancelEdit(pr)">Cancelar</button> }</p>
            }
            @if (kind() === 'recuadros' && !o.voiceReady) {
              <p class="small muted vcount">Sin voz: el video final llevará solo música.</p>
            }
          </li>

          <li class="step">
            <div class="step-head"><span class="num">5</span><h3>Idea o enfoque</h3><span class="hint">Opcional</span></div>
            <textarea class="input idea" rows="2" maxlength="600" aria-label="Idea o enfoque" [(ngModel)]="idea" [placeholder]="ideaHint()"></textarea>
          </li>
        </ol>

        <div class="summary">
          <div class="sum-text">
            <b>{{ summaryTitle() }}</b>
            <span>{{ summaryLine() }}</span>
            <span class="faint">{{ activeJobs() }} pedidos en proceso · máximo 3 a la vez</span>
          </div>
          <button class="btn primary lg" [disabled]="busy() || (!o.voiceReady && kind() !== 'recuadros') || activeJobs() >= 3 || (!formats().length && kind() !== 'recuadros')" (click)="create()">
            <bx-icon name="sparkles" [size]="18" /> {{ busy() ? 'Enviando…' : (kind() === 'recuadros' ? 'Crear 3 borradores' : (formats().length > 1 ? 'Crear ' + formats().length + ' videos' : 'Crear el video')) }}
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
          } @else if (v.status === 'DRAFT' || v.status === 'REVIEW') {
            <div class="state working">
              <bx-mascot [size]="64" mood="happy" />
              <p>{{ v.status === 'DRAFT' ? 'Borrador: revisa el guion y graba la previa' : 'Previa lista: revísala y apruébala' }}</p>
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
          <h3>{{ v.title || v.kindName || kindName(v.kind) }} @if (stage(v); as st) { <span class="badge">{{ st }}</span> }</h3>
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
            <button class="btn sm ghost icon-end" (click)="remove(v)" [disabled]="v.status === 'RUNNING' && v.kind !== 'recuadros'" aria-label="Eliminar video"><bx-icon name="x" [size]="16" /></button>
          </div>
          @if (v.kind === 'recuadros' && v.status !== 'DONE' && v.status !== 'FAILED') {
            <bx-video-draft [video]="v" [assets]="assets()" (changed)="replace($event)" />
          }
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
    @media (hover: hover) and (pointer: fine) { .kind:hover, .fmt:hover, .voice:hover { border-color: var(--faint); } }
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
    .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 22px; }
    .step { display: flex; flex-direction: column; gap: 10px; }
    .step-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .step-head h3 { font-size: 15px; margin: 0; }
    .step-head .num { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 12.5px; font-weight: 800;
      background: rgba(255, 178, 56, .16); color: var(--ink-amber); font-variant-numeric: tabular-nums; }
    .step-head .hint { margin-left: auto; font-size: 12.5px; color: var(--muted); }
    .mgroups { display: flex; flex-direction: column; gap: 10px; }
    .mgroup { display: grid; grid-template-columns: 9.5rem 1fr; gap: 10px; align-items: start; }
    .mlabel { font-size: 12.5px; font-weight: 700; color: var(--muted); padding-top: 7px; }
    @media (max-width: 640px) { .mgroup { grid-template-columns: 1fr; gap: 6px; } .mlabel { padding-top: 0; } }
    .vroles { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: 10px; }
    .vrole { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--line-2); background: var(--bg-2); border-radius: 12px; }
    .vrole.on { border-color: var(--amber); }
    .vrole-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .vtools { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .vsearch { position: relative; flex: 1 1 260px; display: block; }
    .vsearch bx-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; }
    .vsearch .input { padding-left: 36px; width: 100%; }
    .seg { display: inline-flex; padding: 3px; border-radius: 999px; background: var(--bg-2); border: 1px solid var(--line-2); }
    .seg button { border: 0; background: transparent; color: var(--muted); font: 600 13px var(--font); padding: 6px 14px; border-radius: 999px; cursor: pointer;
      transition: background-color 150ms ease, color 150ms ease, transform 140ms var(--ease-out); }
    .seg button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0, 0, 0, .12); }
    .seg button:active { transform: scale(.97); }
    .voices { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); max-height: 340px; overflow-y: auto; padding: 2px 4px 2px 0;
      overscroll-behavior: contain; scrollbar-gutter: stable; }
    .voice { min-height: 58px; }
    .vnone { grid-column: 1 / -1; padding: 12px 2px; }
    .vcount { margin: 0; }
    .idea { resize: vertical; min-height: 56px; line-height: 1.45; width: 100%; }
    .summary { position: sticky; bottom: 12px; z-index: 5; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 14px;
      border: 1px solid var(--line-2); border-radius: 18px; background: var(--surface); box-shadow: 0 12px 30px -16px rgba(0, 0, 0, .35); }
    .sum-text { flex: 1 1 240px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .sum-text b { font-size: 14.5px; }
    .sum-text span { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sum-text .faint { color: var(--faint); }
    @media (max-width: 640px) { .summary .btn { width: 100%; justify-content: center; } }
    @media (hover: hover) and (pointer: fine) { .seg button:not(.on):hover { color: var(--text); } }
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
  /** Voces de la línea de marca (las mismas que recomienda el panel de Canix): narradora cálida y locutor ágil. */
  recommended = new Set(['M5', 'M3', 'M8', 'M6', 'H14', 'H4', 'H12', 'H19']);
  /** Dos voces: la de la mascota (anuncio, función) y la del tutorial. Cada una se elige una vez y el menú se oculta hasta pedir «Cambiar». */
  roles: Role[] = ['mascot', 'tutorial'];
  private voices = { mascot: signal(this.storedVoice('mascot')), tutorial: signal(this.storedVoice('tutorial')) };
  private saved = signal<Record<Role, boolean>>({ mascot: this.hasStored('mascot'), tutorial: this.hasStored('tutorial') });
  editing = signal<Role | null>(null);
  role = computed<Role>(() => (this.kind().startsWith('tutorial') ? 'tutorial' : 'mascot'));
  /** Menú abierto: el que se pidió cambiar, o el del video actual si esa voz aún no se ha elegido. */
  pickerRole = computed<Role | null>(() => this.editing() ?? (this.saved()[this.role()] ? null : this.role()));
  voice = computed(() => this.roleVoice(this.role()));
  voiceFilter = signal<'all' | 'male' | 'female'>('all');
  voiceQuery = signal('');
  /** Voices by gender and by any word of their name or style ("paisa", "locutor", "narradora"). */
  visibleVoices = computed(() => {
    const words = fold(this.voiceQuery()).split(/\s+/).filter(Boolean);
    return (this.options()?.voices ?? []).filter(v =>
      (this.voiceFilter() === 'all' || v.gender === this.voiceFilter()) && words.every(w => fold(v.name + ' ' + v.style).includes(w)))
      .sort((a, b) => Number(this.recommended.has(b.key)) - Number(this.recommended.has(a.key)));
  });
  selectedVoice = computed(() => this.options()?.voices?.find(v => v.key === this.voice()));
  /** Music in groups that read at a glance; a style the studio adds later lands in «Otras». */
  musicGroups = computed(() => {
    const all = this.options()?.music ?? [];
    const groups = MUSIC_GROUPS.map(g => ({ name: g.name, keys: g.keys.filter(k => all.includes(k)) })).filter(g => g.keys.length);
    const placed = new Set(groups.flatMap(g => g.keys));
    const rest = all.filter(k => !placed.has(k));
    return rest.length ? [...groups, { name: 'Otras', keys: rest }] : groups;
  });
  summaryTitle = computed(() => {
    const n = this.kind() === 'recuadros' ? 3 : this.formats().length;
    const kind = this.options()?.kinds?.find(k => k.key === this.kind())?.name ?? 'Video';
    return `${kind} · ${n === 1 ? '1 video' : n + ' videos'}`;
  });
  summaryLine = computed(() =>
    [(this.kind() === 'recuadros' ? 'Reel, Instagram y Tutorial guiado' : this.formats().map(f => this.fmtName(f).name).join(', ')) || 'Elige al menos un formato', ...(this.kind() === 'recuadros' ? ['recuadros, guía y mascota', this.musicName(this.music()), this.selectedVoice() ? 'voz de ' + this.selectedVoice()!.name : 'solo música'] : [this.musicName(this.music()), this.selectedVoice() ? 'voz de ' + this.selectedVoice()!.name : ''])]
      .filter(Boolean).join(' · '));
  music = signal('fiesta');
  idea = '';
  busy = signal(false);
  playing = signal<number | null>(null);
  openScript = signal<number | null>(null);
  activeCount = computed(() => this.videos().filter(v => v.status === 'QUEUED' || v.status === 'RUNNING' || v.status === 'PREVIEWING').length);
  assets = signal<string[]>([]);
  private assetsLoaded = false;
  /** Pedidos (no videos) en proceso: un clic con tres formatos es un solo pedido. */
  activeJobs = computed(() => new Set(this.videos().filter(v => v.status === 'QUEUED' || v.status === 'RUNNING').map(v => v.jobId ?? String(v.id))).size);
  playingVoice = signal<string | null>(null);
  loadingVoice = signal<string | null>(null);
  private audio: HTMLAudioElement | null = null;
  private samples = new Map<string, string>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private storageKey(r: Role): string { return r === 'mascot' ? 'brindix.studio.voice' : 'brindix.studio.voice.tutorial'; }

  private hasStored(r: Role): boolean {
    try { return !!localStorage.getItem(this.storageKey(r)); } catch { return false; }
  }

  private storedVoice(r: Role): string {
    const fallback = 'eleven2:Chris';
    try { return localStorage.getItem(this.storageKey(r)) || fallback; } catch { return fallback; }
  }

  roleVoice(r: Role): string { return this.voices[r](); }
  roleLabel(r: Role): string { return r === 'mascot' ? 'Mascota · anuncios y funciones' : 'Tutoriales'; }
  isSaved(r: Role): boolean { return this.saved()[r]; }
  pickVoice(r: Role, key: string): void { this.voices[r].set(key); }
  startEdit(r: Role): void { this.editing.set(r); }

  saveVoice(r: Role): void {
    try { localStorage.setItem(this.storageKey(r), this.voices[r]()); } catch { /* sin almacenamiento: queda solo en esta pantalla */ }
    this.saved.update(s => ({ ...s, [r]: true }));
    this.editing.set(null);
    this.stopVoice();
    this.toasts.show(r === 'mascot' ? 'Voz de la mascota guardada.' : 'Voz de los tutoriales guardada.');
  }

  cancelEdit(r: Role): void {
    this.voices[r].set(this.storedVoice(r));
    this.editing.set(null);
    this.stopVoice();
  }

  ngOnInit(): void {
    this.api.get<Options>('/platform/videos/options').subscribe({
      next: o => {
        this.options.set(o);
        for (const r of this.roles) {
          if (o.voices?.length && !o.voices.some(v => v.key === this.roleVoice(r))) this.voices[r].set(o.voices[0].key);
        }
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
    this.api.get<PromoVideo[]>('/platform/videos').subscribe({
      next: v => {
        this.videos.set(v);
        if (!this.assetsLoaded && v.some(x => x.kind === 'recuadros' && (x.status === 'DRAFT' || x.status === 'PREVIEWING' || x.status === 'REVIEW'))) this.loadAssets();
      },
      error: () => {},
    });
  }

  /** Imágenes del taller para las escenas: se piden una sola vez. */
  private loadAssets(): void {
    this.assetsLoaded = true;
    this.api.get<{ path: string }[]>('/platform/videos/studio-assets').subscribe({
      next: a => this.assets.set((a ?? []).map(x => x.path)),
      error: () => { this.assetsLoaded = false; },
    });
  }

  /** Etapa de un video con recuadros, para la etiqueta de la tarjeta. */
  stage(v: PromoVideo): string {
    if (v.kind !== 'recuadros') return '';
    switch (v.status) {
      case 'DRAFT': return 'Borrador';
      case 'PREVIEWING': return 'Grabando previa';
      case 'REVIEW': return 'Previa lista';
      case 'RUNNING': return 'Grabando final';
      default: return '';
    }
  }

  replace(n: PromoVideo): void {
    this.videos.update(list => list.map(x => (x.id === n.id ? n : x)));
  }

  ideaHint(): string {
    switch (this.kind()) {
      case 'anuncio': return 'Ej.: para bares de Bogotá que todavía anotan en papel; resalta las rondas por tandas y la caja cuadrada';
      case 'recuadros': return 'Ej.: el subtítulo de la intro, p. ej. «Tu bar, en el celular» (máx. 90 letras)';
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
        kind: this.kind(), formats: this.formats(), voice: this.options()?.voiceReady ? this.voice() : (this.kind() === 'recuadros' ? '' : this.voice()), music: this.music(), idea: this.idea.trim() || null,
      }));
      this.videos.update(list => [...made, ...list]);
      this.idea = '';
      if (this.kind() === 'recuadros') {
        this.toasts.ok('3 borradores creados: corrígelos y graba la versión previa de cada uno.');
        if (!this.assetsLoaded) this.loadAssets();
        return;
      }
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
