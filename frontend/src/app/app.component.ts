import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './core/ui';
import { DialogHostComponent } from './shared/dialogs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, DialogHostComponent],
  template: `
    <router-outlet />
    <bx-dialog-host />
    <div class="toasts" aria-live="polite">
      @for (t of toasts.list(); track t.id) {
        <div class="toast" [class.ok]="t.kind === 'ok'" [class.error]="t.kind === 'error'">{{ t.text }}</div>
      }
    </div>`,
})
export class AppComponent {
  toasts = inject(Toasts);
}
