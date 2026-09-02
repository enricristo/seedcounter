// =============================================================================
// SeedCounter — Calibração Espacial
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
// =============================================================================
// Converte pixels em micrômetros. Sem isso, a morfometria não tem significado
// físico — só faz sentido comparar medidas entre imagens calibradas.
//
// Métodos suportados (adaptáveis a diferentes formas de aquisição):
//   1. DPI do scanner      — resolução conhecida do equipamento
//   2. Referência na imagem — régua, moeda, marcação na placa (2 pontos)
//   3. Micrômetro de platina — padrão para lupa/estereomicroscópio
//   4. Manual               — µm/px informado diretamente
// =============================================================================

export type CalibrationMethod = 'dpi' | 'reference' | 'stage_micrometer' | 'manual' | 'none';

/** Unidades aceitas para a medida de referência. */
export type LengthUnit = 'mm' | 'cm' | 'um' | 'in';

export const UNIT_TO_MICRONS: Record<LengthUnit, number> = {
  um: 1,
  mm: 1_000,
  cm: 10_000,
  in: 25_400,
};

export const UNIT_LABELS: Record<LengthUnit, string> = {
  um: 'µm',
  mm: 'mm',
  cm: 'cm',
  in: 'pol',
};

export interface CalibrationData {
  method: CalibrationMethod;
  /** Resultado da calibração: micrômetros por pixel. */
  umPerPixel?: number;
  /** DPI usado (método 'dpi'). */
  dpi?: number;
  /** Distância medida na imagem, em pixels (métodos 'reference'/'stage_micrometer'). */
  referencePixels?: number;
  /** Comprimento real do objeto de referência. */
  referenceLength?: number;
  referenceUnit?: LengthUnit;
  /** Descrição livre do que foi usado como referência. */
  referenceLabel?: string;
  /** Aumento óptico (lupa/microscópio), ex.: 40 para 40x. */
  magnification?: number;
  /** Data da calibração (ISO). */
  calibratedAt?: string;
}

/** Metadados de aquisição — contexto útil para reprodutibilidade e datasets. */
export interface AcquisitionInfo {
  /** Equipamento: scanner, lupa, microscópio, celular, câmera. */
  device?: string;
  /** Modelo do sensor/câmera. */
  sensor?: string;
  /** Lente/objetiva. */
  lens?: string;
  /** Iluminação (ex.: LED anelar, luz transmitida). */
  illumination?: string;
  /** Observações da aquisição. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

/** DPI (pontos por polegada) -> micrômetros por pixel. */
export function dpiToUmPerPixel(dpi: number): number {
  if (!dpi || dpi <= 0) return 0;
  return UNIT_TO_MICRONS.in / dpi; // 25 400 µm por polegada
}

/** µm/px -> DPI equivalente (útil para exibir/conferir). */
export function umPerPixelToDpi(umPerPixel: number): number {
  if (!umPerPixel || umPerPixel <= 0) return 0;
  return UNIT_TO_MICRONS.in / umPerPixel;
}

/**
 * Calibração por objeto de referência: uma distância conhecida medida sobre a
 * imagem. Serve para régua, marcação impressa na placa, moeda ou micrômetro.
 */
export function referenceToUmPerPixel(pixels: number, length: number, unit: LengthUnit): number {
  if (!pixels || pixels <= 0 || !length || length <= 0) return 0;
  return (length * UNIT_TO_MICRONS[unit]) / pixels;
}

/** Distância euclidiana entre dois pontos, em pixels. */
export function distanceInPixels(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Recalcula o µm/px a partir dos campos preenchidos. */
export function computeUmPerPixel(data: CalibrationData): number {
  switch (data.method) {
    case 'dpi':
      return data.dpi ? dpiToUmPerPixel(data.dpi) : 0;
    case 'reference':
    case 'stage_micrometer':
      return referenceToUmPerPixel(
        data.referencePixels ?? 0,
        data.referenceLength ?? 0,
        data.referenceUnit ?? 'mm'
      );
    case 'manual':
      return data.umPerPixel ?? 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Formatação de medidas
// ---------------------------------------------------------------------------

/** Formata um comprimento em pixels usando a escala, escolhendo a unidade. */
export function formatLength(pixels: number, umPerPixel?: number): string {
  if (!umPerPixel || umPerPixel <= 0) return `${Math.round(pixels)} px`;
  const um = pixels * umPerPixel;
  if (um < 1_000) return `${um.toFixed(1)} µm`;
  if (um < 10_000) return `${(um / 1_000).toFixed(2)} mm`;
  return `${(um / 1_000).toFixed(1)} mm`;
}

/** Formata uma área em pixels² usando a escala. */
export function formatArea(pixelArea: number, umPerPixel?: number): string {
  if (!umPerPixel || umPerPixel <= 0) return `${Math.round(pixelArea)} px²`;
  const um2 = pixelArea * umPerPixel * umPerPixel;
  if (um2 < 1e6) return `${um2.toFixed(0)} µm²`;
  return `${(um2 / 1e6).toFixed(3)} mm²`;
}

// ---------------------------------------------------------------------------
// Predefinições comuns
// ---------------------------------------------------------------------------

export const DPI_PRESETS = [300, 600, 1200, 2400, 3600, 4800] as const;

/**
 * Padrão do Laboratório de Sementes (GPEOrq/Unoeste): HP Scanjet G2710 a 3600 DPI.
 * Equivale a ~7,06 µm/px.
 */
export const DEFAULT_LAB_DPI = 3600;
export const DEFAULT_LAB_SCANNER = 'HP Scanjet G2710';

/** Referências típicas de laboratório, para agilizar a entrada. */
export const REFERENCE_PRESETS: { label: string; length: number; unit: LengthUnit }[] = [
  { label: 'Placa de Petri 90 mm (diâmetro)', length: 90, unit: 'mm' },
  { label: 'Placa de Petri 60 mm (diâmetro)', length: 60, unit: 'mm' },
  { label: 'Lâmina de microscopia (largura 26 mm)', length: 26, unit: 'mm' },
  { label: 'Régua — 10 mm', length: 10, unit: 'mm' },
  { label: 'Régua — 1 cm', length: 1, unit: 'cm' },
  { label: 'Micrômetro de platina — 1 mm', length: 1, unit: 'mm' },
  { label: 'Micrômetro de platina — 100 µm', length: 100, unit: 'um' },
];

/** Rótulos legíveis dos métodos. */
export const METHOD_LABELS: Record<CalibrationMethod, string> = {
  dpi: 'DPI do scanner',
  reference: 'Objeto de referência',
  stage_micrometer: 'Micrômetro de platina',
  manual: 'µm/px manual',
  none: 'Sem calibração',
};

/**
 * Verificação de sanidade: valores muito fora da faixa esperada geralmente
 * indicam erro de unidade (ex.: informar cm onde era mm).
 */
export function validateScale(umPerPixel: number): string | null {
  if (!umPerPixel || umPerPixel <= 0) return null;
  if (umPerPixel < 0.05) return 'Escala muito fina (< 0,05 µm/px). Confira a unidade informada.';
  if (umPerPixel > 500) return 'Escala muito grosseira (> 500 µm/px). Confira a unidade informada.';
  return null;
}
