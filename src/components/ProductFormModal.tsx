import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Sparkles,
  Barcode as BarcodeIcon,
  RefreshCw,
  Camera,
  AlertCircle,
  Save,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  CameraOff,
  Maximize2,
  Scan,
} from 'lucide-react';
import { Product, Language, MartDetails } from '../types';
import { CATEGORIES } from '../data/initialData';
import { generateBarcodeNumber, formatKhr } from '../utils/formatters';
import { playScanBeep } from '../utils/barcode';
import { compressAndResizeImage } from '../utils/imageUtils';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Omit<Product, 'id' | 'updatedAt'>, existingId?: string) => void;
  productToEdit?: Product | null;
  existingProducts: Product[];
  language: Language;
  martDetails: MartDetails;
  openCameraScanner: (onScanCallback: (barcode: string) => void) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  existingProducts,
  language,
  martDetails,
  openCameraScanner,
}) => {
  const [barcode, setBarcode] = useState('');
  const [nameKh, setNameKh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('Beverages');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [costPriceUsd, setCostPriceUsd] = useState<number | ''>(0.5);
  const [sellingPriceUsd, setSellingPriceUsd] = useState<number | ''>(0.85);
  const [stockQuantity, setStockQuantity] = useState<number | ''>(50);
  const [minStockLevel, setMinStockLevel] = useState<number | ''>(10);
  const [unit, setUnit] = useState('Bottle');
  const [imageUrl, setImageUrl] = useState('');
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [barcodeDuplicateWarning, setBarcodeDuplicateWarning] = useState<string | null>(null);

  // Inline Auto Barcode Scanner States
  const [isInlineScanning, setIsInlineScanning] = useState(false);
  const [inlineScanError, setInlineScanError] = useState<string | null>(null);
  const [scanSuccessBadge, setScanSuccessBadge] = useState<string | null>(null);
  const inlineScannerRef = useRef<Html5Qrcode | null>(null);

  const stopInlineScanner = async () => {
    if (inlineScannerRef.current) {
      try {
        if (inlineScannerRef.current.isScanning) {
          await inlineScannerRef.current.stop();
        }
        inlineScannerRef.current.clear();
      } catch (e) {
        console.warn('Error stopping inline scanner:', e);
      }
      inlineScannerRef.current = null;
    }

    // Explicitly release media tracks in DOM container
    const element = document.getElementById('product-inline-barcode-reader');
    if (element) {
      const videos = element.querySelectorAll('video');
      videos.forEach((video) => {
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
          video.srcObject = null;
        }
      });
    }
  };

  const startInlineScanner = async () => {
    setInlineScanError(null);
    await stopInlineScanner();

    // Allow DOM container element to render & camera hardware to release
    await new Promise((r) => setTimeout(r, 250));

    const elementId = 'product-inline-barcode-reader';
    const element = document.getElementById(elementId);
    if (!element) {
      setInlineScanError(
        language === 'km'
          ? 'ពុំអាចស្វែងរកកន្លែងបង្ហាញកាមេរ៉ាបានទេ'
          : 'Camera target container not ready'
      );
      return;
    }

    try {
      const scanner = new Html5Qrcode(elementId);
      inlineScannerRef.current = scanner;

      const config = {
        fps: 20,
        qrbox: { width: 260, height: 140 },
        aspectRatio: 1.777,
      };

      const handleSuccess = (decodedText: string) => {
        playScanBeep();
        setBarcode(decodedText);
        setScanSuccessBadge(
          language === 'km'
            ? `✓ បានចាប់យក Barcode ស្វ័យប្រវត្តិ៖ ${decodedText}`
            : `✓ Auto-captured Barcode: ${decodedText}`
        );
        stopInlineScanner();
        setIsInlineScanning(false);
      };

      let started = false;
      try {
        await scanner.start({ facingMode: 'environment' }, config, handleSuccess, () => {});
        started = true;
      } catch (e) {
        console.warn('Direct environment facingMode failed, trying user camera:', e);
      }

      if (!started) {
        try {
          await scanner.start({ facingMode: 'user' }, config, handleSuccess, () => {});
          started = true;
        } catch (e) {
          console.warn('Direct user facingMode failed, checking explicit cameras:', e);
        }
      }

      if (!started) {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCam = cameras.find((c) => /back|rear|environment/i.test(c.label));
          const cameraId = backCam ? backCam.id : cameras[cameras.length - 1].id;
          await scanner.start(cameraId, config, handleSuccess, () => {});
          started = true;
        }
      }
    } catch (err: any) {
      console.error('Inline scanner error:', err);
      const isNotReadable = err?.name === 'NotReadableError' || err?.toString()?.includes('NotReadableError');
      setInlineScanError(
        isNotReadable
          ? (language === 'km'
              ? 'កាមេរ៉ាកំពុងជាប់រវល់ ឬត្រូវបានប្រើប្រាស់ដោយផ្នែកផ្សេង! សូមចុច "បិទ" រួចបើកឡើងវិញ'
              : 'Camera source is busy. Please close active camera and retry.')
          : (err?.message ||
              (language === 'km'
                ? 'ពុំអាចបើកកាមេរ៉ាបានទេ! សូមពិនិត្យ Permission ឬប្រើ Modal Scanner'
                : 'Could not access camera. Please check camera permission.'))
      );
    }
  };

  useEffect(() => {
    if (isInlineScanning) {
      startInlineScanner();
    } else {
      stopInlineScanner();
    }
    return () => {
      stopInlineScanner();
    };
  }, [isInlineScanning]);

  useEffect(() => {
    if (!isOpen) {
      setIsInlineScanning(false);
      stopInlineScanner();
      setScanSuccessBadge(null);
    }
  }, [isOpen]);

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingImage(true);
    try {
      // Auto downscale & compress image (ideal for iPhone high-res camera photos up to 48MP)
      const compressedDataUrl = await compressAndResizeImage(file, {
        maxDimension: 600,
        quality: 0.8,
        mimeType: 'image/jpeg',
      });
      setImageUrl(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress product photo:', err);
      alert(
        language === 'km'
          ? 'ពុំអាចដំណើរការរូបភាពនេះបានទេ! សូមព្យាយាមម្តងទៀត'
          : 'Could not process image. Please try again.'
      );
    } finally {
      setIsCompressingImage(false);
      // Reset input value so user can re-capture or select same file if needed
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (productToEdit) {
      setBarcode(productToEdit.barcode);
      setNameKh(productToEdit.nameKh);
      setNameEn(productToEdit.nameEn);
      setCategory(productToEdit.category);
      setCostPriceUsd(productToEdit.costPriceUsd);
      setSellingPriceUsd(productToEdit.sellingPriceUsd);
      setStockQuantity(productToEdit.stockQuantity);
      setMinStockLevel(productToEdit.minStockLevel);
      setUnit(productToEdit.unit);
      setImageUrl(productToEdit.imageUrl || '');
    } else {
      setBarcode(generateBarcodeNumber());
      setNameKh('');
      setNameEn('');
      setCategory('Beverages');
      setCostPriceUsd(0.5);
      setSellingPriceUsd(0.85);
      setStockQuantity(50);
      setMinStockLevel(10);
      setUnit('Bottle');
      setImageUrl('');
    }
    setAiError(null);
  }, [productToEdit, isOpen]);

  // Check barcode collision
  useEffect(() => {
    if (!barcode) {
      setBarcodeDuplicateWarning(null);
      return;
    }
    const duplicate = existingProducts.find(
      (p) => p.barcode === barcode.trim() && p.id !== productToEdit?.id
    );
    if (duplicate) {
      setBarcodeDuplicateWarning(
        language === 'km'
          ? `⚠️ Barcode នេះត្រូវគ្នានឹងទំនិញ "${duplicate.nameKh}" ក្នុងស្តុកស្រាប់!`
          : `⚠️ Barcode exists for item "${duplicate.nameEn}"!`
      );
    } else {
      setBarcodeDuplicateWarning(null);
    }
  }, [barcode, existingProducts, productToEdit, language]);

  if (!isOpen) return null;

  const handleGenerateBarcode = () => {
    setBarcode(generateBarcodeNumber());
  };

  const handleScanBarcode = async () => {
    setIsInlineScanning(false);
    await stopInlineScanner();
    openCameraScanner((scannedCode) => {
      setBarcode(scannedCode);
    });
  };

  const handleAiAutoFill = async () => {
    if (!nameKh && !nameEn && !barcode) {
      setAiError(
        language === 'km'
          ? 'សូមវាយឈ្មោះទំនិញ ឬ Barcode ជាមុនសិនដើម្បីអោយ AI ជួយបំពេញ'
          : 'Please enter a product name or barcode first for AI auto-fill.'
      );
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/product-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${nameKh} ${nameEn}`,
          barcode,
        }),
      });

      const data = await res.json();
      setAiLoading(false);

      if (data.success && data.data) {
        const d = data.data;
        if (d.nameKh) setNameKh(d.nameKh);
        if (d.nameEn) setNameEn(d.nameEn);
        if (d.category) setCategory(d.category);
        if (d.priceUsd) setSellingPriceUsd(d.priceUsd);
        if (d.unit) setUnit(d.unit);
      } else {
        setAiError(data.error || 'AI Auto-fill failed');
      }
    } catch (err: any) {
      setAiLoading(false);
      setAiError(err.message || 'AI request failed');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      alert(language === 'km' ? 'សូមបញ្ចូល Barcode ទំនិញ' : 'Barcode is required');
      return;
    }
    if (!nameKh.trim()) {
      alert(language === 'km' ? 'សូមបញ្ចូលឈ្មោះទំនិញជាភាសាខ្មែរ' : 'Khmer name is required');
      return;
    }

    const finalCategory =
      category === '__NEW_CUSTOM__' ? customCategoryInput.trim() || 'Groceries' : category;

    onSave(
      {
        barcode: barcode.trim(),
        nameKh: nameKh.trim(),
        nameEn: nameEn.trim() || nameKh.trim(),
        category: finalCategory,
        costPriceUsd: Number(costPriceUsd) || 0,
        sellingPriceUsd: Number(sellingPriceUsd) || 0,
        stockQuantity: Number(stockQuantity) || 0,
        minStockLevel: Number(minStockLevel) || 5,
        unit,
        imageUrl: imageUrl.trim() || undefined,
      },
      productToEdit?.id
    );

    onClose();
  };

  const calculatedSellingKhr = (Number(sellingPriceUsd) || 0) * martDetails.defaultExchangeRate;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl max-w-xl w-full max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {productToEdit
                  ? language === 'km'
                    ? 'កែប្រែព័ត៌មានទំនិញ'
                    : 'Edit Product Info'
                  : language === 'km'
                  ? 'បញ្ចូលទំនិញថ្មីក្នុងស្តុក'
                  : 'Add New Product'}
              </h3>
              <p className="text-xs text-slate-500 font-bold">
                {language === 'km'
                  ? 'កំណត់ព័ត៌មាន Barcode, តម្លៃទិញចូល-លក់ចេញ និងចំនួនស្តុក'
                  : 'Specify barcode, cost/selling price, and stock quantity'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Barcode Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>{language === 'km' ? 'កូដ Barcode ទំនិញ *' : 'Product Barcode *'}</span>
              <span className="text-slate-500 font-medium text-[11px]">
                {language === 'km' ? 'អាច Scan ឬ បង្កើតស្វ័យប្រវត្តិ' : 'Scan or auto-generate'}
              </span>
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 8850000100234"
                required
                className="flex-1 min-w-[130px] bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 tracking-wider outline-none"
              />
              <button
                type="button"
                onClick={() => setIsInlineScanning((prev) => !prev)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                  isInlineScanning
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
                title="Scan with Camera"
              >
                <Camera className="w-4 h-4 text-emerald-700" />
                <span>
                  {isInlineScanning
                    ? language === 'km'
                      ? 'បិទកាមេរ៉ា'
                      : 'Stop'
                    : language === 'km'
                    ? 'Scan កាមេរ៉ា'
                    : 'Scan'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleGenerateBarcode}
                className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                title="Generate New EAN-13 Barcode"
              >
                <RefreshCw className="w-4 h-4 text-sky-700" />
                <span>{language === 'km' ? 'បង្កើតកូដ' : 'Generate'}</span>
              </button>
            </div>

            {/* Inline Live Auto-Scanner Feed */}
            {isInlineScanning && (
              <div className="mt-2.5 p-3 bg-slate-900 rounded-2xl border border-amber-500 space-y-2 relative overflow-hidden shadow-2xl text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                  <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                    <Scan className="w-4 h-4 animate-pulse shrink-0" />
                    <span>
                      {language === 'km'
                        ? '🎯 ដាក់ Barcode នៅជិតកាមេរ៉ា - ប្រព័ន្ធនឹងចាប់យកដោយស្វ័យប្រវត្តិ'
                        : '🎯 Hold camera near barcode - auto-captures code'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsInlineScanning(false);
                        handleScanBarcode();
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium px-2 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Fullscreen Modal Scanner"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                      <span className="hidden sm:inline">{language === 'km' ? 'ពេញផ្ទាំង' : 'Fullscreen'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInlineScanning(false)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium px-2 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>{language === 'km' ? 'បិទ' : 'Close'}</span>
                    </button>
                  </div>
                </div>

                {/* Video Container Viewport */}
                <div className="relative w-full rounded-xl overflow-hidden bg-black min-h-[220px] flex items-center justify-center border border-slate-800">
                  <div id="product-inline-barcode-reader" className="w-full min-h-[220px]"></div>
                  {/* Laser Beam Animation */}
                  <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/90 shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse pointer-events-none z-10" />
                </div>

                {inlineScanError && (
                  <div className="text-xs text-red-400 p-2.5 bg-red-950/60 rounded-xl flex items-center justify-between border border-red-500/30">
                    <span>{inlineScanError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsInlineScanning(false);
                        handleScanBarcode();
                      }}
                      className="underline text-sky-400 font-semibold text-xs shrink-0 cursor-pointer"
                    >
                      {language === 'km' ? 'ប្រើ Modal កាមេរ៉ា' : 'Use Modal Scanner'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Auto-Captured Success Notification */}
            {scanSuccessBadge && !isInlineScanning && (
              <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{scanSuccessBadge}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScanSuccessBadge(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {barcodeDuplicateWarning && (
              <p className="text-xs text-amber-700 font-bold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{barcodeDuplicateWarning}</span>
              </p>
            )}
          </div>

          {/* Product Names & AI Auto Fill */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {language === 'km' ? 'ឈ្មោះទំនិញ (ភាសាខ្មែរ) *' : 'Product Name (Khmer) *'}
              </label>
              <input
                type="text"
                value={nameKh}
                onChange={(e) => setNameKh(e.target.value)}
                placeholder="ឧ. ទឹកបរិសុទ្ធ វីតាល់ 500ml"
                required
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {language === 'km' ? 'ឈ្មោះទំនិញ (English)' : 'Product Name (English)'}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Vital Water 500ml"
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none"
              />
            </div>
          </div>

          {/* AI Helper Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAiAutoFill}
              disabled={aiLoading}
              className="px-3.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-700 ${aiLoading ? 'animate-spin' : ''}`} />
              <span>
                {aiLoading
                  ? language === 'km'
                    ? 'AI កំពុងវិភាគ...'
                    : 'AI Analyzing...'
                  : language === 'km'
                  ? '✨ AI បំពេញព័ត៌មានស្វ័យប្រវត្តិ'
                  : '✨ AI Smart Auto-Fill'}
              </span>
            </button>
          </div>
          {aiError && <p className="text-xs text-red-700 font-bold">{aiError}</p>}

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>{language === 'km' ? 'ប្រភេទទំនិញ (Category)' : 'Category'}</span>
                {category === '__NEW_CUSTOM__' && (
                  <span className="text-[10px] text-amber-700 font-bold animate-pulse">
                    {language === 'km' ? '✨ បញ្ចូលឈ្មោះប្រភេទថ្មីខាងក្រោម' : 'Enter custom name below'}
                  </span>
                )}
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value !== '__NEW_CUSTOM__') {
                    setCustomCategoryInput('');
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {language === 'km' ? cat.nameKh : cat.nameEn}
                  </option>
                ))}
                
                {/* Dynamically include any custom product categories from existing products */}
                {Array.from(
                  new Set(
                    existingProducts
                      .map((p) => p.category)
                      .filter(
                        (cat) => cat && !CATEGORIES.some((c) => c.id.toLowerCase() === cat.toLowerCase())
                      )
                  )
                ).map((customCat) => (
                  <option key={customCat} value={customCat}>
                    📦 {customCat}
                  </option>
                ))}

                <option value="__NEW_CUSTOM__" className="font-bold text-amber-700">
                  ➕ {language === 'km' ? '+ បង្កើតប្រភេទថ្មីបន្ថែម...' : '+ Add Custom Category...'}
                </option>
              </select>

              {category === '__NEW_CUSTOM__' && (
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  placeholder={
                    language === 'km'
                      ? 'វាយបញ្ចូលឈ្មោះប្រភេទថ្មី (ឧ. ផ្លែឈើស្រស់, គ្រឿងបន្លាស់)'
                      : 'Type new category name (e.g. Fresh Fruits, Spare Parts)'
                  }
                  required
                  className="w-full mt-1.5 bg-amber-50/80 border border-amber-400 focus:border-amber-600 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none animate-fadeIn"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {language === 'km' ? 'ខ្នាត/ប្រភេទដប (Unit)' : 'Unit'}
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Bottle, Can, Pack, Box, Kg, Pcs"
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none"
              />
            </div>
          </div>

          {/* Pricing Details */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">
              {language === 'km' ? 'កំណត់តម្លៃ (Price Settings)' : 'Price Settings'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-600 font-bold">
                  {language === 'km' ? 'ដើមទុនទិញចូល ($ USD)' : 'Cost Price ($ USD)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPriceUsd}
                  onChange={(e) => setCostPriceUsd(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-600 font-bold">
                  {language === 'km' ? 'តម្លៃលក់ចេញ ($ USD) *' : 'Selling Price ($ USD) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={sellingPriceUsd}
                  onChange={(e) => setSellingPriceUsd(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-mono font-black outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-emerald-800 font-bold pt-0.5">
                  ≈ {formatKhr(calculatedSellingKhr)}
                </p>
              </div>
            </div>
          </div>

          {/* Stock Levels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {language === 'km' ? 'ចំនួនក្នុងស្តុកបច្ចុប្បន្ន' : 'Stock Quantity'}
              </label>
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-black outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {language === 'km' ? 'កម្រិតប្រកាសអាសន្នជិតអស់ស្តុក' : 'Min Low Stock Alert'}
              </label>
              <input
                type="number"
                min="1"
                value={minStockLevel}
                onChange={(e) => setMinStockLevel(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold outline-none"
              />
            </div>
          </div>

          {/* Image Upload & URL Section */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label className="text-xs font-bold text-slate-700 block">
              {language === 'km' ? 'រូបភាពទំនិញ (ថតរូប/Upload ឬ តំណភ្ជាប់ URL)' : 'Product Image (Take Photo / Upload or URL)'}
            </label>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Image Preview Thumbnail */}
              <div className="w-20 h-20 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 relative group shadow-xs">
                {isCompressingImage ? (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mb-1" />
                    <span className="text-[9px] font-bold text-slate-600 leading-tight">
                      {language === 'km' ? 'បង្រួមរូប...' : 'Scaling...'}
                    </span>
                  </div>
                ) : imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Product preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-90 hover:opacity-100 shadow-md transition-opacity cursor-pointer"
                      title={language === 'km' ? 'លុបរូបភាព' : 'Remove Image'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>

              {/* Upload Button and URL text input */}
              <div className="flex-1 w-full space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Dedicated Direct Camera Capture Button (iPhone / Android) */}
                  <label className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95">
                    <Camera className="w-4 h-4" />
                    <span>{language === 'km' ? 'ថតរូបទំនិញ (Take Photo)' : 'Take Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageFileUpload}
                      className="hidden"
                      disabled={isCompressingImage}
                    />
                  </label>

                  {/* Photo Library Upload Button */}
                  <label className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>{language === 'km' ? 'ជ្រើសរើសរូប' : 'Gallery'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                      disabled={isCompressingImage}
                    />
                  </label>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'km' ? 'លុបរូប' : 'Remove'}</span>
                    </button>
                  )}
                </div>

                {isCompressingImage && (
                  <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>
                      {language === 'km'
                        ? '⚡ ប្រព័ន្ធកំពុង Resize បង្រួមទំហំរូបភាព iPhone ស្វ័យប្រវត្តិ...'
                        : '⚡ Auto resizing & compressing iPhone photo...'}
                    </span>
                  </p>
                )}

                <input
                  type="text"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={
                    language === 'km'
                      ? 'ឬបិទភ្ជាប់ Link រូបភាព (https://...)'
                      : 'Or paste image URL (https://...)'
                  }
                  className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 bg-white/95 border-t border-slate-200 flex items-center justify-between backdrop-blur-md z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            >
              {language === 'km' ? 'បោះបង់' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {productToEdit
                  ? language === 'km'
                    ? 'រក្សាទុកការកែប្រែ'
                    : 'Save Changes'
                  : language === 'km'
                  ? 'រក្សាទុកទំនិញថ្មី'
                  : 'Add Product'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
