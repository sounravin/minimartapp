import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = 'w-10 h-10', showText = false }) => {
  return (
    <div className={`flex items-center gap-2.5 ${showText ? '' : ''}`}>
      <img
        src="/logo.svg"
        alt="MINI POS Logo"
        className={`${className} object-contain shrink-0`}
        referrerPolicy="no-referrer"
      />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-base tracking-tight text-slate-900">
            ប្រព័ន្ធ-MINI POS
          </span>
          <span className="text-[10px] font-bold text-amber-700 tracking-wider font-mono uppercase">
            Smart POS & Stock System
          </span>
        </div>
      )}
    </div>
  );
};
