// Tipos que devuelve el backend de Brindix (ver backend/.../*Dtos.java).

export type Role = 'SUPERADMIN' | 'ADMIN' | 'WAITER' | 'BARTENDER';
export type RoundStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'REJECTED';
export type RoundSource = 'WAITER' | 'ADMIN' | 'CLIENT';
export type TabStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'NEQUI' | 'DAVIPLATA' | 'OTHER' | 'CREDIT';
export type CallType = 'WAITER' | 'BILL';
export type SongStatus = 'PENDING' | 'QUEUED' | 'PLAYING' | 'PLAYED' | 'REJECTED';
export type MovementType = 'ENTRY' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'WASTE';
export type MusicProvider = 'MANUAL' | 'SPOTIFY' | 'YOUTUBE';
export type CashCategory = 'BILL' | 'RESTOCK' | 'WITHDRAWAL' | 'DEPOSIT' | 'TIP_PAYOUT' | 'SALARY' | 'OTHER' | 'CUSTOMER_PAYMENT';

export interface User {
  id: number; name: string; username: string; role: Role; active: boolean;
  createdAt?: string; lastLoginAt?: string; mustChangePassword?: boolean; email?: string;
}

export interface WaiterOption { id: number; name: string; role: Role; }

export interface PublicVenue {
  slug: string; name: string; tagline?: string; logoUrl?: string; currency: string;
  wifiName?: string; wifiPassword?: string; musicEnabled: boolean; musicProvider: MusicProvider;
  clientOrdersEnabled: boolean; maxSongsPerTable: number;
}

export interface Integrations {
  spotifyClientId?: string; spotifyClientSecret?: string; spotifyConnected: boolean; spotifyAccount?: string;
  spotifyRedirectUri: string; youtubeApiKey?: string; aiEnabled: boolean; storage: string; publicUrl: string;
}

export interface AdminVenue {
  id: number; slug: string; name: string; tagline?: string; logoUrl?: string; currency: string;
  wifiName?: string; wifiPassword?: string; clientOrdersEnabled: boolean; waiterCanCharge: boolean;
  musicEnabled: boolean; songApproval: boolean; maxSongsPerTable: number; musicProvider: MusicProvider;
  screenKey: string; integrations: Integrations;
}

export interface MenuProduct {
  id: number; categoryId: number; name: string; description?: string; price: number;
  imageUrl?: string; art?: string; featured: boolean; soldOut: boolean; tags: string[];
  trackStock: boolean; stock?: number; unit: string;
}

export interface MenuCategory { id: number; name: string; icon?: string; art?: string; products: MenuProduct[]; }

export interface Category { id: number; name: string; icon?: string; art?: string; sortOrder: number; active: boolean; products: number; }

export interface Product {
  id: number; categoryId: number; categoryName?: string; name: string; description?: string;
  price: number; cost?: number; profit?: number; marginPct?: number; imageUrl?: string; art?: string; unit: string;
  trackStock: boolean; stock: number; minStock: number; available: boolean; featured: boolean; needsPrep: boolean; costFromRecipe?: boolean; tags?: string;
  sortOrder: number; soldOut: boolean; lowStock: boolean;
}

export interface Item {
  id: number; productId: number; productName: string; unitPrice: number; quantity: number;
  note?: string; voided: boolean; voidReason?: string; lineTotal: number; prepStatus?: 'PENDING' | 'READY' | null;
}

export interface BarRecipeLine { ingredient: string; unit: string; quantity: number; }
export interface BarItem {
  id: number; roundId: number; tabId: number; tableName: string; at: string; quantity: number;
  productName: string; note?: string; recipe: BarRecipeLine[];
}
export interface BarQueue { items: BarItem[]; }

export interface RoundView {
  id: number; tabId: number; tableName?: string; source: RoundSource; status: RoundStatus;
  clientName?: string; note?: string; rejectReason?: string; createdByName?: string;
  assignedTo?: number; assignedToName?: string; createdAt: string; confirmedAt?: string; deliveredAt?: string;
  total: number; paid: boolean; paymentId?: number; items: Item[];
}

export interface PaymentView {
  id: number; tabId: number; tableName: string; subtotal: number; discount: number; tip: number; total: number;
  method: PaymentMethod; note?: string; collectedByName?: string; collectedAt: string; settled: boolean;
  settledByName?: string; voided: boolean; voidReason?: string; customerId?: number;
}

export interface TabView {
  id: number; tableId: number; tableName: string; status: TabStatus; customerName?: string; notes?: string;
  waiterId?: number; waiterName?: string; openedByName?: string; closedByName?: string; openedAt: string; closedAt?: string;
  consumed: number; paid: number; due: number; pendingTotal: number; itemCount: number; canCharge: boolean;
  rounds: RoundView[]; payments: PaymentView[];
}

