import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  disableNetwork,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Product,
  Sale,
  MartDetails,
  TelegramConfig,
  CartItem,
  RemoteScanEvent,
  UserAccount,
  UserStatus,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_MART_DETAILS,
  INITIAL_TELEGRAM_CONFIG,
} from '../data/initialData';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore Database
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Clean object helper
export function cleanObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject) as unknown as T;
  }
  const cleaned: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = cleanObject(val);
    }
  }
  return cleaned;
}

// Default Admin User
export const DEFAULT_ADMIN: UserAccount = {
  id: 'usr-admin-001',
  username: 'admin',
  password: 'Admin',
  fullName: 'អ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin)',
  storeNameKh: 'ប្រព័ន្ធ MINI-POS (HQ)',
  storeNameEn: 'MINI POS System HQ',
  email: 'admin@minipos.com',
  phone: '012 345 678',
  role: 'admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: new Date().toISOString(),
};

export let isFirestoreQuotaExceeded = false;

export function handleQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || '') + String(err?.code || '') + String(err || '');
  if (
    err?.code === 'resource-exhausted' ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota')
  ) {
    if (!isFirestoreQuotaExceeded) {
      isFirestoreQuotaExceeded = true;
      console.warn('[Firestore] Free tier write quota reached. Disabling Firestore network connection to avoid retry overload.');
      try {
        disableNetwork(db).catch(() => {});
      } catch (e) {}
    }
    return true;
  }
  return false;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (handleQuotaError(error)) return;
  console.warn(`[Firestore Storage] Notice during ${operationType} on ${path}:`, error);
}

// --- USER MANAGEMENT VIA FIRESTORE ---

export function subscribeUsers(onUpdate: (users: UserAccount[]) => void) {
  let isSubscribed = true;

  const handleSnapshotUsers = (snapshotDocs: any[]) => {
    try {
      const dbUsers: UserAccount[] = [];
      snapshotDocs.forEach((docSnap) => {
        const data = docSnap.data ? docSnap.data() : docSnap;
        if (!data) return;
        const u: UserAccount = {
          id: docSnap.id || data.id,
          username: data.username || 'user',
          password: data.password || '',
          fullName: data.fullName || data.full_name || 'User',
          storeNameKh: data.storeNameKh || data.store_name_kh || 'Store',
          storeNameEn: data.storeNameEn || data.store_name_en || '',
          phone: data.phone || '',
          role: data.role || 'member',
          status: data.status || 'active',
          hidePageButton: !!(data.hidePageButton || data.hide_page_button),
          isOnline: data.isOnline !== undefined ? data.isOnline : true,
          lastActiveAt: data.lastActiveAt || data.last_active_at || new Date().toISOString(),
          createdAt: data.createdAt || data.created_at || new Date().toISOString(),
          lastLoginAt: data.lastLoginAt || data.last_login_at || new Date().toISOString(),
        };
        dbUsers.push(u);
      });

      const userMap = new Map<string, UserAccount>();
      dbUsers.forEach((u) => {
        if (u && u.id) userMap.set(u.id, u);
      });

      // ALWAYS merge localStorage cache
      try {
        const cached = localStorage.getItem('minipos_users');
        if (cached) {
          const localUsers: UserAccount[] = JSON.parse(cached);
          localUsers.forEach((lu) => {
            if (lu && lu.id && !userMap.has(lu.id)) {
              userMap.set(lu.id, lu);
            }
          });
        }
      } catch (e) {}

      let combinedUsers = Array.from(userMap.values());
      if (!combinedUsers.some((u) => u.username === 'admin')) {
        combinedUsers.unshift(DEFAULT_ADMIN);
      }

      try {
        localStorage.setItem('minipos_users', JSON.stringify(combinedUsers));
      } catch (e) {}

      if (isSubscribed) {
        onUpdate(combinedUsers);
      }
    } catch (err) {
      console.warn('Firestore snapshot users warning:', err);
    }
  };

  const handleUserUpdated = () => {
    try {
      const cached = localStorage.getItem('minipos_users');
      if (cached) onUpdate(JSON.parse(cached));
    } catch (e) {}
  };

  if (isFirestoreQuotaExceeded) {
    fetch('/api/firebase/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          handleSnapshotUsers(data.users);
        } else {
          handleUserUpdated();
        }
      })
      .catch(() => handleUserUpdated());

    window.addEventListener('minipos_user_updated', handleUserUpdated);
    window.addEventListener('focus', handleUserUpdated);

    return () => {
      isSubscribed = false;
      window.removeEventListener('minipos_user_updated', handleUserUpdated);
      window.removeEventListener('focus', handleUserUpdated);
    };
  }

  // Realtime Firestore Listener
  const usersCol = collection(db, 'users');
  const unsubscribe = onSnapshot(
    usersCol,
    (snapshot) => {
      handleSnapshotUsers(snapshot.docs);
    },
    (err) => {
      handleQuotaError(err);
      fetch('/api/firebase/users')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.users)) {
            handleSnapshotUsers(data.users);
          }
        })
        .catch(() => {});
    }
  );

  window.addEventListener('minipos_user_updated', handleUserUpdated);
  window.addEventListener('focus', handleUserUpdated);

  return () => {
    isSubscribed = false;
    unsubscribe();
    window.removeEventListener('minipos_user_updated', handleUserUpdated);
    window.removeEventListener('focus', handleUserUpdated);
  };
}

