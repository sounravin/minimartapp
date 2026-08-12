import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Store,
  QrCode,
  CheckCircle2,
  Maximize2,
  Minimize2,
  DollarSign,
  Sparkles,
  Clock,
  ArrowRight,
  ShieldCheck,
  Tag,
  CreditCard,
  Gift,
} from 'lucide-react';
import { CustomerDisplayState, MartDetails, Language } from '../types';
import { WirelessSyncService } from '../utils/syncChannel';
import { formatUsd, formatKhr } from '../utils/formatters';

interface CustomerDisplayProps {
  martDetails: MartDetails;
  language?: Language;
  onClosePreviewModal?: () => void;
  isEmbeddedModal?: boolean;
}

export const CustomerDisplay: React.FC<CustomerDisplayProps> = ({
  martDetails,
  language = 'km',
  onClosePreviewModal,
  isEmbeddedModal = false,
}) => {
  const [displayState, setDisplayState] = useState<CustomerDisplayState>(() => {
    const saved = localStorage.getItem('mart_customer_display_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      exchangeRate: martDetails.defaultExchangeRate || 4100,
      cart: [],
      subtotalUsd: 0,
      subtotalKhr: 0,
      discountPercent: 0,
      discountAmountUsd: 0,
      grandTotalUsd: 0,
      grandTotalKhr: 0,
      lastScannedItem: null,
      paymentState: null,
    };
  });

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Live Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(language === 'km' ? 'km-KH' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setCurrentDate(
        now.toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [language]);

  // Subscribe to real-time sync from POS cash terminal
  useEffect(() => {
    const unsub = WirelessSyncService.onCustomerDisplay((newState) => {
      if (newState) {
        setDisplayState(newState);
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'mart_customer_display_data' && e.newValue) {
        try {
          setDisplayState(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const exchangeRate = displayState.exchangeRate || martDetails.defaultExchangeRate || 4100;
  const cart = displayState.cart || [];
  const lastScanned = displayState.lastScannedItem;
  const payment = displayState.paymentState;

  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div
      id="customer-display-screen"
      className={`w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-khmer selection:bg-amber-500 selection:text-slate-950 select-none ${
        isEmbeddedModal ? 'h-[90vh] rounded-3xl overflow-hidden' : 'h-screen'
      }`}
    >
      {/* HEADER BAR */}
      <header className="bg-slate-900/90 border-b border-slate-800/90 px-6 py-4 flex items-center justify-between shrink-0 shadow-2xl backdrop-blur-md">
        {/* Store Brand & Logo */}
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 p-2 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/30">
            <img
              src={displayState.storeLogoUrl || martDetails.logoUrl || '/logo.svg'}
              alt="Store Logo"
              className="w-full h-full object-contain filter drop-shadow"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Store className="w-6 h-6 text-slate-950 hidden group-has-[img[style*='display: none']]:block" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {displayState.storeNameKh || martDetails.nameKh || 'ហាងទំនិញ ម៉ាត'}
            </h1>
            <p className="text-xs text-amber-400 font-bold tracking-wider">
              {displayState.storeNameEn || martDetails.nameEn || 'Mini Mart & Supermarket'}
            </p>
          </div>
        </div>

        {/* Center Badge: Customer Display Mode */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 shadow-inner">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {language === 'km' ? 'ផ្ទាំងម៉ូនីទ័រអតិថិជន (Customer Monitor Display)' : 'Customer Display Active'}
          </span>
        </div>

        {/* Right Info: Exchange Rate & Time & Controls */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex flex-col items-end text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
              <span>$1.00 USD</span>
              <span>=</span>
              <span>{formatKhr(exchangeRate)}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 mt-1 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{currentTime}</span>
            </div>
          </div>

          {!isEmbeddedModal && (
            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer border border-slate-700/80 shadow-md"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          )}

          {onClosePreviewModal && (
            <button
              onClick={onClosePreviewModal}
              className="px-4 py-2 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-colors cursor-pointer"
            >
              {language === 'km' ? 'បិទផ្ទាំងនេះ' : 'Close Screen'}
            </button>
          )}
        </div>
      </header>

      {/* MAIN BODY: 2 COLUMN SPLIT LAYOUT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        {/* LEFT COLUMN: SPOTLIGHT & SCANNED CART ITEMS (SPAN 7) */}
        <div className="lg:col-span-7 flex flex-col gap-6 overflow-hidden">
          {/* SPOTLIGHT: LAST SCANNED ITEM BANNER */}
          {lastScanned && lastScanned.product ? (
            <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-5 shadow-2xl relative overflow-hidden shrink-0 animate-pulse-once">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  {language === 'km' ? 'ទើបតែស្កែនបញ្ចូល (Just Scanned)' : 'Just Scanned'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {lastScanned.timestamp}
                </span>
              </div>

              <div className="flex items-center gap-5">
                {/* Large Product Photo */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-950 border border-slate-800 p-2 shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
                  {lastScanned.product.imageUrl ? (
                    <img
                      src={lastScanned.product.imageUrl}
                      alt={lastScanned.product.nameKh}
                      className="w-full h-full object-contain transform hover:scale-110 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ShoppingBag className="w-12 h-12 text-slate-700" />
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-black text-white truncate leading-tight">
                    {lastScanned.product.nameKh}
                  </h3>
                  <p className="text-xs text-slate-400 truncate font-semibold mt-0.5">
                    {lastScanned.product.nameEn}
                  </p>

                  <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-black text-amber-400">
                      {formatUsd(lastScanned.product.sellingPriceUsd)}
                    </span>
                    <span className="text-sm font-bold text-slate-400">
                      / {formatKhr(lastScanned.product.sellingPriceUsd * exchangeRate)}
                    </span>

                    <span className="ml-auto bg-slate-800 text-slate-200 text-xs font-black px-3 py-1.5 rounded-xl border border-slate-700">
                      x {lastScanned.quantity} {lastScanned.product.unit || 'Pcs'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shrink-0 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-amber-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-200">
                  {language === 'km' ? 'សូមស្វាគមន៍មកកាន់ហាងរបស់យើងខ្ញុំ' : 'Welcome to Our Store'}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'km'
                    ? 'ទំនិញដែលស្កែននឹងបង្ហាញនៅទីនេះយ៉ាងច្បាស់'
                    : 'Scanned items will appear here automatically'}
                </p>
              </div>
            </div>
          )}

          {/* CART ITEMS TABLE */}
          <div className="flex-1 bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h2 className="font-black text-base text-white">
                  {language === 'km' ? 'បញ្ជីទំនិញដែលបានទិញ (Cart Items)' : 'Shopping Cart Items'}
                </h2>
              </div>
              <span className="bg-amber-500/20 text-amber-300 font-extrabold text-xs px-3 py-1 rounded-full border border-amber-500/30">
                {totalItemsCount} {language === 'km' ? 'មុខ' : 'Items'}
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full bg-slate-800/80 p-5 flex items-center justify-center text-slate-600 mb-4 animate-bounce">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-black text-slate-300">
                  {language === 'km' ? 'មិនទាន់មានទំនិញក្នុងរទេះទេ' : 'Your cart is empty'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
                  {language === 'km'
                    ? 'សូមរង់ចាំបុគ្គលិកបេឡាស្កែនទំនិញរបស់អ្នក'
                    : 'Please wait while cashier scans your items'}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                {cart.map((item, idx) => {
                  const lineTotal = item.product.sellingPriceUsd * item.quantity;
                  const isLast = lastScanned?.product.id === item.product.id;

                  return (
                    <div
                      key={item.product.id + '-' + idx}
                      className={`p-3.5 rounded-2xl flex items-center justify-between gap-4 border transition-all ${
                        isLast
                          ? 'bg-amber-500/10 border-amber-500/40 text-white'
                          : 'bg-slate-950/70 border-slate-800/80 text-slate-200'
                      }`}
                    >
                      {/* Product Thumbnail */}
                      <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.nameKh}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-slate-600" />
                        )}
                      </div>

                      {/* Name & Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-sm sm:text-base truncate text-white">
                          {item.product.nameKh}
                        </p>
                        <p className="text-xs text-slate-400 truncate font-semibold">
                          {formatUsd(item.product.sellingPriceUsd)} × {item.quantity} {item.product.unit}
                        </p>
                      </div>

                      {/* Total */}
                      <div className="text-right shrink-0">
                        <p className="text-base sm:text-lg font-black text-amber-400">
                          {formatUsd(lineTotal)}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400">
                          {formatKhr(lineTotal * exchangeRate)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: GRAND TOTAL & PAYMENT STATUS (SPAN 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6 overflow-hidden">
          {/* PAYMENT SUMMARY & GRAND TOTAL BOX */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  {language === 'km' ? 'សរុបការទូទាត់' : 'Payment Summary'}
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {language === 'km' ? 'ពន្ធអាករទំនិញរួមបញ្ចូល' : 'VAT Included'}
                </span>
              </div>

              {/* Subtotal & Discount */}
              <div className="space-y-2.5 text-sm font-bold text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {language === 'km' ? 'តម្លៃសរុប (Subtotal):' : 'Subtotal:'}
                  </span>
                  <span>{formatUsd(displayState.subtotalUsd)}</span>
                </div>

                {displayState.discountPercent > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>
                      {language === 'km'
                        ? `បញ្ចុះតម្លៃ (${displayState.discountPercent}% Discount):`
                        : `Discount (${displayState.discountPercent}%):`}
                    </span>
                    <span>-{formatUsd(displayState.discountAmountUsd)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* HUGE GRAND TOTAL DISPLAY */}
            <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 shadow-2xl text-slate-950 text-center relative overflow-hidden transform transition-all">
              <p className="text-xs font-black uppercase tracking-widest text-slate-900/80 mb-1">
                {language === 'km' ? 'ប្រាក់ត្រូវទូទាត់សរុប (Grand Total)' : 'Grand Total Due'}
              </p>

              {/* USD Grand Total */}
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-sm my-1">
                {formatUsd(displayState.grandTotalUsd)}
              </h1>

              {/* KHR Grand Total */}
              <div className="inline-flex items-center gap-1.5 bg-slate-950/80 text-amber-300 font-extrabold text-base sm:text-lg px-4 py-1.5 rounded-full mt-2 shadow-inner border border-amber-400/30">
                <span>{formatKhr(displayState.grandTotalKhr)}</span>
              </div>
            </div>
          </div>

          {/* DYNAMIC PAYMENT STATUS / KHQR / CHANGE DUE BOX */}
          <div className="flex-1 bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden">
            {/* STATE 1: SALE COMPLETED */}
            {payment && payment.isCompleted ? (
              <div className="space-y-4 animate-scale-up">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-12 h-12 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">
                    {language === 'km' ? '🎉 ការទូទាត់ជោគជ័យ!' : '🎉 Payment Successful!'}
                  </h3>
                  <p className="text-sm text-emerald-400 font-bold mt-1">
                    {language === 'km'
                      ? 'សូមអរគុណច្រើន! សូមអញ្ជើញមកម្តងទៀត!'
                      : 'Thank you for shopping with us! Have a great day!'}
                  </p>
                  {payment.receiptNo && (
                    <span className="inline-block mt-3 px-3.5 py-1 rounded-xl bg-slate-950 text-slate-400 text-xs font-mono font-bold border border-slate-800">
                      Invoice #{payment.receiptNo}
                    </span>
                  )}
                </div>
              </div>
            ) : payment && payment.isPaymentOpen ? (
              /* STATE 2: PAYMENT IN PROGRESS (CASH OR KHQR) */
              <div className="w-full space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-extrabold">
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {language === 'km'
                      ? `វិធីសាស្ត្រទូទាត់៖ ${
                          payment.paymentMethod === 'khqr'
                            ? 'KHQR ធនាគារ'
                            : payment.paymentMethod === 'cash'
                            ? 'ប្រាក់ស្រស់ (Cash)'
                            : 'ទូទាត់ចម្រុះ (Split)'
                        }`
                      : `Payment Method: ${payment.paymentMethod?.toUpperCase()}`}
                  </span>
                </div>

                {/* KHQR DISPLAY FOR CUSTOMER SCANNING */}
                {payment.paymentMethod === 'khqr' ? (
                  <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl border-4 border-amber-500/80 mx-auto my-2">
                    <div className="w-44 h-44 bg-slate-900 rounded-2xl p-2 flex flex-col items-center justify-center relative">
                      <QrCode className="w-36 h-36 text-amber-400" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow">
                          KHQR
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-800 font-black mt-2">
                      {language === 'km' ? 'ស្កែនទូទាត់ជាមួយ App ធនាគារ' : 'Scan to pay with Bank App'}
                    </p>
                  </div>
                ) : (
                  /* CASH RECEIVED & CHANGE DUE DISPLAY */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                    <div className="bg-emerald-950/60 border border-emerald-500/40 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-emerald-400">
                        {language === 'km' ? 'ប្រាក់ទទួលបាន (Received)' : 'Cash Received'}
                      </p>
                      <p className="text-xl font-black text-emerald-200 mt-1">
                        {formatUsd(payment.paidUsd || 0)}
                      </p>
                      <p className="text-xs font-bold text-emerald-400">
                        {formatKhr(payment.paidKhr || 0)}
                      </p>
                    </div>

                    <div className="bg-amber-950/60 border border-amber-500/40 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-amber-400">
                        {language === 'km' ? 'ប្រាក់អាប់ជូន (Change Due)' : 'Change Due'}
                      </p>
                      <p className="text-xl font-black text-amber-200 mt-1">
                        {formatUsd(payment.changeDueUsd || 0)}
                      </p>
                      <p className="text-xs font-bold text-amber-400">
                        {formatKhr(payment.changeDueKhr || 0)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* STATE 3: IDLE WELCOME STATE */
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                  <Store className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-white">
                  {language === 'km' ? 'សូមស្វាគមន៍!' : 'Welcome!'}
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed font-medium">
                  {language === 'km'
                    ? 'សូមអរគុណសម្រាប់ការអញ្ជើញមកកាន់ហាងរបស់យើងខ្ញុំ'
                    : 'Thank you for shopping with us today'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
