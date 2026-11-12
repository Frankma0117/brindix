// Tipos que devuelve el backend de Brindix (ver backend/.../*Dtos.java).

export type Role = 'ADMIN' | 'WAITER';
export type RoundStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'REJECTED';
export type RoundSource = 'WAITER' | 'CLIENT';
export type TabStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'NEQUI' | 'DAVIPLATA' | 'MIXED' | 'OTHER';
export type CallType = 'WAITER' | 'BILL';
export type SongStatus = 'PENDING' | 'QUEUED' | 'PLAYING' | 'PLAYED' | 'REJECTED';
export type MovementType = 'ENTRY' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'WASTE';

export interface User {
  id: number; name: string; username: string; role: Role; active: boolean;
  createdAt?: string; lastLoginAt?: string;
}

export interface PublicVenue {
  name: string; tagline?: string; logoUrl?: string; currency: string;
  wifiName?: string; wifiPassword?: string; musicEnabled: boolean;
  clientOrdersEnabled: boolean; spotifyConnected: boolean; maxSongsPerTable: number;
}

export interface AdminVenue extends PublicVenue {
  id: number; slug: string; songApproval: boolean; spotifyAccount?: string;
}

export interface MenuProduct {
  id: number; categoryId: number; name: string; description?: string; price: number;
  imageUrl?: string; art?: string; featured: boolean; soldOut: boolean; tags: string[];
}

export interface MenuCategory { id: number; name: string; icon?: string; art?: string; products: MenuProduct[]; }

export interface Category { id: number; name: string; icon?: string; art?: string; sortOrder: number; active: boolean; products: number; }

export interface Product {
  id: number; categoryId: number; categoryName?: string; name: string; description?: string;
  price: number; cost?: number; imageUrl?: string; art?: string; unit: string; trackStock: boolean;
  stock: number; minStock: number; available: boolean; featured: boolean; tags?: string;
  sortOrder: number; soldOut: boolean; lowStock: boolean;
}

export interface Item {
  id: number; productId: number; productName: string; unitPrice: number; quantity: number;
  note?: string; voided: boolean; voidReason?: string; lineTotal: number;
}

export interface RoundView {
  id: number; tabId: number; tableName?: string; source: RoundSource; status: RoundStatus;
  clientName?: string; note?: string; rejectReason?: string; createdByName?: string; handledByName?: string;
  createdAt: string; confirmedAt?: string; deliveredAt?: string; total: number; items: Item[];
}

export interface TabView {
  id: number; tableId: number; tableName: string; status: TabStatus; customerName?: string; notes?: string;
  openedByName?: string; closedByName?: string; openedAt: string; closedAt?: string;
  subtotal: number; pendingTotal: number; discount: number; tip: number; total: number;
  paymentMethod?: PaymentMethod; itemCount: number; rounds: RoundView[];
}

export interface TableBoard {
  tableId: number; name: string; zone?: string; seats: number; code: string; tabId?: number;
  customerName?: string; openedAt?: string; total: number; itemCount: number; pendingRounds: number; calls: CallType[];
}

export interface CallView { id: number; tableId: number; tableName: string; type: CallType; createdAt: string; }

export interface Board { tables: TableBoard[]; pending: RoundView[]; calls: CallView[]; }

export interface PublicRound { id: number; status: RoundStatus; source: RoundSource; createdAt: string; rejectReason?: string; total: number; items: Item[]; }

export interface PublicTab { tableName: string; open: boolean; total: number; pendingTotal: number; rounds: PublicRound[]; calls: CallType[]; }

export interface Track { uri: string; title: string; artist: string; album?: string; image?: string; durationMs?: number; explicit: boolean; }

export interface Song {
  id: number; title: string; artist?: string; albumImage?: string; spotifyUri?: string; durationMs?: number;
  requestedBy?: string; tableName?: string; status: SongStatus; pinned: boolean; sentToPlayer: boolean;
  createdAt: string; startedAt?: string;
}

export interface NowPlaying {
  title: string; artist?: string; image?: string; durationMs?: number; progressMs?: number; playing: boolean;
  requestedBy?: string; tableName?: string; fromRequest: boolean; updatedAt: string;
}

export interface Queue { nowPlaying?: NowPlaying; upNext: Song[]; pending: Song[]; spotifyConnected: boolean; }

export interface Banner {
  id: number; title: string; subtitle?: string; imageUrl?: string; theme: string; durationSeconds: number;
  sortOrder: number; active: boolean; startsAt?: string; endsAt?: string; productId?: number;
  productName?: string; productPrice?: number; productImage?: string; live: boolean;
}

export interface Screen { venue: PublicVenue; music: Queue; banners: Banner[]; }

export interface BarTable { id: number; name: string; code: string; zone?: string; seats: number; sortOrder: number; active: boolean; }

export interface Movement {
  id: number; productId: number; productName: string; type: MovementType; quantity: number; stockAfter: number;
  unitCost?: number; supplier?: string; reference?: string; note?: string; userName?: string; tabId?: number; createdAt: string;
}

export interface StockSummary { products: number; lowStock: number; soldOut: number; inventoryValue: number; }

export interface Bucket { key: string; total: number; count: number; }
export interface ProductSales { productId: number; name: string; quantity: number; revenue: number; cost: number; }
export interface Totals {
  sales: number; subtotal: number; discounts: number; tips: number; tabs: number; averageTicket: number;
  itemsSold: number; estimatedCost: number; estimatedMargin: number;
}
export interface Summary {
  from: string; to: string; totals: Totals; byPayment: Bucket[]; byDay: Bucket[]; byHour: Bucket[];
  byWaiter: Bucket[]; topProducts: ProductSales[];
}
export interface Live { openTabs: number; openAmount: number; pendingOrders: number; openCalls: number; lowStock: number; songsQueued: number; songsPending: number; }
export interface Dashboard { today: Summary; live: Live; }

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', MIXED: 'Mixto', OTHER: 'Otro',
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  ENTRY: 'Entrada', SALE: 'Venta', RETURN: 'Devolución', ADJUSTMENT: 'Ajuste', WASTE: 'Merma',
};

export const ART_OPTIONS = [
  { key: 'beer', label: 'Cerveza' }, { key: 'cocktail', label: 'Cóctel' }, { key: 'spirit', label: 'Licor' },
  { key: 'shot', label: 'Shot' }, { key: 'wine', label: 'Vino' }, { key: 'soft', label: 'Sin alcohol' },
  { key: 'coffee', label: 'Café' }, { key: 'food', label: 'Comida' },
];
