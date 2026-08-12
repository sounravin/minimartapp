import React, { useState } from 'react';
import {
  X,
  Settings,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Store,
  Printer,
  RefreshCw,
  HelpCircle,
  Upload,
  Trash2,
  Image as ImageIcon,
  Database,
  ExternalLink,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { MartDetails, TelegramConfig, Language } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  martDetails: MartDetails;
  onSaveMartDetails: (details: MartDetails) => void;
  telegramConfig: TelegramConfig;
  onSaveTelegramConfig: (config: TelegramConfig) => void;
  language: Language;
  isAdmin?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  martDetails,
  onSaveMartDetails,
  telegramConfig,
  onSaveTelegramConfig,
  language,
  isAdmin = false,
}) => {
  // Local form state
  const [nameKh, setNameKh] = useState(martDetails.nameKh);
  const [nameEn, setNameEn] = useState(martDetails.nameEn);
  const [addressKh, setAddressKh] = useState(martDetails.addressKh);
  const [phone, setPhone] = useState(martDetails.phone);
  const [taxNo, setTaxNo] = useState(martDetails.taxNo || '');
  const [logoUrl, setLogoUrl] = useState(martDetails.logoUrl || '');
  const [exchangeRate, setExchangeRate] = useState(martDetails.defaultExchangeRate);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(martDetails.autoPrintReceipt);

  const [botToken, setBotToken] = useState(telegramConfig.botToken);
  const [chatId, setChatId] = useState(telegramConfig.chatId);
  const [autoSendReceipt, setAutoSendReceipt] = useState(telegramConfig.autoSendReceipt);

  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingFirebase, setTestingFirebase] = useState(false);
  const [firebaseStatusResult, setFirebaseStatusResult] = useState<{ success: boolean; message: string; docCount?: number } | null>(null);

  const handleTestFirebase = async () => {
    try {
      setTestingFirebase(true);
      const res = await fetch('/api/firebase/status');
      const data = await res.json();
      setTestingFirebase(false);
      if (data.success) {
        setFirebaseStatusResult({
          success: true,
          message: language === 'km'
            ? `បានភ្ជាប់ Firebase Cloud Firestore (${data.projectId}) ជោគជ័យ!`
            : `Successfully connected to Firebase Cloud Firestore (${data.projectId})!`,
          docCount: data.docCount,
        });
      } else {
        setFirebaseStatusResult({
          success: false,
          message: language === 'km'
            ? `ការភ្ជាប់ Firebase បរាជ័យ៖ ${data.error || 'សូមពិនិត្យមើលការកំណត់'}`
            : `Firebase Connection Failed: ${data.error || 'Check configuration'}`,
        });
      }
    } catch (err: any) {
      setTestingFirebase(false);
      setFirebaseStatusResult({
        success: false,
        message: err.message || 'Error checking Firebase status',
      });
    }
  };

  if (!isOpen) return null;

  // Handle store logo upload with image compression
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(
          language === 'km'
            ? 'ទំហំរូបភាពធំពេក (សូមជ្រើសរើសរូបភាពក្រោម 5MB)'
            : 'Image file too large (Please select under 5MB)'
        );
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const rawBase64 = reader.result;
          const img = new Image();
          img.src = rawBase64;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 300;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/png', 0.85);
              setLogoUrl(compressed);
            } else {
              setLogoUrl(rawBase64);
            }
          };
          img.onerror = () => {
            setLogoUrl(rawBase64);
          };
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Test Telegram Bot Connection
  const handleTestTelegram = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setTestResult({
        success: false,
        message:
          language === 'km'
            ? 'សូមបញ្ចូល Bot Token និង Chat ID ជាមុនសិន'
            : 'Please enter Bot Token and Chat ID first.',
      });
      return;
    }

    setTestingTelegram(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
        }),
      });

      const data = await res.json();
      setTestingTelegram(false);

      if (data.success) {
        setTestResult({
          success: true,
          message:
            language === 'km'
              ? `តភ្ជាប់ Telegram Bot (@${data.username}) និងផ្ញើសារជោគជ័យ!`
              : `Connected to Telegram Bot (@${data.username}) & sent test message!`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to connect to Telegram Bot',
        });
      }
    } catch (err: any) {
      setTestingTelegram(false);
      setTestResult({
        success: false,
        message: err.message || 'Server connection error',
      });
    }
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    onSaveMartDetails({
      ...martDetails,
      nameKh: nameKh.trim(),
      nameEn: nameEn.trim(),
      addressKh: addressKh.trim(),
      phone: phone.trim(),
      taxNo: taxNo.trim(),
      logoUrl: logoUrl,
      defaultExchangeRate: Number(exchangeRate) || 4100,
      autoPrintReceipt,
    });

    onSaveTelegramConfig({
      ...telegramConfig,
      botToken: botToken.trim(),
      chatId: chatId.trim(),
      autoSendReceipt,
      isConnected: testResult?.success || telegramConfig.isConnected,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fade-in font-khmer">
      <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="shrink-0 p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-700 border border-amber-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                {language === 'km' ? 'ការកំណត់ប្រព័ន្ធ Mart & Telegram' : 'Mart & Telegram Settings'}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                {language === 'km' ? 'កំណត់ព័ត៌មានហាង, អត្រាប្តូរប្រាក់, វិក្កយបត្រ, និង Telegram Bot' : 'Configure store info, exchange rate, and Telegram Bot'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSaveAll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-white">
          
          {/* Section 0: Firebase Firestore Database Integration (Admin Only) */}
          {isAdmin && (
            <div className="p-4 sm:p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-black text-sm text-emerald-950">
                    {language === 'km' ? 'ប្រព័ន្ធផ្ទុកទិន្នន័យ Google Cloud Firestore' : 'Google Cloud Firestore Database'}
                  </h4>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-mono font-bold border border-emerald-300">
                  Connected
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/80 p-3 rounded-xl border border-emerald-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Database Engine</span>
                    <span className="font-extrabold text-slate-900">Firebase Firestore</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Project ID</span>
                    <span className="font-extrabold text-slate-900 font-mono">crafty-verve-nsx2c</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-500 font-medium">
                    {language === 'km'
                      ? 'គ្រប់ទិន្នន័យ (Users, Products, Sales, Settings) ត្រូវ​បានរក្សាទុក និង Realtime Sync លើ Firestore ស្វ័យប្រវត្តិ។'
                      : 'All data (Users, Products, Sales, Settings) is synced automatically in Google Cloud Firestore.'}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleTestFirebase}
                      disabled={testingFirebase}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {testingFirebase ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{language === 'km' ? 'តេស្តភ្ជាប់ Firestore' : 'Test Firestore'}</span>
                    </button>
                  </div>
                </div>

                {firebaseStatusResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                      firebaseStatusResult.success
                        ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {firebaseStatusResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">{firebaseStatusResult.message}</p>
                      {firebaseStatusResult.docCount !== undefined && (
                        <p className="text-[10px] opacity-80 mt-0.5">
                          Documents count in sales collection: {firebaseStatusResult.docCount}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Section 1: Telegram Bot Configuration */}
          <div className="p-4 sm:p-5 bg-sky-50/50 rounded-2xl border border-sky-200/80 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-sky-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-sky-600" />
                <h4 className="font-black text-sm text-sky-900">
                  {language === 'km' ? 'ការកំណត់ Telegram Bot ផ្ញើ Report & Receipt' : 'Telegram Bot API Integration'}
                </h4>
              </div>
              <span className="text-[10px] bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full font-mono font-bold border border-sky-200">
                API Bot
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold">
                  Telegram Bot Token *
                </label>
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="e.g. 7890123456:AA..."
                  className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold">
                  Telegram Chat ID / Group ID *
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="e.g. -1001234567890 or 123456789"
                  className="w-full bg-white border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 outline-none transition-all"
                />
              </div>
            </div>

            {/* Auto send toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-bold">
                <input
                  type="checkbox"
                  checked={autoSendReceipt}
                  onChange={(e) => setAutoSendReceipt(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 bg-white border-slate-300 focus:ring-sky-500"
                />
                <span>
                  {language === 'km'
                    ? 'ផ្ញើវិក្កយបត្រទៅ Telegram Bot ស្វ័យប្រវត្តិនៅពេលបង់ប្រាក់រួច'
                    : 'Auto send transaction receipt to Telegram Bot upon payment'}
                </span>
              </label>

              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingTelegram ? 'animate-spin' : ''}`} />
                <span>{language === 'km' ? 'តេស្ត Telegram' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Test result message */}
            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-red-50 text-red-800 border border-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Section 2: Store & Exchange Rate Details */}
          <div className="space-y-4">
            <h4 className="font-black text-sm text-emerald-800 border-b border-slate-200 pb-2 flex items-center gap-2">
              <Store className="w-4.5 h-4.5 text-emerald-600" />
              <span>{language === 'km' ? 'ព័ត៌មានហាង Mart & អត្រាប្តូរប្រាក់' : 'Store Info & Exchange Rate'}</span>
            </h4>

            {/* System Title Lock Banner & Custom Invoice Logo */}
            <div className="space-y-3">
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <h5 className="font-bold text-xs text-slate-900">
                      {language === 'km' ? 'ដាក់ Logo ហាងនៅលើ Invoice' : 'Store Logo for Invoice'}
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-amber-900 font-extrabold bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                    Invoice Logo Custom
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-300 p-2 flex items-center justify-center shrink-0 shadow-sm overflow-hidden relative group">
                    <img
                      src={logoUrl || '/logo.svg'}
                      alt="Store Logo Preview"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <p className="text-xs text-slate-700 font-bold">
                      {language === 'km'
                        ? 'បញ្ចូល Logo ហាងរបស់អ្នកសម្រាប់បង្ហាញលើវិក្កយបត្រ (Invoice Receipt)'
                        : 'Upload custom store logo to display on printed/digital invoices'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {language === 'km'
                        ? 'ទ្រង់ទ្រាយដែលគាំទ្រ៖ PNG, JPG, SVG (ទំហំក្រោម 3MB)'
                        : 'Supported formats: PNG, JPG, SVG (under 3MB)'}
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <label className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{language === 'km' ? 'ជ្រើសរើស Logo ហាង' : 'Upload Logo'}</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>

                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{language === 'km' ? 'ប្រើ Logo ដើម' : 'Reset Logo'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50/80 border border-amber-300/80 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    ឈ្មោះប្រព័ន្ធ៖ <span className="font-extrabold text-amber-900">ប្រព័ន្ធ MINI POS</span>
                  </p>
                  <p className="text-[10px] text-amber-800/80 mt-0.5">
                    {language === 'km'
                      ? 'ឈ្មោះប្រព័ន្ធត្រូវរក្សាថេរ។ អ្នកអាចបញ្ចូលឈ្មោះហាងខាងក្រោមសម្រាប់បង្ហាញលើ Invoice'
                      : 'System name: MINI POS System'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold flex items-center justify-between">
                  <span>{language === 'km' ? 'ឈ្មោះហាងសម្រាប់ Invoice (ភាសាខ្មែរ)' : 'Store Name for Invoice (Khmer)'}</span>
                  <span className="text-[9px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 font-mono font-bold">បង្ហាញលើ Invoice</span>
                </label>
                <input
                  type="text"
                  value={nameKh}
                  onChange={(e) => setNameKh(e.target.value)}
                  placeholder="ឧ. ម៉ាត សុភមង្គល"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold flex items-center justify-between">
                  <span>{language === 'km' ? 'ឈ្មោះហាងសម្រាប់ Invoice (English)' : 'Store Name for Invoice (English)'}</span>
                  <span className="text-[9px] text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300 font-mono font-bold">Invoice Subtitle</span>
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Happy Mart"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold">
                  {language === 'km' ? 'អាសយដ្ឋានហាង' : 'Store Address'}
                </label>
                <input
                  type="text"
                  value={addressKh}
                  onChange={(e) => setAddressKh(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold">
                  {language === 'km' ? 'លេខទូរស័ព្ទទំនាក់ទំនង' : 'Phone Numbers'}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold">
                  {language === 'km' ? 'អត្រាប្តូរប្រាក់ 1 ដុល្លារ = ៛ (KHR)' : 'Exchange Rate ($1 = KHR)'}
                </label>
                <input
                  type="number"
                  step="10"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className="w-full bg-emerald-50/50 border-2 border-emerald-400 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs font-black text-emerald-800 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-700 font-bold">
                  {language === 'km' ? 'លេខសារពើពន្ធ (Tax / VATTIN)' : 'Tax ID (Optional)'}
                </label>
                <input
                  type="text"
                  value={taxNo}
                  onChange={(e) => setTaxNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none transition-all"
                />
              </div>
            </div>

            {/* Auto Print Setting */}
            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-800 font-bold">
                <input
                  type="checkbox"
                  checked={autoPrintReceipt}
                  onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 bg-white border-slate-300 focus:ring-emerald-500"
                />
                <span className="flex items-center gap-1.5 font-bold">
                  <Printer className="w-4 h-4 text-emerald-600" />
                  <span>
                    {language === 'km'
                      ? 'បើកផ្ទាំងបោះពុម្ពវិក្កយបត្រស្វ័យប្រវត្តិ (Auto Print Receipt Dialog) នៅពេលចុចបង់ប្រាក់'
                      : 'Automatically launch print dialog upon payment completion'}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              {language === 'km' ? 'បោះបង់' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{language === 'km' ? 'រក្សាទុកការកំណត់' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
