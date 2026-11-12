import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { PublicVenue } from '../core/models';
import { MascotComponent } from '../shared/mascot.component';

@Component({
  selector: 'bx-home',
  standalone: true,
  imports: [RouterLink, MascotComponent],
  template: `
  <main class="home">
    <div class="glow g1"></div><div class="glow g2"></div>
    <section class="hero container">
      <bx-mascot [size]="150" mood="party" />
      <p class="kicker">Brindix</p>
      <h1>{{ venue()?.name ?? 'Tu bar' }}<span class="grad-text">.</span></h1>
      <p class="lead">{{ venue()?.tagline ?? 'Carta, pedidos y música desde el celular.' }}</p>
      <div class="actions">
        <a class="btn primary lg" routerLink="/carta">Ver la carta</a>
        <a class="btn lg" [routerLink]="auth.loggedIn() ? auth.home() : '/ingresar'">
          {{ auth.loggedIn() ? 'Ir a mi panel' : 'Soy del equipo' }}
        </a>
      </div>
      <p class="hint muted small">¿Estás en una mesa? Escanea el código QR para pedir y poner tu canción.</p>
    </section>

    <section class="container features">
      <div class="card f"><span class="ico">📱</span><h3>Carta con QR</h3><p class="muted">Cada mesa tiene su código. El cliente ve la carta, pide y sigue su cuenta.</p></div>
      <div class="card f"><span class="ico">🧾</span><h3>Cuentas por mesa</h3><p class="muted">Rondas por tandas desde el celular del mesero. Al final, el total exacto.</p></div>
      <div class="card f"><span class="ico">🎧</span><h3>Música a pedido</h3><p class="muted">Los clientes piden canciones y el administrador decide el orden.</p></div>
      <a class="card f link" routerLink="/pantalla"><span class="ico">📺</span><h3>Pantalla del bar</h3><p class="muted">Lo que suena, lo que sigue y la publicidad del bar.</p></a>
    </section>
  </main>`,
  styles: [`
    .home { min-height: 100vh; position: relative; overflow: hidden; padding-bottom: 60px; }
    .glow { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .35; pointer-events: none; }
    .g1 { width: 480px; height: 480px; background: var(--pink); top: -200px; left: -120px; }
    .g2 { width: 420px; height: 420px; background: var(--amber); top: 80px; right: -180px; opacity: .25; }
    .hero { position: relative; text-align: center; padding-top: 64px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .kicker { text-transform: uppercase; letter-spacing: .3em; font-size: 12px; color: var(--amber); font-weight: 800; margin-top: 8px; }
    h1 { font-size: clamp(38px, 8vw, 68px); }
    .lead { color: var(--muted); font-size: 18px; max-width: 520px; }
    .actions { display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap; justify-content: center; }
    .hint { margin-top: 6px; }
    .features { position: relative; margin-top: 56px; display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
    .f { display: flex; flex-direction: column; gap: 6px; color: inherit; }
    .f.link:hover { border-color: var(--line-2); background: var(--surface-2); }
    .ico { font-size: 28px; }
  `],
})
export class HomeComponent {
  auth = inject(Auth);
  venue = signal<PublicVenue | null>(null);

  constructor() {
    inject(Api).get<PublicVenue>('/public/venue').subscribe({ next: v => this.venue.set(v), error: () => {} });
  }
}
