import React from 'react';
import { MousePointer2 } from 'lucide-react';

interface CounterItemProps {
  label: string;
  count: number;
  color: string;
  description: string;
  percent?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function CounterItem({ 
  label, 
  count, 
  color, 
  description, 
  percent,
  onClick,
  isActive = false
}: CounterItemProps) {
  // Determine badge colors based on label
  const isViable = label.toLowerCase().includes('viáv') || label.toLowerCase().includes('viav');
  const badgeClasses = isViable 
    ? 'bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 border-red-100 dark:border-red-900/30'
    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-405 border-amber-100 dark:border-amber-900/30';

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col p-4 rounded-xl transition-all border shadow-sm group relative overflow-hidden cursor-pointer
        ${isActive 
          ? 'bg-neutral-100 dark:bg-zinc-900 border-emerald-500/50 scale-[1.02] ring-1 ring-emerald-500/20' 
          : 'bg-white dark:bg-zinc-900/50 border-neutral-100 dark:border-zinc-800/80 hover:bg-neutral-50 dark:hover:bg-zinc-900 hover:border-neutral-200 dark:hover:border-zinc-700'
        }
      `}
    >
      <div className="flex items-center justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${color} rounded-xl shadow-md flex items-center justify-center text-white`}>
            <MousePointer2 size={15} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col z-10">
            <span className="text-xs font-semibold text-neutral-800 dark:text-zinc-100">{label}</span>
            <span className="text-[9px] text-neutral-400 dark:text-zinc-400 font-medium">{description}</span>
          </div>
        </div>
        <div className="flex flex-col items-end z-10 gap-0.5">
          <span className="text-xl font-bold font-mono tracking-tighter text-neutral-900 dark:text-zinc-50">
            {count}
          </span>
          {percent && (
            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${badgeClasses}`}>
              {percent}%
            </span>
          )}
        </div>
      </div>
      {percent && (
        <div className="absolute top-0 right-0 h-full flex items-center justify-end pr-3 opacity-[0.06] dark:opacity-[0.10] group-hover:opacity-[0.14] transition-opacity pointer-events-none select-none">
          <span className="text-5xl font-black font-mono tracking-tighter -mr-2">{percent}%</span>
        </div>
      )}
    </div>
  );
}
