import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../../core/api.service';
import { AppNotification, NotificationFeed, SetupItem } from '../../core/models';

/** Avisos y lista «Por configurar» del administrador. Sondea cada 45 s solo con la pestaña visible. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private api = inject(Api);
  items = signal<AppNotification[]>([]);
  unread = signal(0);
  setup = signal<SetupItem[]>([]);
  private timer: ReturnType<typeof setInterval> | null = null;
  private users = 0;
  private onVisible = () => { if (document.visibilityState === 'visible') this.refresh(); };

  /** Cada panel montado pide el sondeo y lo suelta al destruirse. */
  acquire(): void {
    if (this.users++ > 0) return;
    this.refresh();
    this.timer = setInterval(() => { if (document.visibilityState === 'visible') this.refresh(); }, 45_000);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  release(): void {
    if (--this.users > 0) return;
    this.users = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  refresh(): void {
    this.api.get<NotificationFeed>('/admin/notifications').subscribe({
      next: f => { this.items.set(f.items); this.unread.set(f.unread); },
      error: () => { /* sin red o sesión vencida: se reintenta en el próximo ciclo */ },
    });
  }

  loadSetup(): void {
    this.api.get<SetupItem[]>('/admin/setup-checklist').subscribe({
      next: s => this.setup.set(s),
      error: () => { /* se conserva la última lista */ },
    });
  }

  markRead(n: AppNotification): void {
    if (n.read) return;
    this.items.update(list => list.map(x => x.id === n.id ? { ...x, read: true } : x));
    this.unread.update(u => Math.max(0, u - 1));
    this.api.post(`/admin/notifications/${n.id}/read`).subscribe({ error: () => this.refresh() });
  }

  markAllRead(): void {
    this.items.update(list => list.map(x => ({ ...x, read: true })));
    this.unread.set(0);
    this.api.post('/admin/notifications/read-all').subscribe({ error: () => this.refresh() });
  }
}
