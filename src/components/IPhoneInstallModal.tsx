import React from 'react';
import { X, Share, PlusSquare, Smartphone, CheckCircle2, ArrowDown } from 'lucide-react';

interface IPhoneInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'km' | 'en';
}

export const IPhoneInstallModal: React.FC<IPhoneInstallModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">
              {language === 'km' ? 'របៀបដំឡើងលើ iPhone (Home Screen)' : 'Add to iPhone Home Screen'}
            </h3>
            <p className="text-xs text-emerald-400 font-semibold">
              {language === 'km' ? 'ប្រើប្រាស់ Sokha Mart ដូច App ពេញលេញ' : 'Run Sokha Mart POS like a native App'}
            </p>
          </div>
        </div>

        {/* Step-by-step instructions */}
        <div className="space-y-3.5 pt-2">
          {/* Step 1 */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0 font-extrabold text-sm">
              1
            </div>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>{language === 'km' ? 'ចុចលើប៊ូតុង' : 'Tap the'}</span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-extrabold flex items-center gap-1 border border-sky-500/30">
                  <Share className="w-3.5 h-3.5" /> Share
                </span>
                <span>{language === 'km' ? 'នៅខាងក្រោម Safari' : 'at the bottom of Safari'}</span>
              </p>
              <p className="text-slate-400 text-[11px]">
                {language === 'km'
                  ? 'ប៊ូតុង Share មានរូបរាងជាប្រអប់ដែលមានសញ្ញាព្រួញចង្អុលឡើងលើ'
                  : 'Look for the box icon with an arrow pointing up on Safari tab bar.'}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 font-extrabold text-sm">
              2
            </div>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>{language === 'km' ? 'រំកិលចុះក្រោម រួចជ្រើសយក' : 'Scroll down and select'}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold flex items-center gap-1 border border-emerald-500/30">
                  <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                </span>
              </p>
              <p className="text-slate-400 text-[11px]">
                {language === 'km'
                  ? '(បន្ថែមទៅអេក្រង់ដើម) នៅក្នុងជម្រើស Menu Safari'
                  : 'Tap "Add to Home Screen" option in the action sheet list.'}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 font-extrabold text-sm">
              3
            </div>
            <div className="text-xs space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>{language === 'km' ? 'ចុចប៊ូតុង' : 'Tap'}</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-extrabold flex items-center gap-1 border border-purple-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Add (បន្ថែម)
                </span>
                <span>{language === 'km' ? 'នៅជ្រុងខាងស្តាំលើ' : 'at the top right'}</span>
              </p>
              <p className="text-slate-400 text-[11px]">
                {language === 'km'
                  ? 'រួចរាល់! App Sokha Mart នឹងបង្ហាញលើអេក្រង់ iPhone របស់អ្នក'
                  : 'Done! Sokha Mart icon will appear on your iPhone home screen.'}
              </p>
            </div>
          </div>
        </div>

        {/* Visual indicator arrow pointing to Safari bar on mobile */}
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 text-center space-y-1">
          <p className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1">
            <ArrowDown className="w-4 h-4 animate-bounce" />
            <span>{language === 'km' ? 'ចុច Share ខាងក្រោមប្រាវស៊ើ Safari' : 'Tap Share button below on Safari'}</span>
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl text-xs transition-colors shadow-lg"
        >
          {language === 'km' ? 'យល់ព្រម (Got it)' : 'Got it'}
        </button>
      </div>
    </div>
  );
};
