import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { POS } from './components/POS';
import { Inventory } from './components/Inventory';
import { SalesHistory } from './components/SalesHistory';
import { Reports } from './components/Reports';
import { MobileScannerTerminal } from './components/MobileScannerTerminal';
import { ProductFormModal } from './components/ProductFormModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { BarcodePrintModal } from './components/BarcodePrintModal';
import { ReceiptModal } from './components/ReceiptModal';
import { SettingsModal } from './components/SettingsModal';
import { WelcomeAuth } from './components/WelcomeAuth';
import { AdminConsole } from './components/AdminConsole';
import { CustomerDisplay } from './components/CustomerDisplay';
import { CustomerCatalog } from './components/CustomerCatalog';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { Wrench, AlertTriangle } from 'lucide-react';

import {
  ActiveTab,
  Language,
  Product,
  Sale,
  MartDetails,
  TelegramConfig,
  UserAccount,
} from './types';
import {
  INITIAL_PRODUCTS,
  INITIAL_MART_DETAILS,
  INITIAL_TELEGRAM_CONFIG,
} from './data/initialData';
import { WirelessSyncService } from './utils/syncChannel';
import {
  saveCheckoutToFirebase,
  convertSaleToCheckoutPayload,
  subscribeProducts,
  subscribeSales,
  subscribeMartDetails,
  subscribeTelegramConfig,
  saveProductToCloud,
  deleteProductFromCloud,
  restockProductInCloud,
  saveSaleToCloud,
  saveMartDetailsToCloud,
  saveTelegramConfigToCloud,
  subscribeUsers,
  subscribeCurrentUser,
  subscribeMaintenanceMode,
  saveUserAccountInCloud,
  updateUserActivePingInCloud,
  DEFAULT_ADMIN,
  isFirestoreQuotaExceeded,
} from './lib/firebase';

