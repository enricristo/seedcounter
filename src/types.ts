// =============================================================================
// SeedCounter — Core Types
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
// Baseado nas publicações do Prof. Nelson Barbosa Machado Neto e Profa. Ceci Castilho Custódio
// =============================================================================

// ---------------------------------------------------------------------------
// Marking & Segmentation
// ---------------------------------------------------------------------------

export interface Mark {
  x: number;
  y: number;
  type: 'viable' | 'inviable';
  id: number;
}

export interface YoloSegmentation {
  id: number;
  category: 'viable' | 'inviable';
  class_name: string;
  confidence: number;
  polygon_points: [number, number][];
  visible?: boolean;
  edited?: boolean;
  width?: number;  // PCA computed width (px)
  height?: number; // PCA computed height (px)
}

// ---------------------------------------------------------------------------
// Session Metadata
// ---------------------------------------------------------------------------

/** Source of the image — determines spatial calibration defaults */
export type ImageSource =
  | 'flatbed_600dpi'    // 42.3 µm/px
  | 'flatbed_1200dpi'  // 21.2 µm/px
  | 'flatbed_2400dpi'  // 10.6 µm/px
  | 'loupe_camera'     // manual calibration required
  | 'stereo_microscope'// manual calibration required
  | 'manual_camera'    // manual calibration required
  | 'other';

/** µm/px lookup for known scanner sources */
export const IMAGE_SOURCE_UM_PER_PIXEL: Partial<Record<ImageSource, number>> = {
  flatbed_600dpi: 42.3,
  flatbed_1200dpi: 21.2,
  flatbed_2400dpi: 10.6,
};

export interface Metadata {
  researcher: string;
  project: string;
  treatment: string;
  plate: string;
  quadrant: string;
  notes: string;
  baselineCount?: number;
  useDifferential?: boolean;
  umPerPixel?: number;       // Spatial calibration: micrometers per pixel
  imageSource?: ImageSource; // Image acquisition source
}

// ---------------------------------------------------------------------------
// Session (single counting event)
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  date: string;
  filename: string;
  viableCount: number;
  inviableCount: number;
  metadata: Metadata;
  marks?: Mark[];
  yoloSegmentations?: YoloSegmentation[];
  imageData?: string; // Base64 encoded image
  experimentId?: string;   // Link to Experiment
  treatmentId?: string;    // Link to Treatment
  dayIndex?: number;       // DAP (Dias Após Plantio) at evaluation
}

// ---------------------------------------------------------------------------
// Longitudinal Experiment Model
// Grounded in Machado-Neto & Custódio lab methodology
// ---------------------------------------------------------------------------

/**
 * Protocorm development stages (Arditti, 1967 — adapted by GPEOrq lab)
 * 0: No change / inviable
 * 1: Germination — embryo swells, testa ruptures, green embryo visible
 * 2: Globular protocorm forms
 * 3: Leaf primordia emerge
 * 4: First true leaf visible
 * 5: Second leaf + root primordia
 * 6: Plantlet with developed root system
 */
export type ProtocormStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const PROTOCORM_STAGE_LABELS: Record<ProtocormStage, string> = {
  0: 'Estágio 0 — Sem mudança / Inviável',
  1: 'Estágio 1 — Germinação (embrião verde)',
  2: 'Estágio 2 — Protocormo globular',
  3: 'Estágio 3 — Primórdio foliar',
  4: 'Estágio 4 — Primeira folha verdadeira',
  5: 'Estágio 5 — Segunda folha + primórdio radicular',
  6: 'Estágio 6+ — Plântula com sistema radicular',
};

/** Type of contamination observed (visual identification per plate) */
export type ContaminationType = 'none' | 'fungal' | 'bacterial' | 'mixed';

export const CONTAMINATION_LABELS: Record<ContaminationType, string> = {
  none: 'Sem contaminação',
  fungal: 'Fúngica',
  bacterial: 'Bacteriana',
  mixed: 'Mista (fúngica + bacteriana)',
};

/** Operational status of a Petri dish / plate */
export type PlateStatus = 'active' | 'contaminated' | 'discarded' | 'completed';

export const PLATE_STATUS_LABELS: Record<PlateStatus, string> = {
  active: 'Ativa',
  contaminated: 'Contaminada',
  discarded: 'Descartada',
  completed: 'Avaliação concluída',
};

