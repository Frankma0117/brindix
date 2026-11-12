import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MascotComponent } from '../shared/mascot.component';

interface Credit { by: string; licence: string; licenceUrl?: string; page: string; }

/** Créditos de las fotografías de la demo (Wikimedia Commons). Las licencias CC BY/BY-SA lo exigen. */
@Component({
  selector: 'bx-credits',
  standalone: true,
  imports: [MascotComponent],
  template: `
  <main class="container wrap">
    <a href="/" class="back"><bx-mascot [size]="30" [animate]="false" /> Brindix</a>
    <h1>Créditos de las fotografías</h1>
    <p class="muted">Las fotos del bar de demostración vienen de Wikimedia Commons, con licencias Creative Commons o de dominio público. Cada bar real usa sus propias fotos.</p>
    <table class="table">
      <thead><tr><th>Foto</th><th>Autor</th><th>Licencia</th></tr></thead>
      <tbody>
        @for (c of credits(); track c[0]) {
          <tr>
            <td><a [href]="c[1].page" target="_blank" rel="noopener">{{ label(c[0]) }}</a></td>
            <td>{{ c[1].by }}</td>
            <td>@if (c[1].licenceUrl) { <a [href]="c[1].licenceUrl" target="_blank" rel="noopener">{{ c[1].licence }}</a> } @else { {{ c[1].licence }} }</td>
          </tr>
        }
      </tbody>
    </table>
  </main>`,
  styles: [`
    .wrap { max-width: 860px; padding-top: 28px; padding-bottom: 60px; display: flex; flex-direction: column; gap: 16px; }
    .back { display: inline-flex; align-items: center; gap: 8px; color: var(--text); font-weight: 800; }
    table { margin-top: 8px; }
  `],
})
export class CreditsComponent {
  credits = signal<[string, Credit][]>([]);

  constructor() {
    inject(HttpClient).get<Record<string, Credit>>('/demo-assets/credits.json').subscribe(c => this.credits.set(Object.entries(c)));
  }

  label(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  }
}
