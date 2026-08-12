import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode as BarcodeIcon,
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  QrCode,
  CreditCard,
  Printer,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  RotateCcw,
  X,
  Smartphone,
  ExternalLink,
  Wifi,
  Radio,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Share2,
  Copy,
  Link2,
} from 'lucide-react';
import { Product, CartItem, Sale, MartDetails, Language, TelegramConfig, CustomerDisplayState, RemoteScanEvent } from '../types';
import { CATEGORIES } from '../data/initialData';
import { formatUsd, formatKhr, generateReceiptNo } from '../utils/formatters';
import { playScanBeep } from '../utils/barcode';
import { WirelessSyncService } from '../utils/syncChannel';
import { CustomerDisplay } from './CustomerDisplay';
import { subscribeRemoteScans } from '../lib/firebase';

interface POSProps {
  products: Product[];
  onCompleteSale: (sale: Sale) => void;
  martDetails: MartDetails;
  telegramConfig: TelegramConfig;
  language: Language;
  openCameraScanner: (onScanCallback: (barcode: string) => void) => void;
  openMobileScannerTerminal?: () => void;
}

export const POS: React.FC<POSProps> = ({
  products,
  onCompleteSale,
  martDetails,
  telegramConfig,
  language,
  openCameraScanner,
  openMobileScannerTerminal,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Unified Categories List (Predefined CATEGORIES + Any custom categories in products)
  const allCategoryList = useMemo(() => {
    const list: Array<{ id: string; nameKh: string; nameEn: string; icon: string }> = [...CATEGORIES];
    const catSet = new Set(CATEGORIES.map((c) => c.id.toLowerCase()));

    products.forEach((p) => {
      if (p.category && p.category.trim() !== '') {
        const key = p.category.trim().toLowerCase();
        if (!catSet.has(key)) {
          catSet.add(key);
          list.push({
            id: p.category.trim(),
            nameKh: p.category.trim(),
            nameEn: p.category.trim(),
            icon: '📦',
          });
        }
      }
    });

    return list;
  }, [products]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Real-time Scan Pop-Up Toast State (with product photo)
  const [scanPopup, setScanPopup] = useState<{
    product: Product;
    addedQty: number;
    time: string;
  } | null>(null);
  const scanToastTimeoutRef = useRef<any>(null);

  // Wireless Remote Scanner State
  const [connectedScannerCount, setConnectedScannerCount] = useState<number>(0);
  const [remoteScanToast, setRemoteScanToast] = useState<{
    name: string;
    qty: number;
    time: string;
    error?: boolean;
  } | null>(null);

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'khqr' | 'split'>('cash');
  const [paidUsd, setPaidUsd] = useState<number | ''>('');
  const [paidKhr, setPaidKhr] = useState<number | ''>('');
  const [cashierName, setCashierName] = useState<string>('បេឡា 01 (Cashier 1)');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('អតិថិជនទូទៅ / Walk-in');

  // Customer Display & Store Link Copy State
  const [isCustomerDisplayPreviewOpen, setIsCustomerDisplayPreviewOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyStoreLink = () => {
    const savedUser = localStorage.getItem('minipos_current_user');
    let storeId = '';
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        storeId = parsed.id || '';
      } catch (e) {}
    }
    const storeUrl = window.location.origin + window.location.pathname + '?mode=catalog' + (storeId ? `&store=${storeId}` : '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(storeUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }).catch(() => {
        fallbackCopyTextToClipboard(storeUrl);
      });
    } else {
      fallbackCopyTextToClipboard(storeUrl);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const handleOpenCustomerDisplayWindow = () => {
    const url = window.location.origin + window.location.pathname + '?mode=customer_display';
    window.open(url, '_blank', 'width=1280,height=800,menubar=no,toolbar=no,location=no');
  };

  // Order Holding / Saved Carts State
  const [heldOrders, setHeldOrders] = useState<{ id: string; cart: CartItem[]; totalUsd: number; totalKhr: number; time: string }[]>(() => {
    const saved = localStorage.getItem('mart_held_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Listen to active connected scanners count
  useEffect(() => {
    const unsub = WirelessSyncService.onDevicePingCount((count) => {
      setConnectedScannerCount(count);
    });
    return () => unsub();
  }, []);

  const processedScanIdsRef = useRef<Set<string>>(new Set());

  // Listen to remote scan events sent from iPhone Wireless Scanner and Online Customer Catalog
  useEffect(() => {
    const handleIncomingScan = (event: RemoteScanEvent) => {
      const scanId = event.id || `${event.barcode}-${event.timestamp}`;
      if (processedScanIdsRef.current.has(scanId)) {
        return; // Deduplicate scan event
      }
      processedScanIdsRef.current.add(scanId);
      setTimeout(() => {
        processedScanIdsRef.current.delete(scanId);
      }, 120000);

      const matchedProduct = products.find((p) => p.barcode === event.barcode || p.id === event.barcode);
      const qtyToAdd = event.quantity && event.quantity > 0 ? event.quantity : 1;

      if (matchedProduct) {
        playScanBeep();
        addToCart(matchedProduct, qtyToAdd);
        setRemoteScanToast({
          name: language === 'km' ? matchedProduct.nameKh : matchedProduct.nameEn,
          qty: qtyToAdd,
          time: event.timestamp || new Date().toLocaleTimeString('km-KH'),
        });
      } else {
        setRemoteScanToast({
          name:
            language === 'km'
              ? `ពុំស្គាល់ Barcode: ${event.barcode}`
              : `Unknown Barcode: ${event.barcode}`,
          qty: qtyToAdd,
          time: event.timestamp || new Date().toLocaleTimeString('km-KH'),
          error: true,
        });
      }

      // Auto-hide toast after 4 seconds
      setTimeout(() => {
        setRemoteScanToast(null);
      }, 4000);
    };

    const unsubLocal = WirelessSyncService.onRemoteScan(handleIncomingScan);

    // Subscribe to Cloud Firestore remote scans/orders
    const savedUser = localStorage.getItem('minipos_current_user');
    let userId: string | undefined = undefined;
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        userId = parsed.id;
      } catch (e) {}
    }

    const unsubCloud = subscribeRemoteScans(userId, handleIncomingScan);

    return () => {
      unsubLocal();
      unsubCloud();
    };
  }, [products, language]);

  // Auto-focus barcode input for hardware scanner
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(focusTimer);
  }, [cart, isPaymentOpen]);

  // Handle hardware barcode scanner enter key
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matchedProduct = products.find(
      (p) => p.barcode.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (matchedProduct) {
      playScanBeep();
      addToCart(matchedProduct);
      setBarcodeInput('');
    } else {
      alert(
        language === 'km'
          ? `រកមិនឃើញទំនិញដែលមាន Barcode: ${barcodeInput}`
          : `No product found with Barcode: ${barcodeInput}`
      );
    }
  };

  const handleCameraScan = () => {
    openCameraScanner((scannedBarcode) => {
      const matched = products.find((p) => p.barcode === scannedBarcode);
      if (matched) {
        addToCart(matched);
      } else {
        alert(
          language === 'km'
            ? `រកមិនឃើញទំនិញដែលមាន Barcode: ${scannedBarcode}`
            : `No product found for scanned barcode: ${scannedBarcode}`
        );
      }
    });
  };

  const addToCart = (product: Product, addQty: number = 1) => {
    if (product.stockQuantity <= 0) {
      alert(
        language === 'km'
          ? `ទំនិញ "${product.nameKh}" អស់ពីស្តុកហើយ!`
          : `Product "${product.nameEn}" is out of stock!`
      );
      return;
    }

    // Trigger Rich Pop-Up with Product Photo
    setScanPopup({
      product,
      addedQty: addQty,
      time: new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });

    if (scanToastTimeoutRef.current) {
      clearTimeout(scanToastTimeoutRef.current);
    }
    scanToastTimeoutRef.current = setTimeout(() => {
      setScanPopup(null);
    }, 4500);

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const existingItem = prev[existingIndex];
        const targetQty = existingItem.quantity + addQty;
        if (targetQty > product.stockQuantity) {
          alert(
            language === 'km'
              ? `ស្តុកមានត្រឹមតែ ${product.stockQuantity} ${product.unit} ប៉ុណ្ណោះ!`
              : `Stock limit reached (${product.stockQuantity} ${product.unit})!`
          );
          const updated = [...prev];
          updated[existingIndex] = {
            ...existingItem,
            quantity: product.stockQuantity,
          };
          return updated;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...existingItem,
          quantity: targetQty,
        };
        return updated;
      }
      return [...prev, { product, quantity: Math.min(addQty, product.stockQuantity) }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stockQuantity) {
              alert(
                language === 'km'
                  ? `ស្តុកមានត្រឹមតែ ${item.product.stockQuantity} ${item.product.unit} ប៉ុណ្ណោះ`
                  : `Only ${item.product.stockQuantity} ${item.product.unit} in stock`
              );
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
  };

  // Calculations
  const subtotalUsd = cart.reduce(
    (acc, item) => acc + item.product.sellingPriceUsd * item.quantity,
    0
  );
  const discountUsd = (subtotalUsd * (discountPercent || 0)) / 100;
  const totalUsd = Math.max(0, subtotalUsd - discountUsd);
  const totalKhr = Math.round(totalUsd * martDetails.defaultExchangeRate);

  // Calculate payment change
  const totalPaidUsdEquivalent =
    (Number(paidUsd) || 0) + (Number(paidKhr) || 0) / martDetails.defaultExchangeRate;
  const changeUsd = Math.max(0, totalPaidUsdEquivalent - totalUsd);
  const changeKhr = Math.round(changeUsd * martDetails.defaultExchangeRate);

  // Real-time broadcast Customer Display updates
  useEffect(() => {
    const displayState: CustomerDisplayState = {
      storeLogoUrl: martDetails.logoUrl,
      storeNameKh: martDetails.nameKh,
      storeNameEn: martDetails.nameEn,
      exchangeRate: martDetails.defaultExchangeRate,
      cart,
      subtotalUsd,
      subtotalKhr: Math.round(subtotalUsd * martDetails.defaultExchangeRate),
      discountPercent,
      discountAmountUsd: discountUsd,
      grandTotalUsd: totalUsd,
      grandTotalKhr: totalKhr,
      lastScannedItem: scanPopup
        ? {
            product: scanPopup.product,
            quantity: scanPopup.addedQty,
            timestamp: scanPopup.time,
          }
        : cart.length > 0
        ? {
            product: cart[cart.length - 1].product,
            quantity: cart[cart.length - 1].quantity,
            timestamp: new Date().toLocaleTimeString('km-KH'),
          }
        : null,
      paymentState: isPaymentOpen
        ? {
            isPaymentOpen: true,
            paymentMethod,
            paidUsd: Number(paidUsd) || 0,
            paidKhr: Number(paidKhr) || 0,
            changeDueUsd: changeUsd,
            changeDueKhr: changeKhr,
            isCompleted: false,
          }
        : null,
    };

    WirelessSyncService.broadcastCustomerDisplay(displayState);
  }, [
    cart,
    subtotalUsd,
    discountPercent,
    discountUsd,
    totalUsd,
    totalKhr,
    scanPopup,
    isPaymentOpen,
    paymentMethod,
    paidUsd,
    paidKhr,
    changeUsd,
    changeKhr,
    martDetails,
  ]);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch =
      p.nameKh.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Hold current order
  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: `hold-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      cart: [...cart],
      totalUsd,
      totalKhr,
      time: new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newHold, ...heldOrders];
    setHeldOrders(updated);
    localStorage.setItem('mart_held_orders', JSON.stringify(updated));
    setCart([]);
    setDiscountPercent(0);
    alert(language === 'km' ? '✓ បានរក្សាទុកការបញ្ជាទិញជាបណ្ដោះអាសន្នជោគជ័យ!' : '✓ Order held successfully!');
  };

  const handleRestoreHeldOrder = (orderId: string) => {
    const target = heldOrders.find((o) => o.id === orderId);
    if (target) {
      setCart(target.cart);
      const updated = heldOrders.filter((o) => o.id !== orderId);
      setHeldOrders(updated);
      localStorage.setItem('mart_held_orders', JSON.stringify(updated));
      setIsHeldOrdersModalOpen(false);
    }
  };

  const handleDeleteHeldOrder = (orderId: string) => {
    const updated = heldOrders.filter((o) => o.id !== orderId);
    setHeldOrders(updated);
    localStorage.setItem('mart_held_orders', JSON.stringify(updated));
  };

  // Open payment modal
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setPaidUsd(totalUsd);
    setPaidKhr(0);
    setIsPaymentOpen(true);
  };

  // Complete Payment & Generate Sale
  const handleConfirmPayment = () => {
    if (totalPaidUsdEquivalent < totalUsd && paymentMethod !== 'khqr') {
      alert(
        language === 'km'
          ? 'ចំនួនប្រាក់ដែលទទួលបានមិនទាន់គ្រប់ចំនួនសរុបទេ!'
          : 'Paid amount is insufficient for total bill!'
      );
      return;
    }

    const saleRecord: Sale = {
      id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      receiptNo: generateReceiptNo(),
      items: cart.map((item) => ({
        productId: item.product.id,
        barcode: item.product.barcode,
        nameKh: item.product.nameKh,
        nameEn: item.product.nameEn,
        unit: item.product.unit,
        quantity: item.quantity,
        costPriceUsd: item.product.costPriceUsd,
        sellingPriceUsd: item.product.sellingPriceUsd,
        totalPriceUsd: item.product.sellingPriceUsd * item.quantity,
      })),
      subtotalUsd,
      discountUsd,
      totalUsd,
      totalKhr,
      paidUsd: paymentMethod === 'khqr' ? totalUsd : Number(paidUsd) || 0,
      paidKhr: paymentMethod === 'khqr' ? 0 : Number(paidKhr) || 0,
      changeUsd: paymentMethod === 'khqr' ? 0 : changeUsd,
      changeKhr: paymentMethod === 'khqr' ? 0 : changeKhr,
      paymentMethod,
      cashierName,
      exchangeRate: martDetails.defaultExchangeRate,
      createdAt: new Date().toISOString(),
    };

    onCompleteSale(saleRecord);
    setIsPaymentOpen(false);
    clearCart();
  };

  return (
    <div id="pos-checkout-wrapper" className="w-full px-2 sm:px-4 lg:px-6 pt-3 pb-36 lg:pb-6 font-khmer">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Product Catalog & Category Filter (Cols 7/8) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {/* Real-time Scan Toast */}
          {scanPopup && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-white border-2 border-emerald-500/90 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 relative overflow-hidden my-2">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse"></div>
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={scanPopup.product.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150'}
                  alt={scanPopup.product.nameKh}
                  className="w-12 h-12 object-cover rounded-xl border border-emerald-300 bg-slate-50 shrink-0 shadow-sm"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900 truncate">
                      {scanPopup.product.nameKh}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shrink-0">
                      +{scanPopup.addedQty} {scanPopup.product.unit}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 font-bold">
                    ៛{(scanPopup.product.sellingPriceUsd * martDetails.defaultExchangeRate).toLocaleString()} / {scanPopup.product.unit}
                    <span className="text-slate-400 font-normal ml-2">Code: {scanPopup.product.barcode}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScanPopup(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Barcode Quick Scan & Search Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-col sm:flex-row items-center gap-2.5">
            <form onSubmit={handleBarcodeSubmit} className="flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <BarcodeIcon className="w-5 h-5 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={
                    language === 'km'
                      ? 'ស្កេន Barcode ឬវាយបញ្ចូល...'
                      : 'Scan or type barcode...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl pl-10 pr-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                <span>{language === 'km' ? 'ស្វែងរក' : 'Scan'}</span>
              </button>
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'km' ? 'ស្វែងរកឈ្មោះ...' : 'Search name...'}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none"
                />
              </div>

              <button
                onClick={handleCameraScan}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                title={language === 'km' ? 'ស្កេន Barcode តាមកាមេរ៉ា' : 'Camera Barcode Scanner'}
              >
                <Camera className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">{language === 'km' ? 'កាមេរ៉ា' : 'Camera'}</span>
              </button>

              {/* Desktop Only: 2 Monitors Customer Display Window */}
              <button
                type="button"
                onClick={handleOpenCustomerDisplayWindow}
                className="hidden sm:flex px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-xs"
                title={language === 'km' ? 'បើកផ្ទាំង Customer Monitor លើ Second Display (២ ម៉ូនីទ័រ)' : 'Open Customer Monitor'}
              >
                <Monitor className="w-4 h-4 text-amber-400" />
                <span>
                  {language === 'km' ? '២ ម៉ូនីទ័រ (Customer Display)' : 'Customer Display'}
                </span>
              </button>

              {/* Mobile Only: Copy Link Button for Online Sellers */}
              <button
                type="button"
                onClick={handleCopyStoreLink}
                className={`sm:hidden px-3 py-2 border rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 ${
                  copiedLink
                    ? 'bg-emerald-500 text-slate-950 border-emerald-600'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-600'
                }`}
                title={language === 'km' ? 'ចម្លង Link ហាងសម្រាប់ផ្ញើជូនអតិថិជនជ្រើសរើសទំនិញ' : 'Copy Store Link for Customers'}
              >
                {copiedLink ? (
                  <CheckCircle2 className="w-4 h-4 text-slate-950 animate-bounce" />
                ) : (
                  <Share2 className="w-4 h-4 text-slate-950" />
                )}
                <span>
                  {copiedLink
                    ? language === 'km' ? 'បានចម្លង!' : 'Copied!'
                    : language === 'km' ? 'ចម្លង Link' : 'Copy Link'}
                </span>
              </button>
            </div>
          </div>

          {/* Top Category Filter Bar with Left & Right Slide Controls */}
          <div className="relative group/cat-bar">
            {/* Slide Left Button */}
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-amber-400 shadow-md flex items-center justify-center transition-all cursor-pointer opacity-90 sm:opacity-0 group-hover/cat-bar:opacity-100"
              title={language === 'km' ? 'រំកិលទៅឆ្វេង' : 'Slide left'}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Category Items Slider */}
            <div
              ref={categoryScrollRef}
              className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex items-center gap-2.5 overflow-x-auto scroll-smooth scrollbar-none touch-pan-x"
            >
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black shrink-0 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/50'
                    : 'bg-slate-50 text-slate-800 border border-slate-200 hover:bg-amber-50/80 hover:border-amber-300'
                }`}
              >
                <span className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-lg shadow-xs">✨</span>
                <span className="whitespace-nowrap">{language === 'km' ? 'ទាំងអស់' : 'All'}</span>
              </button>

              {allCategoryList.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black shrink-0 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/50'
                      : 'bg-slate-50 text-slate-800 border border-slate-200 hover:bg-amber-50/80 hover:border-amber-300'
                  }`}
                >
                  <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-xs border border-slate-100">
                    {cat.icon}
                  </span>
                  <span className="whitespace-nowrap text-xs sm:text-sm font-bold">
                    {language === 'km' ? cat.nameKh : cat.nameEn}
                  </span>
                </button>
              ))}
            </div>

            {/* Slide Right Button */}
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-300 text-slate-700 hover:text-slate-950 hover:bg-amber-400 shadow-md flex items-center justify-center transition-all cursor-pointer opacity-90 sm:opacity-0 group-hover/cat-bar:opacity-100"
              title={language === 'km' ? 'រំកិលទៅស្តាំ' : 'Slide right'}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Product Cards Grid (Matching Exact Photo Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-250px)] lg:max-h-none overflow-y-auto pr-1 pb-36 sm:pb-8">
            {filteredProducts.map((p) => {
              const priceKhr = p.sellingPriceUsd * martDetails.defaultExchangeRate;
              const isOut = p.stockQuantity <= 0;
              const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel;

              return (
                <div
                  key={p.id}
                  onClick={() => !isOut && addToCart(p)}
                  className={`group bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs hover:shadow-md hover:border-amber-400/90 transition-all flex flex-col items-center text-center relative cursor-pointer select-none ${
                    isOut ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {/* Stock Tag Top Left */}
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full absolute top-2.5 left-2.5 z-10 ${
                      isOut
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : isLow
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isOut ? (language === 'km' ? 'អស់' : 'Out') : `${p.stockQuantity} ${p.unit}`}
                  </span>

                  {/* Circular Product Photo Container (Matching Reference Image) */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-slate-100 bg-slate-50 flex items-center justify-center my-1.5 shadow-inner group-hover:scale-105 transition-transform duration-200">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.nameKh}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-slate-300" />
                    )}
                  </div>

                  {/* Price Block (KHR Bold Top, USD Small Bottom) */}
                  <div className="w-full text-center mt-1">
                    <div className="text-slate-900 font-black text-base sm:text-lg leading-tight">
                      ៛{priceKhr.toLocaleString()}
                    </div>
                    <div className="text-slate-500 font-bold text-xs leading-none mb-1">
                      {formatUsd(p.sellingPriceUsd)}
                    </div>
                  </div>

                  {/* Product Title in Khmer */}
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-2 leading-tight mt-0.5 max-w-[140px]">
                    {p.nameKh}
                  </h4>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-bold">
                  {language === 'km' ? 'ពុំមានទំនិញដែលត្រូវនឹងការស្វែងរកទេ' : 'No matching products found.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dark Slate Order Panel `#344452` (Matching Photo Right Panel) */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 bg-[#344452] border border-slate-700/60 rounded-3xl p-4 text-white shadow-2xl flex-col justify-between h-full min-h-[620px]">
          {/* Cart Header & Hold Action Row */}
          <div>
            {/* Top Cart Title & Grand Total Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-600/50">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🛒</span>
                <h3 className="font-extrabold text-sm text-slate-100">
                  {language === 'km' ? 'ផ្ទាំងបញ្ជាទិញ' : 'Order Panel'} x {cart.reduce((a, c) => a + c.quantity, 0)}
                </h3>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-amber-300 font-mono leading-none">
                  ៛{totalKhr.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-300 font-bold">
                  {formatUsd(totalUsd)}
                </div>
              </div>
            </div>

            {/* Action Toggle Tabs (Matching Top Pills in Reference Photo: រក្សាថ្មី & កុម្ម៉ង់មុន) */}
            <div className="flex items-center gap-2 my-3">
              <button
                type="button"
                onClick={handleHoldOrder}
                disabled={cart.length === 0}
                className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-40 text-slate-950 font-black text-xs py-2 px-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>រក្សាថ្មី</span>
                <span className="text-[10px] opacity-80">(Hold)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHeldOrdersModalOpen(true)}
                className="flex-1 bg-[#475569] hover:bg-slate-600 text-slate-100 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer relative"
              >
                <span>កុម្ម៉ង់មុន</span>
                {heldOrders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                    {heldOrders.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsCustomerDisplayPreviewOpen(true)}
                title={language === 'km' ? 'មើលគំរូផ្ទាំងម៉ូនីទ័រអតិថិជន (Customer Display)' : 'Preview Customer Display'}
                className="hidden lg:flex p-2.5 rounded-xl bg-slate-700/80 hover:bg-amber-500 hover:text-slate-950 text-amber-400 transition-colors shrink-0 cursor-pointer items-center gap-1 text-xs font-bold"
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden xl:inline">{language === 'km' ? 'ម៉ូនីទ័រ' : 'Display'}</span>
              </button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  title={language === 'km' ? 'សម្អាតកន្ត្រក' : 'Clear Cart'}
                  className="p-2.5 rounded-xl bg-slate-700/60 hover:bg-red-500/80 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Cart Items List (Soft White Cards matching photo) */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {cart.map((item) => {
                const itemKhrPrice = item.product.sellingPriceUsd * martDetails.defaultExchangeRate;
                const itemKhrTotal = itemKhrPrice * item.quantity;

                return (
                  <div
                    key={item.product.id}
                    className="bg-white text-slate-900 rounded-2xl p-2.5 shadow-md border border-slate-100 flex items-center justify-between gap-2.5"
                  >
                    {/* Item Thumbnail */}
                    <img
                      src={item.product.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150'}
                      alt={item.product.nameKh}
                      className="w-11 h-11 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-50"
                    />

                    {/* Middle Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-extrabold text-xs text-slate-900 truncate">
                          {item.product.nameKh}
                        </p>
                        <span className="text-slate-400 text-[11px]">ⓘ</span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500">
                        ៛{itemKhrPrice.toLocaleString()} <span className="text-[10px] text-slate-400">({formatUsd(item.product.sellingPriceUsd)})</span>
                      </p>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Print icon */}
                      <button
                        type="button"
                        onClick={() => alert(`Item: ${item.product.nameKh}`)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {/* Discount pill badge */}
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                        0%
                      </span>

                      {/* Quantity Stepper */}
                      <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          className="w-5 h-5 rounded-lg bg-white text-slate-800 flex items-center justify-center font-extrabold text-xs shadow-xs hover:bg-slate-200"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-xs font-black text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, 1)}
                          className="w-5 h-5 rounded-lg bg-white text-slate-800 flex items-center justify-center font-extrabold text-xs shadow-xs hover:bg-slate-200"
                        >
                          +
                        </button>
                      </div>

                      {/* Item Subtotal KHR */}
                      <div className="text-right min-w-[50px]">
                        <span className="font-black text-xs text-slate-900 block font-mono">
                          ៛{itemKhrTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <div className="py-16 text-center text-slate-400">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-2 text-slate-500 opacity-60" />
                  <p className="text-xs font-medium">
                    {language === 'km'
                      ? 'កញ្ចប់ទំនិញទំនេរនៅឡើយ។ សូមជ្រើសរើសទំនិញ'
                      : 'Cart is empty. Click products to add.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Bottom Summary & Two Action Buttons (Matching Photo) */}
          <div className="space-y-3 pt-3 border-t border-slate-600/50">
            {/* Customer select button pill */}
            <div className="flex items-center justify-between text-xs bg-[#283542] p-2 rounded-xl border border-slate-600/40">
              <div className="flex items-center gap-1.5 text-slate-300">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span className="font-bold">{selectedCustomer}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const name = prompt(
                    language === 'km' ? 'បញ្ចូលឈ្មោះអតិថិជន:' : 'Enter Customer Name:',
                    selectedCustomer
                  );
                  if (name) setSelectedCustomer(name);
                }}
                className="text-[11px] text-amber-400 hover:underline font-bold"
              >
                {language === 'km' ? 'ផ្លាស់ប្តូរ' : 'Change'}
              </button>
            </div>

            {/* Discount Input Row */}
            <div className="flex items-center justify-between text-xs px-1 text-slate-300">
              <span>{language === 'km' ? 'បញ្ចុះតម្លៃ (%)' : 'Discount (%)'}:</span>
              <div className="flex items-center gap-1 w-20">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-[#283542] border border-slate-600 rounded-lg px-2 py-1 text-right text-xs text-amber-300 outline-none font-bold font-mono"
                />
                <span className="text-slate-400 font-bold">%</span>
              </div>
            </div>

            {/* Two Main Bottom Action Buttons (Matching Photo: កុម្ម៉ង់ & បង់ប្រាក់) */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleHoldOrder}
                disabled={cart.length === 0}
                className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-40 text-slate-950 font-black rounded-2xl py-3.5 px-4 text-sm shadow-md transition-all active:scale-98 cursor-pointer text-center"
              >
                <span>{language === 'km' ? 'កុម្ម៉ង់ (Hold)' : 'Hold Order'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPayment}
                disabled={cart.length === 0}
                className="flex-1 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-40 text-slate-950 font-black rounded-2xl py-3.5 px-4 text-sm shadow-xl flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer text-center"
              >
                <DollarSign className="w-5 h-5 shrink-0" />
                <span>{language === 'km' ? 'អតិថិជន / បង់ប្រាក់' : 'Pay Now'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Cart Bar (Mobile Only - Highlighted Section) */}
      <div className="lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-2.5 right-2.5 z-30">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="flex-1 flex items-center gap-3 min-w-0 text-left cursor-pointer active:scale-98 transition-transform"
          >
            <div className="relative p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
              <ShoppingBag className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-black bg-emerald-500 text-slate-950 rounded-full shadow-sm">
                  {cart.reduce((a, c) => a + c.quantity, 0)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-base text-emerald-400 font-mono leading-none">
                  {formatUsd(totalUsd)}
                </span>
                <span className="text-xs text-slate-300 font-extrabold font-mono leading-none">
                  ({formatKhr(totalKhr)})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-khmer mt-0.5 truncate">
                {cart.length === 0
                  ? language === 'km'
                    ? 'កញ្ចប់ទំនិញទំនេរ (0 មុខ)'
                    : 'Cart empty (0 items)'
                  : `${cart.reduce((a, c) => a + c.quantity, 0)} ${
                      language === 'km' ? 'កញ្ចប់ទំនិញនេះ' : 'items selected'
                    }`}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              if (cart.length > 0) {
                handleOpenPayment();
              } else {
                setIsMobileCartOpen(true);
              }
            }}
            disabled={cart.length === 0}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black rounded-xl text-sm flex items-center gap-1.5 shrink-0 shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <DollarSign className="w-4 h-4 font-black stroke-[3]" />
            <span className="font-khmer">{language === 'km' ? 'បង់ប្រាក់' : 'Checkout'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Cart Drawer Modal */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">
                  {language === 'km' ? 'កញ្ចប់ទំនិញទិញ' : 'Cart Items'} ({cart.reduce((a, c) => a + c.quantity, 0)})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'km' ? 'សម្អាត' : 'Clear'}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="p-4 overflow-y-auto divide-y divide-slate-800 flex-1 min-h-[180px]">
              {cart.map((item) => (
                <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                  {/* Product Image Thumbnail */}
                  <img
                    src={item.product.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150'}
                    alt={item.product.nameKh}
                    className="w-12 h-12 object-cover rounded-xl border border-slate-700/80 bg-slate-950 shrink-0 shadow-sm"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">{item.product.nameKh}</p>
                    <p className="text-xs text-emerald-400 font-semibold">
                      {formatUsd(item.product.sellingPriceUsd)} / {item.product.unit}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
                    <button
                      onClick={() => updateCartQuantity(item.product.id, -1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold font-mono text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQuantity(item.product.id, 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right w-20 shrink-0">
                    <span className="font-black text-sm text-emerald-400 block font-mono">
                      {formatUsd(item.product.sellingPriceUsd * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                  <p className="text-xs">
                    {language === 'km'
                      ? 'កញ្ចប់ទំនិញទំនេរនៅឡើយ។ សូមជ្រើសរើសទំនិញ'
                      : 'Cart is empty. Tap products to add.'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Summary & Action */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{language === 'km' ? 'បញ្ចុះតម្លៃ (%)' : 'Discount (%)'}:</span>
                <div className="flex items-center gap-1 w-24">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent || ''}
                    onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs text-white outline-none font-bold"
                  />
                  <span className="text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                <span className="font-extrabold text-sm text-white">
                  {language === 'km' ? 'ប្រាក់ត្រូវបង់សរុប' : 'Total Due'}:
                </span>
                <div className="text-right">
                  <span className="font-black text-2xl text-emerald-400 block font-mono">
                    {formatUsd(totalUsd)}
                  </span>
                  <span className="text-xs font-bold text-slate-400 block font-mono">
                    {formatKhr(totalKhr)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleOpenPayment();
                }}
                disabled={cart.length === 0}
                className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black rounded-xl shadow-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <DollarSign className="w-5 h-5" />
                <span>
                  {language === 'km' ? `បន្តបង់ប្រាក់ (${formatUsd(totalUsd)})` : `Proceed to Payment (${formatUsd(totalUsd)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Orders Modal (កុម្ម៉ង់មុន / Orders on hold) */}
      {isHeldOrdersModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-hidden">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="shrink-0 p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📋</span>
                <h3 className="font-extrabold text-base text-slate-900">
                  {language === 'km' ? 'បញ្ជីកុម្ម៉ង់មុន / រក្សាទុកបណ្ដោះអាសន្ន' : 'Held Orders List'}
                </h3>
              </div>
              <button
                onClick={() => setIsHeldOrdersModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {heldOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <ShoppingBag className="w-10 h-10 mx-auto text-slate-400" />
                  <p className="text-xs font-bold">
                    {language === 'km' ? 'គ្មានការបញ្ជាទិញដែលបានរក្សាទុកទេ' : 'No held orders saved.'}
                  </p>
                </div>
              ) : (
                heldOrders.map((hold) => (
                  <div
                    key={hold.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black">
                          {hold.time}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">
                          {hold.cart.reduce((a, c) => a + c.quantity, 0)} {language === 'km' ? 'មុខ' : 'items'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-700 font-black text-sm block">
                          ៛{hold.totalKhr.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {formatUsd(hold.totalUsd)}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1 bg-white p-2 rounded-xl border border-slate-200">
                      {hold.cart.slice(0, 3).map((item) => (
                        <div key={item.product.id} className="flex justify-between truncate">
                          <span className="truncate font-bold">{item.product.nameKh}</span>
                          <span className="font-extrabold text-slate-500 ml-2">x{item.quantity}</span>
                        </div>
                      ))}
                      {hold.cart.length > 3 && (
                        <p className="text-[10px] text-amber-700 font-bold italic">
                          +{hold.cart.length - 3} {language === 'km' ? 'មុខទៀត...' : 'more items...'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteHeldOrder(hold.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition-colors"
                      >
                        {language === 'km' ? 'លុប' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRestoreHeldOrder(hold.id)}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors shadow-xs"
                      >
                        {language === 'km' ? 'យកមកលក់វិញ' : 'Restore Order'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Checkout Modal (POS Hardware Widescreen & Khmer Typography Refined) */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl max-w-4xl w-full max-h-[92dvh] md:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden my-auto font-khmer">
            {/* Modal Header */}
            <div className="shrink-0 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {language === 'km' ? 'ការគិតប្រាក់ និងចេញវិក្កយបត្រ (POS Checkout)' : 'Payment & Checkout'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {language === 'km' ? 'បញ្ចូលប្រាក់ទទួលបាន ($ / ៛) ដើម្បីគណនាប្រាក់អាប់ស្វ័យប្រវត្តិ' : 'Enter received cash ($ / ៛) to calculate change'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body - 2-Column Widescreen Layout for POS Hardware screens */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Column (5/12): Grand Total & Payment Method Selection */}
                <div className="md:col-span-5 space-y-4">
                  {/* Grand Total banner */}
                  <div className="bg-amber-50/80 border border-amber-300/80 p-4 rounded-2xl text-center shadow-xs">
                    <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      {language === 'km' ? 'ប្រាក់ត្រូវទូទាត់សរុប (Total Due)' : 'Total Amount Due'}
                    </p>
                    <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 my-1 font-mono tracking-tight">
                      {formatUsd(totalUsd)}
                    </div>
                    <p className="text-sm sm:text-base font-bold text-amber-900 font-mono">
                      ≈ {formatKhr(totalKhr)}
                    </p>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      {language === 'km' ? 'វិធីសាស្ត្រទូទាត់ប្រាក់' : 'Payment Method'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-3 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === 'cash'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs ring-2 ring-amber-400/40'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <DollarSign className="w-5 h-5" />
                        <span>{language === 'km' ? 'ប្រាក់សុទ្ធ Cash' : 'Cash ($/៛)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('khqr')}
                        className={`py-3 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === 'khqr'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs ring-2 ring-amber-400/40'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <QrCode className="w-5 h-5" />
                        <span>{language === 'km' ? 'KHQR / ABA' : 'KHQR Code'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('split')}
                        className={`py-3 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === 'split'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs ring-2 ring-amber-400/40'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span>{language === 'km' ? 'ចម្រុះ ($+៛)' : 'Split ($ + ៛)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* KHQR View (if selected) */}
                  {paymentMethod === 'khqr' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-2">
                      <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=KHQR_HAPPY_MART_${totalKhr}`}
                          alt="KHQR"
                          className="w-36 h-36"
                        />
                      </div>
                      <p className="text-xs font-bold text-red-600 uppercase">Bakong / ABA KHQR</p>
                      <p className="text-base font-extrabold text-slate-900">{formatKhr(totalKhr)}</p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {language === 'km' ? 'អតិថិជន Scan KHQR ដើម្បីបង់ប្រាក់' : 'Scan KHQR to pay via Mobile Banking'}
                      </p>
                    </div>
                  )}

                  {/* Cashier name input */}
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-bold text-slate-700">
                      {language === 'km' ? 'ឈ្មោះអ្នកគិតប្រាក់ (Cashier Name)' : 'Cashier Name'}
                    </label>
                    <input
                      type="text"
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold outline-none"
                    />
                  </div>
                </div>

                {/* Right Column (7/12): Cash Received Inputs & Real-time Dual-Currency Change */}
                <div className="md:col-span-7 space-y-4">
                  {paymentMethod !== 'khqr' ? (
                    <div className="space-y-3.5 p-4 bg-slate-50/90 rounded-2xl border border-slate-200">
                      {/* Quick Preset Action Buttons */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {language === 'km' ? 'ជម្រើសលឿនប្រាក់ទទួលបាន:' : 'Quick Cash Actions:'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setPaidUsd(totalUsd);
                              setPaidKhr('');
                            }}
                            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            {language === 'km' ? 'ប្រាក់គ្រប់ ($)' : 'Exact ($)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaidUsd('');
                              setPaidKhr(totalKhr);
                            }}
                            className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            {language === 'km' ? 'ប្រាក់គ្រប់ (៛)' : 'Exact (៛)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaidUsd('');
                              setPaidKhr('');
                            }}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            {language === 'km' ? 'សម្អាត' : 'Clear'}
                          </button>
                        </div>
                      </div>

                      {/* Cash Inputs USD ($) & KHR (៛) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Received USD */}
                        <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                          <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                            <span>{language === 'km' ? 'ប្រាក់ដុល្លារទទួលបាន ($)' : 'Received USD ($)'}</span>
                            <span className="text-[11px] text-amber-700 font-bold">$ USD</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-extrabold text-slate-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={paidUsd}
                              onChange={(e) => setPaidUsd(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white rounded-xl pl-8 pr-3 py-2.5 text-lg text-slate-900 font-mono font-extrabold outline-none transition-all"
                            />
                          </div>
                          {/* USD Quick Tap Buttons */}
                          <div className="grid grid-cols-3 gap-1 pt-1">
                            {[1, 5, 10, 20, 50, 100].map((amt) => (
                              <button
                                key={`usd-${amt}`}
                                type="button"
                                onClick={() => {
                                  setPaidUsd(amt);
                                }}
                                className="py-1.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-950 text-slate-700 font-mono rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer text-center"
                              >
                                +${amt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Received KHR */}
                        <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                          <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                            <span>{language === 'km' ? 'ប្រាក់រៀលទទួលបាន (៛)' : 'Received KHR (៛)'}</span>
                            <span className="text-[11px] text-emerald-700 font-bold">៛ KHR</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-extrabold text-slate-400">៛</span>
                            <input
                              type="number"
                              step="100"
                              placeholder="0"
                              value={paidKhr}
                              onChange={(e) => setPaidKhr(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white rounded-xl pl-8 pr-3 py-2.5 text-lg text-slate-900 font-mono font-extrabold outline-none transition-all"
                            />
                          </div>
                          {/* KHR Quick Tap Buttons */}
                          <div className="grid grid-cols-3 gap-1 pt-1">
                            {[1000, 5000, 10000, 20000, 50000, 100000].map((khr) => (
                              <button
                                key={`khr-${khr}`}
                                type="button"
                                onClick={() => {
                                  setPaidKhr(khr);
                                }}
                                className="py-1.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-950 text-slate-700 font-mono rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer text-center"
                              >
                                {(khr / 1000).toLocaleString()}k៛
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Real-time Total Paid & Dual-Currency Change Box */}
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-xs">
                        <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                          <span className="font-bold text-slate-700">
                            {language === 'km' ? 'សរុបប្រាក់ទទួលបាន:' : 'Total Received:'}
                          </span>
                          <div className="text-right font-mono font-bold text-slate-900">
                            <span>{formatUsd(totalPaidUsdEquivalent)}</span>
                            <span className="text-slate-500 text-[11px] ml-1">
                              ({formatKhr(Math.round(totalPaidUsdEquivalent * martDetails.defaultExchangeRate))})
                            </span>
                          </div>
                        </div>

                        {/* Change or Shortage Display */}
                        {totalPaidUsdEquivalent >= totalUsd ? (
                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
                                {language === 'km' ? '💵 ប្រាក់ត្រូវអាប់ជូនអតិថិជន (Change Due)' : '💵 Change Return'}
                              </p>
                              <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                                {language === 'km' ? 'អាប់ជាដុល្លារ ឬ ប្រាក់រៀល' : 'Change in USD & KHR'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-black text-emerald-700 block font-mono">
                                {formatUsd(changeUsd)}
                              </span>
                              <span className="text-sm font-extrabold text-emerald-900 block font-mono">
                                {formatKhr(changeKhr)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-extrabold text-amber-950 uppercase tracking-wide">
                                {language === 'km' ? '⚠️ ប្រាក់នៅខ្វះ (Remaining Due)' : '⚠️ Amount Short'}
                              </p>
                              <p className="text-[11px] text-amber-900 font-medium mt-0.5">
                                {language === 'km' ? 'ត្រូវការបន្ថែម:' : 'Still needed:'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-black text-amber-800 block font-mono">
                                -{formatUsd(totalUsd - totalPaidUsdEquivalent)}
                              </span>
                              <span className="text-xs font-bold text-amber-950 block font-mono">
                                -{formatKhr(Math.round((totalUsd - totalPaidUsdEquivalent) * martDetails.defaultExchangeRate))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50/80 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center h-full min-h-[220px]">
                      <QrCode className="w-12 h-12 text-amber-600 mb-2 animate-bounce" />
                      <p className="text-sm font-extrabold text-slate-800">
                        {language === 'km' ? 'ការទូទាត់តាមរយៈ KHQR Code' : 'Payment via KHQR Code'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs font-medium">
                        {language === 'km'
                          ? 'សូមអតិថិជន Scan បារកូដនៅខាងឆ្វេងដៃ ដើម្បីទូទាត់ប្រាក់ តាមកម្មវិធីធនាគារ ABA / Bakong'
                          : 'Please scan the QR code on the left to complete mobile banking payment'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions Footer */}
            <div className="shrink-0 px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between z-10">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                {language === 'km' ? 'ត្រឡប់ក្រោយ' : 'Back'}
              </button>

              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-6 py-2.5 text-sm font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {language === 'km' ? 'បង់ប្រាក់ និងបោះពុម្ពវិក្កយបត្រ (Print Receipt)' : 'Confirm & Print Receipt'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Customer Display Preview Modal */}
      {isCustomerDisplayPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-6">
          <div className="w-full max-w-6xl max-h-[94vh] bg-slate-950 rounded-3xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
                <Monitor className="w-5 h-5" />
                <span>
                  {language === 'km'
                    ? 'ផ្ទាំងគំរូម៉ូនីទ័រអតិថិជន (Customer Monitor Display Preview)'
                    : 'Customer Monitor Display Preview'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenCustomerDisplayWindow}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{language === 'km' ? 'បើកលើ Window ថ្មី (2nd Display)' : 'Open in New Window'}</span>
                </button>
                <button
                  onClick={() => setIsCustomerDisplayPreviewOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CustomerDisplay
                martDetails={martDetails}
                language={language}
                isEmbeddedModal={true}
                onClosePreviewModal={() => setIsCustomerDisplayPreviewOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
