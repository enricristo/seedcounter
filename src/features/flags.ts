// =============================================================================
// Feature Flag Registry
// SeedCounter — GPEOrq / Unoeste
// =============================================================================
// Flags are persisted in localStorage under key 'sc:featureFlags'.
// Stable flags are ON by default; experimental flags require explicit opt-in.
// Dev-only flags can be toggled via Ctrl+Shift+D debug panel.
// =============================================================================

export type FeatureKey =
  | 'longitudinalView' // Phase A — Longitudinal experiment tracking
  | 'yoloExport'       // Phase B — YOLO dataset export (experimental)
  | 'statsView'        // Phase C — Statistical analysis panel
  | 'aiPointer'        // Phase D — AI-assisted annotation (experimental)
  | 'debugPanel';      // Dev — Feature flags debug panel

export interface FeatureFlag {
  key: FeatureKey;
  label: string;
  defaultEnabled: boolean;
  /** stable = available in production builds; false = opt-in only */
  stable: boolean;
  phase: string;
  description: string;
}

export const FEATURE_REGISTRY: FeatureFlag[] = [
  {
    key: 'longitudinalView',
    label: 'Visão Longitudinal',
    defaultEnabled: true,
    stable: true,
    phase: 'Fase A',
    description: 'Rastreamento de experimentos ao longo do tempo (T0, T14, T30...)',
  },
  {
    key: 'statsView',
    label: 'Análise Estatística',
    defaultEnabled: true,
    stable: true,
    phase: 'Fase C',
    description: 'ANOVA, Scott-Knott, Tukey, IVG/Maguire — painéis publicáveis',
  },
  {
    key: 'yoloExport',
    label: 'Exportar Dataset YOLO',
    defaultEnabled: false,
    stable: false,
    phase: 'Fase B',
    description: 'Exporta anotações manuais como dataset YOLOv8 (.zip)',
  },
  {
    key: 'aiPointer',
    label: 'AI Pointer (Beta)',
    defaultEnabled: false,
    stable: false,
    phase: 'Fase D',
    description: 'Detecção semi-automática via ONNX YOLOv8 no navegador',
  },
  {
    key: 'debugPanel',
    label: 'Painel de Debug',
    defaultEnabled: false,
    stable: false,
    phase: 'Dev',
    description: 'Painel de feature flags — ativar/desativar funcionalidades experimentais',
  },
];

/** Lookup map for fast access by key */
export const FEATURE_MAP: Record<FeatureKey, FeatureFlag> = Object.fromEntries(
  FEATURE_REGISTRY.map(f => [f.key, f])
) as Record<FeatureKey, FeatureFlag>;