export default function App() {
  const [isStandaloneScanner, setIsStandaloneScanner] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.search.includes('mode=scanner');
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    return typeof window !== 'undefined' && window.location.search.includes('mode=scanner')
      ? 'mobile_scanner'
      : 'pos';
  });
  const [language, setLanguage] = useState<Language>('km');

  // User Authentication & Session State
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [inspectedUserStore, setInspectedUserStore] = useState<UserAccount | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('minipos_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Core Persistent State
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('mart_products');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('mart_sales');
    if (!saved) return [];
    try {
      const parsed: Sale[] = JSON.parse(saved);
      const seen = new Set<string>();
      return parsed.filter((s) => {
        if (!s || !s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    } catch (e) {
      return [];
    }
  });

  const [martDetails, setMartDetails] = useState<MartDetails>(() => {
    const saved = localStorage.getItem('mart_details');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_MART_DETAILS;
  });

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem('mart_telegram');
    return saved ? JSON.parse(saved) : INITIAL_TELEGRAM_CONFIG;
  });

  // Modal States
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [cameraScanCallback, setCameraScanCallback] = useState<((barcode: string) => void) | null>(null);

  const [isBarcodePrintOpen, setIsBarcodePrintOpen] = useState(false);
  const [productToPrintBarcode, setProductToPrintBarcode] = useState<Product | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeSaleForReceipt, setActiveSaleForReceipt] = useState<Sale | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // System Maintenance Mode State
  const [isMtnMode, setIsMtnMode] = useState<boolean>(false);
  const [mtnMessage, setMtnMessage] = useState<string>('');

  // Ensure legacy Firestore quota flag is removed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('minipos_firestore_quota_exceeded');
    }
  }, []);

  useEffect(() => {
    const unsubMtn = subscribeMaintenanceMode((enabled, msg) => {
      setIsMtnMode(enabled);
      setMtnMessage(msg || '');
    });
    return () => unsubMtn();
  }, []);

  // Sync session user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('minipos_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('minipos_current_user');
    }
  }, [currentUser]);

  // Subscribe to all User Accounts (for Admin Console)
  useEffect(() => {
    const unsubUsers = subscribeUsers((users) => {
      setUsersList(users);
    });
    return () => unsubUsers();
  }, []);

  // Realtime Session Status Monitor: Auto Log Out when account is suspended or deleted by Admin + Instant Presence Tracking
  useEffect(() => {
    if (!currentUser) return;

    const userId = currentUser.id;
    const hasLoadedSession = { current: false };

    // 1. Ensure user doc exists in Firestore & send immediate presence ping
    saveUserAccountInCloud(currentUser);
    updateUserActivePingInCloud(userId, true);

    // 2. Heartbeat ping every 60 seconds to maintain online status
    const pingInterval = setInterval(() => {
      updateUserActivePingInCloud(userId, true);
    }, 60000);

    // 3. Handle tab visibility change (Instant online/offline when switching tabs/apps)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateUserActivePingInCloud(userId, false);
      } else if (document.visibilityState === 'visible') {
        updateUserActivePingInCloud(userId, true);
      }
    };

    // 4. Handle page hide / window unload (Instant offline when closing tab)
    const handlePageHide = () => {
      updateUserActivePingInCloud(userId, false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    const unsubSession = subscribeCurrentUser(userId, (userDoc) => {
      if (userDoc) {
        hasLoadedSession.current = true;

        if (userDoc.status === 'suspended') {
          alert(
            language === 'km'
              ? '⚠️ គណនីរបស់អ្នកត្រូវបានផ្អាកដោយ អ្នកគ្រប់គ្រង (Admin)! ប្រព័ន្ធបាន Log Out ស្វ័យប្រវត្តិ។'
              : '⚠️ Your account was suspended by Admin! You have been logged out automatically.'
          );
          setCurrentUser(null);
          localStorage.removeItem('minipos_current_user');
          return;
        }

        // Sync updated profile details from Cloud to local state
        setCurrentUser(userDoc);
      } else {
        // userDoc is null (missing in Firestore)
        if (hasLoadedSession.current) {
          // Document was present and was just deleted by Admin in real-time
          alert(
            language === 'km'
              ? '⚠️ គណនីរបស់អ្នកត្រូវបានលុបចេញពីប្រព័ន្ធដោយ អ្នកគ្រប់គ្រង (Admin)! ប្រព័ន្ធបាន Log Out ស្វ័យប្រវត្តិ។'
              : '⚠️ Your account was deleted by Admin! You have been logged out automatically.'
          );
          setCurrentUser(null);
          localStorage.removeItem('minipos_current_user');
        } else {
          // On first snapshot, if missing, re-sync account to Firestore
          saveUserAccountInCloud(currentUser);
        }
      }
    });

    return () => {
      clearInterval(pingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      unsubSession();
    };
  }, [currentUser?.id, language]);

  // Sync to localStorage and cross-tab storage listener for real-time sync across devices/windows
  useEffect(() => {
    localStorage.setItem('mart_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('mart_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('mart_details', JSON.stringify(martDetails));
  }, [martDetails]);

  useEffect(() => {
    localStorage.setItem('mart_telegram', JSON.stringify(telegramConfig));
  }, [telegramConfig]);

  // Real-time synchronization listener across tabs/windows via BroadcastChannel & Storage
  useEffect(() => {
    const unsubscribeProductSync = WirelessSyncService.onProductSync((newProducts) => {
      setProducts(newProducts);
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mart_products' && e.newValue) {
        try {
          setProducts(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Error syncing products across tabs', err);
        }
      } else if (e.key === 'mart_sales' && e.newValue) {
        try {
          setSales(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Error syncing sales across tabs', err);
        }
      } else if (e.key === 'mart_details' && e.newValue) {
        try {
          setMartDetails(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Error syncing mart details across tabs', err);
        }
      } else if (e.key === 'mart_telegram' && e.newValue) {
        try {
          setTelegramConfig(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Error syncing telegram config across tabs', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      unsubscribeProductSync();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Handle open camera scanner
  const handleOpenCameraScanner = (onScan: (barcode: string) => void) => {
    setCameraScanCallback(() => onScan);
    setIsBarcodeScannerOpen(true);
  };

  const handleCameraBarcodeScanned = (scannedCode: string) => {
    if (cameraScanCallback) {
      cameraScanCallback(scannedCode);
    }
    setIsBarcodeScannerOpen(false);
  };

  // Effective target user ID for database scoping
  const targetUserId = (currentUser?.role === 'admin' && inspectedUserStore)
    ? inspectedUserStore.id
    : currentUser?.id;

  // Subscribe to Cloud Firestore Realtime database (Scoped per User Store)
  useEffect(() => {
    if (!targetUserId) return;

    const unsubProducts = subscribeProducts(targetUserId, (newProducts) => {
      setProducts(newProducts);
      localStorage.setItem('mart_products', JSON.stringify(newProducts));
    });

    const unsubSales = subscribeSales(targetUserId, (newSales) => {
      const seen = new Set<string>();
      const uniqueSales = newSales.filter((s) => {
        if (!s || !s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      setSales(uniqueSales);
      localStorage.setItem('mart_sales', JSON.stringify(uniqueSales));
    });

    const unsubMartDetails = subscribeMartDetails(targetUserId, (newDetails) => {
      setMartDetails(newDetails);
      localStorage.setItem('mart_details', JSON.stringify(newDetails));
    });

    const unsubTelegram = subscribeTelegramConfig(targetUserId, (newConfig) => {
      setTelegramConfig(newConfig);
      localStorage.setItem('mart_telegram', JSON.stringify(newConfig));
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubMartDetails();
      unsubTelegram();
    };
  }, [targetUserId]);

  // Product CRUD with Cloud Firestore Sync
  const handleSaveProduct = async (
    productData: Omit<Product, 'id' | 'updatedAt'>,
    existingId?: string
  ) => {
    // 1. Save to Cloud Firestore and receive confirmed doc ID
    const savedId = await saveProductToCloud(targetUserId, productData, existingId);
    const finalId = savedId || existingId || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 2. Local State Optimistic Update with matching ID
    let updatedList: Product[] = [];
    if (existingId) {
      updatedList = products.map((p) =>
        p.id === existingId
          ? { ...p, ...productData, id: existingId, updatedAt: new Date().toISOString() }
          : p
      );
    } else {
      const newProduct: Product = {
        ...productData,
        id: finalId,
        updatedAt: new Date().toISOString(),
      };
      updatedList = [newProduct, ...products];
    }
    setProducts(updatedList);
    WirelessSyncService.broadcastProducts(updatedList);
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProductFromCloud(targetUserId, productId);
    const updatedList = products.filter((p) => p.id !== productId);
    setProducts(updatedList);
    WirelessSyncService.broadcastProducts(updatedList);
  };

  const handleRestockProduct = async (productId: string, addQty: number) => {
    const targetProd = products.find((p) => p.id === productId);
    if (targetProd) {
      await restockProductInCloud(targetUserId, productId, targetProd.stockQuantity, addQty);
    }
    const updatedList = products.map((p) =>
      p.id === productId
        ? {
            ...p,
            stockQuantity: p.stockQuantity + addQty,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    setProducts(updatedList);
    WirelessSyncService.broadcastProducts(updatedList);
  };

  // Handle Complete Sale
  const handleCompleteSale = async (newSale: Sale) => {
    // 1. Calculate updated stock quantity for sold products
    const updatedProducts = products.map((product) => {
      const itemInSale = newSale.items.find((i) => i.productId === product.id);
      if (itemInSale) {
        const newQty = Math.max(0, product.stockQuantity - itemInSale.quantity);
        return { ...product, stockQuantity: newQty, updatedAt: new Date().toISOString() };
      }
      return product;
    });

    // 2. Save sale and stock deduction to Cloud Firestore
    await saveSaleToCloud(targetUserId, newSale, updatedProducts);

    // 2b. Store checkout order data in Firestore database
    try {
      const checkoutPayload = convertSaleToCheckoutPayload(newSale, targetUserId, 'pos_checkout');
      await saveCheckoutToFirebase(checkoutPayload);
    } catch (fireErr) {
      console.warn('Firestore checkout save note:', fireErr);
    }

    // 3. Update local state
    setProducts(updatedProducts);
    setSales((prev) => {
      const combined = [newSale, ...prev];
      const seen = new Set<string>();
      return combined.filter((s) => {
        if (!s || !s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    });

    // 4. Open receipt popup
    setActiveSaleForReceipt(newSale);
    setIsReceiptModalOpen(true);
  };

  // Save Mart Settings to local state and Cloud Firestore
  const handleSaveMartDetails = async (newDetails: MartDetails) => {
    setMartDetails(newDetails);
    localStorage.setItem('mart_details', JSON.stringify(newDetails));
    await saveMartDetailsToCloud(targetUserId, newDetails);

    // Sync store name in user session if logged in
    if (currentUser && newDetails.nameKh && !inspectedUserStore) {
      const updatedUser = { ...currentUser, storeNameKh: newDetails.nameKh };
      setCurrentUser(updatedUser);
      localStorage.setItem('minipos_current_user', JSON.stringify(updatedUser));
    }
  };

  const handleSaveTelegramConfig = async (newConfig: TelegramConfig) => {
    setTelegramConfig(newConfig);
    localStorage.setItem('mart_telegram', JSON.stringify(newConfig));
    await saveTelegramConfigToCloud(targetUserId, newConfig);
  };

  const handleLogout = () => {
    if (currentUser?.id) {
      updateUserActivePingInCloud(currentUser.id, false);
    }
    setCurrentUser(null);
    localStorage.removeItem('minipos_current_user');
    localStorage.removeItem('mart_products');
    localStorage.removeItem('mart_sales');
    localStorage.removeItem('mart_details');
    localStorage.removeItem('mart_telegram');
    setProducts([]);
    setSales([]);
    setMartDetails(INITIAL_MART_DETAILS);
    setTelegramConfig(INITIAL_TELEGRAM_CONFIG);
  };

  // Low stock alert count
  const lowStockCount = products.filter((p) => p.stockQuantity <= p.minStockLevel).length;

  if (isStandaloneScanner) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 p-2 sm:p-4">
        <div className="max-w-md mx-auto">
          <MobileScannerTerminal
            products={products}
            onSaveProduct={handleSaveProduct}
            onRestockProduct={handleRestockProduct}
            language={language}
            martDetails={martDetails}
            switchToDesktopPos={() => {
              window.history.replaceState({}, '', window.location.pathname);
              setIsStandaloneScanner(false);
              setActiveTab('pos');
            }}
          />
        </div>
      </div>
    );
  }

  // Check standalone Customer Display URL parameter (Second Monitor)
  const isCustomerDisplayMode =
    typeof window !== 'undefined' &&
    (window.location.search.includes('mode=customer_display') ||
      window.location.search.includes('mode=display') ||
      window.location.search.includes('mode=customer'));

  if (isCustomerDisplayMode) {
    return <CustomerDisplay martDetails={martDetails} language={language} />;
  }

  // Check Online Customer Catalog Shortcut URL parameter
  const isCustomerCatalogMode =
    typeof window !== 'undefined' &&
    (window.location.search.includes('mode=catalog') ||
      window.location.search.includes('mode=store') ||
      window.location.search.includes('store='));

  if (isCustomerCatalogMode) {
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store') || urlParams.get('user') || undefined;
    return <CustomerCatalog storeId={storeId} language={language} />;
  }

  // Render Welcome / Sign in page if not logged in
  if (!currentUser) {
    return (
      <WelcomeAuth
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'admin') {
            setActiveTab('admin_console');
          } else {
            setActiveTab('pos');
          }
        }}
        language={language}
        setLanguage={setLanguage}
        existingUsers={usersList}
      />
    );
  }

  // Check if System Maintenance Mode is active (Regular users see Maintenance Screen)
  if (isMtnMode && currentUser?.role !== 'admin') {
    return <MaintenanceScreen language={language} message={mtnMessage} />;
  }

  return (
    <div className="min-h-screen font-sans antialiased bg-[#eef2f6] text-slate-800 selection:bg-amber-400 selection:text-slate-950 font-khmer">
      {/* System Maintenance Mode Warning Bar for Admin */}
      {isMtnMode && currentUser?.role === 'admin' && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-center text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md">
          <Wrench className="w-4 h-4 shrink-0 animate-bounce" />
          <span>
            {language === 'km'
              ? `⚠️ MTN (Maintenance Mode) កំពុងបើក — Member ទាំងអស់ឃើញផ្ទាំង Under Maintenance (${mtnMessage || 'ប្រព័ន្ធកំពុងកែសម្រួល'})`
              : `⚠️ MTN (Maintenance Mode) is ON — Members see Under Maintenance screen`}
          </span>
        </div>
      )}

      {/* Top Main Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={language}
        setLanguage={setLanguage}
        martDetails={martDetails}
        telegramConfig={telegramConfig}
        lowStockCount={lowStockCount}
        openSettings={() => setIsSettingsModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onUpdateCurrentUser={(updated) => {
          setCurrentUser(updated);
          localStorage.setItem('minipos_current_user', JSON.stringify(updated));
          saveUserAccountInCloud(updated);
        }}
        inspectedUserStore={inspectedUserStore}
        onClearInspectedStore={() => setInspectedUserStore(null)}
      />

      {/* Admin Store Switch Banner Bar */}
      {inspectedUserStore && currentUser?.role === 'admin' && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 px-4 sm:px-8 py-2.5 font-khmer font-black text-xs sm:text-sm flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-950 animate-ping shrink-0"></span>
            <span className="truncate">
              {language === 'km'
                ? `🔍 កំពុងគ្រប់គ្រងទិន្នន័យហាង Member: ${inspectedUserStore.storeNameKh || inspectedUserStore.username}`
                : `Managing Store Data for Member: ${inspectedUserStore.username}`}
            </span>
          </div>
          <button
            onClick={() => {
              setInspectedUserStore(null);
              setActiveTab('admin_console');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-amber-400 text-xs font-black hover:bg-slate-900 transition-colors cursor-pointer shrink-0 ml-3"
          >
            {language === 'km' ? '⬅️ ត្រឡប់ទៅ Admin Console' : 'Back to Admin Hub'}
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="pb-24 md:pb-12">
        {currentUser?.role === 'admin' && activeTab === 'admin_console' ? (
          <AdminConsole
            currentUser={currentUser}
            users={usersList}
            language={language}
            onUpdateCurrentUser={(updated) => {
              setCurrentUser(updated);
              localStorage.setItem('minipos_current_user', JSON.stringify(updated));
              saveUserAccountInCloud(updated);
            }}
            onSelectUserToManage={(u) => {
              setInspectedUserStore(u);
              setActiveTab('pos');
            }}
            onSelectSaleForReceipt={(sale) => {
              setActiveSaleForReceipt(sale);
              setIsReceiptModalOpen(true);
            }}
          />
        ) : (
          <>
            {activeTab === 'pos' && (
              <POS
                products={products}
                onCompleteSale={handleCompleteSale}
                martDetails={martDetails}
                telegramConfig={telegramConfig}
                language={language}
                openCameraScanner={handleOpenCameraScanner}
                openMobileScannerTerminal={() => setActiveTab('mobile_scanner')}
              />
            )}

            {activeTab === 'mobile_scanner' && (
              <MobileScannerTerminal
                products={products}
                onSaveProduct={handleSaveProduct}
                onRestockProduct={handleRestockProduct}
                language={language}
                martDetails={martDetails}
                switchToDesktopPos={() => setActiveTab('pos')}
              />
            )}

            {activeTab === 'inventory' && (
              <Inventory
                products={products}
                onOpenAddModal={() => {
                  setProductToEdit(null);
                  setIsProductFormOpen(true);
                }}
                onOpenEditModal={(product) => {
                  setProductToEdit(product);
                  setIsProductFormOpen(true);
                }}
                onDeleteProduct={handleDeleteProduct}
                onRestockProduct={handleRestockProduct}
                onOpenBarcodePrint={(product) => {
                  setProductToPrintBarcode(product);
                  setIsBarcodePrintOpen(true);
                }}
                language={language}
                martDetails={martDetails}
                openCameraScanner={handleOpenCameraScanner}
              />
            )}

            {activeTab === 'sales' && (
              <SalesHistory
                sales={sales}
                onSelectSaleForReceipt={(sale) => {
                  setActiveSaleForReceipt(sale);
                  setIsReceiptModalOpen(true);
                }}
                language={language}
                martDetails={martDetails}
                telegramConfig={telegramConfig}
              />
            )}

            {activeTab === 'reports' && (
              <Reports
                sales={sales}
                products={products}
                martDetails={martDetails}
                telegramConfig={telegramConfig}
                language={language}
              />
            )}

            {activeTab === 'customer_display' && (
              <CustomerDisplay
                martDetails={martDetails}
                language={language}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <ProductFormModal
        isOpen={isProductFormOpen}
        onClose={() => setIsProductFormOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
        existingProducts={products}
        language={language}
        martDetails={martDetails}
        openCameraScanner={handleOpenCameraScanner}
      />

      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScan={handleCameraBarcodeScanned}
        language={language}
      />

      <BarcodePrintModal
        product={productToPrintBarcode}
        isOpen={isBarcodePrintOpen}
        onClose={() => setIsBarcodePrintOpen(false)}
        language={language}
        martDetails={martDetails}
      />

      <ReceiptModal
        sale={activeSaleForReceipt}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        martDetails={martDetails}
        telegramConfig={telegramConfig}
        language={language}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        martDetails={martDetails}
        onSaveMartDetails={handleSaveMartDetails}
        telegramConfig={telegramConfig}
        onSaveTelegramConfig={handleSaveTelegramConfig}
        language={language}
        isAdmin={currentUser?.role === 'admin'}
      />
    </div>
  );
}
