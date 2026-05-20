import React from 'react';

interface ExportCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ExportCard({ 
  icon, 
  title, 
  desc, 
  onClick,
  disabled = false
}: ExportCardProps) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start text-left p-4 rounded-xl border border-neutral-200 dark:border-zinc-800 hover:border-neutral-300 dark:hover:border-zinc-700 hover:shadow-md transition-all bg-white dark:bg-[#18181B] group active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
    >
      <div className="bg-neutral-50 dark:bg-zinc-950 p-2.5 rounded-lg mb-3 group-hover:bg-neutral-100 dark:group-hover:bg-zinc-900 transition-colors">
        {icon}
      </div>
      <h4 className="font-semibold text-sm text-neutral-800 dark:text-zinc-100 mb-1">{title}</h4>
      <p className="text-[10px] text-neutral-400 dark:text-zinc-400 leading-relaxed font-medium">{desc}</p>
    </button>
  );
}
