export interface Mark {
  x: number;
  y: number;
  type: 'viable' | 'inviable';
  id: number;
}

export interface Metadata {
  researcher: string;
  project: string;
  treatment: string;
  plate: string;
  quadrant: string;
  notes: string;
}

export interface Session {
  id: string;
  date: string;
  filename: string;
  viableCount: number;
  inviableCount: number;
  metadata: Metadata;
}
