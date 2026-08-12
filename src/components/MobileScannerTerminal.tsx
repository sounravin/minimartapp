import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Smartphone,
  Scan,
  CheckCircle2,
  Send,
  Package,
  Plus,
  Minus,
  Barcode as BarcodeIcon,
  RefreshCw,
  Camera,
  CameraOff,
  Sparkles,
  Wifi,
  ShoppingBag,
  ShoppingCart,
  ListPlus,
  Save,
  Trash2,
  AlertCircle,
  HelpCircle,
  Tv,
  Image as ImageIcon,
  Upload,
  X,
} from 'lucide-react';
import { Product, Language, MartDetails } from '../types';
import { WirelessSyncService } from '../utils/syncChannel';
import { playScanBeep } from '../utils/barcode';
import { generateBarcodeNumber, formatUsd, formatKhr } from '../utils/formatters';
import { CATEGORIES } from '../data/initialData';

interface MobileScannerTerminalProps {
  products: Product[];
  onSaveProduct: (productData: Omit<Product, 'id' | 'updatedAt'>, existingId?: string) => void;
  onRestockProduct: (productId: string, addQty: number) => void;
  language: Language;
  martDetails: MartDetails;
  switchToDesktopPos: () => void;
}

export const MobileScannerTerminal: React.FC<MobileScannerTerminalProps> = ({
  products,
  onSaveProduct,
  onRestockProduct,
  language,
  martDetails,
  switchToDesktopPos,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pos_gun' | 'stock_check' | 'add_product'>('pos_gun');

  // Multiplier for POS Gun
  const [scanQtyMultiplier, setScanQtyMultiplier] = useState<number>(1);
  const [recentScans, setRecentScans] = useState<
    { id: string; barcode: string; nameKh: string; priceUsd: number; qty: number; time: string }[]
  >([]);

  // Manual Barcode Input
  const [manualBarcode, setManualBarcode] = useState('');

  // Stock Check state
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(null);
  const [customAddQty, setCustomAddQty] = useState<number>(5);

  // New Product Ingestion State
  const [newBarcode, setNewBarcode] = useState('');
  const [newNameKh, setNewNameKh] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newCategory, setNewCategory] = useState('Beverages');
  const [newCostPrice, setNewCostPrice] = useState<number | ''>('');
  const [newSellingPrice, setNewSellingPrice] = useState<number | ''>('');
  const [newStock, setNewStock] = useState<number | ''>(10);
  const [newUnit, setNewUnit] = useState('កំប៉ុង (Can)');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [scanSuccessBadge, setScanSuccessBadge] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert(
        language === 'km'
          ? 'ទំហំរូបភាពធំពេក! សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 8MB'
          : 'Image size too large! Please choose an image under 8MB'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setNewImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Camera Scanner Reference, Multiplier Ref & Scan Lock Cooldown
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef<boolean>(true);
  const scanQtyMultiplierRef = useRef<number>(scanQtyMultiplier);
  const activeSubTabRef = useRef<'pos_gun' | 'stock_check' | 'add_product'>(activeSubTab);

  // Strict 1-scan-at-a-time Lock Refs
  const isScanningLockedRef = useRef<boolean>(false);
  const lastScannedBarcodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const [isScanCooldown, setIsScanCooldown] = useState<boolean>(false);
  const [autoSwitchToPos, setAutoSwitchToPos] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  // iPhone Macro Lens & Camera Selection State
  const [macroZoom, setMacroZoom] = useState<number>(1.5);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string | null>(null);

  // Apply Macro focus & zoom constraints to active video track
  const applyMacroConstraints = async (zoomValue: number) => {
    try {
      const videoEl = document.querySelector('#mobile-camera-reader video') as HTMLVideoElement;
      if (!videoEl || !videoEl.srcObject) return;
      const stream = videoEl.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track || typeof track.applyConstraints !== 'function') return;

      const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      const advancedOpts: any = {};

      if (caps.focusMode && Array.isArray(caps.focusMode)) {
        if (caps.focusMode.includes('macro')) {
          advancedOpts.focusMode = 'macro';
        } else if (caps.focusMode.includes('continuous')) {
          advancedOpts.focusMode = 'continuous';
        }
      } else {
        advancedOpts.focusMode = 'continuous';
      }

      if (caps.zoom) {
        const minZ = caps.zoom.min || 1;
        const maxZ = caps.zoom.max || 3;
        const targetZ = Math.min(Math.max(zoomValue, minZ), maxZ);
        advancedOpts.zoom = targetZ;
      } else {
        advancedOpts.zoom = zoomValue;
      }

      await track.applyConstraints({ advanced: [advancedOpts] } as any);
    } catch (err) {
      console.warn('Macro focus constraint application note:', err);
    }
  };

  // Re-apply macro focus whenever zoom setting changes
  useEffect(() => {
    if (isCameraActive && scannerRef.current?.isScanning) {
      applyMacroConstraints(macroZoom);
    }
  }, [macroZoom, isCameraActive]);

  useEffect(() => {
    scanQtyMultiplierRef.current = scanQtyMultiplier;
  }, [scanQtyMultiplier]);

  useEffect(() => {
    activeSubTabRef.current = activeSubTab;
  }, [activeSubTab]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Send heartbeat to Desktop POS every 2.5 seconds
  useEffect(() => {
    WirelessSyncService.sendHeartbeat('iphone-mobile-scanner');
    const interval = setInterval(() => {
      WirelessSyncService.sendHeartbeat('iphone-mobile-scanner');
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Stop camera helper
  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping mobile camera:', e);
      }
      scannerRef.current = null;
    }

    // Force release ALL media stream tracks across document to free camera hardware
    try {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach((v) => {
        if (v.srcObject) {
          const stream = v.srcObject as MediaStream;
          stream.getTracks().forEach((t) => {
            t.stop();
          });
          v.srcObject = null;
        }
      });
    } catch (err) {
      console.warn('Error releasing video tracks:', err);
    }
  };

  // Start camera helper
  const startCamera = async () => {
    setCameraError(null);
    await stopCamera();

    // 400ms delay to ensure browser hardware releases previous camera lock
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!mountedRef.current) return;

    const elementId = 'mobile-camera-reader';
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      // Unconstrained config avoids OverconstrainedError / NotReadableError
      const config = {
        fps: 20,
        qrbox: { width: 260, height: 160 },
      };

      const handleScan = (decodedText: string) => {
        const now = Date.now();

        // 🛑 STRICT 1-SCAN-AT-A-TIME DEBOUNCE LOCK:
        if (isScanningLockedRef.current) return;
        if (lastScannedBarcodeRef.current === decodedText && now - lastScanTimeRef.current < 2500) return;
        if (now - lastScanTimeRef.current < 1200) return;

        // Immediately lock scanner
        isScanningLockedRef.current = true;
        lastScannedBarcodeRef.current = decodedText;
        lastScanTimeRef.current = now;
        setIsScanCooldown(true);

        // Haptic feedback & audio beep
        playScanBeep();
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          try { window.navigator.vibrate([120]); } catch (e) {}
        }

        setLastScannedBarcode(decodedText);
        const currentMultiplier = scanQtyMultiplierRef.current;
        const currentTab = activeSubTabRef.current;

        if (currentTab === 'pos_gun') {
          // Send scanned item to Desktop POS
          const matched = products.find((p) => p.barcode === decodedText);
          WirelessSyncService.sendRemoteScan(decodedText, currentMultiplier, matched, 'iPhone Handheld');

          // Add to recent scan log
          setRecentScans((prev) => [
            {
              id: `scan-${Date.now()}`,
              barcode: decodedText,
              nameKh: matched ? matched.nameKh : (language === 'km' ? 'ទំនិញពុំស្គាល់' : 'Unknown Product'),
              priceUsd: matched ? matched.sellingPriceUsd : 0,
              qty: currentMultiplier,
              time: new Date().toLocaleTimeString('km-KH'),
            },
            ...prev.slice(0, 15),
          ]);

          setScanSuccessBadge(
            language === 'km'
              ? `✓ បាន Scan 1x ${matched ? matched.nameKh : decodedText} បញ្ជូនទៅ POS រួចរាល់`
              : `✓ Scanned 1x ${matched ? matched.nameEn : decodedText} sent to POS Cart`
          );

          // Auto-switch to POS Checkout if enabled
          if (autoSwitchToPos && switchToDesktopPos) {
            setTimeout(() => {
              switchToDesktopPos();
            }, 600);
          }
        } else if (currentTab === 'stock_check') {
          const matched = products.find((p) => p.barcode === decodedText);
          if (matched) {
            setInspectedProduct(matched);
            setScanSuccessBadge(
              language === 'km'
                ? `✓ ពិនិត្យឃើញ៖ ${matched.nameKh}`
                : `✓ Found: ${matched.nameEn}`
            );
          } else {
            alert(
              language === 'km'
                ? `រកមិនឃើញទំនិញ Barcode: ${decodedText}`
                : `No product found for Barcode: ${decodedText}`
            );
          }
        } else if (currentTab === 'add_product') {
          setNewBarcode(decodedText);
          setScanSuccessBadge(
            language === 'km'
              ? `✓ ចាប់បាន Barcode ដោយស្វ័យប្រវត្តិ៖ ${decodedText}`
              : `✓ Auto-scanned Barcode: ${decodedText}`
          );
        }

        // Release scan lock after 2.0s cooldown so user must remove or re-align item
        setTimeout(() => {
          isScanningLockedRef.current = false;
          setIsScanCooldown(false);
        }, 2000);
      };

      let started = false;

      // Strategy 1: Check available camera IDs & detect Macro/Ultra Wide lenses
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
          
          // Look for Ultra Wide / Macro camera or Back Camera
          let targetCam = selectedCamId ? cameras.find((c) => c.id === selectedCamId) : null;
          if (!targetCam) {
            // Prefer explicit Macro / Ultra Wide camera on iPhone
            const macroCam = cameras.find((c) => /ultra\s*wide|ultrawide|macro/i.test(c.label));
            const backCam = cameras.find((c) => /back|rear|environment/i.test(c.label));
            targetCam = macroCam || backCam || cameras[cameras.length - 1];
          }

          if (targetCam) {
            setSelectedCamId(targetCam.id);
            await scanner.start(targetCam.id, config, handleScan, () => {});
            started = true;
          }
        }
      } catch (camErr) {
        console.warn('Camera ID lookup failed or restricted, trying facingMode constraints:', camErr);
      }

      // Strategy 2: Direct environment facingMode
      if (!started && mountedRef.current) {
        try {
          await scanner.start({ facingMode: 'environment' }, config, handleScan, () => {});
          started = true;
        } catch (e) {
          console.warn('FacingMode environment failed, trying fallback user camera:', e);
        }
      }

      // Strategy 3: Front user camera fallback
      if (!started && mountedRef.current) {
        try {
          await scanner.start({ facingMode: 'user' }, config, handleScan, () => {});
          started = true;
        } catch (e) {
          console.warn('User camera failed:', e);
        }
      }

      // Auto-apply Macro Focus and Zoom constraints once video stream initializes
      if (started) {
        setTimeout(() => {
          applyMacroConstraints(macroZoom);
        }, 350);
      }
    } catch (err: any) {
      console.error('Mobile scanner start error:', err);
      const isNotReadable = err?.name === 'NotReadableError' || err?.toString()?.includes('NotReadableError') || err?.toString()?.includes('Could not start video source');
      setCameraError(
        isNotReadable
          ? (language === 'km'
              ? 'កាមេរ៉ា iPhone កំពុងជាប់រវល់ ឬកំពុងប្រើប្រាស់ក្នុង App ផ្សេង! សូមចុច "ភ្ជាប់ឡើងវិញ"'
              : 'Camera source is busy or locked by another app. Please click "Retry".')
          : (err?.message ||
              (language === 'km'
                ? 'មិនអាចភ្ជាប់កាមេរ៉ា iPhone បានទេ! សូមពិនិត្យ Camera Permission'
                : 'Could not access mobile camera. Please check camera permissions.'))
      );
    }
  };

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isCameraActive, activeSubTab]);

  // Handle manual POS gun barcode dispatch
  const handleManualSendToPos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;

    const matched = products.find((p) => p.barcode === manualBarcode.trim());
    WirelessSyncService.sendRemoteScan(manualBarcode.trim(), scanQtyMultiplier, matched, 'iPhone Handheld');

    setRecentScans((prev) => [
      {
        id: `scan-${Date.now()}`,
        barcode: manualBarcode.trim(),
        nameKh: matched ? matched.nameKh : (language === 'km' ? 'ទំនិញពុំស្គាល់' : 'Unknown Product'),
        priceUsd: matched ? matched.sellingPriceUsd : 0,
        qty: scanQtyMultiplier,
        time: new Date().toLocaleTimeString('km-KH'),
      },
      ...prev.slice(0, 15),
    ]);

    playScanBeep();
    setManualBarcode('');
  };

  // Handle Quick Add Product
  const handleCreateProductMobile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarcode || !newNameKh || newSellingPrice === '') {
      alert(
        language === 'km'
          ? 'សូមបំពេញព័ត៌មានចាំបាច់៖ Barcode, ឈ្មោះទំនិញ និង តម្លៃលក់'
          : 'Please fill in Barcode, Product Name, and Selling Price'
      );
      return;
    }

    onSaveProduct({
      barcode: newBarcode.trim(),
      nameKh: newNameKh.trim(),
      nameEn: newNameEn.trim() || newNameKh.trim(),
      category: newCategory,
      costPriceUsd: Number(newCostPrice) || 0,
      sellingPriceUsd: Number(newSellingPrice) || 0,
      stockQuantity: Number(newStock) || 0,
      minStockLevel: 5,
      unit: newUnit,
      imageUrl: newImageUrl || undefined,
      updatedAt: new Date().toISOString(),
    });

    setSaveSuccessMsg(
      language === 'km'
        ? `✓ បានបន្ថែមទំនិញ "${newNameKh}" ចូលក្នុង Cloud Database ជោគជ័យ!`
        : `✓ Successfully added "${newNameKh}" to Cloud Database!`
    );

    // Reset form fields
    setNewBarcode(generateBarcodeNumber());
    setNewNameKh('');
    setNewNameEn('');
    setNewCostPrice('');
    setNewSellingPrice('');
    setNewImageUrl('');
    setScanSuccessBadge(null);

    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);
  };

  return (
    <div id="mobile-scanner-terminal-view" className="min-h-[calc(100vh-4rem)] bg-[#eef2f6] text-slate-800 p-3 sm:p-5 pb-24 max-w-2xl mx-auto space-y-4 font-sans">
      {/* Mode Sub-Tab Navigation Bar */}
      <div className="grid grid-cols-3 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <button
          onClick={() => setActiveSubTab('pos_gun')}
          className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'pos_gun'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Scan className="w-4 h-4 shrink-0" />
          <span className="text-center">{language === 'km' ? 'Scan គិតលុយ' : 'POS Wireless Scan'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('stock_check')}
          className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'stock_check'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span className="text-center">{language === 'km' ? 'ពិនិត្យ & បន្ថែមស្តុក' : 'Check Stock'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('add_product')}
          className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
            activeSubTab === 'add_product'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ListPlus className="w-4 h-4 shrink-0" />
          <span className="text-center">{language === 'km' ? 'បញ្ចូលទំនិញថ្មី' : 'New Product'}</span>
        </button>
      </div>

      {/* Shared Camera Viewport Box across all tabs */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-md relative space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Scan className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>
              {activeSubTab === 'pos_gun' && (
                language === 'km'
                  ? `🎯 ដាក់កាមេរ៉ា iPhone ជិត Barcode (Scan -> បញ្ជូនទៅ Desktop x${scanQtyMultiplier})`
                  : `🎯 Aim camera at barcode (Beams x${scanQtyMultiplier} to Desktop)`
              )}
              {activeSubTab === 'stock_check' && (
                language === 'km'
                  ? `🔍 ដាក់កាមេរ៉ា iPhone ជិត Barcode (Scan -> ពិនិត្យ/បញ្ចូលស្តុកទំនិញ)`
                  : `🔍 Aim camera at barcode (Inspect/Restock)`
              )}
              {activeSubTab === 'add_product' && (
                language === 'km'
                  ? `⚡ ដាក់កាមេរ៉ា iPhone ជិត Barcode (Scan -> ចាប់លេខ Barcode ចូល Form ស្វ័យប្រវត្តិ)`
                  : `⚡ Aim camera at barcode (Auto-fills Barcode field)`
              )}
            </span>
          </span>
          <button
            onClick={() => setIsCameraActive((p) => !p)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-300"
          >
            {isCameraActive ? <CameraOff className="w-4 h-4 text-red-500" /> : <Camera className="w-4 h-4 text-emerald-600" />}
          </button>
        </div>

        {isCameraActive ? (
          <div className="space-y-2">
            <div className="relative w-full rounded-xl overflow-hidden bg-black min-h-[220px] flex items-center justify-center border border-slate-300">
              <div id="mobile-camera-reader" className="w-full min-h-[220px]"></div>
              
              {/* 1-Scan Lock Visual Cooldown Overlay */}
              {isScanCooldown ? (
                <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-20 space-y-2 border-2 border-emerald-400 rounded-xl animate-fade-in">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                  <div className="text-white font-black text-sm sm:text-base">
                    {language === 'km' ? '✓ Scan ជោគជ័យ 1x រួចរាល់!' : '✓ Scanned 1x Successfully!'}
                  </div>
                  <div className="text-xs text-emerald-300 font-semibold max-w-xs bg-slate-950/70 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                    {language === 'km'
                      ? 'សូមដក Barcode ចេញ ឬរង់ចាំ ២ វិនាទីដើម្បី Scan ទំនិញបន្ទាប់'
                      : 'Please move barcode away or wait 2s for next scan'}
                  </div>
                </div>
              ) : (
                /* Visual Laser Scanning Line */
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse pointer-events-none z-10" />
              )}
            </div>

            {/* iPhone Macro Lens Focus Controls Bar */}
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{language === 'km' ? '🔍 iPhone Macro Focus Lens (ម៉ាក្រូ Scan ជិត)' : '🔍 iPhone Macro Lens Focus'}</span>
                </div>

                {/* Camera Lens Selector Dropdown if multiple camera devices exist */}
                {availableCameras.length > 1 && (
                  <select
                    value={selectedCamId || ''}
                    onChange={(e) => {
                      setSelectedCamId(e.target.value);
                      startCamera();
                    }}
                    className="bg-white text-xs text-slate-800 font-bold border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500 max-w-[180px] truncate"
                  >
                    {availableCameras.map((cam, idx) => {
                      const isMacro = /ultra\s*wide|ultrawide|macro/i.test(cam.label);
                      return (
                        <option key={cam.id} value={cam.id}>
                          {isMacro ? '🔍 iPhone Macro / Ultra Wide' : cam.label || `Camera ${idx + 1}`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Macro Zoom Preset Buttons */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                {[
                  { zoom: 1.0, labelKh: '1.0x ធម្មតា', labelEn: '1.0x Normal' },
                  { zoom: 1.5, labelKh: '1.5x Macro (ណែនាំ)', labelEn: '1.5x Macro (Best)' },
                  { zoom: 2.0, labelKh: '2.0x ជិត', labelEn: '2.0x Macro' },
                  { zoom: 2.5, labelKh: '2.5x ជិតបំផុត', labelEn: '2.5x Close' },
                ].map((preset) => (
                  <button
                    key={preset.zoom}
                    type="button"
                    onClick={() => {
                      setMacroZoom(preset.zoom);
                      applyMacroConstraints(preset.zoom);
                    }}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-black transition-all border cursor-pointer text-center ${
                      macroZoom === preset.zoom
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {language === 'km' ? preset.labelKh : preset.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-[140px] bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-500 text-xs space-y-2 border border-slate-200">
            <CameraOff className="w-8 h-8 text-slate-400" />
            <span>{language === 'km' ? 'កាមេរ៉ាត្រូវ​បានបិទ' : 'Camera disabled'}</span>
          </div>
        )}

        {cameraError && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
            <span>{cameraError}</span>
            <button
              onClick={startCamera}
              className="px-2.5 py-1 bg-red-100 text-red-800 font-bold rounded-lg text-xs hover:bg-red-200"
            >
              {language === 'km' ? 'ភ្ជាប់ឡើងវិញ' : 'Retry'}
            </button>
          </div>
        )}
      </div>

      {/* MODE 1: WIRELESS POS SCANNER GUN */}
      {activeSubTab === 'pos_gun' && (
        <div className="space-y-4">
          {/* Quick Action POS Checkout Button & Auto-Switch Toggle */}
          <div className="bg-white border border-slate-200/90 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <button
              onClick={switchToDesktopPos}
              className="w-full sm:w-auto px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer group"
            >
              <ShoppingCart className="w-5 h-5 text-slate-950 group-hover:scale-110 transition-transform" />
              <span>{language === 'km' ? '🛒 ចូលទៅកាន់ផ្ទាំងគិតលុយ (POS Checkout)' : '🛒 Open POS Checkout Cart'}</span>
            </button>

            <label className="flex items-center space-x-2 text-xs text-slate-800 font-extrabold cursor-pointer bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:border-amber-400 transition-colors">
              <input
                type="checkbox"
                checked={autoSwitchToPos}
                onChange={(e) => setAutoSwitchToPos(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
              <span>
                {language === 'km'
                  ? '⚡ ស្កេនរួច បើកផ្ទាំង POS គិតលុយស្វ័យប្រវត្តិ'
                  : 'Auto-jump to POS Checkout on Scan'}
              </span>
            </label>
          </div>

          {/* Quantity Multiplier bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-2 shadow-xs">
            <span className="text-xs font-black text-slate-800 shrink-0">
              {language === 'km' ? 'ចំនួន Scan ក្នុង ១ដង (Multiplier):' : 'Qty per Scan:'}
            </span>
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {[1, 2, 3, 5, 10, 12, 24].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setScanQtyMultiplier(m)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scanQtyMultiplier === m
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  x{m}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Barcode Input Fallback */}
          <form onSubmit={handleManualSendToPos} className="bg-white p-3 rounded-2xl border border-slate-200/90 space-y-2 shadow-xs">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>{language === 'km' ? 'បញ្ចូល ឬវាយ Barcode ដោយដៃ៖' : 'Manual Barcode Entry:'}</span>
              <span className="text-[11px] text-amber-700 font-black">Multiplier: x{scanQtyMultiplier}</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder={language === 'km' ? 'វាយលេខ Barcode ទីនេះ...' : 'Enter Barcode number...'}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{language === 'km' ? 'បញ្ជូន' : 'Send'}</span>
              </button>
            </div>
          </form>

          {/* Live Recent Scans Feed */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'km' ? 'ប្រវត្តិ Scan បញ្ជូនទៅ Desktop POS' : 'Real-time Scans Sent to Desktop POS'}
                </span>
              </h3>
              <span className="text-[11px] text-slate-500 font-bold">{recentScans.length} Scans</span>
            </div>

            {recentScans.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6 italic font-bold">
                {language === 'km'
                  ? 'ពុំទាន់មានការ Scan ទំនិញនៅឡើយទេ។ សូមយកកាមេរ៉ា iPhone ដាក់ជិត Barcode!'
                  : 'No barcodes scanned yet. Aim your iPhone camera at a product barcode!'}
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {recentScans.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{item.nameKh}</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px]">
                          x{item.qty}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 font-bold">
                        {item.barcode} • {item.priceUsd > 0 ? formatUsd(item.priceUsd) : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700 font-black flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Sent</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: MOBILE STOCK INSPECTOR & RESTOCKER */}
      {activeSubTab === 'stock_check' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>{language === 'km' ? 'Scan ឬជ្រើសរើសទំនិញដើម្បីពិនិត្យស្តុក' : 'Inspect & Restock Product'}</span>
              </h3>
            </div>

            {/* Select product from dropdown if not scanned */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">
                {language === 'km' ? 'ជ្រើសរើសទំនិញតាមបញ្ជី៖' : 'Or select product manually:'}
              </label>
              <select
                value={inspectedProduct?.id || ''}
                onChange={(e) => {
                  const p = products.find((prod) => prod.id === e.target.value);
                  setInspectedProduct(p || null);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              >
                <option value="">-- {language === 'km' ? 'ជ្រើសរើសទំនិញ' : 'Select Product'} --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameKh} ({p.barcode}) - Stock: {p.stockQuantity}
                  </option>
                ))}
              </select>
            </div>

            {/* Inspected Product Card */}
            {inspectedProduct ? (
              <div className="p-4 bg-slate-50 border border-amber-300 rounded-2xl space-y-3 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                      {inspectedProduct.category}
                    </span>
                    <h4 className="font-extrabold text-base text-slate-900 mt-1">{inspectedProduct.nameKh}</h4>
                    <p className="text-xs text-slate-500 font-medium">{inspectedProduct.nameEn}</p>
                    <p className="text-xs font-mono text-emerald-700 font-bold mt-1">Barcode: {inspectedProduct.barcode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900">
                      {formatUsd(inspectedProduct.sellingPriceUsd)}
                    </p>
                    <p className="text-xs text-slate-600 font-bold">
                      {formatKhr(inspectedProduct.sellingPriceUsd * martDetails.defaultExchangeRate)}
                    </p>
                  </div>
                </div>

                {/* Current Stock Meter */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block font-bold">{language === 'km' ? 'ស្តុកបច្ចុប្បន្ន' : 'Current Stock'}</span>
                    <span className="text-2xl font-black text-slate-900">{inspectedProduct.stockQuantity} {inspectedProduct.unit}</span>
                  </div>
                  {inspectedProduct.stockQuantity <= inspectedProduct.minStockLevel && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-black animate-pulse">
                      ⚠️ ស្តុកទាប (Low Stock)
                    </span>
                  )}
                </div>

                {/* Restock Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-xs font-black text-slate-800 block">
                    {language === 'km' ? '⚡ បញ្ចូលស្តុកបន្ថែមភ្លាមៗ (Quick Restock):' : '⚡ Add Stock:'}
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 5, 10, 20].map((addNum) => (
                      <button
                        key={addNum}
                        onClick={() => {
                          onRestockProduct(inspectedProduct.id, addNum);
                          playScanBeep();
                          setInspectedProduct((prev) =>
                            prev ? { ...prev, stockQuantity: prev.stockQuantity + addNum } : null
                          );
                        }}
                        className="py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+{addNum}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6 italic font-bold">
                {language === 'km'
                  ? 'សូម Scan Barcode នៅកាមេរ៉ាខាងលើ ឬជ្រើសរើសទំនិញក្នុងបញ្ជី'
                  : 'Scan barcode with camera above or select a product from dropdown'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: QUICK PRODUCT INGESTION */}
      {activeSubTab === 'add_product' && (
        <form onSubmit={handleCreateProductMobile} className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-emerald-600" />
              <span>{language === 'km' ? 'បញ្ចូលទំនិញថ្មីតាម iPhone' : 'Add New Product via Mobile'}</span>
            </h3>
          </div>

          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {scanSuccessBadge && (
            <div className="p-3 bg-emerald-100 border border-emerald-400 rounded-xl text-xs text-emerald-900 font-black flex items-center justify-between shadow-xs animate-bounce">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{scanSuccessBadge}</span>
              </div>
              <button
                type="button"
                onClick={() => setScanSuccessBadge(null)}
                className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Barcode input with Auto-Scan Camera status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>{language === 'km' ? 'លេខ Barcode *' : 'Barcode Number *'}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-[10px] font-black border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  <span>Auto-Scan Ready</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setNewBarcode(generateBarcodeNumber())}
                className="text-[11px] text-sky-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{language === 'km' ? 'បង្កើតស្វ័យប្រវត្តិ' : 'Auto Generate'}</span>
              </button>
            </label>
            <input
              type="text"
              required
              value={newBarcode}
              onChange={(e) => setNewBarcode(e.target.value)}
              placeholder="e.g., 8850123456789 (ដាក់កាមេរ៉ាក្បែរ Barcode ដើម្បីស្កេនស្វ័យប្រវត្តិ)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-emerald-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Product Image Upload Field (Option ថត/Upload រូបភាពមុខទំនិញ) */}
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>{language === 'km' ? 'រូបភាពមុខទំនិញ (Product Photo)' : 'Product Front Photo'}</span>
              </label>
              {newImageUrl && (
                <button
                  type="button"
                  onClick={() => setNewImageUrl('')}
                  className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'km' ? 'លុបរូបភាព' : 'Remove'}</span>
                </button>
              )}
            </div>

            {newImageUrl ? (
              <div className="relative w-full h-44 bg-white rounded-xl overflow-hidden border border-amber-300 flex items-center justify-center group">
                <img
                  src={newImageUrl}
                  alt="Product Front Preview"
                  className="w-full h-full object-contain p-2"
                />
                <div className="absolute bottom-2 right-2 px-2.5 py-1 bg-amber-500 text-slate-950 text-[11px] font-black rounded-lg shadow-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'km' ? 'បានបញ្ចូលរូបភាព' : 'Photo Attached'}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute('capture', 'environment');
                      fileInputRef.current.click();
                    }
                  }}
                  className="p-3.5 bg-white hover:bg-slate-100 border border-dashed border-slate-300 hover:border-amber-400 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
                >
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 group-hover:scale-110 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-slate-800">
                    {language === 'km' ? 'ថតរូបតាម iPhone' : 'Take Camera Photo'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {language === 'km' ? 'ថតមុខទំនិញផ្ទាល់' : 'Snap product photo'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                    }
                  }}
                  className="p-3.5 bg-white hover:bg-slate-100 border border-dashed border-slate-300 hover:border-sky-400 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
                >
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-700 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-slate-800">
                    {language === 'km' ? 'ជ្រើសរើសពី Album' : 'Choose Photo'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {language === 'km' ? 'ទាញចេញពី Gallery' : 'Select from Photo Gallery'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Product Name Khmer */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              {language === 'km' ? 'ឈ្មោះទំនិញ (ភាសាខ្មែរ) *' : 'Product Name (Khmer) *'}
            </label>
            <input
              type="text"
              required
              value={newNameKh}
              onChange={(e) => setNewNameKh(e.target.value)}
              placeholder="ឧ. ទឹកក្រូច Coca Cola 330ml"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Product Name English */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              {language === 'km' ? 'ឈ្មោះទំនិញ (English)' : 'Product Name (English)'}
            </label>
            <input
              type="text"
              value={newNameEn}
              onChange={(e) => setNewNameEn(e.target.value)}
              placeholder="e.g., Coca Cola Can 330ml"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Prices Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                {language === 'km' ? 'តម្លៃដើម ($)' : 'Cost Price ($)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.35"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                {language === 'km' ? 'តម្លៃលក់ ($) *' : 'Selling Price ($) *'}
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={newSellingPrice}
                onChange={(e) => setNewSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.60"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-amber-700 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Stock & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                {language === 'km' ? 'ចំនួនស្តុកដំបូង' : 'Initial Stock'}
              </label>
              <input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                {language === 'km' ? 'ប្រភេទទំនិញ' : 'Category'}
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {language === 'km' ? cat.nameKh : cat.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Save className="w-5 h-5" />
            <span>{language === 'km' ? 'រក្សាទុកទំនិញក្នុង Cloud Database' : 'Save Product to Cloud'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
