import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import QRCode from 'qrcode';

@Component({
  selector: 'bx-qr',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (src()) { <img [src]="src()" [attr.width]="size()" [attr.height]="size()" [alt]="'Código QR: ' + text()"> }`,
  styles: [':host{display:inline-block;line-height:0} img{border-radius:12px;background:#fff}'],
})
export class QrComponent {
  text = input.required<string>();
  size = input(180);
  dark = input('#14101c');
  src = signal('');

  constructor() {
    effect(() => {
      const text = this.text();
      QRCode.toDataURL(text, { margin: 1, width: this.size() * 2, errorCorrectionLevel: 'M', color: { dark: this.dark(), light: '#ffffff' } })
        .then(url => this.src.set(url))
        .catch(() => this.src.set(''));
    });
  }
}
