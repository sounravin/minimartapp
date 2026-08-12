import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  Send,
  Store,
  Sparkles,
  Check,
  Loader2,
  Package,
  Database,
} from 'lucide-react';
import { Product, MartDetails, Language, CartItem } from '../types';
import { CATEGORIES } from '../data/initialData';
import { formatUsd, formatKhr } from '../utils/formatters';
import {
  subscribeProducts,
  subscribeMartDetails,
  sendRemoteScanToCloud,
  saveCheckoutToFirebase,
  convertCatalogCartToCheckoutPayload,
} from '../lib/firebase';
import { WirelessSyncService } from '../utils/syncChannel';

interface CustomerCatalogProps {
  storeId?: string;
  language?: Language;
}

export function CustomerCatalog({ storeId, language = 'km' }: CustomerCatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [martDetails, setMartDetails] = useState<MartDetails>({
    nameKh: 'MINI MART POS',
    nameEn: 'MINI MART POS',
    phone: '',
    address: '',
    defaultExchangeRate: 4100,
  });
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
  
  // Selected Cart Items for Customer
  const [customerCart, setCustomerCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

  // Subscribe to Cloud Firestore for this seller's store products & details
  useEffect(() => {
    setLoading(true);
    const targetUserId = storeId && storeId !== 'default' && storeId !== 'guest' ? storeId : undefined;

    // Load local storage fallback initially
    const localProds = localStorage.getItem('mart_products');
    if (localProds) {
      try {
        setProducts(JSON.parse(localProds));
      } catch (e) {}
    }

    const localDetails = localStorage.getItem('mart_details');
    if (localDetails) {
      try {
        setMartDetails(JSON.parse(localDetails));
      } catch (e) {}
    }

    // Subscribe to Firestore Realtime updates for target store
    const unsubProds = subscribeProducts(targetUserId, (newProducts) => {
      if (newProducts && newProducts.length > 0) {
        setProducts(newProducts);
      }
      setLoading(false);
    });

    const unsubDetails = subscribeMartDetails(targetUserId, (newDetails) => {
      if (newDetails) {
        setMartDetails(newDetails);
      }
    });

    return () => {
      unsubProds();
      unsubDetails();
    };
  }, [storeId]);

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.nameKh.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Cart helper functions
  const getItemQuantity = (productId: string) => {
    const item = customerCart.find((ci) => ci.product.id === productId);
    return item ? item.quantity : 0;
  };

  const handleAddToCart = (product: Product) => {
    setCustomerCart((prev) => {
      const existing = prev.find((ci) => ci.product.id === product.id);
      if (existing) {
        return prev.map((ci) =>
          ci.product.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCustomerCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.product.id === productId) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Total calculation
  const totalUsd = customerCart.reduce((sum, item) => sum + item.product.sellingPriceUsd * item.quantity, 0);
  const totalKhr = Math.round(totalUsd * martDetails.defaultExchangeRate);
  const totalItemCount = customerCart.reduce((sum, item) => sum + item.quantity, 0);

  // Submit order to POS
  const handleSendOrderToPos = async () => {
    if (customerCart.length === 0) return;

    try {
      setIsSendingOrder(true);
      const targetUserId = storeId && storeId !== 'default' && storeId !== 'guest' ? storeId : undefined;
      const deviceLabel = customerName.trim()
        ? `អតិថិជន: ${customerName.trim()}`
        : 'អតិថិជន Onine (Customer Catalog)';

      // Send each selected product to POS via Wireless Sync (handles both local broadcast and Cloud Firestore)
      for (const cartItem of customerCart) {
        const itemBarcode = cartItem.product.barcode || cartItem.product.id;
        
        WirelessSyncService.sendRemoteScan(
          itemBarcode,
          cartItem.quantity,
          cartItem.product,
          deviceLabel,
          targetUserId
        );
      }

      // Save website order form checkout data into Supabase
      try {
        const firestorePayload = convertCatalogCartToCheckoutPayload(
          customerCart,
          customerName,
          martDetails.defaultExchangeRate,
          targetUserId
        );
        await saveCheckoutToFirebase(firestorePayload);
      } catch (fireErr) {
        console.warn('Firestore website order save note:', fireErr);
      }

      setOrderSentSuccess(true);
      setCustomerCart([]);
      setTimeout(() => {
        setOrderSentSuccess(false);
      }, 5000);
    } catch (err) {
      console.error('Error sending customer catalog order:', err);
      alert(
        language === 'km'
          ? 'មានបញ្ហាក្នុងការផ្ញើទំនិញ សូមព្យាយាមម្តងទៀត!'
          : 'Failed to send order, please try again!'
      );
    } finally {
      setIsSendingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-khmer text-slate-800 pb-32">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-1 flex items-center justify-center shrink-0">
              <img
                src={martDetails.logoUrl || '/logo.svg'}
                alt="Store Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-black text-base sm:text-lg text-slate-900 truncate">
                  {martDetails.nameKh || 'MINI POS Store'}
                </h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                  Online Catalog
                </span>
                <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-sky-300 flex items-center gap-1 shrink-0">
                  <Database className="w-3 h-3 text-sky-600" />
                  <span>Supabase Connected</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate">
                {language === 'km' ? 'ជ្រើសរើសទំនិញដើម្បីបញ្ជូនទៅគិតលុយ' : 'Select items to send to POS checkout'}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <span className="inline-block bg-amber-100 text-amber-900 px-2 py-1 rounded-lg border border-amber-300 font-mono text-xs font-bold">
              $1 = {martDetails.defaultExchangeRate.toLocaleString()} ៛
            </span>
          </div>
        </div>
      </header>

      {/* Main Catalog View */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-4">
        {/* Success Alert Notification */}
        {orderSentSuccess && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-500 text-slate-950 border border-emerald-600 shadow-xl flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-8 h-8 shrink-0 text-slate-950" />
            <div>
              <h3 className="font-black text-base leading-tight">
                {language === 'km' ? 'បានបញ្ជូនទំនិញទៅផ្ទាំងបញ្ជាទិញរួចរាល់!' : 'Order Sent to POS Checkout!'}
              </h3>
              <p className="text-xs font-semibold opacity-90">
                {language === 'km'
                  ? 'អ្នកលក់បានទទួលមុខទំនិញដែលអ្នកបានជ្រើសរើសនៅលើផ្ទាំងគិតលុយរួចរាល់ហើយ។'
                  : 'The cashier has received your selected items on their POS checkout screen.'}
              </p>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'km' ? 'ស្វែងរកឈ្មោះទំនិញ ឬ Barcode...' : 'Search product name or barcode...'}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Categories Horizontal Scroll Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {language === 'km' ? 'ទាំងអស់' : 'All Categories'} ({products.length})
          </button>
          {allCategoryList.map((cat) => {
            const count = products.filter((p) => p.category === cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{language === 'km' ? cat.nameKh : cat.nameEn}</span>
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">
              {language === 'km' ? 'កំពុងទាញយកទិន្នន័យទំនិញ...' : 'Loading store catalog...'}
            </p>
          </div>
        )}

        {/* Empty Search / Filter State */}
        {!loading && filteredProducts.length === 0 && (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs my-6">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">
              {language === 'km' ? 'ពុំរកឃើញទំនិញទេ' : 'No products found'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'km'
                ? 'សូមព្យាយាមស្វែងរកឈ្មោះផ្សេង ឬជ្រើសរើសប្រភេទផ្សេង'
                : 'Try searching with another keyword or category'}
            </p>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredProducts.map((product) => {
            const qtyInCart = getItemQuantity(product.id);
            const isOutOfStock = product.stockQuantity <= 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Product Image & Stock Badge */}
                  <div className="relative aspect-square bg-slate-50 flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={product.imageUrl || '/placeholder.png'}
                      alt={product.nameKh}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).setAttribute('src', '/placeholder.png');
                      }}
                    />
                    <div className="absolute top-2 left-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isOutOfStock
                          ? language === 'km' ? 'អស់ស្តុក' : 'Out of stock'
                          : `${product.stockQuantity} ${product.unit}`}
                      </span>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-3">
                    <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
                      {product.nameKh}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {product.nameEn}
                    </p>

                    {/* Price Tag */}
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-black text-sm sm:text-base text-emerald-600 font-mono">
                        {formatUsd(product.sellingPriceUsd)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        ({formatKhr(Math.round(product.sellingPriceUsd * martDetails.defaultExchangeRate))})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Add to Cart / Quantity Control Button */}
                <div className="p-2.5 pt-0">
                  {qtyInCart === 0 ? (
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={isOutOfStock}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{language === 'km' ? 'ជ្រើសរើសយក' : 'Select'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl p-1">
                      <button
                        onClick={() => handleUpdateQuantity(product.id, -1)}
                        className="w-7 h-7 bg-white text-slate-900 font-black rounded-lg flex items-center justify-center hover:bg-slate-100 shadow-xs active:scale-90"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <span className="font-black text-xs text-amber-950 font-mono px-2">
                        {qtyInCart}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(product.id, 1)}
                        className="w-7 h-7 bg-amber-500 text-slate-950 font-black rounded-lg flex items-center justify-center hover:bg-amber-400 shadow-xs active:scale-90"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Customer Bottom Cart Bar */}
      {customerCart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Total Amount Info */}
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-lg text-amber-400 font-mono leading-none">
                      {formatUsd(totalUsd)}
                    </span>
                    <span className="text-xs text-slate-300 font-bold font-mono">
                      ({formatKhr(totalKhr)})
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-khmer mt-0.5">
                    {language === 'km'
                      ? `បានជ្រើសរើស ${totalItemCount} មុខទំនិញ`
                      : `${totalItemCount} items selected`}
                  </p>
                </div>
              </div>
            </div>

            {/* Optional Customer Name Input & Submit Button */}
            <div className="w-full sm:w-auto flex items-center gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={language === 'km' ? 'ឈ្មោះ/លេខទូរស័ព្ទ (ជម្រើស)' : 'Your Name / Phone'}
                className="flex-1 sm:w-44 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />

              <button
                onClick={handleSendOrderToPos}
                disabled={isSendingOrder}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSendingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>
                  {language === 'km' ? 'បញ្ជូនទៅកាន់ផ្ទាំងបញ្ជាទិញ' : 'Send to POS'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
