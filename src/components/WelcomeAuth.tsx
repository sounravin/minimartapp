import React, { useState } from 'react';
import {
  Store,
  User,
  Lock,
  UserPlus,
  LogIn,
  ShieldCheck,
  ShoppingBag,
  BarChart2,
  Send,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  Sparkles,
} from 'lucide-react';
import { UserAccount, Language } from '../types';
import { saveUserAccountInCloud, DEFAULT_ADMIN } from '../lib/firebase';
import { getDeviceInfo, fetchClientIp } from '../utils/deviceInfo';

interface WelcomeAuthProps {
  onLoginSuccess: (user: UserAccount) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  existingUsers: UserAccount[];
}

export const WelcomeAuth: React.FC<WelcomeAuthProps> = ({
  onLoginSuccess,
  language,
  setLanguage,
  existingUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return localStorage.getItem('minipos_remember_me') === 'true';
  });

  // Auto-fill remembered credentials on load
  React.useEffect(() => {
    const savedCreds = localStorage.getItem('minipos_remembered_creds');
    if (savedCreds) {
      try {
        const { username, password } = JSON.parse(savedCreds);
        if (username) setLoginUsername(username);
        if (password) setLoginPassword(password);
      } catch (e) {}
    }
  }, []);

  // Signup form
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupStoreName, setSignupStoreName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanUser = loginUsername.trim();
    const cleanPass = loginPassword.trim();

    if (!cleanUser || !cleanPass) {
      setLoginError(
        language === 'km'
          ? 'សូមបញ្ចូលឈ្មោះអ្នកប្រើប្រាស់ និងពាក្យសម្ងាត់'
          : 'Please enter username and password'
      );
      return;
    }

    // Handle Remember Me credentials saving
    if (rememberMe) {
      localStorage.setItem('minipos_remember_me', 'true');
      localStorage.setItem(
        'minipos_remembered_creds',
        JSON.stringify({ username: cleanUser, password: cleanPass })
      );
    } else {
      localStorage.setItem('minipos_remember_me', 'false');
      localStorage.removeItem('minipos_remembered_creds');
    }

    // Check hardcoded/seeded Admin default first
    if (cleanUser === 'admin' && (cleanPass === '123' || cleanPass === 'Admin' || cleanPass === DEFAULT_ADMIN.password)) {
      const adminAcc: UserAccount = {
        ...DEFAULT_ADMIN,
        lastLoginAt: new Date().toISOString(),
      };
      saveUserAccountInCloud(adminAcc);
      onLoginSuccess(adminAcc);
      return;
    }

    // Check in existing users list
    const foundUser = existingUsers.find(
      (u) => u.username.toLowerCase() === cleanUser.toLowerCase()
    );

    if (!foundUser) {
      setLoginError(
        language === 'km'
          ? 'រកមិនឃើញគណនីនេះទេ! សូមពិនិត្យឈ្មោះ ឬចុះឈ្មោះគណនីថ្មី'
          : 'Account not found! Please check username or sign up for a new account.'
      );
      return;
    }

    if (foundUser.password && foundUser.password !== cleanPass) {
      setLoginError(
        language === 'km' ? 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ!' : 'Incorrect password!'
      );
      return;
    }

    if (foundUser.status === 'suspended') {
      setLoginError(
        language === 'km'
          ? '⛔ គណនីរបស់អ្នកត្រូវបានផ្អាកដំណើរការដោយ Admin! សូមទាក់ទងអ្នកគ្រប់គ្រង'
          : '⛔ Your account has been suspended by Admin!'
      );
      return;
    }

    // Update last login & capture device info
    const { deviceType } = getDeviceInfo();
    const updatedUser: UserAccount = {
      ...foundUser,
      lastLoginAt: new Date().toISOString(),
      deviceType: foundUser.deviceType || deviceType,
    };

    // Fetch client IP asynchronously
    fetchClientIp().then((ip) => {
      updatedUser.deviceIp = ip;
      saveUserAccountInCloud(updatedUser);
    }).catch(() => {
      saveUserAccountInCloud(updatedUser);
    });

    onLoginSuccess(updatedUser);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    setSignupSuccess('');

    const uName = signupUsername.trim();
    const pass = signupPassword.trim();
    const confPass = signupConfirmPassword.trim();
    const fName = signupFullName.trim();
    const sName = signupStoreName.trim();
    const phone = signupPhone.trim();

    if (!uName || !pass || !fName || !sName) {
      setSignupError(
        language === 'km'
          ? 'សូមបំពេញព័ត៌មានដែលចាំបាច់ទាំងអស់'
          : 'Please fill in all required fields'
      );
      return;
    }

    if (pass !== confPass) {
      setSignupError(
        language === 'km'
          ? 'ពាក្យសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ'
          : 'Passwords do not match'
      );
      return;
    }

    if (pass.length < 3) {
      setSignupError(
        language === 'km'
          ? 'ពាក្យសម្ងាត់យ៉ាងហោចណាស់ ៣ តួអក្សរ'
          : 'Password must be at least 3 characters'
      );
      return;
    }

    // Check username conflict
    const exists = existingUsers.some(
      (u) => u.username.toLowerCase() === uName.toLowerCase()
    );
    if (exists || uName.toLowerCase() === 'admin') {
      setSignupError(
        language === 'km'
          ? 'ឈ្មោះអ្នកប្រើប្រាស់នេះមានក្នុងប្រព័ន្ធរួចហើយ'
          : 'Username already exists'
      );
      return;
    }

    const { deviceType } = getDeviceInfo();
    const clientIp = await fetchClientIp();

    const newMember: UserAccount = {
      id: `usr-mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: uName,
      password: pass,
      fullName: fName,
      storeNameKh: sName,
      storeNameEn: sName,
      phone: phone || '012 000 000',
      role: 'member',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      totalSalesCount: 0,
      deviceType,
      deviceIp: clientIp,
      hidePageButton: false,
    };

    try {
      await saveUserAccountInCloud(newMember);
      setSignupSuccess(
        language === 'km'
          ? '🎉 ចុះឈ្មោះជោគជ័យ! ប្រព័ន្ធកំពុងនាំអ្នកចូលប្រើប្រាស់...'
          : '🎉 Registration successful! Logging in...'
      );
      setTimeout(() => {
        onLoginSuccess(newMember);
      }, 1000);
    } catch (err) {
      setSignupError(
        language === 'km'
          ? 'មានបញ្ហាក្នុងការចុះឈ្មោះ សូមព្យាយាមម្តងទៀត'
          : 'Error signing up. Please try again.'
      );
    }
  };

  return (
    <div
      id="welcome-auth-page"
      className="h-screen h-[100dvh] w-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 font-khmer selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden"
    >
      {/* LEFT PANEL: High Quality Retail/Mart Interior Background Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden flex-col justify-between p-12">
        {/* Retail Store Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1920&q=80"
            alt="Retail Store Interior"
            className="w-full h-full object-cover object-center transform scale-105 filter brightness-75 contrast-110"
            referrerPolicy="no-referrer"
          />
          {/* Aesthetic Dark Overlay Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/90" />
        </div>

        {/* Top Header Badge on Store Side */}
        <div className="relative z-10 flex items-center justify-end">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xs px-3.5 py-1.5 rounded-full font-bold shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{language === 'km' ? 'ប្រព័ន្ធដំណើរការ ២៤/៧' : 'Cloud Server Active 24/7'}</span>
          </div>
        </div>

        {/* Center/Bottom Highlight Showcase Content */}
        <div className="relative z-10 space-y-6 max-w-lg mt-auto">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'km' ? 'ប្រព័ន្ធគ្រប់គ្រងហាងឆ្លាតវៃ' : 'Next-Gen Smart Retail Management'}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              {language === 'km' ? (
                <>
                  គ្រប់គ្រងការលក់ និងស្តុកទំនិញ <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400">
                    ដោយទំនុកចិត្ត និងរហ័សទាន់ចិត្ត
                  </span>
                </>
              ) : (
                <>
                  Effortless Retail POS & <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400">
                    Real-time Inventory Control
                  </span>
                </>
              )}
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
              {language === 'km'
                ? 'គាំទ្រការស្កែន Barcode, គិតលុយ $ នឹង ៛, បោះពុម្ពវិក្កយបត្រ, ផ្ញើរបាយការណ៍ចូល Telegram Bot ភ្លាមៗ និងបែងចែកទិន្នន័យ Member នីមួយៗដាច់ដោយឡែក។'
                : 'Barcode scanning, dual USD/KHR currency calculation, thermal receipt printer, Telegram Bot sales alerts, and secure multi-tenant Member isolation.'}
            </p>
          </div>

          {/* Feature Badges Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 p-3 rounded-2xl flex items-center space-x-3">
              <ShoppingBag className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-xs text-white">
                  {language === 'km' ? 'ស្កែនកូដ Barcode' : 'Barcode POS'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {language === 'km' ? 'គិតលុយរហ័សទាន់ចិត្ត' : 'Instant Checkout'}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 p-3 rounded-2xl flex items-center space-x-3">
              <Send className="w-5 h-5 text-sky-400 shrink-0" />
              <div>
                <p className="font-bold text-xs text-white">
                  {language === 'km' ? 'Telegram Bot' : 'Telegram Bot'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {language === 'km' ? 'ជូនដំណឹងវិក្កយបត្រ' : 'Auto Sales Alerts'}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 p-3 rounded-2xl flex items-center space-x-3">
              <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-xs text-white">
                  {language === 'km' ? 'Mobile Scanner' : 'Mobile Scanner'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {language === 'km' ? 'ស្កែនតាមទូរស័ព្ទដៃ' : 'Wireless Mobile Scan'}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/80 p-3 rounded-2xl flex items-center space-x-3">
              <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <p className="font-bold text-xs text-white">
                  {language === 'km' ? 'ទិន្នន័យសុវត្ថិភាព' : 'Cloud Isolation'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {language === 'km' ? 'រក្សាស្តុក Member ដាច់ដោយឡែក' : 'Multi-Member Cloud'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Blurred Background + Centered Modern Login / Sign Up Card */}
      <div 
        className="w-full lg:w-1/2 h-screen h-[100dvh] relative flex flex-col justify-between px-4 py-3 sm:p-8 lg:p-12 bg-slate-950/90 backdrop-blur-2xl overflow-hidden"
      >
        {/* Background Store Blur Image Layer for Right Side matching visual aesthetic */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1920&q=80"
            alt="Store Blur Background"
            className="w-full h-full object-cover filter blur-2xl scale-125"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-slate-950/80" />
        </div>

        {/* Top Header Controls (Language switch) - Moved down safely for iPhone Notch / Status Bar */}
        <div className="relative z-10 flex items-center justify-end w-full max-w-md mx-auto pt-6 sm:pt-2 pb-1">
          <button
            onClick={() => setLanguage(language === 'km' ? 'en' : 'km')}
            className="px-3 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-xs font-bold text-slate-200 border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xl ml-auto"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === 'km' ? '🇰🇭 ខ្មែរ' : '🇬🇧 English'}</span>
          </button>
        </div>

        {/* Centered Login / Sign Up Form Card */}
        <div className="relative z-10 w-full max-w-md mx-auto my-auto py-1 sm:py-4">
          {/* System Logo Centered at Top */}
          <div className="text-center mb-2.5 sm:mb-5 space-y-1 sm:space-y-2">
            <div className="inline-flex p-1.5 sm:p-3 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-amber-500/10 ring-4 ring-amber-500/10 transform transition-transform hover:scale-105">
              <img
                src="/logo.svg"
                alt="MINI POS Logo"
                className="w-10 h-10 sm:w-16 sm:h-16 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div>
              <h1 className="text-lg sm:text-3xl font-black text-white tracking-tight">
                {language === 'km' ? 'ប្រព័ន្ធ MINI-POS' : 'MINI POS System'}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold mt-0.5">
                {language === 'km'
                  ? 'សូមបញ្ចូលគណនីរបស់អ្នកដើម្បីចូលប្រើប្រាស់'
                  : 'Sign in to your account to continue'}
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Form Tabs Toggle */}
            <div className="flex rounded-xl sm:rounded-2xl bg-slate-950 p-1 sm:p-1.5 border border-slate-800 mb-4 sm:mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setLoginError('');
                }}
                className={`flex-1 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{language === 'km' ? 'ចូលប្រើប្រាស់ (Sign In)' : 'Sign In'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setSignupError('');
                }}
                className={`flex-1 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{language === 'km' ? 'ចុះឈ្មោះ (Sign Up)' : 'Sign Up'}</span>
              </button>
            </div>

            {/* LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                {loginError && (
                  <div className="p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl sm:rounded-2xl text-xs flex items-start gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 sm:mb-1.5">
                    {language === 'km' ? 'ឈ្មោះអ្នកប្រើប្រាស់ (Username)' : 'Username'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 sm:left-3.5 top-2.5 sm:top-3.5" />
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder={
                        language === 'km' ? 'ឧទាហរណ៍៖ admin ឬ member' : 'e.g. admin or store1'
                      }
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 sm:pl-10 pr-3.5 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 sm:mb-1.5">
                    {language === 'km' ? 'ពាក្យសម្ងាត់ (Password)' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 sm:left-3.5 top-2.5 sm:top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 sm:pl-10 pr-9 sm:pr-10 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 sm:top-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-0.5 sm:pt-1 flex items-center justify-between text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white select-none font-bold text-xs">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500"
                    />
                    <span>{language === 'km' ? 'ចងចាំខ្ញុំ (Remember Me)' : 'Remember Me'}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 text-xs sm:text-sm transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>{language === 'km' ? 'ចូលប្រើប្រាស់ប្រព័ន្ធ' : 'Sign In Now'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* SIGNUP FORM */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignup} className="space-y-2.5 sm:space-y-3">
                {signupError && (
                  <div className="p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl sm:rounded-2xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{signupError}</span>
                  </div>
                )}

                {signupSuccess && (
                  <div className="p-2.5 sm:p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl sm:rounded-2xl text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{signupSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-0.5 sm:mb-1">
                    {language === 'km' ? 'ឈ្មោះអ្នកប្រើប្រាស់ (Username) *' : 'Username *'}
                  </label>
                  <input
                    type="text"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    placeholder="e.g. sokha_mart"
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-0.5 sm:mb-1">
                    {language === 'km' ? 'ឈ្មោះពេញរបស់អ្នក (Full Name) *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    placeholder="e.g. សុខា ម៉ាត"
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-0.5 sm:mb-1">
                    {language === 'km' ? 'ឈ្មោះហាង (Store Name) *' : 'Store Name *'}
                  </label>
                  <input
                    type="text"
                    value={signupStoreName}
                    onChange={(e) => setSignupStoreName(e.target.value)}
                    placeholder="e.g. សុខា ម៉ាតសាខាទី១"
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-0.5 sm:mb-1">
                    {language === 'km' ? 'លេខទូរស័ព្ទ (Phone Number)' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="e.g. 012 345 678"
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-0.5 sm:mb-1">
                      {language === 'km' ? 'ពាក្យសម្ងាត់ *' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-0.5 sm:mb-1">
                      {language === 'km' ? 'បញ្ជាក់ *' : 'Confirm *'}
                    </label>
                    <input
                      type="password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 text-xs sm:text-sm mt-1 sm:mt-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{language === 'km' ? 'បង្កើតគណនី Member ថ្មី' : 'Sign Up Member Account'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 w-full max-w-md mx-auto text-center text-[10px] sm:text-xs text-slate-500 pt-2 sm:pt-4 pb-2 sm:pb-0">
          <p>© 2026 MINI POS System — All Member Data Isolated & Secured via Supabase Cloud</p>
        </div>
      </div>
    </div>
  );
};
