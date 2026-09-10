import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AnalyticsDispatcher,
  sanitizeAnalyticsValue,
} from '../analytics';

describe('GTM & GA4 Product Analytics Dispatcher', () => {
  let mockDataLayer: Array<Record<string, unknown>> = [];
  let mockGtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDataLayer = [];
    mockGtag = vi.fn();
    vi.restoreAllMocks();

    vi.stubGlobal('window', {
      dataLayer: mockDataLayer,
      gtag: mockGtag,
    });
    vi.stubGlobal('navigator', {
      onLine: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('PII Sanitization Guardrail', () => {
    it('redacts email addresses from string parameters', () => {
      const input = {
        researcher_note: 'Sample verified by analyst.nelson@embrapa.br on bench 4',
        email: 'contact@seedcounter.org',
      };
      const cleaned = sanitizeAnalyticsValue(input) as Record<string, unknown>;
      expect(cleaned.researcher_note).toBe(
        'Sample verified by [REDACTED] on bench 4'
      );
      expect(cleaned.email).toBe('[REDACTED]');
    });

    it('strips absolute local file paths leaving only the basename', () => {
      const input = {
        windows_path: 'C:\\Users\\Analyst\\Scans\\petri_dish_01.png',
        linux_path: '/home/ubuntu/data/sample_seed.jpg',
      };
      const cleaned = sanitizeAnalyticsValue(input) as Record<string, unknown>;
      expect(cleaned.windows_path).toBe('petri_dish_01.png');
      expect(cleaned.linux_path).toBe('sample_seed.jpg');
    });

    it('preserves numeric and boolean values across nested structures', () => {
      const input = {
        viable_count: 142,
        is_calibrated: true,
        nested: {
          scale_um_px: 21.2,
          labels: ['viable', 'inviable'],
        },
      };
      const cleaned = sanitizeAnalyticsValue(input);
      expect(cleaned).toEqual(input);
    });
  });

  describe('Silent No-Op Behavior When Unconfigured or Offline', () => {
    it('returns false and performs zero operations when env vars are unset', () => {
      const dispatcher = new AnalyticsDispatcher({
        gtmId: '',
        ga4MeasurementId: '',
      });
      expect(dispatcher.isEnabled()).toBe(false);

      const tracked = dispatcher.trackEvent('scan_completed', { viable_count: 10 });
      expect(tracked).toBe(false);
      expect(mockDataLayer).toHaveLength(0);
      expect(mockGtag).not.toHaveBeenCalled();
    });

    it('degrades to silent no-op when browser is offline', () => {
      vi.stubGlobal('navigator', { onLine: false });

      const dispatcher = new AnalyticsDispatcher({
        gtmId: 'GTM-TEST01',
        ga4MeasurementId: 'G-TEST01',
      });
      expect(dispatcher.isEnabled()).toBe(false);

      const tracked = dispatcher.trackScanCompleted({
        viable_count: 50,
        inviable_count: 5,
      });
      expect(tracked).toBe(false);
      expect(mockDataLayer).toHaveLength(0);
      expect(mockGtag).not.toHaveBeenCalled();
    });

    it('silently ignores tracking calls when window is undefined (Node/SSR context)', () => {
      vi.stubGlobal('window', undefined);

      const dispatcher = new AnalyticsDispatcher({
        gtmId: 'GTM-TEST01',
      });
      expect(dispatcher.isEnabled()).toBe(false);
      expect(dispatcher.trackEvent('test')).toBe(false);
    });
  });

  describe('Active Event Dispatching to GTM and GA4', () => {
    it('pushes event with timestamp to GTM dataLayer when gtmId is configured', () => {
      const dispatcher = new AnalyticsDispatcher({
        gtmId: 'GTM-PROD123',
      });

      const tracked = dispatcher.trackEvent('dataset_exported', {
        format: 'yolov8',
        count: 500,
        contact: 'dev@seedcounter.org',
      });

      expect(tracked).toBe(true);
      expect(mockDataLayer).toHaveLength(1);
      expect(mockDataLayer[0].event).toBe('dataset_exported');
      expect(mockDataLayer[0].format).toBe('yolov8');
      expect(mockDataLayer[0].count).toBe(500);
      expect(mockDataLayer[0].contact).toBe('[REDACTED]');
      expect(mockDataLayer[0].timestamp).toBeDefined();
    });

    it('calls gtag with event name and sanitized parameters when ga4MeasurementId is configured', () => {
      const dispatcher = new AnalyticsDispatcher({
        ga4MeasurementId: 'G-MEASURE456',
      });

      const tracked = dispatcher.trackEvent('ai_inference_run', {
        model: 'yolov8m-seg',
        duration_ms: 120,
      });

      expect(tracked).toBe(true);
      expect(mockGtag).toHaveBeenCalledWith('event', 'ai_inference_run', {
        model: 'yolov8m-seg',
        duration_ms: 120,
      });
    });
  });

  describe('Key Agronomic Event Helpers', () => {
    let dispatcher: AnalyticsDispatcher;

    beforeEach(() => {
      dispatcher = new AnalyticsDispatcher({
        gtmId: 'GTM-AGRONOMY',
        ga4MeasurementId: 'G-AGRONOMY',
      });
    });

    it('trackScanCompleted dispatches scan_completed event', () => {
      dispatcher.trackScanCompleted({
        viable_count: 320,
        inviable_count: 25,
        species: 'soja',
        duration_ms: 450,
      });

      expect(mockDataLayer[0]).toMatchObject({
        event: 'scan_completed',
        viable_count: 320,
        inviable_count: 25,
        species: 'soja',
        duration_ms: 450,
      });
      expect(mockGtag).toHaveBeenCalledWith(
        'event',
        'scan_completed',
        expect.objectContaining({
          viable_count: 320,
          inviable_count: 25,
        })
      );
    });

    it('trackExportYolo dispatches export_yolo event', () => {
      dispatcher.trackExportYolo({
        split_ratio: 0.8,
        session_count: 15,
        format: 'both',
      });

      expect(mockDataLayer[0]).toMatchObject({
        event: 'export_yolo',
        split_ratio: 0.8,
        session_count: 15,
      });
    });

    it('trackModelInference dispatches model_inference event', () => {
      dispatcher.trackModelInference({
        model_name: 'seeds-yolov8m-seg.onnx',
        detection_count: 42,
        duration_ms: 380,
      });

      expect(mockDataLayer[0]).toMatchObject({
        event: 'model_inference',
        model_name: 'seeds-yolov8m-seg.onnx',
        detection_count: 42,
      });
    });

    it('trackCurationToggle dispatches curation_toggle event', () => {
      dispatcher.trackCurationToggle({
        previous_category: 'inviable',
        new_category: 'viable',
        source: 'gallery_modal',
      });

      expect(mockDataLayer[0]).toMatchObject({
        event: 'curation_toggle',
        previous_category: 'inviable',
        new_category: 'viable',
        source: 'gallery_modal',
      });
    });
  });
});
