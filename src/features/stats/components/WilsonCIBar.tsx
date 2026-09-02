import React from 'react';
import type { ConfidenceInterval } from '../../../types';

interface WilsonCIBarProps {
  /** Percentage value 0–100 */
  value: number;
  /** Wilson CI (bounds in [0,1]) */
  ci: ConfidenceInterval;
  /** Width of the bar container in px (default: 120) */
  width?: number;
}

/**
 * Inline mini-bar showing germination % with Wilson CI bounds.
 * The bar represents [0%, 100%]. The center dot is the point estimate;
 * the flanking ticks are the lower/upper CI bounds.
 */
export function WilsonCIBar({ value, ci, width = 120 }: WilsonCIBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const lower = Math.min(100, Math.max(0, ci.lower * 100));
  const upper = Math.min(100, Math.max(0, ci.upper * 100));

  // Color encoding
  const barColor =
    pct >= 80
      ? '#10b981' // emerald
      : pct >= 50
      ? '#f59e0b' // amber
      : '#ef4444'; // red

  const ciWidth = upper - lower;

  return (
    <div
      className="flex items-center gap-2"
      title={`${pct.toFixed(1)}% [IC 95%: ${lower.toFixed(1)}% – ${upper.toFixed(1)}%]`}
    >
      {/* Bar track */}
      <div
        className="relative flex-shrink-0 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-visible"
        style={{ width }}
      >
        {/* CI interval band */}
        <div
          className="absolute top-0 h-full rounded-full opacity-30"
          style={{
            left: `${lower}%`,
            width: `${Math.max(ciWidth, 0.5)}%`,
            backgroundColor: barColor,
          }}
        />
        {/* Filled bar up to value */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
        {/* Lower CI tick */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80 dark:bg-zinc-900/80"
          style={{ left: `${lower}%`, transform: 'translateX(-50%)' }}
        />
        {/* Upper CI tick */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80 dark:bg-zinc-900/80"
          style={{ left: `${upper}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      {/* Numeric label */}
      <span
        className="text-[11px] font-bold font-mono tabular-nums"
        style={{ color: barColor }}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