/** Culture media used in asymbiotic germination (lab standards) */
export type CultureMedium = 'KC' | 'half-MS' | 'MS' | 'WPM' | 'MM' | 'other';

export const CULTURE_MEDIUM_LABELS: Record<CultureMedium, string> = {
  'KC': 'Knudson C (KC)',
  'half-MS': 'Murashige & Skoog ½ força (½MS)',
  'MS': 'Murashige & Skoog completo (MS)',
  'WPM': 'Woody Plant Medium (WPM)',
  'MM': 'MM (meio modificado)',
  'other': 'Outro (especificar em notas)',
};

/**
 * A single evaluation reading on one plate at one timepoint.
 * Linked back to the Session (image + marks) via sessionId.
 */
export interface PlateRun {
  sessionId?: string;          // → Session with the annotated image
  dayIndex: number;            // DAP (Dias Após Plantio)
  evaluationDate: string;      // ISO date string
  totalSeeds: number;          // Total seeds counted on this plate
  germinatedSeeds: number;     // Seeds at Stage ≥ 1
  stageDistribution: Partial<Record<ProtocormStage, number>>; // counts per stage
  contamination: ContaminationType;
  status: PlateStatus;
  observerName?: string;
  notes?: string;
}

/**
 * A treatment within an experiment.
 * Example: "Tratamento A — Luz UV 24h", "Controle KC"
 */
export interface Treatment {
  id: string;
  experimentId: string;
  name: string;    // Full descriptive name
  code: string;    // Short code: T1, T2, Ctrl
  description?: string;
  plates: PlateRun[]; // One per plate × timepoint combination
}

/**
 * Top-level Experiment entity.
 * Corresponds to one research trial tracked over multiple evaluation days.
 */
export interface Experiment {
  id: string;
  name: string;               // "Germinação de Cattleya labiata — Ensaio 2026"
  species: string;            // Full species name: "Cattleya labiata"
  genus?: string;             // Genus for filtering: "Cattleya"
  seedLot: string;            // Lot/accession identifier: "CL-2024-03"
  collectionDate?: string;    // ISO date of seed collection
  responsible: string;        // "Dr. Nelson Barbosa Machado Neto"
  institution: string;        // "GPEOrq / Unoeste"
  cultureMedia: CultureMedium;
  cultureMediaNotes?: string;       // "KC + 15g/L sacarose + PPM 2mL/L"
  sterilizationProtocol?: string;   // "NaOCl 1%, 15min + Tween 80"
  preconditioningTreatment?: string;// "Sacarose 10%, 24h, TA"
  seedsPerPlate: number;       // Target seeds per Petri dish
  replicates: number;          // Number of replicates per treatment
  sowingDate: string;          // ISO date — base for DAP calculation
  evaluationDays: number[];    // Planned evaluation days: [0, 14, 30, 45, 60, 90]
  treatments: Treatment[];
  tags?: string[];             // Free tags for filtering
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Statistical Analysis Types
// ---------------------------------------------------------------------------

export interface GerminationReading {
  day: number;       // DAP
  germinated: number; // Seeds germinated ON THIS DAY (not cumulative)
  cumulative?: number; // Total germinated up to this day
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  center: number;
}

export interface TreatmentStats {
  treatmentId: string;
  treatmentCode: string;
  treatmentName: string;
  n: number;
  mean: number;          // Mean germination %
  sd: number;            // Standard deviation
  ci: ConfidenceInterval;// Wilson CI
  ivg: number;           // Índice de Velocidade de Germinação (Maguire, 1962)
  mgt?: number;          // Mean Germination Time
  letter?: string;       // Scott-Knott / Tukey grouping letter
}

export interface ANOVAResult {
  fStat: number;
  pValue: number;
  dfBetween: number;
  dfWithin: number;
  msBetween: number;
  msWithin: number;
  significant: boolean;
}

export interface ComparisonPair {
  groupA: string;
  groupB: string;
  meanDiff: number;
  significant: boolean;
  pAdj: number;
}

// ---------------------------------------------------------------------------
// App Navigation
// ---------------------------------------------------------------------------

export type AppView = 'counter' | 'longitudinal' | 'stats' | 'history' | 'experiments';
