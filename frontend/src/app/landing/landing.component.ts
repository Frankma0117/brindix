import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { ThemeToggleComponent } from '../core/theme';
import { IconComponent } from '../shared/icon.component';
import { MascotComponent } from '../shared/mascot.component';

/** Página de ventas de Brindix (modo Persuade). Una sección por pantalla, producto real y fotos reales. */
@Component({
  selector: 'bx-landing',
  standalone: true,
  imports: [FormsModule, MascotComponent, ThemeToggleComponent, IconComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  auth = inject(Auth);
  private router = inject(Router);
  whatsapp = signal('');
  /** Carta del bar demo para "Ver una carta real" (BRINDIX_DEMO_URL en el servidor). */
  demoUrl = signal('');
  slug = '';
  loginOpen = signal(false);
  menuOpen = signal(false);
  year = new Date().getFullYear();

  faqs = [
    { q: '¿Necesito instalar algo?', a: 'No. Brindix funciona en el navegador del celular, la tablet o el computador. El cliente solo escanea el QR de su mesa.' },
    { q: '¿El cliente tiene que registrarse?', a: 'No. Ve la carta, pide si lo permites, pone su canción y sigue su cuenta sin crear usuario.' },
    { q: '¿Quién puede cambiar precios o inventario?', a: 'Solo el administrador. Los meseros ven la carta y cargan productos a sus mesas.' },
    { q: '¿Cómo cuadro la caja?', a: 'Abres el turno con la base, registras salidas como recibos y compras y al cerrar cuentas el efectivo. Brindix calcula lo esperado y la diferencia.' },
    { q: '¿Puedo tener varios bares?', a: 'Sí. Cada bar tiene su dirección, su equipo, su carta, su caja y su pantalla, totalmente separados.' },
    { q: '¿Con qué pongo la música?', a: 'Con Spotify, con YouTube o en modo manual. Se configura en la sección de configuración del administrador.' },
  ];

  constructor() {
    inject(Api).get<{ whatsapp: string; demoUrl?: string }>('/public/site').subscribe({
      next: s => { this.whatsapp.set(s.whatsapp); this.demoUrl.set(s.demoUrl ?? ''); },
      error: () => {},
    });
  }

  waLink(): string {
    const text = encodeURIComponent('Hola, quiero conocer Brindix para mi bar');
    return this.whatsapp() ? `https://wa.me/${this.whatsapp()}?text=${text}` : '#contacto';
  }

  goToBar(): void {
    const s = this.slug.trim().toLowerCase().replace(/^.*\//, '').replace(/[^a-z0-9-]/g, '');
    if (s) this.router.navigate(['/', s, 'ingresar']);
  }

  scroll(id: string): void {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
