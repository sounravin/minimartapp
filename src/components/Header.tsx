import React, { useState } from 'react';
import {
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  Settings,
  Send,
  AlertTriangle,
  RefreshCw,
  Store,
  Smartphone,
  ExternalLink,
  PlusSquare,
  ShieldCheck,
  LogOut,
  User,
  Monitor,
  ChevronDown,
  Edit3,
  Globe,
  Camera,
  Database,
} from 'lucide-react';
import { ActiveTab, Language, MartDetails, TelegramConfig, UserAccount } from '../types';
import { IPhoneInstallModal } from './IPhoneInstallModal';
import { EditProfileModal } from './EditProfileModal';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  martDetails: MartDetails;
  telegramConfig: TelegramConfig;
  lowStockCount: number;
  openSettings: () => void;
  currentUser: UserAccount | null;
  onLogout: () => void;
  onUpdateCurrentUser?: (user: UserAccount) => void;
  inspectedUserStore?: UserAccount | null;
  onClearInspectedStore?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  martDetails,
  telegramConfig,
  lowStockCount,
  openSettings,
  currentUser,
  onLogout,
  onUpdateCurrentUser,
  inspectedUserStore,
  onClearInspectedStore,
}) => {
  const [isIPhoneInstallOpen, setIsIPhoneInstallOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <header id="main-app-header" className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs pt-safe font-khmer">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[4.25rem] py-2 gap-3">
          {/* Logo & Mart Title */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 min-w-0">
            <div className="w-11 h-11 xs:w-12 xs:h-12 sm:w-13 sm:h-13 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-md shadow-slate-200/50 shrink-0 overflow-hidden">
              <img src="/logo.svg" alt="MINI POS Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="font-black text-sm xs:text-base sm:text-xl lg:text-2xl leading-tight text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[130px] xs:max-w-[190px] sm:max-w-none">
                {language === 'km' ? 'ប្រព័ន្ធ MINI POS' : 'MINI POS System'}
              </h1>
              <p className="text-[10px] sm:text-sm text-slate-600 font-bold flex items-center gap-1 whitespace-nowrap">
                <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md sm:rounded-lg border border-amber-300 shrink-0 font-mono text-[10px] sm:text-xs font-extrabold">
                  $1 = {martDetails.defaultExchangeRate.toLocaleString()} ៛
                </span>
                <span className="text-emerald-700 font-extrabold truncate hidden sm:inline">
                  {inspectedUserStore
                    ? (inspectedUserStore.storeNameKh || inspectedUserStore.username)
                    : (currentUser?.storeNameKh || martDetails.nameKh || 'ប្រព័ន្ធ MINI POS')}
                </span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav id="header-nav-tabs" className="hidden md:flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
            {isAdmin && (
              <button
                id="nav-tab-admin-console"
                onClick={() => {
                  setActiveTab('admin_console');
                }}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  activeTab === 'admin_console'
                    ? 'bg-slate-900 text-amber-400 shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                }`}
              >
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                <span>{language === 'km' ? 'Admin Hub' : 'Admin Hub'}</span>
              </button>
            )}

            {(!isAdmin || inspectedUserStore || activeTab !== 'admin_console') && (
              <>
                <button
                  id="nav-tab-pos"
                  onClick={() => setActiveTab('pos')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    activeTab === 'pos'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{language === 'km' ? 'លក់ទំនិញ (POS)' : 'POS Checkout'}</span>
                </button>

                <button
                  id="nav-tab-inventory"
                  onClick={() => setActiveTab('inventory')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer relative ${
                    activeTab === 'inventory'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{language === 'km' ? 'ស្តុកទំនិញ' : 'Inventory'}</span>
                  {lowStockCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-black bg-red-500 text-white rounded-full animate-pulse">
                      {lowStockCount}
                    </span>
                  )}
                </button>

                <button
                  id="nav-tab-sales"
                  onClick={() => setActiveTab('sales')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    activeTab === 'sales'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{language === 'km' ? 'ប្រវត្តិលក់' : 'Sales History'}</span>
                </button>

                <button
                  id="nav-tab-reports"
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    activeTab === 'reports'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{language === 'km' ? 'របាយការណ៍' : 'Reports'}</span>
                </button>

                <button
                  id="nav-tab-customer-display"
                  onClick={() => setActiveTab('customer_display')}
                  className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    activeTab === 'customer_display'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                  title={language === 'km' ? 'ផ្ទាំងម៉ូនីទ័រអតិថិជន (Customer Display)' : 'Customer Display'}
                >
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                  <span className="hidden lg:inline">{language === 'km' ? 'ម៉ូនីទ័រអតិថិជន' : 'Customer Display'}</span>
                </button>
              </>
            )}
          </nav>

          {/* Right Action Widgets - Clean User Profile Dropdown Menu */}
          <div className="flex items-center space-x-2 shrink-0">
            {currentUser && (
              <div className="relative">
                {/* Profile Trigger Button */}
                <button
                  type="button"
                  id="user-profile-menu-trigger"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  {/* User Avatar */}
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500 border border-amber-600 flex items-center justify-center font-black text-slate-950 text-xs sm:text-sm overflow-hidden shrink-0 shadow-xs">
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{currentUser.username.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  {/* User Display Name & Role Subtitle */}
                  <div className="hidden xs:flex flex-col text-left leading-tight">
                    <span className="text-xs font-black text-slate-900 truncate max-w-[90px] sm:max-w-[130px]">
                      {currentUser.fullName || currentUser.username}
                    </span>
                    <span className="text-[10px] font-extrabold text-amber-800 uppercase">
                      {currentUser.role === 'admin' ? 'Administrator' : (currentUser.storeNameKh || 'Member')}
                    </span>
                  </div>

                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Floating Quick Menus Card Dropdown */}
                {isProfileMenuOpen && (
                  <>
                    {/* Backdrop listener */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />

                    {/* Clean Profile Dropdown Container */}
                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden p-3 font-khmer animate-fade-in">
                      {/* Top User Info Section */}
                      <div 
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsEditProfileOpen(true);
                        }}
                        className="p-3 bg-slate-50 hover:bg-amber-50/60 rounded-2xl border border-slate-200/80 mb-2 flex items-center space-x-3 cursor-pointer transition-colors group"
                        title={language === 'km' ? 'ចុចដើម្បីកែសម្រួលព័ត៌មាន ឬរូបថត' : 'Click to edit profile info or avatar'}
                      >
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full border-2 border-amber-400 overflow-hidden bg-amber-500 flex items-center justify-center font-black text-slate-950 text-base shadow-xs">
                            {currentUser.avatarUrl ? (
                              <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span>{currentUser.username.substring(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div
                            className="absolute -bottom-1 -right-1 p-1 bg-slate-900 text-white rounded-full group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-2xs border border-white"
                          >
                            <Camera className="w-3 h-3" />
                          </div>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-amber-900">
                            {currentUser.fullName || currentUser.username}
                          </h4>
                          <span className="text-xs text-slate-500 font-semibold truncate">
                            @{currentUser.username} {currentUser.phone ? `• ${currentUser.phone}` : ''}
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md w-fit mt-1 border border-amber-200 uppercase">
                            {currentUser.role === 'admin' ? 'Administrator' : (currentUser.storeNameKh || 'Store Member')}
                          </span>
                        </div>
                      </div>

                      {/* Quick Menus List */}
                      <div className="space-y-1 text-xs font-extrabold">

                        {/* Supabase Database Settings (Admin Only) */}
                        {currentUser?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              openSettings();
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-slate-800 hover:text-emerald-950 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="p-1.5 bg-emerald-100 group-hover:bg-emerald-200 text-emerald-800 rounded-lg transition-colors">
                                <Database className="w-4 h-4" />
                              </div>
                              <span>{language === 'km' ? 'ទិន្នន័យ Supabase DB' : 'Supabase Order DB'}</span>
                            </div>
                            <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100/80 px-1.5 py-0.5 rounded font-extrabold">Active</span>
                          </button>
                        )}

                        {/* Widget settings */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            openSettings();
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 bg-slate-100 group-hover:bg-amber-100 text-slate-700 group-hover:text-amber-800 rounded-lg transition-colors">
                              <Settings className="w-4 h-4" />
                            </div>
                            <span>{language === 'km' ? 'ការកំណត់ប្រព័ន្ធ (Widget settings)' : 'Widget settings'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">⌘W</span>
                        </button>

                        {/* Standalone Scanner Link (if enabled for member) */}
                        {!isAdmin && !currentUser?.hidePageButton && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              window.open(window.location.origin + window.location.pathname + '?mode=scanner', '_blank');
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                                <Smartphone className="w-4 h-4" />
                              </div>
                              <span>{language === 'km' ? 'បើក Page ថ្មី (Standalone Scanner)' : 'Open Standalone Scanner'}</span>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        )}

                        {/* Language Switcher */}
                        <button
                          type="button"
                          onClick={() => {
                            setLanguage(language === 'km' ? 'en' : 'km');
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm">
                              {language === 'km' ? '🇰🇭' : '🇬🇧'}
                            </div>
                            <span>{language === 'km' ? 'ភាសាខ្មែរ (Khmer Language)' : 'English Language'}</span>
                          </div>
                          <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                            {language === 'km' ? 'KH 🇰🇭' : 'EN 🇬🇧'}
                          </span>
                        </button>

                        <hr className="my-1 border-slate-100" />

                        {/* Log Out */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl hover:bg-red-50 text-red-600 font-black transition-colors cursor-pointer"
                        >
                          <div className="p-1.5 bg-red-100/80 text-red-600 rounded-lg">
                            <LogOut className="w-4 h-4" />
                          </div>
                          <span>{language === 'km' ? 'ចាកចេញពីគណនី (Log out)' : 'Log out'}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Mobile Bottom Dock Navigation Bar */}
      <div id="mobile-bottom-nav-dock" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] px-2 flex items-center justify-around shadow-2xl">
        {isAdmin ? (
          <div className="flex-1 flex items-center justify-center py-2 bg-slate-900 text-amber-400 font-black text-xs rounded-xl mx-2 shadow-xs">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-amber-400" />
            <span>{language === 'km' ? 'ផ្ទាំងគ្រប់គ្រង Admin Console' : 'Admin Console'}</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all ${
                activeTab === 'pos'
                  ? 'text-slate-950 font-black bg-amber-400 border border-amber-500 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-5 h-5 mb-0.5" />
              <span className="text-xs font-bold">{language === 'km' ? 'POS លក់' : 'POS'}</span>
            </button>

            <div className="flex-1 relative flex items-center justify-center">
              <button
                onClick={() => setActiveTab('mobile_scanner')}
                className={`w-full flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all ${
                  activeTab === 'mobile_scanner'
                    ? 'text-slate-950 font-black bg-amber-400 border border-amber-500 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-5 h-5 mb-0.5 text-emerald-700" />
                <span className="text-xs font-bold">{language === 'km' ? 'iPhone Scan' : 'iPhone Scan'}</span>
              </button>
              {!currentUser?.hidePageButton && (
                <button
                  type="button"
                  title={language === 'km' ? 'បើក Scanner ក្នុង Page ថ្មី' : 'Open Standalone Scanner Page'}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(window.location.origin + window.location.pathname + '?mode=scanner', '_blank');
                  }}
                  className="absolute top-1 right-1 p-1 bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-300 shadow-xs transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl relative transition-all ${
                activeTab === 'inventory'
                  ? 'text-slate-950 font-black bg-amber-400 border border-amber-500 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-5 h-5 mb-0.5" />
              <span className="text-xs font-bold">{language === 'km' ? 'ស្តុកទំនិញ' : 'Stock'}</span>
              {lowStockCount > 0 && (
                <span className="absolute top-1 right-2 px-1.5 py-0.2 text-[9px] font-black bg-red-500 text-white rounded-full animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all ${
                activeTab === 'sales'
                  ? 'text-slate-950 font-black bg-amber-400 border border-amber-500 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-5 h-5 mb-0.5" />
              <span className="text-xs font-bold">{language === 'km' ? 'ប្រវត្តិលក់' : 'Sales'}</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all ${
                activeTab === 'reports'
                  ? 'text-slate-950 font-black bg-amber-400 border border-amber-500 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] sm:text-xs font-bold">{language === 'km' ? 'របាយការណ៍' : 'Report'}</span>
            </button>

            <button
              id="mobile-dock-settings-btn"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl text-slate-700 hover:text-slate-950 transition-all cursor-pointer"
            >
              <Settings className="w-5 h-5 mb-0.5 text-slate-800" />
              <span className="text-[10px] sm:text-xs font-bold">{language === 'km' ? 'ការកំណត់' : 'Settings'}</span>
            </button>
          </>
        )}
      </div>

      <IPhoneInstallModal
        isOpen={isIPhoneInstallOpen}
        onClose={() => setIsIPhoneInstallOpen(false)}
        language={language}
      />

      {currentUser && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          currentUser={currentUser}
          language={language}
          onSaveSuccess={(updated) => {
            if (onUpdateCurrentUser) {
              onUpdateCurrentUser(updated);
            }
          }}
        />
      )}
    </header>
  );
};