export async function fetchUsersFromCloud(): Promise<UserAccount[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const list: UserAccount[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({ ...data, id: docSnap.id } as UserAccount);
    });
    if (list.length > 0) return list;
  } catch (e) {}

  try {
    const res = await fetch('/api/firebase/users');
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) return data.users;
  } catch (e) {}

  return [DEFAULT_ADMIN];
}

export async function seedDefaultAdmin() {
  await saveUserAccountInCloud(DEFAULT_ADMIN);
}

export function subscribeCurrentUser(userId: string, onUpdate: (user: UserAccount | null) => void) {
  if (isFirestoreQuotaExceeded) {
    try {
      const cached = localStorage.getItem('minipos_users');
      if (cached) {
        const users: UserAccount[] = JSON.parse(cached);
        const match = users.find((u) => u.id === userId);
        if (match) {
          onUpdate(match);
          return () => {};
        }
      }
    } catch (e) {}

    if (userId === DEFAULT_ADMIN.id) onUpdate(DEFAULT_ADMIN);
    else onUpdate(null);
    return () => {};
  }

  const userRef = doc(db, 'users', userId);
  const unsubscribe = onSnapshot(
    userRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({ ...data, id: docSnap.id } as UserAccount);
      } else {
        if (userId === DEFAULT_ADMIN.id) {
          onUpdate(DEFAULT_ADMIN);
        } else {
          onUpdate(null);
        }
      }
    },
    () => {
      // Fallback
      try {
        const cached = localStorage.getItem('minipos_users');
        if (cached) {
          const users: UserAccount[] = JSON.parse(cached);
          const match = users.find((u) => u.id === userId);
          if (match) {
            onUpdate(match);
            return;
          }
        }
      } catch (e) {}

      if (userId === DEFAULT_ADMIN.id) onUpdate(DEFAULT_ADMIN);
      else onUpdate(null);
    }
  );

  return unsubscribe;
}

