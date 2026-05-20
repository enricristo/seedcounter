import React from 'react';

interface MetadataInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}

export function MetadataInput({ 
  label, 
  value, 
  onChange, 
  placeholder,
  disabled = false
}: MetadataInputProps) {
  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label className="text-[11px] font-semibold text-neutral-600 dark:text-zinc-400 ml-1 tracking-wide uppercase">
        {label}
      </label>
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-neutral-100 dark:bg-zinc-900/80 border border-neutral-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-neutral-400 dark:placeholder:text-zinc-600 dark:text-zinc-100 disabled:opacity-50"
      />
    </div>
  );
}
