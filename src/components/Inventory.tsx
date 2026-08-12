import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Barcode as BarcodeIcon,
  AlertTriangle,
  Printer,
  ShoppingBag,
  TrendingUp,
  Boxes,
  Camera,
} from 'lucide-react';
import { Product, Language, MartDetails } from '../types';
import { CATEGORIES } from '../data/initialData';
import { formatUsd, formatKhr } from '../utils/formatters';

interface InventoryProps {
  products: Product[];
  onOpenAddModal: () => void;
  onOpenEditModal: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onRestockProduct: (productId: string, addQty: number) => void;
  onOpenBarcodePrint: (product: Product) => void;
  language: Language;
  martDetails: MartDetails;
  openCameraScanner?: (onScanCallback: (barcode: string) => void) => void;
}

export const Inventory: React.FC<InventoryProps> = ({
  products,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteProduct,
  onRestockProduct,
  onOpenBarcodePrint,
  language,
  martDetails,
  openCameraScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

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

  // Restock Modal state
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQuantity, setRestockQuantity] = useState<number>(20);

  // Filter logic
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.nameKh.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

    let matchesStock = true;
    if (stockFilter === 'LOW') {
      matchesStock = p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel;
    } else if (stockFilter === 'OUT') {
      matchesStock = p.stockQuantity <= 0;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Calculate stock stats
  const totalItems = products.length;
  const totalStockQuantity = products.reduce((a, c) => a + c.stockQuantity, 0);
  const totalStockValueUsd = products.reduce((a, c) => a + c.costPriceUsd * c.stockQuantity, 0);
  const lowStockCount = products.filter((p) => p.stockQuantity <= p.minStockLevel).length;

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockProduct && restockQuantity > 0) {
      onRestockProduct(restockProduct.id, restockQuantity);
      setRestockProduct(null);
      setRestockQuantity(20);
    }
  };

  return (
    <div id="inventory-management-wrapper" className="w-full px-2 sm:px-4 lg:px-6 py-6 space-y-6">
      {/* Stock Summary Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold">
              {language === 'km' ? 'មុខទំនិញសរុប' : 'Total Items'}
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalItems}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold">
              {language === 'km' ? 'ចំនួនក្នុងស្តុកសរុប' : 'Total Stock Units'}
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalStockQuantity}</h3>
          </div>
          <div className="p-3 bg-sky-50 text-sky-700 rounded-xl border border-sky-200">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold">
              {language === 'km' ? 'តម្លៃទុនស្តុកសរុប' : 'Stock Valuation'}
            </p>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">
              {formatUsd(totalStockValueUsd)}
            </h3>
          </div>
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold">
              {language === 'km' ? 'ជិតអស់/អស់ពីស្តុក' : 'Low/Out of Stock'}
            </p>
            <h3 className="text-2xl font-black text-amber-700 mt-1">{lowStockCount}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'km'
                ? 'ស្វែងរកតាមឈ្មោះ, Barcode, ឬ ប្រភេទទំនិញ...'
                : 'Search by name, barcode, or category...'
            }
            className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 outline-none"
          />
        </div>

        {/* Category & Stock Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
          >
            <option value="ALL">✨ {language === 'km' ? 'គ្រប់ប្រភេទ' : 'All Categories'}</option>
            {allCategoryList.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {language === 'km' ? cat.nameKh : cat.nameEn}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
          >
            <option value="ALL">📦 {language === 'km' ? 'គ្រប់ស្ថានភាពស្តុក' : 'All Stock Status'}</option>
            <option value="LOW">⚠️ {language === 'km' ? 'ជិតអស់ស្តុក (Low Stock)' : 'Low Stock'}</option>
            <option value="OUT">🚫 {language === 'km' ? 'អស់ពីស្តុក (Out of Stock)' : 'Out of Stock'}</option>
          </select>

          {/* Scan Barcode Button */}
          {openCameraScanner && (
            <button
              onClick={() => {
                openCameraScanner((scannedCode) => {
                  setSearchQuery(scannedCode);
                });
              }}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              title={language === 'km' ? 'Scan ស្វែងរកតាម Barcode' : 'Scan to search barcode'}
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>{language === 'km' ? 'Scan Barcode' : 'Scan Code'}</span>
            </button>
          )}

          {/* Add New Product Button */}
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'km' ? 'បញ្ចូលទំនិញថ្មី' : 'Add New Product'}</span>
          </button>
        </div>
      </div>

      {/* Products Display (Table on Desktop, Touch Cards on Mobile) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {/* Mobile View: Touch Cards */}
        <div className="block md:hidden divide-y divide-slate-200">
          {filteredProducts.map((p) => {
            const priceKhr = p.sellingPriceUsd * martDetails.defaultExchangeRate;
            const isOut = p.stockQuantity <= 0;
            const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel;

            return (
              <div key={p.id} className="p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.nameKh} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-slate-900 text-sm truncate">{p.nameKh}</h4>
                      <p className="text-xs text-slate-500 font-medium truncate">{p.nameEn}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {p.barcode}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {p.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black ${
                      isOut
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : isLow
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isOut
                      ? language === 'km' ? 'អស់ស្តុក' : 'Out'
                      : isLow
                      ? language === 'km' ? 'ជិតអស់' : 'Low'
                      : language === 'km' ? 'មានស្តុក' : 'In Stock'}
                  </span>
                </div>

                {/* Price & Stock info */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">{language === 'km' ? 'ដើមទុន' : 'Cost'}:</span>
                    <span className="font-mono text-slate-700 font-bold">{formatUsd(p.costPriceUsd)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">{language === 'km' ? 'តម្លៃលក់' : 'Selling'}:</span>
                    <span className="font-mono text-emerald-700 font-black">{formatUsd(p.sellingPriceUsd)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">{language === 'km' ? 'ស្តុក' : 'Stock'}:</span>
                    <span className="font-black text-slate-900">{p.stockQuantity} {p.unit}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setRestockProduct(p)}
                    className="flex-1 py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{language === 'km' ? 'ថែមស្តុក' : '+Stock'}</span>
                  </button>

                  <button
                    onClick={() => onOpenBarcodePrint(p)}
                    className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors"
                    title={language === 'km' ? 'បោះពុម្ព Barcode' : 'Print Barcode'}
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onOpenEditModal(p)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                    title={language === 'km' ? 'កែប្រែ' : 'Edit'}
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (
                        confirm(
                          language === 'km'
                            ? `តើអ្នកពិតជាចង់លុបទំនិញ "${p.nameKh}" នេះមែនទេ?`
                            : `Are you sure you want to delete "${p.nameEn}"?`
                        )
                      ) {
                        onDeleteProduct(p.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                    title={language === 'km' ? 'លុប' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="py-12 text-center text-slate-500 font-bold">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-400" />
              <p>{language === 'km' ? 'ពុំមានទំនិញក្នុងបញ្ជីស្តុកឡើយ' : 'No inventory items found.'}</p>
            </div>
          )}
        </div>

        {/* Desktop View: Full Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">{language === 'km' ? 'រូប/ទំនិញ' : 'Product'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'កូដ Barcode' : 'Barcode'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'ប្រភេទ' : 'Category'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'ដើមទុន ($)' : 'Cost ($)'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'តម្លៃលក់ ($/៛)' : 'Selling ($/៛)'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'ចំនួនក្នុងស្តុក' : 'Stock Qty'}</th>
                <th className="py-3.5 px-4">{language === 'km' ? 'ស្ថានភាព' : 'Status'}</th>
                <th className="py-3.5 px-4 text-right">{language === 'km' ? 'សកម្មភាព' : 'Actions'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredProducts.map((p) => {
                const priceKhr = p.sellingPriceUsd * martDetails.defaultExchangeRate;
                const isOut = p.stockQuantity <= 0;
                const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    {/* Image & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.nameKh} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs">{p.nameKh}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{p.nameEn}</p>
                        </div>
                      </div>
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-4 font-mono text-emerald-800 font-bold">
                      {p.barcode}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-slate-700 font-bold">{p.category}</td>

                    {/* Cost price */}
                    <td className="py-3 px-4 font-mono text-slate-600 font-bold">{formatUsd(p.costPriceUsd)}</td>

                    {/* Selling price */}
                    <td className="py-3 px-4">
                      <span className="font-black text-emerald-700 font-mono block">
                        {formatUsd(p.sellingPriceUsd)}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-bold">
                        {formatKhr(priceKhr)}
                      </span>
                    </td>

                    {/* Stock quantity */}
                    <td className="py-3 px-4 font-black text-sm text-slate-900">
                      {p.stockQuantity} <span className="text-xs text-slate-500 font-bold">{p.unit}</span>
                    </td>

                    {/* Status badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black ${
                          isOut
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : isLow
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isOut
                          ? language === 'km'
                            ? 'អស់ពីស្តុក'
                            : 'Out of Stock'
                          : isLow
                          ? language === 'km'
                            ? 'ជិតអស់ស្តុក'
                            : 'Low Stock'
                          : language === 'km'
                          ? 'មានក្នុងស្តុក'
                          : 'In Stock'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-1">
                      {/* Restock Button */}
                      <button
                        onClick={() => setRestockProduct(p)}
                        className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-colors"
                        title={language === 'km' ? 'បន្ថែមចំនួនស្តុក' : 'Restock Quantity'}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {/* Print Barcode Sticker Button */}
                      <button
                        onClick={() => onOpenBarcodePrint(p)}
                        className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors"
                        title={language === 'km' ? 'បោះពុម្ព Barcode' : 'Print Barcode Sticker'}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => onOpenEditModal(p)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                        title={language === 'km' ? 'កែប្រែ' : 'Edit'}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              language === 'km'
                                ? `តើអ្នកពិតជាចង់លុបទំនិញ "${p.nameKh}" នេះមែនទេ?`
                                : `Are you sure you want to delete "${p.nameEn}"?`
                            )
                          ) {
                            onDeleteProduct(p.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                        title={language === 'km' ? 'លុប' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-bold">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                    <p>{language === 'km' ? 'ពុំមានទំនិញក្នុងបញ្ជីស្តុកឡើយ' : 'No inventory items found.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Quantity Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-extrabold text-base mb-1">
              {language === 'km' ? 'បញ្ចូលស្តុកបន្ថែម (Restock)' : 'Restock Item Quantity'}
            </h3>
            <p className="text-xs text-slate-500 font-bold mb-4">{restockProduct.nameKh}</p>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  {language === 'km' ? 'ចំនួនបន្ថែមចូលស្តុក' : 'Add Quantity'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base font-black text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              {/* Presets */}
              <div className="flex gap-2">
                {[10, 20, 50, 100].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setRestockQuantity(qty)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black rounded-lg border border-slate-300"
                  >
                    +{qty}
                  </button>
                ))}
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                >
                  {language === 'km' ? 'បោះបង់' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs"
                >
                  {language === 'km' ? 'រក្សាទុកស្តុក' : 'Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
