import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, timer } from 'rxjs';
import { Api } from '../core/api.service';
import { Banner, Screen } from '../core/models';
import { MoneyPipe, duration } from '../core/ui';
import { MascotComponent } from '../shared/mascot.component';
import { ProductArtComponent } from '../shared/product-art.component';

/**
 * Pantalla para el televisor del bar: lo que suena, lo que sigue y publicidad rotando.
 * Se deja abierta en /pantalla y se actualiza sola cada 4 segundos.
 */
@Component({
  selector: 'bx-screen',
  standalone: true,
  imports: [MoneyPipe, MascotComponent, ProductArtComponent],
  templateUrl: './screen.component.html',
  styleUrl: './screen.component.scss',
})
export class ScreenComponent implements OnInit {
  private api = inject(Api);
  private destroyRef = inject(DestroyRef);

  data = signal<Screen | null>(null);
  offline = signal(false);
  bannerIndex = signal(0);
  clock = signal(new Date());
  /** Progreso estimado entre consultas, para que la barra avance suave. */
  progress = signal(0);
  private progressBase = { ms: 0, at: Date.now() };
  private bannerTimer?: ReturnType<typeof setTimeout>;
  duration = duration;

  banner = computed<Banner | null>(() => {
    const list = this.data()?.banners ?? [];
    return list.length ? list[this.bannerIndex() % list.length] : null;
  });
  now = computed(() => this.data()?.music.nowPlaying ?? null);
  upNext = computed(() => (this.data()?.music.upNext ?? []).slice(0, 5));
  percent = computed(() => {
    const d = this.now()?.durationMs;
    return d ? Math.min(100, (this.progress() / d) * 100) : 0;
  });

  ngOnInit(): void {
    timer(0, 4000).pipe(
      switchMap(() => this.api.get<Screen>('/public/screen').pipe(catchError(() => { this.offline.set(true); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(s => {
      if (!s) return;
      this.offline.set(false);
      const prevTitle = this.now()?.title;
      this.data.set(s);
      const np = s.music.nowPlaying;
      if (np?.progressMs != null && (np.title !== prevTitle || Math.abs(np.progressMs - this.progress()) > 3000 || !np.playing)) {
        this.progressBase = { ms: np.progressMs, at: Date.now() };
      }
      if (!this.bannerTimer) this.scheduleBanner();
    });

    timer(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.clock.set(new Date());
      const np = this.now();
      this.progress.set(np?.playing === false ? this.progressBase.ms : this.progressBase.ms + (Date.now() - this.progressBase.at));
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.bannerTimer));
  }

  fullscreen(): void {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  /** Cada banner dura lo que el administrador configuró. */
  private scheduleBanner(): void {
    const b = this.banner();
    this.bannerTimer = setTimeout(() => {
      const n = this.data()?.banners.length ?? 0;
      if (n > 1) this.bannerIndex.update(i => (i + 1) % n);
      this.scheduleBanner();
    }, Math.max(3, b?.durationSeconds ?? 10) * 1000);
  }
}
