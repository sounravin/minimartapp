import React, { useState } from 'react';
import {
  FileText,
  Search,
  Printer,
  Send,
  Eye,
  Calendar,
  DollarSign,
  User,
  ShoppingBag,
  Database,
} from 'lucide-react';
import { Sale, Language, MartDetails, TelegramConfig } from '../types';
import { formatUsd, formatKhr, formatKhmerDateTime } from '../utils/formatters';

interface SalesHistoryProps {
  sales: Sale[];
  onSelectSaleForReceipt: (sale: Sale) => void;
  language: Language;
  martDetails: MartDetails;
  telegramConfig: TelegramConfig;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
  sales,
  onSelectSaleForReceipt,
  language,
  martDetails,
  telegramConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSales = sales.filter((s) => {
    const matchesQuery =
      s.receiptNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.items.some((i) => i.nameKh.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesQuery;
  });

  const totalSalesCount = sales.length;
  const totalRevenueUsd = sales.reduce((a, c) => a + c.totalUsd, 0);
  const totalRevenueKhr = sales.reduce((a, c) => a + c.totalKhr, 0);

  return (
    <div id="sales-history-wrapper" className="w-full px-2 sm:px-4 lg:px-6 py-6 space-y-6">
      {/* Sales Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold">
              {language === 'km' ? 'ចំនួនប្រតិបត្តិការលក់' : 'Total Sales Count'}
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalSalesCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold">
              {language === 'km' ? 'ចំណូលសរុបជា USD' : 'Total Revenue (USD)'}
            </p>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">
              {formatUsd(totalRevenueUsd)}
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold">
              {language === 'km' ? 'ចំណូលសរុបជា KHR' : 'Total Revenue (KHR)'}
            </p>
            <h3 className="text-2xl font-black text-sky-700 mt-1">
              {formatKhr(totalRevenueKhr)}
            </h3>
          </div>
          <div className="p-3 bg-sky-50 text-sky-700 rounded-xl border border-sky-200">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'km'
                ? 'ស្វែងរកតាមលេខវិក្កយបត្រ, ឈ្មោះអ្នកលក់, ឬទំនិញ...'
                : 'Search by receipt number, cashier, or product name...'
            }
            className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/90 px-3.5 py-2 rounded-xl text-emerald-950 shrink-0">
          <Database className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="text-[11px] font-bold leading-tight">
            <span className="block font-black text-emerald-900">Supabase Connected</span>
            <span className="text-[10px] text-emerald-700 font-mono">ygvvtppgqlxyhuwglhkk</span>
          </div>
        </div>
      </div>

      {/* Sales List (Touch Cards on Mobile, Table on Desktop) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {/* Mobile View: Touch Cards */}
        <div className="block md:hidden divide-y divide-slate-200">
          {filteredSales.map((s, idx) => (
            <div key={s.id ? `${s.id}-${idx}` : `sale-${idx}`} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-800 text-sm">{s.receiptNo}</span>
                <span className="uppercase font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  {s.paymentMethod}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                <span>{formatKhmerDateTime(s.createdAt)}</span>
                <span className="text-slate-800 font-bold">
                  {language === 'km' ? 'អ្នកលក់' : 'Cashier'}: {s.cashierName}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block font-bold">{language === 'km' ? 'ចំនួនទំនិញ' : 'Total Items'}:</span>
                  <span className="font-extrabold text-slate-900 text-xs">
                    {s.items.reduce((a, c) => a + c.quantity, 0)} {language === 'km' ? 'មុខ' : 'items'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-black text-emerald-700 font-mono text-sm block">{formatUsd(s.totalUsd)}</span>
                  <span className="text-[10px] text-slate-500 font-bold block">{formatKhr(s.totalKhr)}</span>
                </div>
              </div>

              <button
                onClick={() => onSelectSaleForReceipt(s)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Eye className="w-4 h-4" />
                <span>{language === 'km' ? 'មើល / បោះពុម្ពវិក្កយបត្រ' : 'View / Print Receipt'}</span>
              </button>
            </div>
          ))}

          {filteredSales.length === 0 && (
            <div className="py-12 text-center text-slate-500 font-bold">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-400" />
              <p>{language === 'km' ? 'ពុំទាន់មានប្រវត្តិលក់នៅឡើយ' : 'No sales records found.'}</p>
            </div>
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{language === 'km' ? 'លេខវិក្កយបត្រ' : 'Receipt No'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'កាលបរិច្ឆេទ & ម៉ោង' : 'Date & Time'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'ចំនួនទំនិញ' : 'Items'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'អ្នកលក់' : 'Cashier'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'វិធីសាស្ត្របង់' : 'Payment'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'សរុប USD / KHR' : 'Total Amount'}</th>
                <th className="py-3.5 px-4 text-right">{language === 'km' ? 'សកម្មភាព' : 'Action'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredSales.map((s, idx) => (
                <tr key={s.id ? `${s.id}-${idx}` : `sale-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">{s.receiptNo}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">{formatKhmerDateTime(s.createdAt)}</td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <span className="font-black text-slate-900">{s.items.reduce((a, c) => a + c.quantity, 0)}</span>{' '}
                    {language === 'km' ? 'មុខទំនិញ' : 'items'}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">{s.cashierName}</td>
                  <td className="py-3.5 px-4">
                    <span className="uppercase font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-black text-emerald-700 block font-mono">
                      {formatUsd(s.totalUsd)}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-bold">
                      {formatKhr(s.totalKhr)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onSelectSaleForReceipt(s)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 ml-auto transition-colors shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{language === 'km' ? 'មើល/បោះពុម្ព' : 'View / Print'}</span>
                    </button>
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-bold">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                    <p>{language === 'km' ? 'ពុំទាន់មានប្រវត្តិលក់នៅឡើយ' : 'No sales records found.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
