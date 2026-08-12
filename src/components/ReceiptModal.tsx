import React, { useEffect, useState } from 'react';
import { X, Printer, Send, CheckCircle2, ShoppingBag, Sparkles, Download, Loader2 } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { Sale, MartDetails, Language, TelegramConfig } from '../types';
import { formatUsd, formatKhr, formatKhmerDateTime } from '../utils/formatters';
import { formatReceiptForTelegram, sendTelegramMessage } from '../utils/telegram';

interface ReceiptModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  martDetails: MartDetails;
  telegramConfig: TelegramConfig;
  language: Language;
}

const convertToPngDataUrl = async (imageUrl: string): Promise<string> => {
  if (!imageUrl || imageUrl.trim() === '') imageUrl = '/logo.svg';

  if (imageUrl.startsWith('data:image/png') || imageUrl.startsWith('data:image/jpeg')) {
    return imageUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = img.naturalWidth || img.width || 200;
        const height = img.naturalHeight || img.height || 200;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const pngDataUrl = canvas.toDataURL('image/png');
          if (pngDataUrl && pngDataUrl.startsWith('data:image/png')) {
            resolve(pngDataUrl);
            return;
          }
        }
      } catch (err) {
        console.warn('Error rasterizing logo to PNG canvas:', err);
      }
      resolve(imageUrl);
    };

    img.onerror = async () => {
      try {
        const res = await fetch(imageUrl);
        if (res.ok) {
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const rawData = reader.result as string;
            const tempImg = new Image();
            tempImg.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = tempImg.naturalWidth || tempImg.width || 200;
              canvas.height = tempImg.naturalHeight || tempImg.height || 200;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(tempImg, 0, 0);
                resolve(canvas.toDataURL('image/png'));
                return;
              }
              resolve(rawData);
            };
            tempImg.onerror = () => resolve(rawData);
            tempImg.src = rawData;
          };
          reader.readAsDataURL(blob);
          return;
        }
      } catch (e) {
        console.warn('Fetch fallback error for logo:', e);
      }
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  isOpen,
  onClose,
  martDetails,
  telegramConfig,
  language,
}) => {
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramSuccess, setTelegramSuccess] = useState<boolean | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [isSavingJpg, setIsSavingJpg] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const loadLogo = async () => {
      const targetUrl =
        martDetails.logoUrl && martDetails.logoUrl.trim() !== ''
          ? martDetails.logoUrl
          : '/logo.svg';

      const pngData = await convertToPngDataUrl(targetUrl);
      if (isMounted) {
        setLogoDataUrl(pngData);
      }
    };

    if (isOpen) {
      loadLogo();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, martDetails.logoUrl]);

  useEffect(() => {
    if (isOpen && sale && martDetails.autoPrintReceipt) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, sale, martDetails.autoPrintReceipt]);

  useEffect(() => {
    if (isOpen && sale && telegramConfig.autoSendReceipt && telegramConfig.isConnected && !sale.telegramSent) {
      handleSendTelegram();
    }
  }, [isOpen, sale, telegramConfig]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveJpg = async () => {
    const receiptEl = document.getElementById('printable-pos-receipt');
    if (!receiptEl) return;

    try {
      setIsSavingJpg(true);

      if (!logoDataUrl) {
        const targetUrl =
          martDetails.logoUrl && martDetails.logoUrl.trim() !== ''
            ? martDetails.logoUrl
            : '/logo.svg';
        const pngData = await convertToPngDataUrl(targetUrl);
        setLogoDataUrl(pngData);
      }

      // Wait for DOM images to be ready
      const imgs = Array.from(receiptEl.querySelectorAll('img'));
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) resolve(true);
              else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(true);
              }
            })
        )
      );

      // Give iOS Safari 200ms layout settle time
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Warm up Safari WebKit image renderer
      await toJpeg(receiptEl, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: false,
      }).catch(() => {});

      const dataUrl = await toJpeg(receiptEl, {
        quality: 0.98,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: false,
        skipFonts: false,
      });

      const safeReceiptNo = (sale.receiptNo || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Invoice_${safeReceiptNo}.jpg`;

      const isiOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isiOS) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: 'image/jpeg' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: fileName,
            });
            return;
          }
        } catch (shareErr) {
          console.warn('Share API failed or cancelled:', shareErr);
        }
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error rendering receipt JPG:', err);
      alert(
        language === 'km'
          ? 'មានបញ្ហាក្នុងការបង្កើតរូបភាព JPG នៃវិក្កយបត្រ'
          : 'Failed to generate JPG image of receipt'
      );
    } finally {
      setIsSavingJpg(false);
    }
  };

  const handleSendTelegram = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      setTelegramError(
        language === 'km'
          ? 'សូមកំណត់ Bot Token & Chat ID ក្នុង Setting ជាមុនសិន'
          : 'Please configure Telegram Bot Token and Chat ID in settings first.'
      );
      return;
    }

    setTelegramSending(true);
    setTelegramError(null);

    const msg = formatReceiptForTelegram(sale, martDetails);
    const result = await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, msg);

    setTelegramSending(false);
    if (result.success) {
      setTelegramSuccess(true);
      sale.telegramSent = true;
    } else {
      setTelegramError(result.error || 'Failed to send to Telegram');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 sticky top-0 z-10 print:hidden">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {language === 'km' ? 'វិក្កយបត្រទូទាត់ប្រាក់' : 'Payment Receipt'}
              </h3>
              <p className="text-xs text-slate-400">{sale.receiptNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telegram Status Bar (if any) */}
        {(telegramSuccess || telegramError || telegramSending) && (
          <div className="shrink-0 p-3 bg-slate-950 border-b border-slate-800 text-xs px-4 flex items-center justify-between print:hidden">
            {telegramSending && (
              <span className="text-sky-400 flex items-center gap-1.5 animate-pulse">
                <Send className="w-3.5 h-3.5" />
                <span>{language === 'km' ? 'កំពុងផ្ញើទៅ Telegram...' : 'Sending receipt to Telegram...'}</span>
              </span>
            )}
            {telegramSuccess && (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{language === 'km' ? 'បានផ្ញើទៅ Telegram Bot រួចរាល់!' : 'Receipt sent to Telegram Bot!'}</span>
              </span>
            )}
            {telegramError && (
              <span className="text-red-400 flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />
                <span>{telegramError}</span>
              </span>
            )}
          </div>
        )}

        {/* Printable Receipt Paper Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex flex-col items-center">
          <div
            id="printable-pos-receipt"
            className="w-full bg-white text-slate-900 rounded-lg p-5 shadow-xl font-sans border border-slate-200 text-xs text-slate-800 select-text"
          >
            {/* Mart Logo & Title */}
            <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
              <div style={{ width: '64px', height: '64px', marginBottom: '8px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shrink: 0 }}>
                <img
                  src={logoDataUrl || martDetails.logoUrl || '/logo.svg'}
                  alt="Store Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.svg';
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>

              {martDetails.nameKh && (
                <div
                  style={{ display: 'block', width: '100%', fontSize: '18px', fontWeight: '900', color: '#020617', lineHeight: '1.4', marginTop: '2px', marginBottom: '4px', textAlign: 'center' }}
                  className="font-khmer tracking-normal"
                >
                  {martDetails.nameKh}
                </div>
              )}

              {martDetails.nameEn && martDetails.nameEn.trim() !== '' && martDetails.nameEn !== martDetails.nameKh && (
                <div
                  style={{ display: 'block', width: '100%', fontSize: '13px', fontWeight: '700', color: '#334155', lineHeight: '1.4', marginBottom: '6px', textAlign: 'center' }}
                  className="font-sans"
                >
                  {martDetails.nameEn}
                </div>
              )}

              {martDetails.addressKh && (
                <div
                  style={{ display: 'block', width: '100%', fontSize: '11px', color: '#475569', lineHeight: '1.4', marginBottom: '2px', textAlign: 'center' }}
                  className="font-khmer"
                >
                  {martDetails.addressKh}
                </div>
              )}

              {martDetails.phone && (
                <div
                  style={{ display: 'block', width: '100%', fontSize: '11px', color: '#475569', lineHeight: '1.4', marginBottom: '2px', textAlign: 'center' }}
                  className="font-sans"
                >
                  ទូរស័ព្ទ: {martDetails.phone}
                </div>
              )}

              {martDetails.taxNo && (
                <div
                  style={{ display: 'block', width: '100%', fontSize: '11px', color: '#475569', lineHeight: '1.4', textAlign: 'center' }}
                  className="font-sans"
                >
                  VATTIN: {martDetails.taxNo}
                </div>
              )}
            </div>

            {/* Receipt Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">លេខវិក្កយបត្រ / Inv #:</span>
                <span className="font-bold text-slate-900">{sale.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">កាលបរិច្ឆេទ / Date:</span>
                <span className="font-medium text-slate-800">{formatKhmerDateTime(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">អ្នកគិតប្រាក់ / Cashier:</span>
                <span className="font-semibold text-slate-900">{sale.cashierName}</span>
              </div>
            </div>

            {/* Table of Items */}
            <div className="py-3 border-b border-dashed border-slate-300">
              <div className="flex font-bold border-b border-slate-200 pb-1 text-[11px] text-slate-900">
                <span className="flex-1">មុខទំនិញ / Item</span>
                <span className="w-12 text-center">ចំនួន</span>
                <span className="w-16 text-right">តម្លៃ</span>
                <span className="w-16 text-right">សរុប</span>
              </div>

              <div className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="py-1.5 flex text-[11px] items-start">
                    <div className="flex-1 pr-1">
                      <p className="font-bold text-slate-900 leading-snug">{item.nameKh}</p>
                      <p className="text-[10px] text-slate-500 leading-none">{item.nameEn}</p>
                    </div>
                    <div className="w-12 text-center font-medium text-slate-800">
                      {item.quantity} {item.unit}
                    </div>
                    <div className="w-16 text-right font-medium text-slate-700">
                      {formatUsd(item.sellingPriceUsd)}
                    </div>
                    <div className="w-16 text-right font-bold text-slate-900">
                      {formatUsd(item.totalPriceUsd)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1.5 font-sans">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-600">សរុបរង / Subtotal:</span>
                <span className="font-bold">{formatUsd(sale.subtotalUsd)}</span>
              </div>
              {sale.discountUsd > 0 && (
                <div className="flex justify-between text-[11px] text-red-600 font-medium">
                  <span>បញ្ចុះតម្លៃ / Discount:</span>
                  <span>-{formatUsd(sale.discountUsd)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-extrabold text-sm text-slate-950">សរុបរួម / Total USD:</span>
                <span className="font-extrabold text-base text-emerald-700">{formatUsd(sale.totalUsd)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-xs text-slate-700">សរុបជាប្រាក់រៀល / Total KHR:</span>
                <span className="font-bold text-sm text-emerald-800">{formatKhr(sale.totalKhr)}</span>
              </div>
            </div>

            {/* Payment & Change Info */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-600">វិធីសាស្ត្របង់ / Payment:</span>
                <span className="font-bold uppercase text-slate-900">{sale.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">បានបង់ ($ / ៛):</span>
                <span className="font-semibold text-slate-900">
                  {formatUsd(sale.paidUsd)} ({formatKhr(sale.paidKhr)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">ប្រាក់អាប់ / Change:</span>
                <span className="font-bold text-emerald-700">
                  {formatUsd(sale.changeUsd)} / {formatKhr(sale.changeKhr)}
                </span>
              </div>
            </div>

            {/* Footer Message */}
            <div className="pt-3 text-center text-[10px] text-slate-600 font-medium space-y-0.5">
              <p>{martDetails.receiptFooterMessageKh}</p>
              <p>{martDetails.receiptFooterMessageEn}</p>
              <p className="text-[9px] text-slate-400 mt-2">Powered by Mart POS System</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 print:hidden backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendTelegram}
              disabled={telegramSending}
              className="px-3 py-2 text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'km' ? 'ផ្ញើទៅ Telegram' : 'Telegram'}</span>
              <span className="sm:hidden">Telegram</span>
            </button>

            {/* Save as JPG Button */}
            <button
              onClick={handleSaveJpg}
              disabled={isSavingJpg}
              className="px-3 py-2 text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
              title={language === 'km' ? 'រក្សាទុកវិក្កយបត្រជា file JPG' : 'Save Invoice as JPG image file'}
            >
              {isSavingJpg ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{language === 'km' ? 'រក្សាទុក JPG' : 'Save JPG'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {language === 'km' ? 'បិទ' : 'Close'}
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'km' ? 'បោះពុម្ពវិក្កយបត្រ' : 'Print Receipt'}</span>
              <span className="sm:hidden">{language === 'km' ? 'បោះពុម្ព' : 'Print'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
