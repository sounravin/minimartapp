import React from 'react';
import { Wrench, ShieldAlert, RefreshCw, Clock, PhoneCall } from 'lucide-react';
import { Language } from '../types';

interface MaintenanceScreenProps {
  language: Language;
  message?: string;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ language, message }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 font-khmer selection:bg-amber-500 selection:text-slate-950">
      
      {/* Background Subtle Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md text-center space-y-6 animate-scale-up">
        
        {/* Animated Maintenance Icon */}
        <div className="relative inline-block">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
            <Wrench className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
          </span>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>{language === 'km' ? 'ប្រព័ន្ធកំពុងស្ថិតក្នុងការថែទាំ (Maintenance Mode)' : 'System Under Maintenance'}</span>
        </div>

        {/* Title & Description */}
        <div className="space-y-3">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide leading-tight">
            {language === 'km' ? 'ប្រព័ន្ធកំពុងស្ថិតក្នុងការកែសម្រួល' : 'We are currently updating our system'}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-bold">
            {message || (language === 'km'
              ? 'សូមអធ្យាស្រ័យ! ក្រុមការងារ Admin កំពុងធ្វើការកែសម្រួល និងអាប់ដេតប្រព័ន្ធ POS ឱ្យកាន់តែប្រសើរឡើង។ ប្រព័ន្ធនឹងបើកដំណើរការឡើងវិញក្នុងពេលឆាប់ៗនេះ។'
              : 'Our technical team is currently performing scheduled system updates and improvements. The POS system will be back online shortly.')}
          </p>
        </div>

        {/* Status Indicators */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs text-slate-400 font-bold">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{language === 'km' ? 'ស្ថានភាពប្រព័ន្ធ' : 'Status'}</span>
            </span>
            <span className="text-amber-400 font-black">Under Maintenance (MTN ON)</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
            <span className="flex items-center gap-1.5 text-slate-300">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>{language === 'km' ? 'ការពិនិត្យស្ថានភាព' : 'Auto Checking'}</span>
            </span>
            <span className="text-emerald-400 font-extrabold">{language === 'km' ? 'ភ្ជាប់ Realtime ស្វ័យប្រវត្តិ' : 'Syncing Live'}</span>
          </div>
        </div>

        {/* Support Contact */}
        <div className="pt-2 text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
          <PhoneCall className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{language === 'km' ? 'ត្រូវការជំនួយបន្ទាន់? ទំនាក់ទំនង Admin: Telegram / Phone' : 'Emergency Contact: Admin Support'}</span>
        </div>

      </div>
    </div>
  );
};
