import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../core/api.service';
import { Auth } from '../core/auth.service';
import { MascotComponent } from '../shared/mascot.component';
import { ProductArtComponent } from '../shared/product-art.component';

@Component({
  selector: 'bx-landing',
  standalone: true,
  imports: [FormsModule, MascotComponent, ProductArtComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  auth = inject(Auth);
  private router = inject(Router);
  whatsapp = signal('');
  slug = '';
  loginOpen = signal(false);
  menuOpen = signal(false);

  features = [
    { icon: '📱', title: 'Carta digital con QR', text: 'Cada mesa tiene su código. El cliente ve una carta con fotos, categorías y recomendados, sin descargar nada ni registrarse.' },
    { icon: '🍻', title: 'Rondas por tandas', text: 'El mesero carga la ronda desde su celular: ×1, ×2, ×6… dos toques y 6 cervezas quedan en la mesa correcta.' },
    { icon: '🛎️', title: 'Pedidos desde la mesa', text: 'Si lo activas, el cliente pide desde el QR. Tú asignas el pedido a un mesero y él lo marca como entregado.' },
    { icon: '💳', title: 'Cobro por ronda o total', text: 'Cobra cada ronda o la cuenta completa. Si cobra el mesero, el dinero queda pendiente hasta que lo entregue en caja.' },
    { icon: '🧮', title: 'Caja y cierre del día', text: 'Abre con la base, registra recibos pagados y reposiciones, cuenta el efectivo y mira la diferencia al instante.' },
    { icon: '📦', title: 'Inventario con costos', text: 'Entradas de mercancía por factura, mermas y conteos. Costo promedio automático para saber tu ganancia real.' },
    { icon: '🎧', title: 'Música a pedido', text: 'Los clientes piden canciones con Spotify o YouTube. Tú decides el orden, priorizas o quitas.' },
    { icon: '📺', title: 'Pantalla del bar', text: 'En el TV: lo que suena, lo que sigue y tu publicidad rotando todo el tiempo.' },
    { icon: '🔐', title: 'Perfiles y bitácora', text: 'Administrador y meseros con permisos distintos. Cada anulación, cambio o cobro queda registrado con su autor.' },
  ];

  steps = [
    { n: '1', title: 'Creamos tu bar', text: 'Te damos tu dirección (brindix.cania.app/tu-bar) y el usuario de administrador.' },
    { n: '2', title: 'Cargas tu carta', text: 'Productos con foto, precio de venta y de compra. Ordenas todo arrastrando.' },
    { n: '3', title: 'Imprimes los QR', text: 'Uno por mesa, listos para poner en un portavasos o en la mesa.' },
    { n: '4', title: '¡A atender!', text: 'Meseros con su celular, la caja abierta y la pantalla con tu música y promociones.' },
  ];

  faqs = [
    { q: '¿Necesito instalar algo?', a: 'No. Brindix funciona en el navegador del celular, la tablet o el computador. El cliente solo escanea el QR.' },
    { q: '¿El cliente tiene que registrarse?', a: 'No. Ve la carta, pide (si lo permites), pide canciones y sigue su cuenta sin crear usuario.' },
    { q: '¿Quién puede cambiar precios o inventario?', a: 'Solo el administrador. Los meseros ven la carta y cargan productos a las mesas; nada más.' },
    { q: '¿Cómo cuadro la caja?', a: 'Abres el turno con la base, registras salidas (recibos, compras) y al cerrar cuentas el efectivo. Brindix calcula lo esperado y la diferencia.' },
    { q: '¿Puedo tener varios bares?', a: 'Sí. Cada bar tiene su propia dirección, equipo, carta, caja y pantalla, totalmente separados.' },
    { q: '¿Qué pasa con la música?', a: 'Puedes usar Spotify, YouTube o modo manual. Se configura en la sección de configuración del administrador.' },
  ];

  constructor() {
    inject(Api).get<{ whatsapp: string }>('/public/site').subscribe({ next: s => this.whatsapp.set(s.whatsapp), error: () => {} });
  }

  waLink(): string {
    const text = encodeURIComponent('Hola, quiero conocer Brindix para mi bar 🍸');
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
