import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { Api } from './api.service';
import { User } from './models';

const TOKEN_KEY = 'brindix.token';
const USER_KEY = 'brindix.user';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* modo privado */ }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);

  readonly token = signal<string | null>(read(TOKEN_KEY));
  readonly user = signal<User | null>(JSON.parse(read(USER_KEY) ?? 'null'));
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly loggedIn = computed(() => !!this.token());

  async login(username: string, password: string): Promise<User> {
    const res = await firstValueFrom(this.api.post<{ token: string; user: User }>('/auth/login', { username, password }));
    this.token.set(res.token);
    this.user.set(res.user);
    write(TOKEN_KEY, res.token);
    write(USER_KEY, JSON.stringify(res.user));
    return res.user;
  }

  logout(redirect = true): void {
    this.token.set(null);
    this.user.set(null);
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
    if (redirect) this.router.navigateByUrl('/ingresar');
  }

  home(): string {
    return this.isAdmin() ? '/admin' : '/mesero';
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const token = auth.token();
  const isPublic = req.url.startsWith('/api/public') || req.url.startsWith('/api/auth/login');
  const r = token && !isPublic ? req.clone({ setHeaders: { Authorization: 'Bearer ' + token } }) : req;
  return next(r).pipe(catchError(err => {
    if (err?.status === 401 && token && !isPublic) auth.logout();
    return throwError(() => err);
  }));
};

export const staffGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.loggedIn() ? true : inject(Router).parseUrl('/ingresar');
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  if (!auth.loggedIn()) return inject(Router).parseUrl('/ingresar');
  return auth.isAdmin() ? true : inject(Router).parseUrl('/mesero');
};
