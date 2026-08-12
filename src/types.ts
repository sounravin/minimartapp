export type Language = 'km' | 'en';

export interface Product {
  id: string;
  barcode: string;
  nameKh: string;
  nameEn: string;
  category: string;
  costPriceUsd: number;
  sellingPriceUsd: number;
  stockQuantity: number;
  minStockLevel: number; // Low stock alert threshold
  unit: string; // Bottle, Can, Pack, Box, Kg, Pcs
  imageUrl?: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent?: number;
}

export interface SaleItem {
  productId: string;
  barcode: string;
  nameKh: string;
  nameEn: string;
  unit: string;
  quantity: number;
  costPriceUsd: number;
  sellingPriceUsd: number;
  totalPriceUsd: number;
}

export interface Sale {
  id: string;
  receiptNo: string;
  items: SaleItem[];
  subtotalUsd: number;
  discountUsd: number;
  totalUsd: number;
  totalKhr: number;
  paidUsd: number;
  paidKhr: number;
  changeUsd: number;
  changeKhr: number;
  paymentMethod: 'cash' | 'khqr' | 'split';
  cashierName: string;
  exchangeRate: number; // e.g., 4100 KHR per 1 USD
  createdAt: string; // ISO string
  telegramSent?: boolean;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  autoSendReceipt: boolean;
  autoSendDailyReport: boolean;
  isConnected: boolean;
  lastTestedAt?: string;
}

export interface MartDetails {
  nameKh: string;
  nameEn: string;
  addressKh: string;
  addressEn: string;
  phone: string;
  taxNo?: string;
  logoUrl?: string;
  receiptFooterMessageKh: string;
  receiptFooterMessageEn: string;
  defaultExchangeRate: number; // KHR per 1 USD
  autoPrintReceipt: boolean;
}

export type ActiveTab = 'pos' | 'inventory' | 'sales' | 'reports' | 'settings' | 'mobile_scanner' | 'admin_console' | 'customer_display';

export interface CustomerDisplayState {
  storeLogoUrl?: string;
  storeNameKh?: string;
  storeNameEn?: string;
  exchangeRate: number;
  cart: CartItem[];
  subtotalUsd: number;
  subtotalKhr: number;
  discountPercent: number;
  discountAmountUsd: number;
  grandTotalUsd: number;
  grandTotalKhr: number;
  lastScannedItem?: {
    product: Product;
    quantity: number;
    timestamp: string;
  } | null;
  paymentState?: {
    isPaymentOpen: boolean;
    paymentMethod?: 'cash' | 'khqr' | 'split';
    paidUsd?: number;
    paidKhr?: number;
    changeDueUsd?: number;
    changeDueKhr?: number;
    isCompleted?: boolean;
    receiptNo?: string;
  } | null;
}

export type UserRole = 'admin' | 'member';
export type UserStatus = 'active' | 'suspended';

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  fullName?: string;
  storeNameKh?: string;
  storeNameEn?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  isOnline?: boolean;
  totalSalesCount?: number;
  deviceType?: string;
  deviceIp?: string;
  hidePageButton?: boolean;
  avatarUrl?: string;
}

export interface RemoteScanEvent {
  id: string;
  barcode: string;
  quantity: number;
  timestamp: string;
  deviceName?: string;
  productNameKh?: string;
  productNameEn?: string;
  priceUsd?: number;
}

export interface TerminalPairingInfo {
  sessionId: string;
  connectedDeviceCount: number;
  lastActiveAt: string;
}
