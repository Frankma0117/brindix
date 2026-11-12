import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

/** Envoltorio mínimo de HttpClient: rutas relativas a /api y errores legibles. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Observable<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return this.http.get<T>('/api' + path, { params: p });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>('/api' + path, body ?? {});
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>('/api' + path, body);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>('/api' + path, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>('/api' + path);
  }

  /** Atajos con promesa para acciones de un solo disparo. */
  run<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs);
  }

  upload(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<{ url: string }>('/api/admin/uploads', form));
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'Sin conexión con el servidor';
    const msg = (e.error && typeof e.error === 'object' && 'error' in e.error) ? String(e.error.error) : '';
    return msg || `Error ${e.status}`;
  }
  return e instanceof Error ? e.message : 'Algo salió mal';
}
