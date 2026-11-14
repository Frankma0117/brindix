import { Component, OnInit, inject, signal } from '@angular/core';
import { Api, errorMessage } from '../core/api.service';
import { Toasts } from '../core/ui';
import { IconComponent } from '../shared/icon.component';
import { MascotComponent } from '../shared/mascot.component';

interface PublisherStatus {
  enabled: boolean;
  up: boolean;
}

/**
 * Publicador de redes de Brindix (YouTube, Instagram, Facebook y TikTok). Corre en su propio contenedor y se abre
 * como una sección más de la plataforma: Brindix entrega un ticket de un solo uso y el publicador abre la sesión sin otro login.
 * Los videos que arma el estudio llegan solos a «Por validar» y aquí se elige cuál se publica.
 */
@Component({
  selector: 'bx-platform-publisher',
  standalone: true,
  imports: [IconComponent, MascotComponent],
  template: `
  <div class="page-head">
    <div><h1>Publicador de redes</h1><p>Programa y publica los videos de Brindix en YouTube, Instagram, Facebook y TikTok, con textos pensados para cada red.</p></div>
  </div>

  @if (status(); as s) {
    @if (!s.enabled) {
      <div class="empty">
        <h3>El publicador no está configurado</h3>
        <p>En el servidor corre <code>bash scripts/set-publisher.sh</code>, reconstruye con <code>bash scripts/deploy.sh</code> y vuelve aquí.</p>
      </div>
    } @else {
      <section class="card pub">
        <bx-mascot [size]="64" mood="party" />
        <div class="grow">
          <h2>Entrar al publicador</h2>
          <ul class="small muted">
            <li><strong>Por validar:</strong> cada video que termina el estudio aparece ahí y tú eliges cuál se publica.</li>
            <li><strong>Estudio de marca:</strong> logo, portadas y publicaciones con la identidad de Brindix.</li>
            <li><strong>Automático:</strong> publicaciones diarias o semanales en cada red, con tu aprobación.</li>
          </ul>
          @if (!s.up) { <p class="small warn">El publicador no responde en este momento. Si acabas de actualizar, espera un minuto.</p> }
        </div>
        <button class="btn primary lg" type="button" [disabled]="busy() || !s.up" (click)="open()">
          <bx-icon name="upload" [size]="18" /> {{ busy() ? 'Abriendo…' : 'Abrir el publicador' }}
        </button>
      </section>
    }
  } @else {
    <p class="muted">Cargando…</p>
  }
  `,
  styles: [`
    .pub { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding: 22px; }
    .pub .grow { flex: 1 1 320px; min-width: 0; }
    .pub h2 { margin: 0 0 6px; font-size: 20px; }
    .pub ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
    .warn { color: var(--c-warn, #b45309); margin: 8px 0 0; }
  `],
})
export class PlatformPublisherComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);

  status = signal<PublisherStatus | null>(null);
  busy = signal(false);

  ngOnInit(): void {
    this.api.get<PublisherStatus>('/platform/publisher/status').subscribe({
      next: s => this.status.set(s),
      error: e => { this.status.set({ enabled: false, up: false }); this.toasts.error(errorMessage(e)); },
    });
  }

  async open(): Promise<void> {
    this.busy.set(true);
    try {
      const r = await this.api.run(this.api.post<{ url: string }>('/platform/publisher/ticket'));
      window.location.href = r.url; // mismo dominio: /publicador/sso?ticket=…
    } catch (e) {
      this.toasts.error(errorMessage(e));
      this.busy.set(false);
    }
  }
}