export interface TableBoard {
  tableId: number; name: string; zone?: string; seats: number; code: string; tabId?: number;
  customerName?: string; waiterName?: string; openedAt?: string; consumed: number; due: number; itemCount: number;
  pendingRounds: number; inProgress: number; calls: CallType[];
}

export interface CallView { id: number; tableId: number; tableName: string; type: CallType; createdAt: string; }

export interface Board {
  tables: TableBoard[]; pending: RoundView[]; inProgress: RoundView[]; calls: CallView[]; cashOpen: boolean; canCharge: boolean;
}

export interface PublicRound { id: number; status: RoundStatus; source: RoundSource; createdAt: string; rejectReason?: string; total: number; paid: boolean; items: Item[]; }

export interface PublicTab { tableName: string; open: boolean; consumed: number; due: number; pendingTotal: number; rounds: PublicRound[]; calls: CallType[]; }

export interface Track { provider: MusicProvider; ref: string; title: string; artist: string; album?: string; image?: string; durationMs?: number; explicit: boolean; }

export interface Song {
  id: number; provider: MusicProvider; ref?: string; title: string; artist?: string; albumImage?: string; durationMs?: number;
  requestedBy?: string; tableName?: string; status: SongStatus; pinned: boolean; sentToPlayer: boolean;
  createdAt: string; startedAt?: string;
}

export interface NowPlaying {
  title: string; artist?: string; image?: string; durationMs?: number; progressMs?: number; playing: boolean;
  requestedBy?: string; tableName?: string; fromRequest: boolean; updatedAt: string;
}

export interface Queue { provider: MusicProvider; nowPlaying?: NowPlaying; upNext: Song[]; pending: Song[]; spotifyConnected: boolean; searchEnabled: boolean; }

export interface Banner {
  id: number; title: string; subtitle?: string; imageUrl?: string; theme: string; durationSeconds: number;
  sortOrder: number; active: boolean; startsAt?: string; endsAt?: string; productId?: number;
  productName?: string; productPrice?: number; productImage?: string; live: boolean;
  eventDate?: string; eventKind?: string; ctaWhatsapp?: boolean; whatsappPhone?: string;
}

export const EVENT_KIND_LABELS: Record<string, string> = {
  BIRTHDAY: 'Cumpleaños', PARTY: 'Fiesta', LIVE_MUSIC: 'Música en vivo', PROMO: 'Promoción', OTHER: 'Evento',
};

/** Fecha del evento en español, p. ej. "sáb 29 nov · 8:00 p. m."; vacío si el banner no es un evento. */
export function eventLabel(b: Banner): string {
  if (!b.eventDate) return '';
  const d = new Date(b.eventDate);
  const day = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
  const hour = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${hour}`;
}

export function eventWhatsappUrl(b: Banner): string {
  if (!b.ctaWhatsapp || !b.whatsappPhone) return '';
  const when = eventLabel(b);
  const msg = `Hola, quiero reservar para "${b.title}"${when ? ' (' + when + ')' : ''}. ¿Me confirman disponibilidad?`;
  return `https://wa.me/${b.whatsappPhone}?text=${encodeURIComponent(msg)}`;
}

export interface PlayerCommand { songId: number; videoId: string; title: string; }

export interface Screen { venue: PublicVenue; music: Queue; banners: Banner[]; player?: PlayerCommand; controller: boolean; }

export interface BarTable { id: number; name: string; code: string; zone?: string; seats: number; sortOrder: number; active: boolean; }

export interface Movement {
  id: number; productId: number; productName: string; type: MovementType; quantity: number; stockAfter: number;
  unitCost?: number; supplier?: string; reference?: string; note?: string; userName?: string; tabId?: number; createdAt: string;
}

export interface StockSummary { products: number; lowStock: number; soldOut: number; inventoryValue: number; saleValue: number; }

export interface Bucket { key: string; total: number; count: number; }
export interface ProductSales { productId: number; name: string; quantity: number; revenue: number; cost: number; profit: number; }
export interface Totals {
  sales: number; subtotal: number; discounts: number; tips: number; payments: number; tabs: number; averageTicket: number;
  itemsSold: number; cost: number; profit: number; marginPct: number;
}
export interface Summary {
  from: string; to: string; totals: Totals; byPayment: Bucket[]; byDay: Bucket[]; byHour: Bucket[];
  byWaiter: Bucket[]; products: ProductSales[];
}
export interface Live {
  openTabs: number; openConsumed: number; openDue: number; pendingOrders: number; inProgress: number; openCalls: number;
  lowStock: number; songsQueued: number; songsPending: number; cashOpen: boolean; expectedCash?: number;
  unsettledCount: number; unsettledTotal: number;
}
export interface Dashboard { today: Summary; live: Live; }

