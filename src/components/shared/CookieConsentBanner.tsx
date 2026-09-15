import React, { useState, useEffect } from 'react';

// Declaration for global window.gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      params?: Record<string, string | boolean | number>
    ) => void;
  }
}

const STORAGE_KEY = 'sc:cookie-consent';

export const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) {
        setVisible(true);
      }
    } catch {
      // LocalStorage unavailable (e.g. strict incognito sandbox)
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'granted');
    } catch {}

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
    setVisible(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'denied');
    } catch {}

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
      });
    }
    setVisible(false);
  };

  return (
    <aside
      aria-label="Consentimento de Cookies e Privacidade"
      className="fixed bottom-4 right-4 z-50 max-w-md bg-[#131b1e]/95 border border-cyan-500/30 text-slate-200 backdrop-blur-md rounded-xl p-4 shadow-2xl animate-fade-in text-xs font-sans"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl select-none" aria-hidden="true">🍪</span>
        <div className="flex-1 space-y-2">
          <p className="font-semibold text-slate-100 text-sm tracking-tight">
            Privacidade & Cookies Analíticos
          </p>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            O <strong>SeedCounter</strong> é <em>Local-First</em>: suas imagens, recortes e contagens de bancada são processados 100% no seu navegador e não são enviados a nenhum servidor.
          </p>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Utilizamos apenas cookies analíticos anônimos (Google Analytics) para compreender o uso geral e aprimorar os modelos agronômicos.
          </p>

          <div className="flex items-center gap-2 pt-1.5">
            <button
              onClick={handleAccept}
              className="bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              Aceitar analíticos
            </button>
            <button
              onClick={handleDecline}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Apenas essenciais
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
