import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Search,
  Lock,
  Unlock,
  Trash2,
  Eye,
  Store,
  Calendar,
  Clock,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Database,
  Smartphone,
  EyeOff,
  Globe,
  DollarSign,
  Package,
  FileText,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  Wrench,
  Copy,
  Check,
} from 'lucide-react';
import { UserAccount, Language, UserStatus, Product, Sale, MartDetails } from '../types';
import {
  updateUserStatusInCloud,
  updateUserButtonVisibilityInCloud,
  deleteUserAccountInCloud,
  subscribeProducts,
  subscribeSales,
  subscribeMartDetails,
  subscribeMaintenanceMode,
  setMaintenanceModeInCloud,
} from '../lib/firebase';

interface AdminConsoleProps {
  currentUser: UserAccount;
  users: UserAccount[];
  language: Language;
  onInspectMemberStore?: (userId: string) => void;
  onUpdateCurrentUser?: (user: UserAccount) => void;
  onSelectUserToManage?: (user: UserAccount) => void;
  onSelectSaleForReceipt?: (sale: Sale) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  currentUser,
  users,
  language,
  onInspectMemberStore,
  onUpdateCurrentUser,
  onSelectUserToManage,
  onSelectSaleForReceipt,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'suspended'>('all');
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserAccount | null>(null);
  
  // Inspecting user state
  const [inspectingUser, setInspectingUser] = useState<UserAccount | null>(null);
  const [inspectTab, setInspectTab] = useState<'overview' | 'products' | 'sales' | 'settings'>('overview');
  const [inspectSearch, setInspectSearch] = useState('');
  
  const [inspectedProducts, setInspectedProducts] = useState<Product[]>([]);
  const [inspectedSales, setInspectedSales] = useState<Sale[]>([]);
  const [inspectedMartDetails, setInspectedMartDetails] = useState<MartDetails | null>(null);
  
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');

  // Maintenance Mode (MTN Button) State
  const [isMtnMode, setIsMtnMode] = useState<boolean>(false);
  const [mtnMessage, setMtnMessage] = useState<string>('');
  const [isMtnModalOpen, setIsMtnModalOpen] = useState<boolean>(false);
  const [customMtnMsg, setCustomMtnMsg] = useState<string>('');

