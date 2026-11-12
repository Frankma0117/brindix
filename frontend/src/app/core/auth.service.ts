import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { Api } from './api.service';
import { User, WaiterOption } from './models';
import { store } from './ui';

/** support = el súper administrador entró al bar desde la plataforma (modo soporte). */
export interface StaffSession { token: string; user: User; venue: string; venueName: string; support?: boolean; }
interface PlatformSession { token: string; name: string; mustChangePassword?: boolean; }

const STAFF_KEY = 'brindix.session';
const PLATFORM_KEY = 'brindix.platform';
const ADMIN_HOME_KEY = 'brindix.adminHome';

/** Sesión del personal de un bar (administrador o mesero). Una sesión a la vez por navegador. */
@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);

  readonly session = signal<StaffSession | null>(store.get<StaffSession | null>(STAFF_KEY, null));
  readonly user = computed(() => this.session()?.user ?? null);
  readonly venue = computed(() => this.session()?.venue ?? null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly isSupport = computed(() => !!this.session()?.support);
  /** Clave temporal: debe cambiarla antes de usar el bar (no aplica en modo soporte). */
  readonly mustChange = computed(() => !!this.user()?.mustChangePassword && !this.isSupport());

  /** ¿Hay sesión para este bar? */
  inVenue(slug: string): boolean {
    return this.session()?.venue === slug;
  }

  async login(venue: string, username: string, password: string): Promise<StaffSession> {
    const res = await firstValueFrom(this.api.post<StaffSession>('/auth/login', { venue, username, password }));
    this.use(res);
    return res;
  }

  /** Guarda la sesión (login normal o entrada en modo soporte desde la plataforma). */
  use(s: StaffSession): void {
    this.session.set(s);
    store.set(STAFF_KEY, s);
  }

  async changePassword(current: string, next: string): Promise<void> {
    await firstValueFrom(this.api.post('/auth/password', { current, next }));
    const s = this.session();
    if (s) this.use({ ...s, user: { ...s.user, mustChangePassword: false } });
  }

  logout(redirect = true): void {
    const slug = this.venue();
    this.session.set(null);
    try { localStorage.removeItem(STAFF_KEY); } catch { /* */ }
    if (redirect) this.router.navigateByUrl(slug ? `/${slug}/ingresar` : '/');
  }

  home(): string {
    const s = this.session();
    if (!s) return '/';
    if (this.mustChange()) return `/${s.venue}/clave`;
    if (s.user.role !== 'ADMIN') return `/${s.venue}/mesero`;
    return `/${s.venue}/${store.get<string>(ADMIN_HOME_KEY, 'admin') === 'mesero' ? 'mesero' : 'admin'}`;
  }

  /** En bares pequeños el administrador también atiende: al entrar vuelve a la vista que usó por última vez. */
  rememberAdminHome(view: 'admin' | 'mesero'): void {
    if (this.isAdmin()) store.set(ADMIN_HOME_KEY, view);
  }

  isMe(id: number | null | undefined): boolean {
    return id != null && id === this.user()?.id;
  }

  /** Nombre para listas de "quién la lleva": el propio usuario aparece como "Yo". */
  staffLabel(w: WaiterOption): string {
    return this.isMe(w.id) ? `Yo (${w.name})` : w.name;
  }

  /** ¿El administrador atiende solo? (no hay otro mesero activo) */
  alone(waiters: WaiterOption[]): boolean {
    return waiters.every(w => this.isMe(w.id));
  }
}

/** Sesión del súper administrador de Brindix. */
@Injectable({ providedIn: 'root' })
export class PlatformAuth {
  private api = inject(Api);
  readonly session = signal<PlatformSession | null>(store.get<PlatformSession | null>(PLATFORM_KEY, null));

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(this.api.post<PlatformSession>('/platform/login', { username, password }));
    this.session.set(res);
    store.set(PLATFORM_KEY, res);
  }

  logout(): void {
    this.session.set(null);
    try { localStorage.removeItem(PLATFORM_KEY); } catch { /* */ }
  }

  async changePassword(current: string, next: string): Promise<void> {
    await firstValueFrom(this.api.post('/platform/password', { current, next }));
    const s = this.session();
    if (s) {
      const updated = { ...s, mustChangePassword: false };
      this.session.set(updated);
      store.set(PLATFORM_KEY, updated);
    }
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const platform = inject(PlatformAuth);
  const router = inject(Router);
  const isPlatform = req.url.startsWith('/api/platform') && !req.url.endsWith('/login');
  const isStaff = /^\/api\/(staff|admin|auth\/(me|password))/.test(req.url);
  const token = isPlatform ? platform.session()?.token : isStaff ? auth.session()?.token : null;
  const r = token ? req.clone({ setHeaders: { Authorization: 'Bearer ' + token } }) : req;
  return next(r).pipe(catchError(err => {
    if (err?.status === 401 && token) {
      if (isPlatform) platform.logout(); else auth.logout();
    }
    if (err?.status === 403 && err.error?.code === 'PASSWORD_CHANGE_REQUIRED' && isStaff && auth.venue()) {
      const s = auth.session()!;
      auth.use({ ...s, user: { ...s.user, mustChangePassword: true } });
      router.navigateByUrl(`/${s.venue}/clave`);
    }
    return throwError(() => err);
  }));
};

function slugOf(route: ActivatedRouteSnapshot): string {
  let r: ActivatedRouteSnapshot | null = route;
  while (r && !r.paramMap.get('slug')) r = r.parent;
  return r?.paramMap.get('slug') ?? '';
}

export const staffGuard: CanActivateFn = route => {
  const auth = inject(Auth);
  const slug = slugOf(route);
  if (!auth.inVenue(slug)) return inject(Router).parseUrl(`/${slug}/ingresar`);
  return auth.mustChange() ? inject(Router).parseUrl(`/${slug}/clave`) : true;
};

export const adminGuard: CanActivateFn = route => {
  const auth = inject(Auth);
  const slug = slugOf(route);
  if (!auth.inVenue(slug)) return inject(Router).parseUrl(`/${slug}/ingresar`);
  if (auth.mustChange()) return inject(Router).parseUrl(`/${slug}/clave`);
  return auth.isAdmin() ? true : inject(Router).parseUrl(`/${slug}/mesero`);
};

/** Pantalla de cambio de clave: solo con sesión en el bar. */
export const passwordGuard: CanActivateFn = route => {
  const slug = slugOf(route);
  return inject(Auth).inVenue(slug) ? true : inject(Router).parseUrl(`/${slug}/ingresar`);
};