export async function saveUserAccountInCloud(userAccount: UserAccount) {
  if (!userAccount || !userAccount.id) return;

  // 1. FAST Server API POST First!
  try {
    await fetch('/api/firebase/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userAccount),
    });
  } catch (e) {}

  // 2. Save locally in localStorage
  try {
    const cached = localStorage.getItem('minipos_users');
    let usersList: UserAccount[] = cached ? JSON.parse(cached) : [DEFAULT_ADMIN];
    const idx = usersList.findIndex((u) => u.id === userAccount.id);
    if (idx >= 0) {
      usersList[idx] = { ...usersList[idx], ...userAccount };
    } else {
      usersList.push(userAccount);
    }
    localStorage.setItem('minipos_users', JSON.stringify(usersList));
    localStorage.setItem('minipos_current_user', JSON.stringify(userAccount));
  } catch (e) {}

  // 3. Dispatch custom event
  try {
    window.dispatchEvent(new CustomEvent('minipos_user_updated', { detail: userAccount }));
  } catch (e) {}

  // 4. Save to Firestore DB
  if (!isFirestoreQuotaExceeded) {
    try {
      const userRef = doc(db, 'users', userAccount.id);
      await setDoc(userRef, cleanObject(userAccount), { merge: true });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

export async function updateUserStatusInCloud(userId: string, status: UserStatus) {
  try {
    await fetch('/api/firebase/user/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status }),
    });
  } catch (e) {}

  try {
    const cached = localStorage.getItem('minipos_users');
    if (cached) {
      const usersList: UserAccount[] = JSON.parse(cached);
      const match = usersList.find((u) => u.id === userId);
      if (match) {
        match.status = status;
        localStorage.setItem('minipos_users', JSON.stringify(usersList));
      }
    }
  } catch (e) {}

  try {
    window.dispatchEvent(new CustomEvent('minipos_user_updated'));
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { status });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

export async function updateUserButtonVisibilityInCloud(userId: string, hidePageButton: boolean) {
  try {
    await fetch('/api/firebase/user/button', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, hidePageButton }),
    });
  } catch (e) {}

  try {
    const cached = localStorage.getItem('minipos_users');
    if (cached) {
      const usersList: UserAccount[] = JSON.parse(cached);
      const match = usersList.find((u) => u.id === userId);
      if (match) {
        match.hidePageButton = hidePageButton;
        localStorage.setItem('minipos_users', JSON.stringify(usersList));
      }
    }
  } catch (e) {}

  try {
    window.dispatchEvent(new CustomEvent('minipos_user_updated'));
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { hidePageButton });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

export async function updateUserActivePingInCloud(userId: string, isOnline: boolean = true) {
  const now = new Date().toISOString();
  try {
    await fetch('/api/firebase/user/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isOnline }),
    });
  } catch (e) {}

  if (isFirestoreQuotaExceeded) return;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { isOnline, lastActiveAt: now });
  } catch (err) {
    handleQuotaError(err);
  }
}

