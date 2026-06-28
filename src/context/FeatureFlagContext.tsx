import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { FEATURE_REGISTRY, FEATURE_MAP, type FeatureKey } from '../features/flags';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlagState = Record<FeatureKey, boolean>;

interface FeatureFlagContextValue {
  flags: FlagState;
  isEnabled: (key: FeatureKey) => boolean;
  toggle: (key: FeatureKey) => void;
  enable: (key: FeatureKey) => void;
  disable: (key: FeatureKey) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sc:featureFlags';

function getDefaultFlags(): FlagState {
  return Object.fromEntries(
    FEATURE_REGISTRY.map(f => [f.key, f.defaultEnabled])
  ) as FlagState;
}

function loadFlags(): FlagState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return getDefaultFlags();
    // Merge saved with defaults — handles newly added or removed flags
    const parsed = JSON.parse(saved) as Partial<FlagState>;
    return { ...getDefaultFlags(), ...parsed };
  } catch {
    return getDefaultFlags();
  }
}

function saveFlags(flags: FlagState): void {
  try {
    // Only persist flags that differ from their defaults (keep storage minimal)
    const defaults = getDefaultFlags();
    const diff: Partial<FlagState> = {};
    for (const key of Object.keys(flags) as FeatureKey[]) {
      if (flags[key] !== defaults[key]) {
        diff[key] = flags[key];
      }
    }
    if (Object.keys(diff).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diff));
    }
  } catch {
    // localStorage might be unavailable (incognito, storage full)
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: getDefaultFlags(),
  isEnabled: () => false,
  toggle: () => {},
  enable: () => {},
  disable: () => {},
  reset: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FlagState>(loadFlags);

  const updateFlags = useCallback((updater: (prev: FlagState) => FlagState) => {
    setFlags(prev => {
      const next = updater(prev);
      saveFlags(next);
      return next;
    });
  }, []);

  const toggle = useCallback((key: FeatureKey) => {
    updateFlags(prev => ({ ...prev, [key]: !prev[key] }));
  }, [updateFlags]);

  const enable = useCallback((key: FeatureKey) => {
    updateFlags(prev => ({ ...prev, [key]: true }));
  }, [updateFlags]);

  const disable = useCallback((key: FeatureKey) => {
    updateFlags(prev => ({ ...prev, [key]: false }));
  }, [updateFlags]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setFlags(getDefaultFlags());
  }, []);

  const isEnabled = useCallback((key: FeatureKey) => flags[key], [flags]);

  const value = useMemo<FeatureFlagContextValue>(
    () => ({ flags, isEnabled, toggle, enable, disable, reset }),
    [flags, isEnabled, toggle, enable, disable, reset]
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Returns true/false for a single feature flag */
export function useFeatureFlag(key: FeatureKey): boolean {
  const { isEnabled } = useContext(FeatureFlagContext);
  return isEnabled(key);
}

/** Returns the full context (for the debug panel) */
export function useFeatureFlags(): FeatureFlagContextValue {
  return useContext(FeatureFlagContext);
}

// ---------------------------------------------------------------------------
// Debug Panel Component
// (Rendered only when debugPanel flag is enabled — toggled by Ctrl+Shift+D)
// ---------------------------------------------------------------------------

export function FeatureFlagsDebugPanel() {
  const { flags, toggle, reset } = useFeatureFlags();
  const isDebugEnabled = flags['debugPanel'];

  if (!isDebugEnabled) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 9999,
        backgroundColor: 'rgba(10, 10, 20, 0.96)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        minWidth: '260px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, color: '#a78bfa', letterSpacing: '0.05em' }}>⚡ FEATURE FLAGS</span>
        <button
          onClick={reset}
          style={{ fontSize: '0.65rem', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}
          title="Resetar para padrões"
        >
          RESET
        </button>
      </div>

      {FEATURE_REGISTRY.map(flag => (
        <label
          key={flag.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.4rem',
            cursor: 'pointer',
            opacity: flag.stable ? 1 : 0.8,
          }}
          title={flag.description}
        >
          <input
            type="checkbox"
            checked={flags[flag.key]}
            onChange={() => toggle(flag.key)}
            style={{ accentColor: '#818cf8' }}
          />
          <span>
            <span style={{ color: flag.stable ? '#4ade80' : '#fbbf24' }}>
              [{flag.phase}]
            </span>
            {' '}{flag.label}
          </span>
        </label>
      ))}

      <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.65rem' }}>
        Verde = estável · Amarelo = experimental
      </div>
    </div>
  );
}

export { FEATURE_MAP };
