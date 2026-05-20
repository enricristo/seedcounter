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
  width?: number;  // PCA computed width
  height?: number; // PCA computed height
}

export interface Metadata {
  researcher: string;
  project: string;
  treatment: string;
  plate: string;
  quadrant: string;
  notes: string;
  baselineCount?: number;
  useDifferential?: boolean;
}

export interface Session {
  id: string;
  date: string;
  filename: string;
  viableCount: number;
  inviableCount: number;
  metadata: Metadata;
  marks?: Mark[]; // Optional saved manual marks
  yoloSegmentations?: YoloSegmentation[]; // Optional saved YOLO segmentations
}
