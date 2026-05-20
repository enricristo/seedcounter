import React from 'react';

interface FooterProps {
  filename?: string;
  imageWidth?: number;
  imageHeight?: number;
  version?: string;
}

export function Footer({
  filename,
  imageWidth,
  imageHeight,
  version = 'v2.0.0'
}: FooterProps) {
  return (
    <footer className="h-12 border-t border-neutral-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] px-6 flex items-center justify-between shrink-0 transition-colors duration-300">
      {/* Active System Indicator */}
      <div className="flex items-center gap-4 text-[10px] text-neutral-500 dark:text-zinc-500 font-bold tracking-wide uppercase">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Offline</span>
        </div>
        {filename && (
          <div className="font-mono lowercase text-[10px] opacity-80 border-l border-neutral-200 dark:border-zinc-800 pl-3">
            {filename} {imageWidth && imageHeight && `• ${imageWidth}x${imageHeight}px`}
          </div>
        )}
      </div>

      {/* Affiliation / Credits */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <div className="text-[10px] text-neutral-500 dark:text-zinc-400 font-medium">
            <span className="font-bold text-emerald-600 dark:text-emerald-500">GPEOrq</span> (Grupo de Pesquisa em Orquídeas) / Unoeste • <a href="https://www.instagram.com/gpeorq" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors underline decoration-emerald-500/30 underline-offset-2">@gpeorq</a>
          </div>
          <div className="text-[8px] text-neutral-400 dark:text-zinc-500 mt-0.5 max-w-xl text-right truncate">
            Laboratório de Sementes e Laboratório de Tecido Vegetal (Campus II - Presidente Prudente - SP) • Dr. Nelson Barbosa Machado Neto e Dra. Ceci Castilho Custódio
          </div>
        </div>
        <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-mono font-bold tracking-wider italic bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded ml-2">
          {version}
        </div>
      </div>
    </footer>
  );
}
