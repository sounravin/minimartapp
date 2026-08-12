import { RemoteScanEvent, Product, CustomerDisplayState } from '../types';
import { sendRemoteScanToCloud, subscribeRemoteScans } from '../lib/firebase';

const CHANNEL_NAME = 'mart_pos_wireless_channel';
const STORAGE_KEY_REMOTE_SCAN = 'mart_remote_scan_event';
const STORAGE_KEY_PING = 'mart_terminal_ping';
const STORAGE_KEY_CUSTOMER_DISPLAY = 'mart_customer_display_data';

export class WirelessSyncService {
  private static channel: BroadcastChannel | null = null;
  private static listeners: ((event: RemoteScanEvent) => void)[] = [];
  private static pingListeners: ((count: number) => void)[] = [];
  private static productSyncListeners: ((products: Product[]) => void)[] = [];
  private static customerDisplayListeners: ((state: CustomerDisplayState) => void)[] = [];
  private static activePings: Map<string, number> = new Map();
  private static cloudScanUnsub: (() => void) | null = null;

  public static init() {
    if (typeof window === 'undefined') return;

    if (!this.channel && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (e) => {
          this.handleIncomingMessage(e.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel error, falling back to localStorage events', err);
      }
    }

    // Subscribe to Firestore Cloud Realtime Remote Scans
    if (!this.cloudScanUnsub) {
      this.cloudScanUnsub = subscribeRemoteScans(undefined, (scanEvent) => {
        this.notifyScanListeners(scanEvent);
      });
    }

    // Storage event listener fallback for cross-tab sync
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY_REMOTE_SCAN && e.newValue) {
        try {
          const scanEvent: RemoteScanEvent = JSON.parse(e.newValue);
          this.notifyScanListeners(scanEvent);
        } catch (err) {
          console.error('Error parsing remote scan storage event', err);
        }
      } else if (e.key === 'mart_products' && e.newValue) {
        try {
          const productsList: Product[] = JSON.parse(e.newValue);
          this.notifyProductSyncListeners(productsList);
        } catch (err) {
          console.error('Error parsing product storage event', err);
        }
      } else if (e.key === STORAGE_KEY_CUSTOMER_DISPLAY && e.newValue) {
        try {
          const displayData: CustomerDisplayState = JSON.parse(e.newValue);
          this.notifyCustomerDisplayListeners(displayData);
        } catch (err) {
          console.error('Error parsing customer display storage event', err);
        }
      } else if (e.key === STORAGE_KEY_PING && e.newValue) {
        try {
          const pingData = JSON.parse(e.newValue);
          if (pingData.deviceId) {
            this.activePings.set(pingData.deviceId, Date.now());
            this.cleanupAndNotifyPings();
          }
        } catch (err) {
          console.error('Error parsing ping event', err);
        }
      }
    });

    // Start interval cleanup for active device pings
    setInterval(() => {
      this.cleanupAndNotifyPings();
    }, 3000);
  }

  // Broadcast customer display cart/payment state
  public static broadcastCustomerDisplay(displayState: CustomerDisplayState) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'CUSTOMER_DISPLAY_UPDATE', payload: displayState });
      } catch (err) {
        console.warn('Error broadcasting customer display update', err);
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOMER_DISPLAY, JSON.stringify(displayState));
    } catch (err) {
      console.warn('Error saving customer display state to localStorage', err);
    }
    this.notifyCustomerDisplayListeners(displayState);
  }

  // Broadcast product list changes in real time across tabs
  public static broadcastProducts(products: Product[]) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'PRODUCTS_UPDATED', payload: products });
      } catch (err) {
        console.warn('Error broadcasting product update', err);
      }
    }
    try {
      localStorage.setItem('mart_products', JSON.stringify(products));
    } catch (err) {
      console.warn('Error writing products to localStorage', err);
    }
  }

  private static cleanupAndNotifyPings() {
    const now = Date.now();
    let count = 0;
    this.activePings.forEach((timestamp, deviceId) => {
      if (now - timestamp < 10000) {
        count++;
      } else {
        this.activePings.delete(deviceId);
      }
    });
    this.pingListeners.forEach((listener) => listener(count));
  }

  private static processedScanIds = new Set<string>();

  // Send a scanned barcode from Mobile Scanner to Desktop POS
  public static sendRemoteScan(
    barcode: string,
    quantity: number = 1,
    product?: Product,
    deviceName: string = 'iPhone Mobile Scanner',
    storeUserId?: string
  ) {
    const event: RemoteScanEvent = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      barcode,
      quantity,
      timestamp: new Date().toLocaleTimeString('km-KH'),
      deviceName,
      productNameKh: product?.nameKh,
      productNameEn: product?.nameEn,
      priceUsd: product?.sellingPriceUsd,
    };

    // Also send directly to Cloud Firestore Realtime database
    sendRemoteScanToCloud(storeUserId, event);

    // Broadcast via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'REMOTE_SCAN', payload: event });
      } catch (err) {
        console.warn('Error posting broadcast message', err);
      }
    }

    // Broadcast via localStorage event
    try {
      localStorage.setItem(STORAGE_KEY_REMOTE_SCAN, JSON.stringify(event));
    } catch (err) {
      console.warn('Error writing to localStorage for remote scan', err);
    }

    // Also trigger local listeners if on same page
    this.notifyScanListeners(event);
  }

  // Send periodic ping from mobile device
  public static sendHeartbeat(deviceId: string = 'iphone-scanner-1') {
    const pingPayload = { deviceId, timestamp: Date.now() };
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'HEARTBEAT', payload: pingPayload });
      } catch (err) {
        console.warn('Error sending heartbeat', err);
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY_PING, JSON.stringify(pingPayload));
    } catch (err) {
      console.warn('Error setting ping', err);
    }
  }

  private static handleIncomingMessage(data: any) {
    if (!data) return;
    if (data.type === 'REMOTE_SCAN' && data.payload) {
      this.notifyScanListeners(data.payload);
    } else if (data.type === 'PRODUCTS_UPDATED' && Array.isArray(data.payload)) {
      this.notifyProductSyncListeners(data.payload);
    } else if (data.type === 'CUSTOMER_DISPLAY_UPDATE' && data.payload) {
      this.notifyCustomerDisplayListeners(data.payload);
    } else if (data.type === 'HEARTBEAT' && data.payload?.deviceId) {
      this.activePings.set(data.payload.deviceId, Date.now());
      this.cleanupAndNotifyPings();
    }
  }

  private static notifyScanListeners(event: RemoteScanEvent) {
    if (!event) return;
    const scanId = event.id || `${event.barcode}-${event.timestamp}`;
    if (this.processedScanIds.has(scanId)) {
      return; // Skip duplicate scan event delivery
    }
    this.processedScanIds.add(scanId);
    setTimeout(() => {
      this.processedScanIds.delete(scanId);
    }, 120000);

    this.listeners.forEach((listener) => listener(event));
  }

  private static notifyProductSyncListeners(products: Product[]) {
    this.productSyncListeners.forEach((listener) => listener(products));
  }

  private static notifyCustomerDisplayListeners(displayState: CustomerDisplayState) {
    this.customerDisplayListeners.forEach((listener) => listener(displayState));
  }

  public static onCustomerDisplay(callback: (displayState: CustomerDisplayState) => void) {
    this.customerDisplayListeners.push(callback);
    return () => {
      this.customerDisplayListeners = this.customerDisplayListeners.filter((l) => l !== callback);
    };
  }

  public static onRemoteScan(callback: (event: RemoteScanEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public static onProductSync(callback: (products: Product[]) => void) {
    this.productSyncListeners.push(callback);
    return () => {
      this.productSyncListeners = this.productSyncListeners.filter((l) => l !== callback);
    };
  }

  public static onDevicePingCount(callback: (count: number) => void) {
    this.pingListeners.push(callback);
    return () => {
      this.pingListeners = this.pingListeners.filter((l) => l !== callback);
    };
  }
}

// Auto-initialize
WirelessSyncService.init();
