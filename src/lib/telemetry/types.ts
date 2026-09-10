/**
 * Telemetry Types and DTO Interfaces
 * File: seedcounter/src/lib/telemetry/types.ts
 *
 * Complies with PROJECT.md Interface Contracts 1 & 2 and backend schemas.
 */

export type TelemetryStatus = 'pending' | 'uploading' | 'synced' | 'failed';

export interface TelemetryAnnotation {
  id?: string;
  category: string;
  origin?: 'modelo' | 'clique' | 'manual' | 'model' | 'human' | string;
  confidence?: number;
  is_edited?: boolean;
  is_deleted?: boolean;
  pixel_polygon?: [number, number][];
  normalized_bbox?: [number, number, number, number]; // [cx, cy, w, h]
  area_px?: number;
  perimeter_px?: number;
  major_axis_um?: number;
  minor_axis_um?: number;
  area_um2?: number;
  width?: number;
  height?: number;
}

export interface TelemetryClientMetadata {
  app_version?: string;
  model_version?: string;
  is_anonymous?: boolean;
  timestamp?: string;
  platform?: string;
  [key: string]: unknown;
}

export interface TelemetryPayload {
  session_id: string;
  filename: string;
  storage_key?: string;
  species?: string;
  image_width: number;
  image_height: number;
  dpi?: number;
  um_per_pixel?: number;
  viable_count: number;
  inviable_count: number;
  annotations: TelemetryAnnotation[];
  client_metadata?: TelemetryClientMetadata;
  experiment_id?: string;
  treatment_id?: string;
  day_index?: number;
  researcher?: string;
  project?: string;
  user_id?: string;
  date?: string;
}

export interface TelemetryQueueRecord {
  id: string;
  sessionId: string;
  createdAt: string;
  status: TelemetryStatus;
  retryCount: number;
  lastError?: string;
  imageBlob?: Blob;
  imageHash: string;
  storageKey?: string;
  uploadUrl?: string;
  payload: TelemetryPayload;
}

export interface PresignedUrlRequest {
  filename: string;
  content_type: string;
  file_size?: number;
  sha256?: string;
}

export interface PresignedUrlResponse {
  storage_key: string;
  upload_url: string;
  expires_in_seconds?: number;
  http_method?: string;
  headers?: Record<string, string>;
}

export interface SessionCommitResponse {
  status: string;
  session_id: string;
  persisted_annotations: number;
  audit_log_id: string;
}

export interface TelemetryConfig {
  baseUrl?: string;
  maxRetries?: number;
  batchSize?: number;
  autoDrainOnOnline?: boolean;
  getAuthToken?: () => string | null;
  enabled?: boolean;
}