export async function deleteUserAccountInCloud(userId: string) {
  try {
    await fetch('/api/firebase/user/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch (e) {}

  try {
    const cached = localStorage.getItem('minipos_users');
    if (cached) {
      const usersList: UserAccount[] = JSON.parse(cached).filter((u: UserAccount) => u.id !== userId);
      localStorage.setItem('minipos_users', JSON.stringify(usersList));
    }
  } catch (e) {}

  try {
    window.dispatchEvent(new CustomEvent('minipos_user_updated'));
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

// --- MAINTENANCE MODE VIA FIRESTORE ---

export function subscribeMaintenanceMode(onUpdate: (isMaintenance: boolean, message?: string) => void) {
  if (isFirestoreQuotaExceeded) {
    try {
      const cached = localStorage.getItem('minipos_mtn_mode');
      if (cached) {
        const parsed = JSON.parse(cached);
        onUpdate(!!parsed.enabled, parsed.message || '');
        return () => {};
      }
    } catch (e) {}
    onUpdate(false, '');
    return () => {};
  }

  const mtnRef = doc(db, 'settings', 'maintenance_mode');
  const unsubscribe = onSnapshot(
    mtnRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate(!!data.enabled, data.message || '');
      } else {
        onUpdate(false, '');
      }
    },
    () => {
      try {
        const cached = localStorage.getItem('minipos_mtn_mode');
        if (cached) {
          const parsed = JSON.parse(cached);
          onUpdate(!!parsed.enabled, parsed.message || '');
          return;
        }
      } catch (e) {}
      onUpdate(false, '');
    }
  );

  return unsubscribe;
}

export async function setMaintenanceModeInCloud(enabled: boolean, message: string = '') {
  const payload = { enabled, message, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem('minipos_mtn_mode', JSON.stringify(payload));
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const mtnRef = doc(db, 'settings', 'maintenance_mode');
      await setDoc(mtnRef, payload, { merge: true });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

export async function fetchMaintenanceModeFromCloud() {
  if (isFirestoreQuotaExceeded) return { enabled: false, message: '' };
  try {
    const mtnRef = doc(db, 'settings', 'maintenance_mode');
    const snap = await getDoc(mtnRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    handleQuotaError(e);
  }
  return { enabled: false, message: '' };
}

// --- PRODUCTS VIA FIRESTORE ---

export function subscribeProducts(userId: string | undefined, onUpdate: (products: Product[]) => void) {
  const localKey = userId ? `mart_products_${userId}` : 'mart_products';

  if (isFirestoreQuotaExceeded) {
    try {
      const cached = localStorage.getItem(localKey) || localStorage.getItem('mart_products');
      if (cached) {
        onUpdate(JSON.parse(cached));
        return () => {};
      }
    } catch (e) {}
    onUpdate(INITIAL_PRODUCTS);
    return () => {};
  }

  const productsCol = collection(db, 'products');
  const unsubscribe = onSnapshot(
    productsCol,
    (snapshot) => {
      const products: Product[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (userId && data.userId && data.userId !== userId && data.storeId !== userId) {
          return;
        }
        products.push({
          id: docSnap.id,
          barcode: data.barcode || docSnap.id,
          nameKh: data.nameKh || 'ទំនិញ',
          nameEn: data.nameEn || 'Product',
          category: data.category || 'General',
          costPriceUsd: data.costPriceUsd ?? 0,
          sellingPriceUsd: data.sellingPriceUsd ?? 1,
          stockQuantity: data.stockQuantity ?? 10,
          minStockLevel: data.minStockLevel ?? 5,
          unit: data.unit || 'Pcs',
          imageUrl: data.imageUrl,
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      products.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      try {
        localStorage.setItem(localKey, JSON.stringify(products));
      } catch (e) {}

      onUpdate(products);
    },
    (err) => {
      handleQuotaError(err);
      try {
        const cached = localStorage.getItem(localKey) || localStorage.getItem('mart_products');
        if (cached) {
          onUpdate(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      onUpdate(INITIAL_PRODUCTS);
    }
  );

  return unsubscribe;
}

export async function fetchProductsFromCloud(userId?: string): Promise<Product[]> {
  if (!isFirestoreQuotaExceeded) {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const list: Product[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (userId && data.userId && data.userId !== userId && data.storeId !== userId) return;
        list.push({ ...data, id: docSnap.id } as Product);
      });
      if (list.length > 0) return list;
    } catch (e) {
      handleQuotaError(e);
    }
  }

  return INITIAL_PRODUCTS;
}

export async function seedInitialProductsForUser(userId: string) {
  try {
    for (const p of INITIAL_PRODUCTS) {
      await saveProductToCloud(userId, p, p.id);
    }
  } catch (err) {
    handleQuotaError(err);
  }
}

export async function saveProductToCloud(
  userId: string | undefined,
  productData: Omit<Product, 'id' | 'updatedAt'>,
  existingId?: string
) {
  const docId = existingId || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const fullProduct: Product = cleanObject({
    ...productData,
    id: docId,
    updatedAt: now,
  });

  const localKey = userId ? `mart_products_${userId}` : 'mart_products';
  try {
    const cached = localStorage.getItem(localKey);
    let list: Product[] = cached ? JSON.parse(cached) : [...INITIAL_PRODUCTS];
    const idx = list.findIndex((p) => p.id === docId);
    if (idx >= 0) {
      list[idx] = fullProduct;
    } else {
      list.unshift(fullProduct);
    }
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const prodRef = doc(db, 'products', docId);
      await setDoc(prodRef, { ...fullProduct, userId: userId || 'default', storeId: userId || 'default' }, { merge: true });
    } catch (err) {
      handleQuotaError(err);
    }
  }

  return docId;
}

export async function deleteProductFromCloud(userId: string | undefined, productId: string) {
  const localKey = userId ? `mart_products_${userId}` : 'mart_products';
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const list: Product[] = JSON.parse(cached).filter((p: Product) => p.id !== productId);
      localStorage.setItem(localKey, JSON.stringify(list));
    }
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const prodRef = doc(db, 'products', productId);
      await deleteDoc(prodRef);
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

export async function restockProductInCloud(userId: string | undefined, productId: string, currentQty: number, addQty: number) {
  const newQty = currentQty + addQty;
  const now = new Date().toISOString();

  const localKey = userId ? `mart_products_${userId}` : 'mart_products';
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const list: Product[] = JSON.parse(cached);
      const match = list.find((p) => p.id === productId);
      if (match) {
        match.stockQuantity = newQty;
        match.updatedAt = now;
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    }
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const prodRef = doc(db, 'products', productId);
      await updateDoc(prodRef, { stockQuantity: newQty, updatedAt: now });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

// --- SALES VIA FIRESTORE ---

export function subscribeSales(userId: string | undefined, onUpdate: (sales: Sale[]) => void) {
  const localKey = userId ? `mart_sales_${userId}` : 'mart_sales';

  if (isFirestoreQuotaExceeded) {
    try {
      const cached = localStorage.getItem(localKey) || localStorage.getItem('mart_sales');
      if (cached) {
        onUpdate(JSON.parse(cached));
        return () => {};
      }
    } catch (e) {}
    onUpdate([]);
    return () => {};
  }

  const salesCol = collection(db, 'sales');
  const unsubscribe = onSnapshot(
    salesCol,
    (snapshot) => {
      const sales: Sale[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (userId && data.storeId && data.storeId !== userId) return;
        sales.push({
          id: docSnap.id,
          receiptNo: data.receiptNo || docSnap.id,
          items: data.items || [],
          subtotalUsd: data.subtotalUsd ?? 0,
          discountUsd: data.discountUsd ?? 0,
          totalUsd: data.totalUsd ?? 0,
          totalKhr: data.totalKhr ?? 0,
          paidUsd: data.paidUsd ?? 0,
          paidKhr: data.paidKhr ?? 0,
          changeUsd: data.changeUsd ?? 0,
          changeKhr: data.changeKhr ?? 0,
          paymentMethod: data.paymentMethod || 'cash',
          cashierName: data.cashierName || 'Cashier',
          exchangeRate: data.exchangeRate ?? 4100,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });

      sales.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      try {
        localStorage.setItem(localKey, JSON.stringify(sales));
      } catch (e) {}

      onUpdate(sales);
    },
    (err) => {
      handleQuotaError(err);
      try {
        const cached = localStorage.getItem(localKey) || localStorage.getItem('mart_sales');
        if (cached) {
          onUpdate(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      onUpdate([]);
    }
  );

  return unsubscribe;
}

export async function saveSaleToCloud(userId: string | undefined, sale: Sale, updatedProducts: Product[]) {
  const localKey = userId ? `mart_sales_${userId}` : 'mart_sales';

  try {
    const cached = localStorage.getItem(localKey);
    const sales: Sale[] = cached ? JSON.parse(cached) : [];
    sales.unshift(sale);
    localStorage.setItem(localKey, JSON.stringify(sales));

    const prodKey = userId ? `mart_products_${userId}` : 'mart_products';
    localStorage.setItem(prodKey, JSON.stringify(updatedProducts));
  } catch (e) {}

  try {
    const checkoutPayload = convertSaleToCheckoutPayload(sale, userId, 'pos_checkout');
    await saveCheckoutToFirebase(checkoutPayload);

    if (!isFirestoreQuotaExceeded) {
      for (const p of updatedProducts) {
        const prodRef = doc(db, 'products', p.id);
        await updateDoc(prodRef, { stockQuantity: p.stockQuantity, updatedAt: new Date().toISOString() });
      }
    }
  } catch (err) {
    handleQuotaError(err);
  }
}

// --- REMOTE SCANS VIA FIRESTORE REALTIME SNAPSHOT ---

export async function sendRemoteScanToCloud(userId: string | undefined, event: Omit<RemoteScanEvent, 'id'>) {
  const fullEvent: RemoteScanEvent = {
    ...event,
    id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  if (!isFirestoreQuotaExceeded) {
    try {
      const scanRef = doc(db, 'remote_scans', fullEvent.id);
      await setDoc(scanRef, {
        ...fullEvent,
        userId: userId || 'default',
        createdAt: fullEvent.timestamp,
      });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

export function subscribeRemoteScans(userId: string | undefined, onScan: (scan: RemoteScanEvent) => void) {
  if (isFirestoreQuotaExceeded) {
    return () => {};
  }

  const processedScanIds = new Set<string>();

  const handleScan = (scan: RemoteScanEvent) => {
    if (!scan || !scan.id) return;
    if (processedScanIds.has(scan.id)) return;
    processedScanIds.add(scan.id);
    setTimeout(() => processedScanIds.delete(scan.id), 120000);
    onScan(scan);
  };

  const scansCol = collection(db, 'remote_scans');
  const unsubscribe = onSnapshot(
    scansCol,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          handleScan({
            id: change.doc.id,
            barcode: data.barcode,
            quantity: data.quantity || 1,
            timestamp: data.timestamp || data.createdAt || new Date().toISOString(),
            deviceName: data.deviceName,
            productNameKh: data.productNameKh,
            productNameEn: data.productNameEn,
            priceUsd: data.priceUsd,
          });
        }
      });
    },
    (err) => {
      handleQuotaError(err);
    }
  );

  return unsubscribe;
}

// --- MART DETAILS & TELEGRAM CONFIG VIA FIRESTORE ---

export function subscribeMartDetails(userId: string | undefined, onUpdate: (details: MartDetails) => void) {
  const localKey = userId ? `mart_details_${userId}` : 'mart_details';
  const settingKey = userId ? `mart_details_${userId}` : 'mart_details';

  if (isFirestoreQuotaExceeded) {
    try {
      const cached = localStorage.getItem(localKey) || localStorage.getItem('mart_details');
      if (cached) {
        onUpdate(JSON.parse(cached));
        return () => {};
      }
    } catch (e) {}
    onUpdate(INITIAL_MART_DETAILS);
    return () => {};
  }

  const detailsRef = doc(db, 'settings', settingKey);
  const unsubscribe = onSnapshot(
    detailsRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const details = docSnap.data() as MartDetails;
        onUpdate(details);
        try {
          localStorage.setItem(localKey, JSON.stringify(details));
        } catch (e) {}
      } else {
        try {
          const cached = localStorage.getItem(localKey) || localStorage.getItem('mart_details');
          if (cached) {
            onUpdate(JSON.parse(cached));
            return;
          }
        } catch (e) {}
        onUpdate(INITIAL_MART_DETAILS);
      }
    },
    (err) => {
      handleQuotaError(err);
      try {
        const cached = localStorage.getItem(localKey) || localStorage.getItem('mart_details');
        if (cached) {
          onUpdate(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      onUpdate(INITIAL_MART_DETAILS);
    }
  );

  return unsubscribe;
}

export async function saveMartDetailsToCloud(userId: string | undefined, details: MartDetails) {
  const localKey = userId ? `mart_details_${userId}` : 'mart_details';
  const settingKey = userId ? `mart_details_${userId}` : 'mart_details';

  try {
    localStorage.setItem(localKey, JSON.stringify(details));
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const detailsRef = doc(db, 'settings', settingKey);
      await setDoc(detailsRef, cleanObject(details), { merge: true });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

export function subscribeTelegramConfig(userId: string | undefined, onUpdate: (config: TelegramConfig) => void) {
  const localKey = userId ? `telegram_config_${userId}` : 'telegram_config';
  const settingKey = userId ? `telegram_config_${userId}` : 'telegram_config';

  if (isFirestoreQuotaExceeded) {
    try {
      const cached = localStorage.getItem(localKey) || localStorage.getItem('telegram_config');
      if (cached) {
        onUpdate(JSON.parse(cached));
        return () => {};
      }
    } catch (e) {}
    onUpdate(INITIAL_TELEGRAM_CONFIG);
    return () => {};
  }

  const configRef = doc(db, 'settings', settingKey);
  const unsubscribe = onSnapshot(
    configRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const config = docSnap.data() as TelegramConfig;
        onUpdate(config);
        try {
          localStorage.setItem(localKey, JSON.stringify(config));
        } catch (e) {}
      } else {
        try {
          const cached = localStorage.getItem(localKey) || localStorage.getItem('telegram_config');
          if (cached) {
            onUpdate(JSON.parse(cached));
            return;
          }
        } catch (e) {}
        onUpdate(INITIAL_TELEGRAM_CONFIG);
      }
    },
    (err) => {
      handleQuotaError(err);
      try {
        const cached = localStorage.getItem(localKey) || localStorage.getItem('telegram_config');
        if (cached) {
          onUpdate(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      onUpdate(INITIAL_TELEGRAM_CONFIG);
    }
  );

  return unsubscribe;
}

export async function saveTelegramConfigToCloud(userId: string | undefined, config: TelegramConfig) {
  const localKey = userId ? `telegram_config_${userId}` : 'telegram_config';
  const settingKey = userId ? `telegram_config_${userId}` : 'telegram_config';

  try {
    localStorage.setItem(localKey, JSON.stringify(config));
  } catch (e) {}

  if (!isFirestoreQuotaExceeded) {
    try {
      const configRef = doc(db, 'settings', settingKey);
      await setDoc(configRef, cleanObject(config), { merge: true });
    } catch (err) {
      handleQuotaError(err);
    }
  }
}

// --- CHECKOUT HELPERS ---

export interface CheckoutOrderPayload {
  id: string;
  receiptNo?: string;
  customerName?: string;
  customerPhone?: string;
  items: any[];
  subtotalUsd: number;
  discountUsd?: number;
  totalUsd: number;
  totalKhr: number;
  paidUsd?: number;
  paidKhr?: number;
  changeUsd?: number;
  changeKhr?: number;
  paymentMethod?: string;
  cashierName?: string;
  storeId?: string;
  source?: 'pos_checkout' | 'website_order_form' | 'customer_catalog';
  createdAt: string;
}

export async function saveCheckoutToFirebase(
  order: CheckoutOrderPayload
): Promise<{ success: boolean; error?: string; tablesSaved?: string[] }> {
  try {
    fetch('/api/firebase/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    }).catch(() => {});

    if (!isFirestoreQuotaExceeded) {
      const saleRef = doc(db, 'sales', order.id);
      await setDoc(saleRef, cleanObject(order), { merge: true });
    }

    return { success: true, tablesSaved: ['sales'] };
  } catch (err: any) {
    handleQuotaError(err);
    return { success: true, tablesSaved: ['local'] };
  }
}

// Backwards-compatible export alias
export const saveCheckoutToSupabase = saveCheckoutToFirebase;
export const saveCheckoutToCloud = saveCheckoutToFirebase;

export function convertSaleToCheckoutPayload(
  sale: Sale,
  storeId?: string,
  source: 'pos_checkout' | 'website_order_form' | 'customer_catalog' = 'pos_checkout'
): CheckoutOrderPayload {
  return {
    id: sale.id,
    receiptNo: sale.receiptNo,
    customerName: 'POS Customer',
    items: sale.items || [],
    subtotalUsd: sale.subtotalUsd,
    discountUsd: sale.discountUsd,
    totalUsd: sale.totalUsd,
    totalKhr: sale.totalKhr,
    paidUsd: sale.paidUsd,
    paidKhr: sale.paidKhr,
    changeUsd: sale.changeUsd,
    changeKhr: sale.changeKhr,
    paymentMethod: sale.paymentMethod,
    cashierName: sale.cashierName,
    storeId: storeId || 'default',
    source,
    createdAt: sale.createdAt,
  };
}

export function convertCatalogCartToCheckoutPayload(
  cartItems: CartItem[],
  customerName: string,
  exchangeRate: number = 4100,
  storeId?: string
): CheckoutOrderPayload {
  const totalUsd = cartItems.reduce((sum, ci) => sum + ci.product.sellingPriceUsd * ci.quantity, 0);
  const totalKhr = Math.round(totalUsd * exchangeRate);

  const formattedItems = cartItems.map((ci) => ({
    productId: ci.product.id,
    barcode: ci.product.barcode || ci.product.id,
    nameKh: ci.product.nameKh,
    nameEn: ci.product.nameEn,
    unit: ci.product.unit || 'Pcs',
    quantity: ci.quantity,
    costPriceUsd: ci.product.costPriceUsd || 0,
    sellingPriceUsd: ci.product.sellingPriceUsd,
    totalPriceUsd: ci.product.sellingPriceUsd * ci.quantity,
  }));

  const orderId = `FIRE-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return {
    id: orderId,
    receiptNo: orderId,
    customerName: customerName.trim() || 'Online Order Customer',
    items: formattedItems,
    subtotalUsd: totalUsd,
    discountUsd: 0,
    totalUsd: totalUsd,
    totalKhr: totalKhr,
    paidUsd: totalUsd,
    paidKhr: totalKhr,
    changeUsd: 0,
    changeKhr: 0,
    paymentMethod: 'online_order',
    cashierName: 'Website Order Form',
    storeId: storeId || 'default',
    source: 'website_order_form',
    createdAt: new Date().toISOString(),
  };
}
