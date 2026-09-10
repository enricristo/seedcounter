import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../../db';
import {
  enqueueTelemetry,
  getPendingTelemetry,
  markTelemetryStatus,
  pruneSyncedTelemetry,
  getQueueStats,
  clearTelemetryQueue,
  getTelemetryRecord,
  resetStalledUploads,
} from '../telemetry-queue';
import { TelemetryClient, computeSha256 } from '../telemetry-client';
import type { TelemetryPayload } from '../types';

describe('Telemetry Subsystem', () => {
  beforeEach(async () => {
    await clearTelemetryQueue();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await clearTelemetryQueue();
  });

  describe('computeSha256', () => {
    it('computes correct SHA-256 for an empty blob', async () => {
      const blob = new Blob([]);
      const hash = await computeSha256(blob);
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('computes correct 64-char hex SHA-256 for a text payload', async () => {
      const blob = new Blob(['SeedCounter-Agronomic-Scan-Data']);
      const hash = await computeSha256(blob);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });

  describe('IndexedDB Outbox Queue', () => {
    const mockPayload: TelemetryPayload = {
      session_id: 'sess-001',
      filename: 'petri_dish_01.png',
      image_width: 2000,
      image_height: 2000,
      viable_count: 10,
      inviable_count: 2,
      annotations: [
        {
          category: 'viable',
          origin: 'modelo',
          confidence: 0.95,
          pixel_polygon: [[10, 10], [20, 10], [20, 20]],
          normalized_bbox: [0.1, 0.1, 0.05, 0.05],
        },
      ],
      client_metadata: {
        app_version: '1.0.0',
        is_anonymous: true,
      },
    };

    it('enqueues a record with pending status and retryCount 0', async () => {
      const id = await enqueueTelemetry({
        sessionId: 'sess-001',
        imageHash: 'a'.repeat(64),
        payload: mockPayload,
      });

      expect(id).toBeDefined();
      const record = await getTelemetryRecord(id);
      expect(record).toBeDefined();
      expect(record?.status).toBe('pending');
      expect(record?.retryCount).toBe(0);
      expect(record?.sessionId).toBe('sess-001');
      expect(record?.imageHash).toBe('a'.repeat(64));
    });

    it('returns pending items sorted by creation time', async () => {
      await enqueueTelemetry({
        sessionId: 'sess-early',
        imageHash: '1'.repeat(64),
        payload: { ...mockPayload, session_id: 'sess-early' },
      });

      // Brief pause to ensure distinct timestamp
      await new Promise((r) => setTimeout(r, 10));

      await enqueueTelemetry({
        sessionId: 'sess-late',
        imageHash: '2'.repeat(64),
        payload: { ...mockPayload, session_id: 'sess-late' },
      });

      const pending = await getPendingTelemetry(10);
      expect(pending).toHaveLength(2);
      expect(pending[0].sessionId).toBe('sess-early');
      expect(pending[1].sessionId).toBe('sess-late');
    });

    it('updates status and evicts imageBlob when marked synced', async () => {
      const blob = new Blob(['image-raw-bytes'], { type: 'image/png' });
      const id = await enqueueTelemetry({
        sessionId: 'sess-blob',
        imageHash: 'b'.repeat(64),
        imageBlob: blob,
        payload: mockPayload,
      });

      let rec = await getTelemetryRecord(id);
      expect(rec?.imageBlob).toBeDefined();

      await markTelemetryStatus(id, 'synced', {
        storageKey: 'raw/2026/09/test.png',
        evictBlob: true,
      });

      rec = await getTelemetryRecord(id);
      expect(rec?.status).toBe('synced');
      expect(rec?.storageKey).toBe('raw/2026/09/test.png');
      expect(rec?.imageBlob).toBeUndefined();
    });

    it('increments retry count and records error on failure', async () => {
      const id = await enqueueTelemetry({
        sessionId: 'sess-fail',
        imageHash: 'c'.repeat(64),
        payload: mockPayload,
      });

      await markTelemetryStatus(id, 'failed', {
        lastError: 'HTTP 500: R2 storage timeout',
        incrementRetry: true,
      });

      const rec = await getTelemetryRecord(id);
      expect(rec?.status).toBe('failed');
      expect(rec?.retryCount).toBe(1);
      expect(rec?.lastError).toContain('R2 storage timeout');

      // Failed items with retryCount < maxRetries should still be included in getPending
      const pending = await getPendingTelemetry(10, 3);
      expect(pending.some((p) => p.id === id)).toBe(true);
    });

    it('prunes synced records while keeping pending and failed ones', async () => {
      const idPending = await enqueueTelemetry({
        sessionId: 'sess-p',
        imageHash: 'p'.repeat(64),
        payload: mockPayload,
      });
      const idSynced = await enqueueTelemetry({
        sessionId: 'sess-s',
        imageHash: 's'.repeat(64),
        payload: mockPayload,
      });

      await markTelemetryStatus(idSynced, 'synced');

      const pruned = await pruneSyncedTelemetry();
      expect(pruned).toBe(1);

      expect(await getTelemetryRecord(idPending)).toBeDefined();
      expect(await getTelemetryRecord(idSynced)).toBeUndefined();
    });

    it('accurately computes queue summary statistics', async () => {
      const id1 = await enqueueTelemetry({
        sessionId: 'sess-1',
        imageHash: '1'.repeat(64),
        payload: mockPayload,
      });
      const id2 = await enqueueTelemetry({
        sessionId: 'sess-2',
        imageHash: '2'.repeat(64),
        payload: mockPayload,
      });

      await markTelemetryStatus(id1, 'synced');
      await markTelemetryStatus(id2, 'failed');

      const stats = await getQueueStats();
      expect(stats.total).toBe(2);
      expect(stats.synced).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it('recovers stalled uploading records upon session recovery and clears stale URLs', async () => {
      const id = await enqueueTelemetry({
        sessionId: 'sess-zombie',
        imageHash: 'z'.repeat(64),
        payload: mockPayload,
      });

      // Simulate a crashed session that was mid-upload
      await markTelemetryStatus(id, 'uploading', {
        uploadUrl: 'https://r2.cloudflarestorage.com/stale-url',
        storageKey: 'raw/stale-key.png',
      });

      const beforeRec = await getTelemetryRecord(id);
      expect(beforeRec?.status).toBe('uploading');
      expect(beforeRec?.uploadUrl).toBe('https://r2.cloudflarestorage.com/stale-url');

      // resetStalledUploads(0) recovers all in-flight uploads to pending and clears stale URLs
      const recoveredCount = await resetStalledUploads(0);
      expect(recoveredCount).toBe(1);

      const afterRec = await getTelemetryRecord(id);
      expect(afterRec?.status).toBe('pending');
      expect(afterRec?.uploadUrl).toBeUndefined();
      expect(afterRec?.storageKey).toBeUndefined();

      // Ensure it is now retrieved by getPendingTelemetry
      const pending = await getPendingTelemetry(10);
      expect(pending.some((p) => p.id === id)).toBe(true);
    });

    it('getPendingTelemetry includes stalled uploading records older than threshold', async () => {
      const id = await enqueueTelemetry({
        sessionId: 'sess-stalled-timeout',
        imageHash: 't'.repeat(64),
        payload: mockPayload,
      });

      await markTelemetryStatus(id, 'uploading');

      // If record is considered older than threshold (e.g. timeout = 0 ms)
      const eligible = await getPendingTelemetry(10, 5, 0);
      expect(eligible.some((p) => p.id === id)).toBe(true);
    });
  });

  describe('TelemetryClient Outbox Drainage Flow', () => {
    const mockPayload: TelemetryPayload = {
      session_id: 'session-outbox-test-1',
      filename: 'soja_lote01.png',
      species: 'soja',
      image_width: 4000,
      image_height: 3000,
      viable_count: 50,
      inviable_count: 5,
      annotations: [],
      client_metadata: { is_anonymous: true },
    };

    it('pauses outbox drain silently when client is offline', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.local' });
      vi.spyOn(client, 'isOnline').mockReturnValue(false);

      await client.submitSession({
        payload: mockPayload,
        imageHash: 'd'.repeat(64),
      });

      const res = await client.drainOutbox();
      expect(res.processed).toBe(0);
      expect(res.succeeded).toBe(0);

      const stats = await getQueueStats();
      expect(stats.pending).toBe(1);
    });

    it('successfully acquires presigned URL, PUTs raw blob, and commits session', async () => {
      const client = new TelemetryClient({
        baseUrl: 'http://backend.local',
        getAuthToken: () => 'valid_token_123',
      });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      const mockFetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/2026/09/soja_lote01_dddddddd.png',
                upload_url: 'https://r2.cloudflarestorage.com/test-bucket/soja_lote01.png',
                expires_in_seconds: 3600,
              }),
          });
        }
        if (url.includes('https://r2.cloudflarestorage.com')) {
          expect(opts.method).toBe('PUT');
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(''),
          });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          expect(opts.method).toBe('POST');
          const body = JSON.parse(opts.body as string);
          expect(body.storage_key).toBe('raw/2026/09/soja_lote01_dddddddd.png');
          expect(body.session_id).toBe('session-outbox-test-1');
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'session-outbox-test-1',
                persisted_annotations: 0,
                audit_log_id: 'audit-1234',
              }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const testBlob = new Blob(['raw-pixel-data-stream'], { type: 'image/png' });
      const qId = await client.submitSession({
        payload: mockPayload,
        imageBlob: testBlob,
        imageHash: 'd'.repeat(64),
      });

      const drainResult = await client.drainOutbox();
      expect(drainResult.processed).toBe(1);
      expect(drainResult.succeeded).toBe(1);
      expect(drainResult.failed).toBe(0);

      const stats = await getQueueStats();
      expect(stats.synced).toBe(1);
      expect(stats.pending).toBe(0);

      // Verify blob is evicted after sync
      const syncedRecord = await getTelemetryRecord(qId);
      expect(syncedRecord?.imageBlob).toBeUndefined();
    });

    it('gracefully marks failed without throwing when network returns 500', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.local' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal storage error'),
      }) as unknown as typeof fetch;

      await client.submitSession({
        payload: mockPayload,
        imageHash: 'e'.repeat(64),
      });

      const drainResult = await client.drainOutbox();
      expect(drainResult.processed).toBe(1);
      expect(drainResult.succeeded).toBe(0);
      expect(drainResult.failed).toBe(1);

      const stats = await getQueueStats();
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it('invalidates presigned URL on failure and requests a fresh URL on retry to prevent 403 loops', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.local' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      let presignedCallCount = 0;
      let putCallCount = 0;

      const mockFetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          presignedCallCount++;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: `raw/2026/09/session_fresh_${presignedCallCount}.png`,
                upload_url: `https://r2.cloudflarestorage.com/test-bucket/session_fresh_${presignedCallCount}.png`,
                expires_in_seconds: 3600,
              }),
          });
        }

        if (url.includes('session_fresh_1.png')) {
          putCallCount++;
          // First attempt to PUT to presigned URL fails with 403 Forbidden (e.g. expired presigned URL)
          return Promise.resolve({
            ok: false,
            status: 403,
            text: () => Promise.resolve('Request has expired'),
          });
        }

        if (url.includes('session_fresh_2.png')) {
          putCallCount++;
          // Second attempt with fresh presigned URL succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(''),
          });
        }

        if (url.includes('/api/v1/telemetry/session')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'session-outbox-test-1',
                persisted_annotations: 0,
                audit_log_id: 'audit-retry-5678',
              }),
          });
        }

        return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
      });

      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const testBlob = new Blob(['sample-retry-pixel-data'], { type: 'image/png' });
      const qId = await client.submitSession({
        payload: mockPayload,
        imageBlob: testBlob,
        imageHash: 'f'.repeat(64),
      });

      // 1st attempt: fails because upload URL returned 403
      const firstDrain = await client.drainOutbox();
      expect(firstDrain.processed).toBe(1);
      expect(firstDrain.succeeded).toBe(0);
      expect(firstDrain.failed).toBe(1);
      expect(presignedCallCount).toBe(1);
      expect(putCallCount).toBe(1);

      // Verify that failure cleared uploadUrl and storageKey on the record
      const failedRec = await getTelemetryRecord(qId);
      expect(failedRec?.status).toBe('failed');
      expect(failedRec?.retryCount).toBe(1);
      expect(failedRec?.uploadUrl).toBeUndefined();
      expect(failedRec?.storageKey).toBeUndefined();

      // 2nd attempt (retry): requests a FRESH presigned URL (session_fresh_2.png) and succeeds!
      const secondDrain = await client.drainOutbox();
      expect(secondDrain.processed).toBe(1);
      expect(secondDrain.succeeded).toBe(1);
      expect(secondDrain.failed).toBe(0);
      expect(presignedCallCount).toBe(2);
      expect(putCallCount).toBe(2);

      const syncedRec = await getTelemetryRecord(qId);
      expect(syncedRec?.status).toBe('synced');
      expect(syncedRec?.imageBlob).toBeUndefined();
    });
  });
});
