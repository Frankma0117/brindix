import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Api, errorMessage } from '../../core/api.service';
import { AdminVenue, MusicProvider } from '../../core/models';
import { Toasts } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { IconComponent } from '../../shared/icon.component';

/**
 * Configuración del bar (solo administrador). Aquí se conecta la música:
 * Spotify (Client ID + Secret de la app del bar), YouTube (API key) o manual.
 */
@Component({
  selector: 'bx-settings',
  standalone: true,
  imports: [IconComponent, FormsModule],
  templateUrl: './settings.component.html',
  styles: [`
    .nav { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; position: sticky; top: 0; z-index: 5; background: var(--bg); padding: 8px 0; }
    section.card { margin-bottom: 18px; scroll-margin-top: 70px; }
    section.card > h2 { margin-bottom: 4px; }
    .lead { color: var(--muted); margin-bottom: 16px; }
    .switches { display: flex; flex-direction: column; gap: 12px; }
    .switch-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border: 1px solid var(--line); border-radius: 12px; }
    .switch-row input { margin-top: 3px; width: 18px; height: 18px; accent-color: var(--pink); }
    .providers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    @media (max-width: 760px) { .providers { grid-template-columns: 1fr; } }
    .prov { text-align: left; border: 1px solid var(--line-2); border-radius: 14px; padding: 14px; background: var(--bg-2); color: var(--text); cursor: pointer; font: inherit; display: flex; flex-direction: column; gap: 4px; }
    .prov.on { border-color: var(--pink); box-shadow: 0 0 0 2px rgba(255,79,139,.3); background: var(--surface-2); }
    .prov b { font-size: 16px; }
    .integ { border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-top: 12px; }
    .integ h3 { display: flex; align-items: center; gap: 8px; }
    ol.steps { margin: 10px 0; padding-left: 20px; color: var(--muted); display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
    ol.steps b { color: var(--text); }
    .copy { display: flex; gap: 8px; align-items: center; background: var(--bg-2); border: 1px solid var(--line-2); border-radius: 10px; padding: 6px 6px 6px 12px; font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; }
    .copy span { flex: 1; }
    .status { padding: 10px 12px; border-radius: 10px; background: var(--surface-2); font-weight: 600; font-size: 14px; }
    .brand-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .brand-dot.spotify { background: #1ed760; }
    .brand-dot.youtube { background: #ff0033; }
    h2 { display: flex; align-items: center; gap: 10px; }
    h2 bx-icon { color: var(--c-amber); }
    .status.ok { background: rgba(74,222,128,.12); color: var(--ink-green); }
    .logo-prev { width: 72px; height: 72px; border-radius: 18px; object-fit: cover; background: var(--surface-2); }
    .spot-btn { background: #1ed760; color: #06210f; border-color: transparent; font-weight: 800; }
  `],
})
export class SettingsComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  private route = inject(ActivatedRoute);
  ctx = inject(VenueContext);

  v = signal<AdminVenue | null>(null);
  busy = signal(false);
  uploading = signal(false);
  provider: MusicProvider = 'MANUAL';
  spotifyClientId = '';
  spotifyClientSecret = '';
  youtubeApiKey = '';
  current = '';
  next = '';

  ngOnInit(): void {
    const sp = this.route.snapshot.queryParamMap.get('spotify');
    if (sp === 'ok') this.toasts.ok('Spotify conectado');
    if (sp === 'error') this.toasts.error('No se pudo conectar Spotify. Revisa los datos de la app e intenta otra vez.');
    this.load();
    setTimeout(() => {
      const f = this.route.snapshot.fragment;
      if (f) document.getElementById(f)?.scrollIntoView({ behavior: 'smooth' });
    }, 400);
  }

  load(): void {
    this.api.get<AdminVenue>('/admin/venue').subscribe(v => this.apply(v));
  }

  private apply(v: AdminVenue): void {
    this.v.set(v);
    this.provider = v.musicProvider;
    this.spotifyClientId = v.integrations.spotifyClientId ?? '';
    this.spotifyClientSecret = '';
    this.youtubeApiKey = '';
  }

  providerLabel(p: MusicProvider): string {
    return { MANUAL: 'modo manual', SPOTIFY: 'Spotify', YOUTUBE: 'YouTube' }[p];
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  screenUrl(): string {
    const v = this.v();
    return v ? `${location.origin}/${v.slug}/pantalla?k=${v.screenKey}` : '';
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.toasts.ok('Copiado'), () => this.toasts.error('No se pudo copiar'));
  }

  async uploadLogo(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      const { url } = await this.api.upload(file, 'logo');
      this.v.update(v => v && { ...v, logoUrl: url });
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.uploading.set(false);
    }
  }

  async saveGeneral(): Promise<void> {
    const v = this.v();
    if (!v) return;
    await this.run(() => this.api.run(this.api.put<AdminVenue>('/admin/venue', v)), 'Configuración guardada');
    this.ctx.venue.update(pv => pv && { ...pv, name: v.name, logoUrl: v.logoUrl, clientOrdersEnabled: v.clientOrdersEnabled });
  }

  async saveMusic(provider?: MusicProvider): Promise<void> {
    await this.run(() => this.api.run(this.api.put<AdminVenue>('/admin/venue/music', {
      provider: provider ?? null,
      spotifyClientId: this.spotifyClientId.trim() || null,
      spotifyClientSecret: this.spotifyClientSecret.trim() || null,
      youtubeApiKey: this.youtubeApiKey.trim() || null,
    })), provider ? 'Música configurada' : 'Datos guardados');
  }

  async clear(kind: 'spotify' | 'youtube'): Promise<void> {
    if (!confirm(kind === 'spotify' ? '¿Borrar los datos de Spotify y desconectar la cuenta?' : '¿Borrar la API key de YouTube?')) return;
    await this.run(() => this.api.run(this.api.put<AdminVenue>('/admin/venue/music', {
      provider: this.v()?.musicProvider === (kind === 'spotify' ? 'SPOTIFY' : 'YOUTUBE') ? 'MANUAL' : null,
      clearSpotify: kind === 'spotify', clearYoutube: kind === 'youtube',
    })), 'Datos borrados');
  }

  async connectSpotify(): Promise<void> {
    try {
      const { url } = await this.api.run(this.api.get<{ url: string }>('/admin/spotify/authorize'));
      location.href = url;
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async disconnectSpotify(): Promise<void> {
    if (!confirm('¿Desconectar la cuenta de Spotify?')) return;
    await this.run(() => this.api.run(this.api.post('/admin/spotify/disconnect')).then(() => this.api.run(this.api.get<AdminVenue>('/admin/venue'))), 'Spotify desconectado');
  }

  async newScreenKey(): Promise<void> {
    if (!confirm('¿Generar un enlace nuevo? El TV con el enlace anterior ya no podrá controlar la música.')) return;
    await this.run(() => this.api.run(this.api.post<AdminVenue>('/admin/venue/screen-key')), 'Enlace nuevo listo');
  }

  async changePassword(): Promise<void> {
    try {
      await this.api.run(this.api.post('/auth/password', { current: this.current, next: this.next }));
      this.current = '';
      this.next = '';
      this.toasts.ok('Contraseña cambiada');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  private async run(fn: () => Promise<unknown>, ok: string): Promise<void> {
    this.busy.set(true);
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'integrations' in r) this.apply(r as AdminVenue);
      else this.load();
      this.toasts.ok(ok);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
