import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { BarTable } from '../../core/models';
import { Toasts } from '../../core/ui';
import { VenueContext } from '../../core/venue-context';
import { MascotComponent } from '../../shared/mascot.component';
import { QrComponent } from '../../shared/qr.component';
import { IconComponent } from '../../shared/icon.component';

interface TableForm { id?: number; name: string; zone: string; seats: number; sortOrder: number; active: boolean; }

@Component({
  selector: 'bx-tables',
  standalone: true,
  imports: [IconComponent, FormsModule, QrComponent, MascotComponent],
  template: `
  <div class="page-head no-print">
    <div><h1>Mesas y QR</h1><p>Imprime el QR de cada mesa: el cliente lo escanea y ve la carta, pide y pone música.</p></div>
    <div class="row"><button class="btn" (click)="print()"><bx-icon name="printer" /> Imprimir todos</button><button class="btn primary" (click)="edit()"><bx-icon name="plus" /> Nueva mesa</button></div>
  </div>

  <div class="tgrid no-print">
    @for (t of tables(); track t.id) {
      <div class="card t" [class.off]="!t.active">
        <bx-qr [text]="url(t)" [size]="132" />
        <div class="grow col" style="gap: 4px">
          <p class="strong name">{{ t.name }}</p>
          <p class="tiny muted">{{ t.zone || 'Sin zona' }} · {{ t.seats }} puestos</p>
          <a class="tiny ellipsis" [href]="url(t)" target="_blank">{{ url(t) }}</a>
          <div class="row wrap" style="gap: 6px; margin-top: 6px">
            <button class="btn xs" (click)="edit(t)">Editar</button>
            <button class="btn xs" (click)="regen(t)">Nuevo código</button>
            <button class="btn xs" (click)="printOne(t)">Imprimir</button>
          </div>
        </div>
      </div>
    }
  </div>

  <section class="print-sheet">
    @for (t of printable(); track t.id) {
      <div class="qr-card">
        <bx-mascot [size]="58" [animate]="false" />
        <p class="v">{{ ctx.name() }}</p>
        <p class="tn">{{ t.name }}</p>
        <bx-qr [text]="url(t)" [size]="190" />
        <p class="cta">Escanéame</p>
        <p class="sub">Mira la carta · Pon tu canción · Llama al mesero</p>
        @if (ctx.venue()?.wifiName) { <p class="wifi">Wi-Fi: {{ ctx.venue()!.wifiName }} · {{ ctx.venue()!.wifiPassword }}</p> }
      </div>
    }
  </section>

  @if (form(); as f) {
    <div class="backdrop" (click)="form.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head"><h2>{{ f.id ? 'Editar mesa' : 'Nueva mesa' }}</h2><button class="btn icon sm" (click)="form.set(null)" aria-label="Cerrar"><bx-icon name="x" /></button></div>
        <div class="form-grid">
          <label class="field"><span>Nombre</span><input class="input" [(ngModel)]="f.name" placeholder="Mesa 9"></label>
          <label class="field"><span>Zona</span><input class="input" [(ngModel)]="f.zone" placeholder="Salón, Terraza…"></label>
          <label class="field"><span>Puestos</span><input class="input" type="number" min="1" [(ngModel)]="f.seats"></label>
          <label class="field"><span>Orden</span><input class="input" type="number" [(ngModel)]="f.sortOrder"></label>
          <label class="check full"><input type="checkbox" [(ngModel)]="f.active"> Activa</label>
        </div>
        <div class="modal-foot"><button class="btn" (click)="form.set(null)">Cancelar</button><button class="btn primary" [disabled]="!f.name.trim()" (click)="save()">Guardar</button></div>
      </div>
    </div>
  }`,
  styles: [`
    .tgrid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .t { display: flex; gap: 14px; align-items: center; }
    .t.off { opacity: .5; }
    .name { font-size: 18px; font-weight: 800; }
    .print-sheet { display: none; }
    @media print {
      :host ::ng-deep .side, :host ::ng-deep .mobile-top { display: none !important; }
      .print-sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
      .qr-card { break-inside: avoid; border: 2px solid #000; border-radius: 6mm; padding: 6mm; text-align: center; color: #000; display: flex; flex-direction: column; align-items: center; gap: 2mm; }
      .v { font-size: 13px; letter-spacing: .2em; text-transform: uppercase; font-weight: 800; }
      .tn { font-family: var(--display); font-size: 30px; font-weight: 800; }
      .cta { font-size: 20px; font-weight: 800; }
      .sub, .wifi { font-size: 11px; }
    }
  `],
})
export class TablesComponent implements OnInit {
  private api = inject(Api);
  private toasts = inject(Toasts);
  ctx = inject(VenueContext);
  tables = signal<BarTable[]>([]);
  printable = signal<BarTable[]>([]);
  form = signal<TableForm | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<BarTable[]>('/admin/tables').subscribe(t => this.tables.set(t));
  }

  url(t: BarTable): string {
    return `${location.origin}/${this.ctx.slug()}/m/${t.code}`;
  }

  edit(t?: BarTable): void {
    this.form.set(t ? { id: t.id, name: t.name, zone: t.zone ?? '', seats: t.seats, sortOrder: t.sortOrder, active: t.active }
      : { name: `Mesa ${this.tables().length + 1}`, zone: '', seats: 4, sortOrder: this.tables().length + 1, active: true });
  }

  async save(): Promise<void> {
    const f = this.form();
    if (!f) return;
    try {
      if (f.id) await this.api.run(this.api.put(`/admin/tables/${f.id}`, f));
      else await this.api.run(this.api.post('/admin/tables', f));
      this.form.set(null);
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async regen(t: BarTable): Promise<void> {
    if (!confirm(`¿Generar un QR nuevo para ${t.name}? El QR impreso actual dejará de funcionar.`)) return;
    try {
      await this.api.run(this.api.post(`/admin/tables/${t.id}/regenerate-code`));
      this.toasts.ok('Código nuevo. Imprime el QR otra vez.');
      this.load();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  print(): void {
    this.printable.set(this.tables().filter(t => t.active));
    setTimeout(() => window.print(), 600);
  }

  printOne(t: BarTable): void {
    this.printable.set([t]);
    setTimeout(() => window.print(), 600);
  }
}
