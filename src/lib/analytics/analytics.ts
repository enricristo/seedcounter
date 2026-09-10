/**
 * Google Tag Manager (GTM) & Google Analytics 4 (GA4) Event Dispatcher
 * File: seedcounter/src/lib/analytics/analytics.ts
 *
 * Provides privacy-preserving product analytics with zero PII and silent no-op degradation.
 * Complies with ORIGINAL_REQUEST §R4 and PROJECT.md F10.
 */

export interface AnalyticsConfig {
  gtmId?: string;
  ga4MeasurementId?: string;
  enabled?: boolean;
}

export interface ScanCompletedEvent {
  viable_count: number;
  inviable_count: number;
  species?: string;
  duration_ms?: number;
}

export interface ExportYoloEvent {
  split_ratio: number;
  session_count: number;
  format?: string;
}

export interface ModelInferenceEvent {
  model_name?: string;
  detection_count: number;
  duration_ms: number;
}

export interface CurationToggleEvent {
  previous_category: string;
  new_category: string;
  source?: string;
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const WIN_PATH_REGEX = /[A-Za-z]:\\(?:[^\s"'\\]+\\)+([^\s"'\\]+)/g;
const UNIX_PATH_REGEX = /\/(?:home|Users|var|tmp)\/(?:[^\s"'/]+\/)+([^\s"'/]+)/g;

/**
 * Strips emails, local absolute file paths, and potential PII from parameters.
 */
export function sanitizeAnalyticsValue(val: unknown): unknown {
  if (typeof val === 'string') {
    let clean = val.replace(EMAIL_REGEX, '[REDACTED]');
    clean = clean.replace(WIN_PATH_REGEX, '$1');
    clean = clean.replace(UNIX_PATH_REGEX, '$1');
    return clean;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeAnalyticsValue);
  }
  if (val !== null && typeof val === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      res[k] = sanitizeAnalyticsValue(v);
    }
    return res;
  }
  return val;
}

export class AnalyticsDispatcher {
  private config: Required<AnalyticsConfig>;

  constructor(config: AnalyticsConfig = {}) {
    const envGtm =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_GTM_ID
        ? String(import.meta.env.VITE_GTM_ID).trim()
        : '';
    const envGa4 =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_GA4_MEASUREMENT_ID
        ? String(import.meta.env.VITE_GA4_MEASUREMENT_ID).trim()
        : '';

    this.config = {
      gtmId: config.gtmId ?? envGtm,
      ga4MeasurementId: config.ga4MeasurementId ?? envGa4,
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Check if analytics tracking is active and environment variables are present.
   */
  public isEnabled(): boolean {
    if (!this.config.enabled) return false;
    if (!this.config.gtmId && !this.config.ga4MeasurementId) return false;
    if (typeof window === 'undefined') return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    return true;
  }

  /**
   * Configure analytics dispatcher at runtime.
   */
  public configure(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Dispatches a sanitized event to GTM dataLayer and GA4 gtag if active.
   * Degrades to silent no-op when unconfigured or offline.
   */
  public trackEvent(eventName: string, params: Record<string, unknown> = {}): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const sanitized = (sanitizeAnalyticsValue(params) as Record<string, unknown>) || {};
      const win = window as unknown as {
        dataLayer?: Array<Record<string, unknown>>;
        gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
      };

      // 1. Dispatch to Google Tag Manager dataLayer
      if (this.config.gtmId) {
        if (!win.dataLayer) {
          win.dataLayer = [];
        }
        win.dataLayer.push({
          event: eventName,
          ...sanitized,
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Dispatch to Google Analytics 4 gtag
      if (this.config.ga4MeasurementId && typeof win.gtag === 'function') {
        win.gtag('event', eventName, sanitized);
      }

      return true;
    } catch {
      // Ad-blocker, CSP, or tracking protection - fail silently
      return false;
    }
  }

  /**
   * Track scan completion metrics.
   */
  public trackScanCompleted(event: ScanCompletedEvent): boolean {
    return this.trackEvent('scan_completed', {
      viable_count: event.viable_count,
      inviable_count: event.inviable_count,
      species: event.species || 'generic',
      duration_ms: event.duration_ms,
    });
  }

  /**
   * Track YOLOv8/v11 dataset export.
   */
  public trackExportYolo(event: ExportYoloEvent): boolean {
    return this.trackEvent('export_yolo', {
      split_ratio: event.split_ratio,
      session_count: event.session_count,
      format: event.format || 'both',
    });
  }

  /**
   * Track browser ONNX inference execution.
   */
  public trackModelInference(event: ModelInferenceEvent): boolean {
    return this.trackEvent('model_inference', {
      model_name: event.model_name || 'yolov8m-seg',
      detection_count: event.detection_count,
      duration_ms: event.duration_ms,
    });
  }

  /**
   * Track human curation toggle (e.g. viable <-> inviable).
   */
  public trackCurationToggle(event: CurationToggleEvent): boolean {
    return this.trackEvent('curation_toggle', {
      previous_category: event.previous_category,
      new_category: event.new_category,
      source: event.source || 'gallery',
    });
  }
}

/**
 * Singleton instance of AnalyticsDispatcher.
 */
export const analytics = new AnalyticsDispatcher();