export interface CashMovementView {
  id: number; direction: 'IN' | 'OUT'; category: CashCategory; method: string; amount: number; description: string;
  createdByName?: string; createdAt: string;
}
export interface ShiftStatus {
  id: number; openedAt: string; openedByName?: string; openingCash: number; cashSales: number; cashIn: number; cashOut: number;
  expectedCash: number; salesTotal: number; tips: number; payments: number; unsettledCount: number; unsettledTotal: number; creditTotal: number;
  movements: CashMovementView[];
}
export interface ShiftRow {
  id: number; status: string; openedAt: string; closedAt?: string; openedByName?: string; closedByName?: string;
  openingCash: number; expectedCash?: number; countedCash?: number; difference?: number; sales: number; creditTotal?: number;
}
export interface AuditView { id: number; userName?: string; action: string; entity: string; entityId?: number; details?: string; createdAt: string; }
export interface ShiftReport {
  shiftId: number; status: string; openedAt: string; closedAt?: string; openedBy?: string; closedBy?: string;
  cash: ShiftStatus; countedCash?: number; difference?: number; openingNote?: string; closingNote?: string;
  totals: Totals; byPayment: Bucket[]; byWaiter: Bucket[]; products: ProductSales[]; sensitive: AuditView[];
  openTabs: number; openDue: number;
}

export interface PlatformVenue {
  id: number; name: string; slug: string; active: boolean; contactName?: string; contactPhone?: string;
  users: number; admin?: string; createdAt: string;
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', OTHER: 'Otro', CREDIT: 'Fiado',
};

/** Métodos con los que entra dinero de verdad (sin fiado). */
export const MONEY_METHODS = (Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).filter(m => m[0] !== 'CREDIT');

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  ENTRY: 'Entrada', SALE: 'Venta', RETURN: 'Devolución', ADJUSTMENT: 'Ajuste', WASTE: 'Merma',
};

export const CASH_LABELS: Record<CashCategory, string> = {
  BILL: 'Pago de recibo / servicio', RESTOCK: 'Compra o reposición de mercancía', WITHDRAWAL: 'Retiro del dueño',
  DEPOSIT: 'Ingreso de dinero', TIP_PAYOUT: 'Pago de propinas', SALARY: 'Pago a personal', OTHER: 'Otro', CUSTOMER_PAYMENT: 'Abono de cliente',
};

export const ROUND_LABELS: Record<RoundStatus, string> = {
  PENDING: 'Por asignar', CONFIRMED: 'En camino', DELIVERED: 'Entregada', REJECTED: 'Rechazada',
};

export const ART_OPTIONS = [
  { key: 'beer', label: 'Cerveza' }, { key: 'cocktail', label: 'Cóctel' }, { key: 'spirit', label: 'Licor' },
  { key: 'shot', label: 'Shot' }, { key: 'wine', label: 'Vino' }, { key: 'soft', label: 'Sin alcohol' },
  { key: 'coffee', label: 'Café' }, { key: 'food', label: 'Comida' },
];

export interface CustomerRow { id: number; name: string; phone?: string; note?: string; balance: number; lastMovementAt?: string; preferred?: boolean; }
export interface CustomerOption { id: number; name: string; phone?: string; balance: number; preferred?: boolean; }
export interface CustomerEntry {
  kind: 'CREDIT' | 'PAYMENT'; id: number; amount: number; method: PaymentMethod; note?: string; byName?: string;
  at: string; voided: boolean; detail?: string;
}
export interface CustomerDetail { customer: CustomerRow; entries: CustomerEntry[]; }
export interface CustomerOverview { totalOwed: number; debtors: number; customers: CustomerRow[]; }

export interface AppNotification { id: number; type: string; title: string; body?: string; link?: string; createdAt: string; read: boolean; }
export interface NotificationFeed { unread: number; items: AppNotification[]; }
export interface SetupItem { key: string; title: string; hint: string; link: string; done: boolean; }

export type IngredientMovementType = 'ENTRY' | 'SALE' | 'ADJUST' | 'WASTE' | 'SALE_VOID';
export const INGREDIENT_MOVEMENT_LABELS: Record<IngredientMovementType, string> = {
  ENTRY: 'Entrada', SALE: 'Venta', ADJUST: 'Conteo', WASTE: 'Merma', SALE_VOID: 'Devuelto por anulación',
};
export interface Ingredient { id: number; name: string; unit: string; stock: number; minStock?: number | null; avgCost: number; low: boolean; }
export interface IngredientMovement { id: number; type: IngredientMovementType; quantity: number; stockAfter: number; unitCost?: number; note?: string; createdAt: string; }
export interface RecipeLine { ingredientId: number; name: string; unit: string; quantity: number; unitCost: number; lineCost: number; }
export interface Recipe { productId: number; price: number; lines: RecipeLine[]; cost: number; margin: number; marginPct?: number | null; }