  // Supabase SQL Setup Modal State
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);

  const SUPABASE_SETUP_SQL = `-- ========================================================
-- 🚀 FULL SUPABASE DATABASE & REALTIME CONFIGURATION SCRIPT
-- Copy and run this in Supabase Dashboard -> SQL Editor
-- ========================================================

-- 1. Create 'users' table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT,
    password TEXT,
    full_name TEXT,
    store_name_kh TEXT,
    store_name_en TEXT,
    phone TEXT,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'active',
    hide_page_button BOOLEAN DEFAULT false,
    is_online BOOLEAN DEFAULT true,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ DEFAULT NOW(),
    data TEXT
);

-- 2. Create 'products' table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    store_id TEXT DEFAULT 'default',
    barcode TEXT,
    name_kh TEXT,
    name_en TEXT,
    price_usd NUMERIC DEFAULT 0,
    cost_usd NUMERIC DEFAULT 0,
    stock_qty NUMERIC DEFAULT 0,
    unit TEXT,
    image_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data TEXT
);

-- 3. Create 'sales' table
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    receipt_number TEXT,
    total_usd NUMERIC DEFAULT 0,
    discount_usd NUMERIC DEFAULT 0,
    grand_total_usd NUMERIC DEFAULT 0,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data TEXT
);

-- 4. Create 'settings' table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    data TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create 'remote_scans' table
CREATE TABLE IF NOT EXISTS public.remote_scans (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    barcode TEXT,
    quantity NUMERIC DEFAULT 1,
    device_name TEXT,
    product_name_kh TEXT,
    product_name_en TEXT,
    price_usd NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data TEXT
);

-- 6. DISABLE Row Level Security (RLS) for seamless access
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_scans DISABLE ROW LEVEL SECURITY;

-- 7. SET REPLICA IDENTITY TO FULL FOR REALTIME LISTENERS
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER TABLE public.remote_scans REPLICA IDENTITY FULL;

-- 8. ENABLE REALTIME PUBLICATION FOR ALL TABLES
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;`;

  useEffect(() => {
    const unsubMtn = subscribeMaintenanceMode((enabled, msg) => {
      setIsMtnMode(enabled);
      setMtnMessage(msg || '');
    });
    return () => unsubMtn();
  }, []);

  const handleToggleMtnMode = async (enabled: boolean) => {
    try {
      await setMaintenanceModeInCloud(enabled, customMtnMsg || mtnMessage);
      const msg = enabled
        ? (language === 'km' ? 'បានបើក Maintenance Mode (MTN) រួចរាល់! User ទាំងអស់នឹងឃើញផ្ទាំង Under Maintenance។' : 'Maintenance Mode ON! All users see maintenance screen.')
        : (language === 'km' ? 'បានបិទ Maintenance Mode (MTN) វិញរួចរាល់! ប្រព័ន្ធដំណើការធម្មតា។' : 'Maintenance Mode OFF! System back online.');
      setActionSuccessMsg(msg);
      setIsMtnModalOpen(false);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Failed to set maintenance mode:", err);
    }
  };

  // Per-member real-time summary statistics map
  const [memberStats, setMemberStats] = useState<{
    [userId: string]: { productCount: number; salesCount: number; totalRevenue: number };
  }>({});

  // Subscribe to real-time stats for all member accounts
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    users.forEach((u) => {
      if (u.role === 'admin') return;

      const unsubP = subscribeProducts(u.id, (prods) => {
        setMemberStats((prev) => ({
          ...prev,
          [u.id]: {
            ...(prev[u.id] || { productCount: 0, salesCount: 0, totalRevenue: 0 }),
            productCount: prods.length,
          },
        }));
      });

      const unsubS = subscribeSales(u.id, (sales) => {
        const revenue = sales.reduce((acc, s) => acc + (s.totalUsd || 0), 0);
        setMemberStats((prev) => ({
          ...prev,
          [u.id]: {
            ...(prev[u.id] || { productCount: 0, salesCount: 0, totalRevenue: 0 }),
            salesCount: sales.length,
            totalRevenue: revenue,
          },
        }));
      });

      unsubs.push(unsubP, unsubS);
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [users.map((u) => u.id).join(',')]);

  // Subscribe to inspecting user's store data when inspecting modal is open
  useEffect(() => {
    if (!inspectingUser) {
      setInspectedProducts([]);
      setInspectedSales([]);
      setInspectedMartDetails(null);
      return;
    }

    const unsubProd = subscribeProducts(inspectingUser.id, (prods) => setInspectedProducts(prods));
    const unsubSales = subscribeSales(inspectingUser.id, (sales) => setInspectedSales(sales));
    const unsubMart = subscribeMartDetails(inspectingUser.id, (details) => setInspectedMartDetails(details));

    return () => {
      unsubProd();
      unsubSales();
      unsubMart();
    };
  }, [inspectingUser?.id]);

  // Helper to determine if a user account is online
  const isUserOnline = (u: UserAccount): boolean => {
    if (u.status === 'suspended') return false;
    if (u.isOnline === false) return false;
    const timeStr = u.lastActiveAt || u.lastLoginAt;
    if (!timeStr) return false;
    const lastTime = new Date(timeStr).getTime();
    return Date.now() - lastTime < 30 * 1000;
  };

  // Relative time text
  const getRelativeTimeText = (timeStr?: string): string => {
    if (!timeStr) return '';
    const lastTime = new Date(timeStr).getTime();
    const diffSec = Math.floor((Date.now() - lastTime) / 1000);
    if (diffSec < 60) return language === 'km' ? 'អំបោះមិញ' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return language === 'km' ? `${diffMin} នាទីមុន` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return language === 'km' ? `${diffHours} ម៉ោងមុន` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return language === 'km' ? `${diffDays} ថ្ងៃមុន` : `${diffDays}d ago`;
  };

  // Aggregate Stats across system
  const totalMembers = users.filter((u) => u.role === 'member').length;
  const onlineMembers = users.filter((u) => u.role === 'member' && u.status === 'active' && isUserOnline(u)).length;
  const offlineMembers = users.filter((u) => u.role === 'member' && u.status === 'active' && !isUserOnline(u)).length;
  const suspendedMembers = users.filter((u) => u.role === 'member' && u.status === 'suspended').length;
  
  const memberStatsList = Object.values(memberStats) as Array<{ productCount: number; salesCount: number; totalRevenue: number }>;
  const totalSystemRevenue = memberStatsList.reduce((acc, s) => acc + (s.totalRevenue || 0), 0);
  const totalSystemProducts = memberStatsList.reduce((acc, s) => acc + (s.productCount || 0), 0);
  const totalSystemSales = memberStatsList.reduce((acc, s) => acc + (s.salesCount || 0), 0);

  // Filtered member list
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.storeNameKh || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === 'online') {
      matchesStatus = u.status === 'active' && isUserOnline(u);
    } else if (statusFilter === 'offline') {
      matchesStatus = u.status === 'active' && !isUserOnline(u);
    } else if (statusFilter === 'suspended') {
      matchesStatus = u.status === 'suspended';
    }

    return matchesSearch && matchesStatus;
  });

  // Toggle Hide / Show "Page ថ្មី" Button
  const handleToggleHideButton = async (targetUser: UserAccount) => {
    const newHideState = !targetUser.hidePageButton;
    try {
      await updateUserButtonVisibilityInCloud(targetUser.id, newHideState);
      
      if (currentUser && targetUser.id === currentUser.id && onUpdateCurrentUser) {
        onUpdateCurrentUser({
          ...currentUser,
          hidePageButton: newHideState,
        });
      }

      const msg = newHideState
        ? (language === 'km' ? `បានលាក់ Button [Page ថ្មី] ចេញពីគណនី ${targetUser.username} រួចរាល់!` : `Hidden [New Page] button for ${targetUser.username}!`)
        : (language === 'km' ? `បានបង្ហាញ Button [Page ថ្មី] លើគណនី ${targetUser.username} វិញរួចរាល់!` : `Shown [New Page] button for ${targetUser.username}!`);
      setActionSuccessMsg(msg);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Failed to toggle user button visibility:", err);
    }
  };

  // Toggle Suspend / Active status
  const handleToggleStatus = async (targetUser: UserAccount) => {
    if (targetUser.role === 'admin') {
      alert(language === 'km' ? 'មិនអាចផ្អាកគណនី Admin បានទេ!' : 'Cannot suspend Admin account!');
      return;
    }

    const newStatus: UserStatus = targetUser.status === 'active' ? 'suspended' : 'active';
    try {
      await updateUserStatusInCloud(targetUser.id, newStatus);
      const msg = newStatus === 'suspended'
        ? (language === 'km' ? `បានផ្អាកគណនី ${targetUser.username} រួចរាល់! User នឹង Log Out ស្វ័យប្រវត្តិ។` : `Suspended ${targetUser.username}. User logged out automatically.`)
        : (language === 'km' ? `បានបើកដំណើរការគណនី ${targetUser.username} ឡើងវិញ!` : `Reactivated ${targetUser.username}!`);
      setActionSuccessMsg(msg);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Failed to toggle user status:", err);
    }
  };

  // Delete User
  const handleConfirmDelete = async () => {
    if (!selectedUserForDelete) return;
    try {
      await deleteUserAccountInCloud(selectedUserForDelete.id);
      const msg = language === 'km'
        ? `បានលុបគណនី ${selectedUserForDelete.username} ចេញពីប្រព័ន្ធរួចរាល់!`
        : `Deleted user account ${selectedUserForDelete.username}!`;
      setActionSuccessMsg(msg);
      setSelectedUserForDelete(null);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Failed to delete user account:", err);
    }
  };

  // Inspect member store
  const handleOpenInspect = (user: UserAccount) => {
    setInspectingUser(user);
    setInspectTab('overview');
    setInspectSearch('');
  };

  // Filter products inside inspection modal
  const filteredInspectedProducts = inspectedProducts.filter((p) => {
    if (!inspectSearch) return true;
    const term = inspectSearch.toLowerCase();
    return (
      (p.nameKh || '').toLowerCase().includes(term) ||
      (p.nameEn || '').toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term)
    );
  });

  // Filter sales inside inspection modal
  const filteredInspectedSales = inspectedSales.filter((s) => {
    if (!inspectSearch) return true;
    const term = inspectSearch.toLowerCase();
    return (
      (s.id || '').toLowerCase().includes(term) ||
      (s.paymentMethod || '').toLowerCase().includes(term) ||
      s.items.some((i) => (i.productNameKh || '').toLowerCase().includes(term))
    );
  });

  // Inspected store summary numbers
  const inspectedRevenueUsd = inspectedSales.reduce((acc, s) => acc + (s.totalUsd || 0), 0);
  const inspectedItemsSold = inspectedSales.reduce(
    (acc, s) => acc + s.items.reduce((sum, item) => sum + item.quantity, 0),
    0
  );
  const inspectedLowStockCount = inspectedProducts.filter((p) => p.stockQuantity <= p.minStockLevel).length;

  return (
    <div id="admin-console-view" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-khmer">
      
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/80 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{language === 'km' ? 'ផ្ទាំងគ្រប់គ្រងប្រព័ន្ធ Admin' : 'System Admin Hub'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-wide text-white">
              {language === 'km' ? 'គ្រប់គ្រងគណនី Member & មើលទិន្នន័យ store ទាំងអស់' : 'All Member Accounts & Multi-Store Data Hub'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {language === 'km'
                ? 'ពិនិត្យមើលទិន្នន័យស្តុក, ប្រវត្តិលក់, ប្រាក់ចំណូល realtime របស់ Member នីមួយៗ ឬចុចចូលគ្រប់គ្រង POS និងស្តុកទំនិញក្នុងនាមជា Admin'
                : 'Monitor real-time inventory, sales invoices, revenue per member, or switch to manage POS/inventory directly as Admin.'}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg">
                👑
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold">{language === 'km' ? 'គណនីបច្ចុប្បន្ន' : 'Logged-in Account'}</p>
                <p className="text-sm font-extrabold text-amber-400">{currentUser.username} ({currentUser.role.toUpperCase()})</p>
                <p className="text-xs text-slate-300">{currentUser.storeNameKh || 'MINI POS HQ'}</p>
              </div>
            </div>

            {/* Supabase SQL Setup Button */}
            <button
              id="admin-supabase-sql-button"
              onClick={() => {
                setSqlCopied(false);
                setIsSqlModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 ml-0 sm:ml-2"
            >
              <Database className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{language === 'km' ? '⚡ ដំឡើង Supabase SQL' : '⚡ Supabase SQL Setup'}</span>
            </button>

            {/* MTN Button (Maintenance Mode Toggle) */}
            <button
              id="admin-mtn-button"
              onClick={() => {
                setCustomMtnMsg(mtnMessage);
                setIsMtnModalOpen(true);
              }}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer border ${
                isMtnMode
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300'
              }`}
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <span>{isMtnMode ? (language === 'km' ? '🔴 MTN: កំពុងបើក (Under Maintenance)' : '🔴 MTN: ON') : (language === 'km' ? '🔧 Button MTN' : '🔧 Button MTN')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Status Notification Toast */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 rounded-2xl text-sm font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg('')} className="p-1 hover:bg-emerald-500/20 rounded-lg cursor-pointer">
            <X className="w-4 h-4 text-emerald-800" />
          </button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">{language === 'km' ? 'សរុប Member' : 'Total Members'}</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900">{totalMembers}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">{language === 'km' ? 'Member អនឡាញ' : 'Online Members'}</p>
            <p className="text-lg sm:text-2xl font-black text-emerald-700">{onlineMembers}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">{language === 'km' ? 'ចំណូលប្រព័ន្ធសរុប' : 'System Total Sales'}</p>
            <p className="text-lg sm:text-2xl font-black text-amber-700">${totalSystemRevenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">{language === 'km' ? 'ទំនិញក្នុងស្តុកសរុប' : 'Total Products'}</p>
            <p className="text-lg sm:text-2xl font-black text-indigo-900">{totalSystemProducts}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center space-x-3 col-span-2 lg:col-span-1">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">{language === 'km' ? 'ប្រតិបត្តិការលក់សរុប' : 'Total Invoices'}</p>
            <p className="text-lg sm:text-2xl font-black text-purple-900">{totalSystemSales}</p>
          </div>
        </div>
      </div>

      {/* Member Management Controls (Search & Filter) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'km' ? 'ស្វែងរក Member តាម Username, ឈ្មោះហាង ឬលេខទូរស័ព្ទ...' : 'Search members by username, store name, phone...'}
              className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-slate-800 placeholder-slate-400 outline-none transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'km' ? 'ទាំងអស់' : 'All'}
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'online' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{language === 'km' ? 'អនឡាញ' : 'Online'}</span>
            </button>
            <button
              onClick={() => setStatusFilter('offline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'offline' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>{language === 'km' ? 'អូហ្វឡាញ' : 'Offline'}</span>
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'suspended' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{language === 'km' ? 'ត្រូវ​បាន​ផ្អាក' : 'Suspended'}</span>
            </button>
          </div>
        </div>

        {/* Members List Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 text-xs font-black border-b border-slate-200">
                <th className="px-4 py-3.5">{language === 'km' ? 'គណនី Member' : 'User Account'}</th>
                <th className="px-4 py-3.5">{language === 'km' ? 'ឈ្មោះហាង' : 'Store Name'}</th>
                <th className="px-4 py-3.5">{language === 'km' ? 'លេខទូរស័ព្ទ' : 'Phone'}</th>
                <th className="px-4 py-3.5 text-center">{language === 'km' ? 'ទិន្នន័យ Store (Realtime)' : 'Store Data'}</th>
                <th className="px-4 py-3.5 text-center">{language === 'km' ? 'ស្ថានភាព' : 'Status'}</th>
                <th className="px-4 py-3.5 text-right">{language === 'km' ? 'សកម្មភាព (Actions)' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500 font-bold text-sm">
                    {language === 'km' ? 'មិនមានទិន្នន័យ Member ត្រូវគ្នាទេ' : 'No matching members found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.role === 'admin';
                  const isSuspended = u.status === 'suspended';
                  const online = isUserOnline(u);
                  const relTime = getRelativeTimeText(u.lastActiveAt || u.lastLoginAt);
                  const uStats = memberStats[u.id] || { productCount: 0, salesCount: 0, totalRevenue: 0 };

                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${isSuspended ? 'bg-red-50/30' : ''}`}>
                      {/* User Avatar & Info */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="relative shrink-0">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base overflow-hidden border-2 shadow-xs ${
                              isAdmin
                                ? 'bg-amber-500 border-amber-300'
                                : isSuspended
                                ? 'bg-red-500 border-red-300'
                                : online
                                ? 'bg-emerald-600 border-emerald-400'
                                : 'bg-slate-800 border-slate-600'
                            }`}>
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt={u.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : isAdmin ? (
                                '👑'
                              ) : (
                                u.username.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                isSuspended ? 'bg-red-500' : online ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                              title={isSuspended ? 'Suspended' : online ? 'Online' : 'Offline'}
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900">{u.username}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                isAdmin ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {u.role}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold">{u.fullName || u.username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Store Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-xs sm:text-sm">
                          <Store className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{u.storeNameKh || u.storeNameEn || 'ហាងទូទៅ'}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-700">
                        {u.phone || '—'}
                      </td>

                      {/* Store Realtime Data Metrics */}
                      <td className="px-4 py-3.5 text-center">
                        {isAdmin ? (
                          <span className="text-xs text-slate-400 italic">HQ Account</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 text-xs font-extrabold flex items-center gap-1" title="ចំនួនទំនិញស្តុក">
                              <Package className="w-3.5 h-3.5 text-sky-600" />
                              <span>{uStats.productCount}</span>
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-extrabold flex items-center gap-1" title="ចំនួនប្រតិបត្តិការលក់">
                              <FileText className="w-3.5 h-3.5 text-purple-600" />
                              <span>{uStats.salesCount}</span>
                            </span>
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center gap-1" title="ប្រាក់ចំណូលសរុប">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              <span>${uStats.totalRevenue.toFixed(2)}</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3.5 text-center">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-300">
                            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>{language === 'km' ? 'ត្រូវ​បាន​ផ្អាក' : 'Suspended'}</span>
                          </span>
                        ) : online ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                            </span>
                            <span>{language === 'km' ? 'អនឡាញ' : 'Online'}</span>
                          </span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
                              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                              <span>{language === 'km' ? 'អូហ្វឡាញ' : 'Offline'}</span>
                            </span>
                            {relTime && (
                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 whitespace-nowrap">
                                {relTime}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Hide / Show "Page ថ្មី" Button Toggle */}
                          <button
                            onClick={() => handleToggleHideButton(u)}
                            title={u.hidePageButton ? 'ចុចដើម្បបង្ហាញ Button [Page ថ្មី]' : 'ចុចដើម្បីលាក់ Button [Page ថ្មី]'}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer border shadow-2xs ${
                              u.hidePageButton
                                ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            }`}
                          >
                            {u.hidePageButton ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span className="hidden xl:inline">{language === 'km' ? 'លាក់ [Page ថ្មី]' : 'Hide Page'}</span>
                              </>
                            ) : (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="hidden xl:inline">{language === 'km' ? 'បង្ហាញ [Page ថ្មី]' : 'Show Page'}</span>
                              </>
                            )}
                          </button>

                          {/* Inspect Member Store Data Modal */}
                          {!isAdmin && (
                            <button
                              onClick={() => handleOpenInspect(u)}
                              title={language === 'km' ? 'មើលទិន្នន័យពិស្តាររបស់ Member នេះ' : 'Inspect Data'}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-700" />
                              <span>{language === 'km' ? 'មើលទិន្នន័យ' : 'Inspect'}</span>
                            </button>
                          )}

                          {/* Direct Manage Store Button */}
                          {!isAdmin && onSelectUserToManage && (
                            <button
                              onClick={() => onSelectUserToManage(u)}
                              title={language === 'km' ? 'ចូលគ្រប់គ្រង POS និងស្តុករបស់ Member នេះ' : 'Manage Store'}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                              <span className="hidden md:inline">{language === 'km' ? 'ចូលគ្រប់គ្រង' : 'Manage'}</span>
                            </button>
                          )}

                          {/* Suspend / Reactivate Toggle */}
                          {!isAdmin && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={isSuspended ? 'បើកដំណើរការឡើងវិញ' : 'ផ្អាកគណនីនេះភ្លាមៗ'}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-1 cursor-pointer shadow-xs ${
                                isSuspended
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              }`}
                            >
                              {isSuspended ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">{language === 'km' ? 'បើកវិញ' : 'Activate'}</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">{language === 'km' ? 'ផ្អាក' : 'Suspend'}</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Delete Account */}
                          {!isAdmin && (
                            <button
                              onClick={() => setSelectedUserForDelete(u)}
                              title={language === 'km' ? 'លុបគណនីនេះចេញពីប្រព័ន្ធ' : 'Delete Account'}
                              className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {selectedUserForDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900">
                {language === 'km' ? 'ប្រាកដជាចង់លុបគណនីនេះមែនទេ?' : 'Confirm Delete Account?'}
              </h3>
              <p className="text-sm text-slate-600">
                {language === 'km' ? (
                  <>
                    តើអ្នកពិតជាចង់លុបគណនី <strong className="text-red-600">{selectedUserForDelete.username}</strong> ({selectedUserForDelete.storeNameKh}) ចេញពីប្រព័ន្ធមែនទេ? គណនីនេះនឹងត្រូវ Log Out ចេញភ្លាមៗ។
                  </>
                ) : (
                  <>
                    Are you sure you want to delete <strong className="text-red-600">{selectedUserForDelete.username}</strong>? The user will be automatically logged out immediately.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setSelectedUserForDelete(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-sm transition-colors cursor-pointer"
              >
                {language === 'km' ? 'បោះបង់' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-colors cursor-pointer shadow-lg shadow-red-600/30"
              >
                {language === 'km' ? 'លុបគណនីភ្លាមៗ' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED INSPECT MEMBER STORE DATA MODAL */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] flex flex-col animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-lg shadow-sm shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    {language === 'km' ? 'ផ្ទាំងពិនិត្យទិន្នន័យពិស្តារ' : 'Member Store Data Hub'}
                  </h3>
                  <p className="text-xs text-amber-800 font-bold flex items-center gap-2">
                    <span>Member: <strong>{inspectingUser.username}</strong></span>
                    <span>|</span>
                    <span>ហាង: <strong>{inspectingUser.storeNameKh || inspectingUser.storeNameEn || 'General Mart'}</strong></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onSelectUserToManage && (
                  <button
                    onClick={() => {
                      onSelectUserToManage(inspectingUser);
                      setInspectingUser(null);
                    }}
                    className="px-4 py-2 rounded-2xl bg-slate-900 text-amber-400 font-black text-xs sm:text-sm hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                    <span>{language === 'km' ? 'ចូលគ្រប់គ្រង POS ហាងនេះ' : 'Manage POS'}</span>
                  </button>
                )}
                <button
                  onClick={() => setInspectingUser(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Sub Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto shrink-0">
              <button
                onClick={() => setInspectTab('overview')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  inspectTab === 'overview'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>{language === 'km' ? 'សេចក្តីសង្ខេប' : 'Overview'}</span>
              </button>

              <button
                onClick={() => setInspectTab('products')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  inspectTab === 'products'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>{language === 'km' ? `ស្តុកទំនិញ (${inspectedProducts.length})` : `Products (${inspectedProducts.length})`}</span>
              </button>

              <button
                onClick={() => setInspectTab('sales')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  inspectTab === 'sales'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{language === 'km' ? `ប្រវត្តិលក់ (${inspectedSales.length})` : `Sales (${inspectedSales.length})`}</span>
              </button>

              <button
                onClick={() => setInspectTab('settings')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  inspectTab === 'settings'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>{language === 'km' ? 'ព័ត៌មានហាង' : 'Store Info'}</span>
              </button>
            </div>

            {/* Modal Main Body Content */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">

              {/* TAB 1: OVERVIEW */}
              {inspectTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-1">
                      <p className="text-xs font-bold text-emerald-800">{language === 'km' ? 'ប្រាក់ចំណូលសរុប' : 'Total Revenue'}</p>
                      <p className="text-xl sm:text-2xl font-black text-emerald-900">${inspectedRevenueUsd.toFixed(2)}</p>
                      <p className="text-[10px] text-emerald-700 font-extrabold font-mono">
                        ៛ {(inspectedRevenueUsd * (inspectedMartDetails?.defaultExchangeRate || 4100)).toLocaleString()}
                      </p>
                    </div>

                    <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 space-y-1">
                      <p className="text-xs font-bold text-sky-800">{language === 'km' ? 'វិក្កយបត្របានលក់' : 'Total Invoices'}</p>
                      <p className="text-xl sm:text-2xl font-black text-sky-900">{inspectedSales.length} វិក្កយបត្រ</p>
                    </div>

                    <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 space-y-1">
                      <p className="text-xs font-bold text-indigo-800">{language === 'km' ? 'មុខទំនិញក្នុងស្តុក' : 'Products in Stock'}</p>
                      <p className="text-xl sm:text-2xl font-black text-indigo-900">{inspectedProducts.length} មុខ</p>
                    </div>

                    <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 space-y-1">
                      <p className="text-xs font-bold text-purple-800">{language === 'km' ? 'ចំនួនទំនិញលក់បាន' : 'Items Sold'}</p>
                      <p className="text-xl sm:text-2xl font-black text-purple-900">{inspectedItemsSold} កញ្ចប់</p>
                    </div>
                  </div>

                  {/* Low Stock Alert in Store */}
                  {inspectedLowStockCount > 0 && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs font-bold text-amber-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <span>ហាងនេះមានទំនិញជិតអស់ពីស្តុកចំនួន {inspectedLowStockCount} មុខ</span>
                      </div>
                      <button
                        onClick={() => setInspectTab('products')}
                        className="text-xs font-black text-amber-800 underline hover:text-amber-950 cursor-pointer"
                      >
                        មើលបញ្ជីទំនិញ
                      </button>
                    </div>
                  )}

                  {/* Recent 5 Sales Preview */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                      <span>{language === 'km' ? 'ប្រតិបត្តិការលក់ថ្មីៗចុងក្រោយ' : 'Recent Sales'}</span>
                      <button onClick={() => setInspectTab('sales')} className="text-amber-800 hover:underline cursor-pointer text-[11px]">
                        មើលទាំងអស់ →
                      </button>
                    </h4>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">កូដវិក្កយបត្រ</th>
                            <th className="p-2.5">កាលបរិច្ឆេទ</th>
                            <th className="p-2.5">ទូទាត់តាម</th>
                            <th className="p-2.5 text-right">សរុប ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {inspectedSales.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400 font-bold">
                                មិនទាន់មានប្រតិបត្តិការលក់នៅឡើយទេ
                              </td>
                            </tr>
                          ) : (
                            inspectedSales.slice(0, 5).map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-mono font-extrabold text-slate-900">{s.id}</td>
                                <td className="p-2.5 font-bold text-slate-600">
                                  {new Date(s.createdAt).toLocaleString()}
                                </td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 font-black uppercase text-[10px] text-slate-800">
                                    {s.paymentMethod}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-black text-emerald-700">
                                  ${s.totalUsd.toFixed(2)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRODUCTS */}
              {inspectTab === 'products' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={inspectSearch}
                      onChange={(e) => setInspectSearch(e.target.value)}
                      placeholder={language === 'km' ? 'ស្វែងរកទំនិញតាមឈ្មោះ, កូដបារកូដ...' : 'Search product name or barcode...'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="p-3">ឈ្មោះទំនិញ</th>
                          <th className="p-3">បារកូដ</th>
                          <th className="p-3">ប្រភេទ</th>
                          <th className="p-3">តម្លៃលក់ ($)</th>
                          <th className="p-3">ដើម ($)</th>
                          <th className="p-3 text-right">ស្តុក</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-bold">
                        {filteredInspectedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">
                              រកមិនឃើញទំនិញត្រូវគ្នាទេ
                            </td>
                          </tr>
                        ) : (
                          filteredInspectedProducts.map((p) => {
                            const isLow = p.stockQuantity <= p.minStockLevel;
                            return (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="p-3 text-slate-900 font-black">{p.nameKh}</td>
                                <td className="p-3 font-mono text-slate-600">{p.barcode}</td>
                                <td className="p-3 text-slate-500">{p.category}</td>
                                <td className="p-3 font-black text-emerald-700">${p.sellingPriceUsd.toFixed(2)}</td>
                                <td className="p-3 text-slate-600">${p.costPriceUsd.toFixed(2)}</td>
                                <td className="p-3 text-right">
                                  <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                                    isLow ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse' : 'bg-slate-100 text-slate-800'
                                  }`}>
                                    {p.stockQuantity} {p.unit}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: SALES HISTORY */}
              {inspectTab === 'sales' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={inspectSearch}
                      onChange={(e) => setInspectSearch(e.target.value)}
                      placeholder={language === 'km' ? 'ស្វែងរកវិក្កយបត្រតាម ID...' : 'Search sales invoice ID...'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="p-3">កូដវិក្កយបត្រ</th>
                          <th className="p-3">ថ្ងៃ ខែ ម៉ោង</th>
                          <th className="p-3">ចំនួនមុខទំនិញ</th>
                          <th className="p-3">ទូទាត់តាម</th>
                          <th className="p-3 text-right">សរុប ($)</th>
                          <th className="p-3 text-center">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-bold">
                        {filteredInspectedSales.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400">
                              មិនទាន់មានវិក្កយបត្រលក់នៅឡើយទេ
                            </td>
                          </tr>
                        ) : (
                          filteredInspectedSales.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-black text-slate-900">{s.id}</td>
                              <td className="p-3 text-slate-600">{new Date(s.createdAt).toLocaleString()}</td>
                              <td className="p-3 text-slate-700">{s.items.length} មុខ ({s.items.reduce((a, b) => a + b.quantity, 0)} កញ្ចប់)</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-extrabold uppercase text-[10px] text-slate-800">
                                  {s.paymentMethod}
                                </span>
                              </td>
                              <td className="p-3 text-right font-black text-emerald-700">${s.totalUsd.toFixed(2)}</td>
                              <td className="p-3 text-center">
                                {onSelectSaleForReceipt && (
                                  <button
                                    onClick={() => onSelectSaleForReceipt(s)}
                                    className="p-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black cursor-pointer"
                                  >
                                    មើល Receipt
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: STORE SETTINGS INFO */}
              {inspectTab === 'settings' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <h4 className="font-black text-slate-900 text-sm border-b border-slate-200 pb-2">
                    {language === 'km' ? 'ព័ត៌មានលម្អិតអំពីហាង' : 'Store Details'}
                  </h4>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500 font-bold">ឈ្មោះហាង (ភាសាខ្មែរ):</p>
                      <p className="font-black text-slate-900 text-sm">{inspectedMartDetails?.nameKh || inspectingUser.storeNameKh || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold">ឈ្មោះហាង (English):</p>
                      <p className="font-black text-slate-900 text-sm">{inspectedMartDetails?.nameEn || inspectingUser.storeNameEn || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold">លេខទូរស័ព្ទហាង:</p>
                      <p className="font-mono font-bold text-slate-800">{inspectedMartDetails?.phone1 || inspectingUser.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-bold">អត្រាប្តូរប្រាក់ ($1):</p>
                      <p className="font-mono font-extrabold text-amber-800">{inspectedMartDetails?.defaultExchangeRate || 4100} ៛</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-500 font-bold">អាសយដ្ឋានហាង:</p>
                      <p className="font-bold text-slate-800">{inspectedMartDetails?.addressKh || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-200 shrink-0">
              <span className="text-xs font-bold text-slate-500">
                រាល់ទិន្នន័យត្រូវបាន Sync Realtime ពី Supabase Cloud
              </span>
              <button
                onClick={() => setInspectingUser(null)}
                className="px-6 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'km' ? 'បិទ' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MAINTENANCE MODE (MTN BUTTON) MODAL */}
      {isMtnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-6 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-md ${
                  isMtnMode ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-slate-950'
                }`}>
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {language === 'km' ? 'ប្រព័ន្ធ Maintenance Mode (MTN)' : 'System Maintenance Control'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    {isMtnMode
                      ? (language === 'km' ? '🔴 ស្ថានភាព៖ កំពុងបើក (Under Maintenance)' : '🔴 Status: UNDER MAINTENANCE')
                      : (language === 'km' ? '🟢 ស្ថានភាព៖ ដំណើរការធម្មតា (Online)' : '🟢 Status: ONLINE')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMtnModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Info */}
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-bold">
                {language === 'km'
                  ? 'នៅពេលដែលអ្នកចុចបើក Maintenance Mode, ប្រព័ន្ធនឹងបង្ហាញផ្ទាំង "Under Maintenance" ជូនទៅគ្រប់ Member ទាំងអស់ភ្លាមៗស្វ័យប្រវត្តិ។ មានតែគណនី Admin ប៉ុណ្ណោះដែលអាចបន្តចូលប្រើប្រាស់បាន។'
                  : 'Enabling Maintenance Mode will trigger the "Under Maintenance" full-screen overlay for all regular members in real-time. Only Admin accounts can navigate and edit system settings.'}
              </p>

              {/* Maintenance Message Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800">
                  {language === 'km' ? 'សារដំណឹងបង្ហាញលើផ្ទាំង Maintenance (ជម្រើស):' : 'Custom Announcement Message:'}
                </label>
                <textarea
                  rows={3}
                  value={customMtnMsg}
                  onChange={(e) => setCustomMtnMsg(e.target.value)}
                  placeholder={language === 'km' ? 'ឧទាហរណ៍៖ ប្រព័ន្ធ POS កំពុងស្ថិតក្នុងការកែសម្រួល ឬ upgrade. សូមរង់ចាំបន្តិច!' : 'Enter message for users during maintenance...'}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 rounded-2xl p-3 text-xs font-bold text-slate-900 outline-none"
                />
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={() => setIsMtnModalOpen(false)}
                className="w-full sm:w-1/3 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-colors cursor-pointer"
              >
                {language === 'km' ? 'បោះបង់' : 'Cancel'}
              </button>

              {isMtnMode ? (
                <button
                  onClick={() => handleToggleMtnMode(false)}
                  className="w-full sm:w-2/3 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm transition-colors cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'km' ? 'បិទ Maintenance (បើកប្រព័ន្ធធម្មតា)' : 'Turn OFF Maintenance (Back Online)'}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleToggleMtnMode(true)}
                  className="w-full sm:w-2/3 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm transition-colors cursor-pointer shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{language === 'km' ? 'បើក Maintenance Mode (MTN ON)' : 'Turn ON Maintenance Mode (MTN)'}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Supabase SQL Setup Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/90 text-white rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {language === 'km' ? '⚡ ស្គ្រីបដំឡើង Supabase SQL & Realtime' : '⚡ Supabase SQL & Realtime Setup Script'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'km' ? 'ចម្លង SQL នេះទៅ Run ក្នុង Supabase SQL Editor ដើម្បីឱ្យ Realtime ដំណើរការ 100%' : 'Copy & run this in Supabase SQL Editor to activate Realtime 100%'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-300 space-y-2">
                <p className="font-extrabold flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {language === 'km' ? 'ប្រព័ន្ធ Cloud Firestore ត្រូវ​បានភ្ជាប់រួចរាល់' : 'Cloud Firestore Database Connected'}
                </p>
                <p className="text-slate-300 font-medium text-[12px] leading-relaxed">
                  {language === 'km' 
                    ? 'ទិន្នន័យទាំងអស់ (Users, Products, Sales, Settings) ត្រូវ​បានរក្សាទុក និង Sync ដោយស្វ័យប្រវត្តិនៅលើ Google Cloud Firebase Firestore។ មិនចាំបាច់រៀបចំ SQL ឬ Table បន្ថែមទៀតទេ។'
                    : 'All application data (Users, Products, Sales, Settings) is automatically synchronized and stored in Google Cloud Firebase Firestore. No additional SQL or schema setup is required.'}
                </p>
              </div>

              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                      setSqlCopied(true);
                      setTimeout(() => setSqlCopied(false), 3000);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
                  >
                    {sqlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{sqlCopied ? (language === 'km' ? 'បាន Copy រួចរាល់!' : 'Copied!') : (language === 'km' ? 'ចម្លង (Copy SQL)' : 'Copy SQL')}</span>
                  </button>
                </div>

                <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-sky-300 overflow-x-auto max-h-[350px] leading-relaxed select-all">
                  {SUPABASE_SETUP_SQL}
                </pre>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {language === 'km' ? 'បិទ' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
