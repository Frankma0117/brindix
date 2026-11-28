import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Api, errorMessage } from '../core/api.service';
import { Toasts } from '../core/ui';
import { IconComponent } from '../shared/icon.component';

interface FalModel { key: string; name: string; price: number; voices: string[]; }

/** Audición de voces de fal.ai (Kokoro, MiniMax, ElevenLabs): la misma frase en cada voz, para elegir cuál usar en los videos. */
@Component({
  selector: 'bx-fal-voices',
  standalone: true,
  imports: [IconComponent],
  template: `
  <section class="card fal">
    <button type="button" class="fal-head" (click)="toggle()" [attr.aria-expanded]="open()">
      <span><b>Audición de voces fal.ai</b><small class="muted"> · escucha la misma frase en cada voz y dime cuál te gusta</small></span>
      <bx-icon [name]="open() ? 'minus' : 'plus'" [size]="16" />
    </button>
    @if (open()) {
      @for (m of models(); track m.key) {
        <h3 class="fal-model">{{ m.name }} <small class="muted">· USD {{ m.price }} por 1.000 caracteres</small></h3>
        <div class="fal-grid">
          @for (v of m.voices; track v) {
            <button type="button" class="fal-voice" [class.on]="playing() === m.key + '/' + v" (click)="hear(m.key, v)"
                    [attr.aria-label]="'Escuchar ' + v + ' de ' + m.name">
              @if (loading() === m.key + '/' + v) { <span class="dotty"></span> }
              @else { <bx-icon [name]="playing() === m.key + '/' + v ? 'pause' : 'play'" [size]="14" /> }
              <span>{{ v.replaceAll('_', ' ') }}</span>
            </button>
          }
        </div>
      }
      @if (!models().length) { <p class="muted small">Cargando voces…</p> }
    }
  </section>`,
  styles: [`
    .fal { padding: 14px 16px; margin-bottom: 16px; }
    .fal-head { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 12px; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; padding: 0; }
    .fal-model { margin: 16px 0 8px; font-size: 14px; }
    .fal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .fal-voice { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line, #3334); background: transparent; color: inherit; font: inherit; font-size: 13px; cursor: pointer; text-align: left; min-height: 40px; }
    .fal-voice.on { border-color: var(--accent, #f5a623); }
  `],
})
export class FalVoicesComponent implements OnDestroy {
  private api = inject(Api);
  private toasts = inject(Toasts);
  open = signal(false);
  models = signal<FalModel[]>([]);
  playing = signal<string | null>(null);
  loading = signal<string | null>(null);
  private samples = new Map<string, string>();
  private audio: HTMLAudioElement | null = null;

  async toggle(): Promise<void> {
    this.open.update(v => !v);
    if (this.open() && !this.models().length) {
      try { this.models.set(await this.api.run(this.api.get<FalModel[]>('/platform/videos/fal-voices'))); }
      catch (e) { this.toasts.error(errorMessage(e)); }
    }
  }

  async hear(model: string, voice: string): Promise<void> {
    const id = `${model}/${voice}`;
    const was = this.playing();
    this.stop();
    if (was === id) return;
    this.loading.set(id);
    try {
      let url = this.samples.get(id);
      if (!url) {
        url = (await this.api.run(this.api.get<{ url: string }>(`/platform/videos/fal-voices/${model}/${voice}/sample`))).url;
        this.samples.set(id, url);
      }
      const a = new Audio(url);
      this.audio = a;
      a.onended = () => { if (this.audio === a) this.playing.set(null); };
      await a.play();
      this.playing.set(id);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.loading.set(null);
    }
  }

  private stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.playing.set(null);
  }

  ngOnDestroy(): void { this.stop(); }
}
