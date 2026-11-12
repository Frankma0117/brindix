// Tipos que devuelve el backend de Brindix (ver backend/.../*Dtos.java).

export type Role = 'SUPERADMIN' | 'ADMIN' | 'WAITER';
export type RoundStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'REJECTED';
export type RoundSource = 'WAITER' | 'ADMIN' | 'CLIENT';
export type TabStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'NEQUI' | 'DAVIPLATA' | 'OTHER';
export type CallType = 'WAITER' | 'BILL';
export type SongStatus = 'PENDING' | 'QUEUED' | 'PLAYING' | 'PLAYED' | 'REJECTED';
export type MovementType = 'ENTRY' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'WASTE';
export type MusicProvider = 'MANUAL' | 'SPOTIFY' | 'YOUTUBE';
export type CashCategory = 'BILL' | 'RESTOCK' | 'WITHDRAWAL' | 'DEPOSIT' | 'TIP_PAYOUT' | 'SALARY' | 'OTHER';

export interface User {
  id: number; name: string; username: string; role: Role; active: boolean;
  createdAt?: string; lastLoginAt?: string; mustChangePassword?: boolean;
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
  trackStock: boolean; stock: number; minStock: number; available: boolean; featured: boolean; tags?: string;
  sortOrder: number; soldOut: boolean; lowStock: boolean;
}

export interface Item {
  id: number; productId: number; productName: string; unitPrice: number; quantity: number;
  note?: string; voided: boolean; voidReason?: string; lineTotal: number;
}

export interface RoundView {
  id: number; tabId: number; tableName?: string; source: RoundSource; status: RoundStatus;
  clientName?: string; note?: string; rejectReason?: string; createdByName?: string;
  assignedTo?: number; assignedToName?: string; createdAt: string; confirmedAt?: string; deliveredAt?: string;
  total: number; paid: boolean; paymentId?: number; items: Item[];
}

export interface PaymentView {
  id: number; tabId: number; tableName: string; subtotal: number; discount: number; tip: number; total: number;
  method: PaymentMethod; note?: string; collectedByName?: string; collectedAt: string; settled: boolean;
  settledByName?: string; voided: boolean; voidReason?: string;
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
  expectedCash: number; salesTotal: number; tips: number; payments: number; unsettledCount: number; unsettledTotal: number;
  movements: CashMovementView[];
}
export interface ShiftRow {
  id: number; status: string; openedAt: string; closedAt?: string; openedByName?: string; closedByName?: string;
  openingCash: number; expectedCash?: number; countedCash?: number; difference?: number; sales: number;
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
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', OTHER: 'Otro',
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  ENTRY: 'Entrada', SALE: 'Venta', RETURN: 'Devolución', ADJUSTMENT: 'Ajuste', WASTE: 'Merma',
};

export const CASH_LABELS: Record<CashCategory, string> = {
  BILL: 'Pago de recibo / servicio', RESTOCK: 'Compra o reposición de mercancía', WITHDRAWAL: 'Retiro del dueño',
  DEPOSIT: 'Ingreso de dinero', TIP_PAYOUT: 'Pago de propinas', SALARY: 'Pago a personal', OTHER: 'Otro',
};

export const ROUND_LABELS: Record<RoundStatus, string> = {
  PENDING: 'Por asignar', CONFIRMED: 'En camino', DELIVERED: 'Entregada', REJECTED: 'Rechazada',
};

export const ART_OPTIONS = [
  { key: 'beer', label: 'Cerveza' }, { key: 'cocktail', label: 'Cóctel' }, { key: 'spirit', label: 'Licor' },
  { key: 'shot', label: 'Shot' }, { key: 'wine', label: 'Vino' }, { key: 'soft', label: 'Sin alcohol' },
  { key: 'coffee', label: 'Café' }, { key: 'food', label: 'Comida' },
];
