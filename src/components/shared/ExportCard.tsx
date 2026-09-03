import React from 'react';

interface ExportCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ExportCard({ icon, title, desc, onClick, disabled = false }: ExportCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-panel border-line hover:border-accent bg-surface-1 group flex flex-col items-start border p-4 text-left transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
    >
      <div className="bg-surface-2 rounded-control group-hover:bg-accent-tint mb-3 p-2.5 transition-colors">
        {icon}
      </div>
      <h4 className="text-ink-1 mb-1 text-sm font-bold">{title}</h4>
      <p className="text-ink-3 text-[10px] leading-relaxed">{desc}</p>
    </button>
  );
}
