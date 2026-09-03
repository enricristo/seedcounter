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
  | 'yoloExport' // Phase B — YOLO dataset export (experimental)
  | 'statsView' // Phase C — Statistical analysis panel
  | 'aiPointer' // Phase D — AI-assisted annotation (experimental)
  | 'cameraCapture' // Phase E — Camera capture (loupe/microscope/mobile)
  | 'assistedDetection' // Phase E — Classic CV assisted detection
  | 'debugPanel'; // Dev — Feature flags debug panel

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
    // Promovido a estável: não produz medida de pesquisa, apenas empacota as
    // anotações que o usuário já fez. O risco de erro é o de um zip malformado,
    // não o de um número errado num artigo.
    key: 'yoloExport',
    label: 'Exportar Dataset YOLO',
    defaultEnabled: true,
    stable: true,
    phase: 'Fase B',
    description: 'Exporta anotações manuais como dataset YOLOv8 (.zip), pronto para treino',
  },
  {
    // Continua experimental de propósito. Dois motivos medidos: a morfometria
    // ainda não foi validada contra medição manual, e em produção o modelo
    // servido é o int8, cuja quantização degrada a classificação
    // viável/inviável (fp32 24/5 contra int8 7/9 na amostra 3_Lab1).
    key: 'aiPointer',
    label: 'AI Pointer (Beta)',
    defaultEnabled: false,
    stable: false,
    phase: 'Fase D',
    description:
      'Detecção semi-automática via YOLOv8 no navegador. Contagem confiável; a divisão viável/inviável e as medidas ainda não foram validadas contra método manual.',
  },
  {
    key: 'cameraCapture',
    label: 'Capturar da Câmera',
    defaultEnabled: true,
    stable: true,
    phase: 'Fase E',
    description: 'Captura de imagem por lupa/microscópio (desktop) ou câmera de celular/tablet',
  },
  {
    key: 'assistedDetection',
    label: 'Detecção Assistida',
    defaultEnabled: false,
    stable: false,
    phase: 'Fase E',
    description: 'Contagem automática por visão computacional clássica (sem modelo treinado)',
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
  FEATURE_REGISTRY.map((f) => [f.key, f])
) as Record<FeatureKey, FeatureFlag>;
