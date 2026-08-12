import React, { useEffect, useRef } from 'react';
import { X, Printer, Barcode as BarcodeIcon } from 'lucide-react';
import { Product, Language, MartDetails } from '../types';
import { renderBarcode } from '../utils/barcode';
import { formatUsd, formatKhr } from '../utils/formatters';

interface BarcodePrintModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  martDetails: MartDetails;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  product,
  isOpen,
  onClose,
  language,
  martDetails,
}) => {
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (isOpen && product && barcodeSvgRef.current) {
      renderBarcode(barcodeSvgRef.current, product.barcode);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handlePrint = () => {
    window.print();
  };

  const priceKhr = product.sellingPriceUsd * martDetails.defaultExchangeRate;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {language === 'km' ? 'បោះពុម្ពស្លាក Barcode ទំនិញ' : 'Print Barcode Sticker'}
              </h3>
              <p className="text-xs text-slate-400">{product.nameKh}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sticker Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex flex-col items-center">
          <div
            id="printable-barcode-sticker"
            className="w-full max-w-xs bg-white text-slate-900 rounded-xl p-4 shadow-lg flex flex-col items-center text-center border border-slate-200"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              {martDetails.nameKh}
            </p>
            <p className="text-sm font-extrabold line-clamp-1 text-slate-900">{product.nameKh}</p>
            <p className="text-xs text-slate-600 mb-2 font-medium">{product.nameEn}</p>

            <div className="w-full bg-slate-50 p-2 rounded-lg flex items-center justify-center my-1 border border-slate-100">
              <svg ref={barcodeSvgRef} className="max-w-full h-auto"></svg>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200 w-full flex items-center justify-between px-2">
              <span className="text-xs text-slate-500 font-semibold">{product.unit}</span>
              <div className="text-right">
                <span className="text-base font-black text-emerald-700 block leading-tight">
                  {formatUsd(product.sellingPriceUsd)}
                </span>
                <span className="text-xs font-bold text-slate-600 block">
                  {formatKhr(priceKhr)}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center">
            {language === 'km'
              ? 'ចុចប៊ូតុងខាងក្រោមដើម្បីបោះពុម្ព Barcode បិទលើផលិតផល'
              : 'Click button below to print barcode label for product packaging'}
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between backdrop-blur-md z-10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            {language === 'km' ? 'បោះបង់' : 'Cancel'}
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg shadow-md flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'km' ? 'បោះពុម្ព Barcode' : 'Print Barcode'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
