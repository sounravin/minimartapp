import React, { useState } from 'react';
import {
  BarChart3,
  Send,
  TrendingUp,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  DollarSign,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import { Sale, Product, MartDetails, TelegramConfig, Language } from '../types';
import { formatUsd, formatKhr, formatKhmerDateTime } from '../utils/formatters';
import { formatDailyReportForTelegram, sendTelegramMessage } from '../utils/telegram';

interface ReportsProps {
  sales: Sale[];
  products: Product[];
  martDetails: MartDetails;
  telegramConfig: TelegramConfig;
  language: Language;
}

export const Reports: React.FC<ReportsProps> = ({
  sales,
  products,
  martDetails,
  telegramConfig,
  language,
}) => {
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | 'all'>('today');
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Filter sales by time
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const filteredSales = sales.filter((s) => {
    const saleTime = new Date(s.createdAt).getTime();
    if (timeFilter === 'today') return saleTime >= startOfToday;
    if (timeFilter === '7days') return saleTime >= startOf7DaysAgo;
    return true;
  });

  const totalUsd = filteredSales.reduce((a, c) => a + c.totalUsd, 0);
  const totalKhr = filteredSales.reduce((a, c) => a + c.totalKhr, 0);
  const totalTransactions = filteredSales.length;

  // Calculate profit margin
  const totalCostUsd = filteredSales.reduce((acc, sale) => {
    return (
      acc +
      sale.items.reduce((itemAcc, item) => itemAcc + item.costPriceUsd * item.quantity, 0)
    );
  }, 0);
  const totalProfitUsd = totalUsd - totalCostUsd;

  // Top selling products calculation
  const itemMap: Record<
    string,
    { nameKh: string; nameEn: string; category: string; qty: number; revenueUsd: number }
  > = {};

  filteredSales.forEach((s) => {
    s.items.forEach((item) => {
      if (!itemMap[item.barcode]) {
        itemMap[item.barcode] = {
          nameKh: item.nameKh,
          nameEn: item.nameEn,
          category: '',
          qty: 0,
          revenueUsd: 0,
        };
      }
      itemMap[item.barcode].qty += item.quantity;
      itemMap[item.barcode].revenueUsd += item.totalPriceUsd;
    });
  });

  const topProducts = Object.values(itemMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Low stock products
  const lowStockProducts = products.filter((p) => p.stockQuantity <= p.minStockLevel);

  // Send Report to Telegram
  const handleSendReportToTelegram = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      setTelegramStatus({
        success: false,
        message:
          language === 'km'
            ? 'សូមបញ្ចូល Telegram Bot Token និង Chat ID ក្នុង Setting ជាមុនសិន!'
            : 'Please configure Telegram Bot Token and Chat ID in Settings first.',
      });
      return;
    }

    setSendingTelegram(true);
    setTelegramStatus(null);

    const filterLabel =
      timeFilter === 'today'
        ? 'ថ្ងៃនេះ (Today)'
        : timeFilter === '7days'
        ? '7 ថ្ងៃចុងក្រោយ (Last 7 Days)'
        : 'ទិន្នន័យទាំងអស់ (All Time)';

    const msg = formatDailyReportForTelegram(filteredSales, products, martDetails, filterLabel);
    const result = await sendTelegramMessage(telegramConfig.botToken, telegramConfig.chatId, msg);

    setSendingTelegram(false);
    if (result.success) {
      setTelegramStatus({
        success: true,
        message:
          language === 'km'
            ? 'បានផ្ញើរបាយការណ៍ទៅ Telegram Bot ជោគជ័យ!'
            : 'Sales report successfully sent to Telegram Bot!',
      });
    } else {
      setTelegramStatus({
        success: false,
        message: result.error || 'Failed to send report to Telegram',
      });
    }
  };

  return (
    <div id="reports-analytics-wrapper" className="w-full px-2 sm:px-4 lg:px-6 py-6 space-y-6">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-700" />
            <span>{language === 'km' ? 'របាយការណ៍លក់ & ផ្ញើ Telegram' : 'Sales Reports & Telegram Bot'}</span>
          </h2>
          <p className="text-xs text-slate-500 font-bold mt-1">
            {language === 'km'
              ? 'តាមដានចំណូល, ផលចំណេញ, ទំនិញលក់ដាច់ និង ផ្ញើរបាយការណ៍ផ្ទាល់ទៅ Telegram'
              : 'Track revenue, profits, top items, and send instant summary to Telegram.'}
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Time filter selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                timeFilter === 'today'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'km' ? 'ថ្ងៃនេះ' : 'Today'}
            </button>
            <button
              onClick={() => setTimeFilter('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                timeFilter === '7days'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'km' ? '7 ថ្ងៃចុងក្រោយ' : '7 Days'}
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                timeFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'km' ? 'ទាំងអស់' : 'All'}
            </button>
          </div>

          {/* Send Report to Telegram Button */}
          <button
            onClick={handleSendReportToTelegram}
            disabled={sendingTelegram}
            className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${sendingTelegram ? 'animate-bounce' : ''}`} />
            <span>
              {sendingTelegram
                ? language === 'km'
                  ? 'កំពុងផ្ញើ...'
                  : 'Sending...'
                : language === 'km'
                ? 'ផ្ញើរបាយការណ៍ទៅ Telegram'
                : 'Send Report to Telegram'}
            </span>
          </button>
        </div>
      </div>

      {/* Telegram Status Message */}
      {telegramStatus && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
            telegramStatus.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {telegramStatus.success ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span className="font-bold">{telegramStatus.message}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-bold">
            {language === 'km' ? 'ចំណូលលក់សរុប (USD)' : 'Total Sales (USD)'}
          </p>
          <h3 className="text-2xl font-black text-emerald-700">{formatUsd(totalUsd)}</h3>
          <p className="text-xs text-slate-500 font-bold">{formatKhr(totalKhr)}</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-bold">
            {language === 'km' ? 'ចំណេញសរុបប៉ាន់ស្មាន' : 'Estimated Net Profit'}
          </p>
          <h3 className="text-2xl font-black text-emerald-700">{formatUsd(totalProfitUsd)}</h3>
          <p className="text-xs text-emerald-700 font-bold">
            {totalUsd > 0 ? `Margin: ${((totalProfitUsd / totalUsd) * 100).toFixed(1)}%` : '0%'}
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-bold">
            {language === 'km' ? 'ចំនួនប្រតិបត្តិការលក់' : 'Total Transactions'}
          </p>
          <h3 className="text-2xl font-black text-slate-900">{totalTransactions} លើក</h3>
          <p className="text-xs text-slate-500 font-bold">
            {language === 'km' ? 'វិក្កយបត្រដែលបានទូទាត់' : 'Completed Invoices'}
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-bold">
            {language === 'km' ? 'ទំនិញជិតអស់ស្តុក' : 'Low Stock Alert'}
          </p>
          <h3 className="text-2xl font-black text-amber-700">{lowStockProducts.length} មុខ</h3>
          <p className="text-xs text-amber-700 font-bold">
            {language === 'km' ? 'ត្រូវការបញ្ជាទិញបន្ថែម' : 'Needs reordering'}
          </p>
        </div>
      </div>

      {/* Top Products & Low Stock Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Best Selling Items */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
            <Award className="w-5 h-5 text-amber-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              {language === 'km' ? 'ទំនិញលក់ដាច់បំផុត Top 5' : 'Top 5 Best Selling Items'}
            </h3>
          </div>

          <div className="space-y-3">
            {topProducts.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200"
              >
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center border border-amber-300">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-extrabold text-xs text-slate-900">{p.nameKh}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{p.nameEn}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-xs text-emerald-700 block">
                    {formatUsd(p.revenueUsd)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {p.qty} {language === 'km' ? 'កំប៉ុង/ដប' : 'units sold'}
                  </span>
                </div>
              </div>
            ))}

            {topProducts.length === 0 && (
              <p className="text-xs text-slate-500 font-bold text-center py-6">
                {language === 'km' ? 'ពុំទាន់មានទិន្នន័យការលក់' : 'No sales data yet.'}
              </p>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              {language === 'km' ? 'បញ្ជីទំនិញជិតអស់ពីស្តុក' : 'Low Stock Warning List'}
            </h3>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-amber-50/60 rounded-xl border border-amber-200"
              >
                <div>
                  <p className="font-extrabold text-xs text-slate-900">{p.nameKh}</p>
                  <p className="text-[10px] text-slate-500 font-mono font-bold">Barcode: {p.barcode}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-xs border border-amber-300">
                    {p.stockQuantity} {p.unit}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-1">Min: {p.minStockLevel}</span>
                </div>
              </div>
            ))}

            {lowStockProducts.length === 0 && (
              <div className="p-6 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs font-bold">
                  {language === 'km' ? 'គ្រប់ទំនិញទាំងអស់មានស្តុកគ្រប់គ្រាន់' : 'All items have sufficient stock!'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
