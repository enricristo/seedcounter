import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  enqueueTelemetry,
  getPendingTelemetry,
  markTelemetryStatus,
  pruneSyncedTelemetry,
  getQueueStats,
  clearTelemetryQueue,
  getTelemetryRecord,
} from '../telemetry-queue';
import { TelemetryClient, computeSha256 } from '../telemetry-client';
import type { TelemetryPayload } from '../types';

describe('Milestone 4 Empirical Challenger Suite', () => {
  const samplePayload: TelemetryPayload = {
    session_id: 'sess-chal-001',
    filename: 'dish_chal_01.png',
    species: 'soja',
    image_width: 3840,
    image_height: 2160,
    viable_count: 120,
    inviable_count: 14,
    annotations: [
      {
        category: 'viable',
        origin: 'modelo',
        confidence: 0.96,
        pixel_polygon: [[100, 100], [150, 100], [150, 150], [100, 150]],
        normalized_bbox: [0.1, 0.1, 0.05, 0.05],
      },
    ],
    client_metadata: {
      app_version: '1.0.0',
      model_version: 'yolov8m-seg-soja',
      is_anonymous: true,
    },
  };

  beforeEach(async () => {
    await clearTelemetryQueue();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await clearTelemetryQueue();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Mission 1: SHA-256 Hashing Verification
  // ==========================================================================
  describe('1. SHA-256 Hashing Verification (Web Crypto & Fallback)', () => {
    it('computes exact SHA-256 for empty blob matching NIST standard', async () => {
      const blob = new Blob([]);
      const hash = await computeSha256(blob);
      const expected = crypto.createHash('sha256').update(Buffer.from([])).digest('hex');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(hash).toBe(expected);
    });

    it('computes exact SHA-256 for standard NIST vector "abc"', async () => {
      const blob = new Blob(['abc']);
      const hash = await computeSha256(blob);
      const expected = crypto.createHash('sha256').update('abc').digest('hex');
      expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      expect(hash).toBe(expected);
    });

    it('computes exact SHA-256 for multi-block NIST vector (56 bytes)', async () => {
      const text = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
      const blob = new Blob([text]);
      const hash = await computeSha256(blob);
      const expected = crypto.createHash('sha256').update(text).digest('hex');
      expect(hash).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
      expect(hash).toBe(expected);
    });

    it('computes exact SHA-256 for arbitrary binary buffer with high-bytes', async () => {
      // Create random binary buffer containing bytes 0x00 to 0xFF
      const rawBytes = new Uint8Array(2048);
      for (let i = 0; i < rawBytes.length; i++) {
        rawBytes[i] = (i * 37 + 13) & 0xff;
      }
      const blob = new Blob([rawBytes]);
      const hash = await computeSha256(blob);
      const expected = crypto.createHash('sha256').update(rawBytes).digest('hex');
      expect(hash).toBe(expected);
    });

    it('computes exact SHA-256 for large binary blob (1 MB)', async () => {
      const largeBuffer = new Uint8Array(1024 * 1024);
      for (let i = 0; i < largeBuffer.length; i += 1024) {
        largeBuffer[i] = (i / 1024) & 0xff;
      }
      const blob = new Blob([largeBuffer]);
      const hash = await computeSha256(blob);
      const expected = crypto.createHash('sha256').update(largeBuffer).digest('hex');
      expect(hash).toBe(expected);
    });

    it('pure JS fallback branch produces exact match when crypto.subtle is unavailable', async () => {
      // Force fallback by mocking crypto.subtle.digest to throw
      const originalSubtle = globalThis.crypto.subtle;
      try {
        // Mock subtle to throw
        vi.spyOn(globalThis.crypto.subtle, 'digest').mockRejectedValue(new Error('Subtle unavailable'));

        const testStrings = [
          '',
          'abc',
          'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
          'SeedCounter Agronomic Platform Multi-species Telemetry',
        ];

        for (const str of testStrings) {
          const blob = new Blob([str]);
          const hash = await computeSha256(blob);
          const expected = crypto.createHash('sha256').update(str).digest('hex');
          expect(hash).toBe(expected);
        }

        // Test with binary buffer
        const rawBytes = new Uint8Array(1024);
        for (let i = 0; i < rawBytes.length; i++) {
          rawBytes[i] = (i * 73 + 17) & 0xff;
        }
        const binBlob = new Blob([rawBytes]);
        const binHash = await computeSha256(binBlob);
        const expectedBin = crypto.createHash('sha256').update(rawBytes).digest('hex');
        expect(binHash).toBe(expectedBin);
      } finally {
        // Restore
        vi.restoreAllMocks();
      }
    });
  });

  // ==========================================================================
  // Mission 2: Offline Enqueue Lifecycle
  // ==========================================================================
  describe('2. Offline Enqueue Lifecycle', () => {
    it('enqueues item with status "pending" and retryCount 0 when offline', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://test-server' });
      vi.spyOn(client, 'isOnline').mockReturnValue(false);

      const fakeBlob = new Blob(['image-raw-data'], { type: 'image/png' });
      const queueId = await client.submitSession({
        payload: samplePayload,
        imageBlob: fakeBlob,
      });

      expect(queueId).toBeTruthy();
      const record = await getTelemetryRecord(queueId);
      expect(record).toBeDefined();
      expect(record?.status).toBe('pending');
      expect(record?.retryCount).toBe(0);
      expect(record?.sessionId).toBe(samplePayload.session_id);
      expect(record?.imageBlob).toBeDefined();
      expect(record?.imageHash).toHaveLength(64);
    });

    it('drainOutbox does NOT perform network fetch while offline and maintains pending state', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://test-server' });
      vi.spyOn(client, 'isOnline').mockReturnValue(false);
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      const queueId = await client.submitSession({
        payload: samplePayload,
        imageHash: 'f'.repeat(64),
      });

      const res = await client.drainOutbox();
      expect(res.processed).toBe(0);
      expect(res.succeeded).toBe(0);
      expect(res.failed).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();

      const record = await getTelemetryRecord(queueId);
      expect(record?.status).toBe('pending');
      expect(record?.retryCount).toBe(0);
    });

    it('enqueues multiple offline items maintaining FIFO chronological order', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://test-server' });
      vi.spyOn(client, 'isOnline').mockReturnValue(false);

      const id1 = await client.submitSession({
        payload: { ...samplePayload, session_id: 'session-first' },
        imageHash: '1'.repeat(64),
      });
      await new Promise((r) => setTimeout(r, 10));
      const id2 = await client.submitSession({
        payload: { ...samplePayload, session_id: 'session-second' },
        imageHash: '2'.repeat(64),
      });
      await new Promise((r) => setTimeout(r, 10));
      const id3 = await client.submitSession({
        payload: { ...samplePayload, session_id: 'session-third' },
        imageHash: '3'.repeat(64),
      });

      const stats = await getQueueStats();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(3);

      const pending = await getPendingTelemetry(10);
      expect(pending.map((p) => p.id)).toEqual([id1, id2, id3]);
    });
  });

  // ==========================================================================
  // Mission 3: Online Recovery & Event Drainage
  // ==========================================================================
  describe('3. Online Recovery & Event-Driven Drain', () => {
    it('automatically drains outbox when browser fires "online" event', async () => {
      // Mock a window EventTarget to simulate browser online events
      const listeners: Record<string, (() => void)[]> = {};
      const fakeWindow = {
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        dispatchEvent: (event: { type: string }) => {
          (listeners[event.type] || []).forEach((cb) => cb());
        },
      };

      // Set global window before constructing client
      const origWindow = globalThis.window;
      (globalThis as unknown as { window: unknown }).window = fakeWindow;

      try {
        const client = new TelemetryClient({
          baseUrl: 'http://api.seedcounter.test',
          autoDrainOnOnline: true,
        });

        // Start offline
        let onlineState = false;
        vi.spyOn(client, 'isOnline').mockImplementation(() => onlineState);

        const mockFetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
          if (url.includes('/api/v1/telemetry/presigned-url')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  storage_key: 'raw/scan_recovered.png',
                  upload_url: 'https://r2.test/raw/scan_recovered.png',
                }),
            });
          }
          if (url.includes('https://r2.test')) {
            return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
          }
          if (url.includes('/api/v1/telemetry/session')) {
            return Promise.resolve({
              ok: true,
              status: 201,
              json: () =>
                Promise.resolve({
                  status: 'persisted',
                  session_id: 'sess-recovery-01',
                  persisted_annotations: 1,
                  audit_log_id: 'audit-recovery-01',
                }),
            });
          }
          return Promise.reject(new Error(`Unexpected ${url}`));
        });
        globalThis.fetch = mockFetch;

        // Enqueue offline
        const qId = await client.submitSession({
          payload: { ...samplePayload, session_id: 'sess-recovery-01' },
          imageBlob: new Blob(['recovery-pixels'], { type: 'image/png' }),
          imageHash: 'a1'.repeat(32),
        });

        expect((await getTelemetryRecord(qId))?.status).toBe('pending');

        // Transition connectivity to ONLINE
        onlineState = true;

        // Spy on drainOutbox to observe invocation from scheduleDrain
        const drainSpy = vi.spyOn(client, 'drainOutbox');

        // Fire the 'online' event on window
        fakeWindow.dispatchEvent({ type: 'online' });

        // Wait for scheduleIdleWork (50ms fallback)
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(drainSpy).toHaveBeenCalled();
        const record = await getTelemetryRecord(qId);
        expect(record?.status).toBe('synced');
        expect(record?.imageBlob).toBeUndefined(); // evicted
      } finally {
        (globalThis as unknown as { window: unknown }).window = origWindow;
      }
    });

    it('respects autoDrainOnOnline: false by not draining on online event', async () => {
      const listeners: Record<string, (() => void)[]> = {};
      const fakeWindow = {
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        dispatchEvent: (event: { type: string }) => {
          (listeners[event.type] || []).forEach((cb) => cb());
        },
      };

      const origWindow = globalThis.window;
      (globalThis as unknown as { window: unknown }).window = fakeWindow;

      try {
        const client = new TelemetryClient({
          baseUrl: 'http://api.seedcounter.test',
          autoDrainOnOnline: false, // DISABLED
        });

        const drainSpy = vi.spyOn(client, 'drainOutbox');
        fakeWindow.dispatchEvent({ type: 'online' });

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(drainSpy).not.toHaveBeenCalled();
      } finally {
        (globalThis as unknown as { window: unknown }).window = origWindow;
      }
    });
  });

  // ==========================================================================
  // Mission 4: Failure Handling & Error Recovery
  // ==========================================================================
  describe('4. Failure Handling & Error Recovery', () => {
    it('handles Step 1 network drop (fetch Presigned URL TypeError) gracefully', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://api.test' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch (DNS failure)'));

      const qId = await client.submitSession({
        payload: samplePayload,
        imageHash: 'e1'.repeat(32),
      });

      const res = await client.drainOutbox();
      expect(res.processed).toBe(1);
      expect(res.succeeded).toBe(0);
      expect(res.failed).toBe(1);

      const record = await getTelemetryRecord(qId);
      expect(record?.status).toBe('failed');
      expect(record?.retryCount).toBe(1);
      expect(record?.lastError).toContain('Failed to fetch');
    });

    it('handles Step 1 server HTTP 500 error on Presigned URL endpoint', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://api.test' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal S3 gateway error'),
      });

      const qId = await client.submitSession({
        payload: samplePayload,
        imageHash: 'e2'.repeat(32),
      });

      const res = await client.drainOutbox();
      expect(res.failed).toBe(1);

      const record = await getTelemetryRecord(qId);
      expect(record?.status).toBe('failed');
      expect(record?.retryCount).toBe(1);
      expect(record?.lastError).toContain('HTTP 500');
    });

    it('handles Step 2 binary PUT failure, preserving uploadUrl and storageKey for retry', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://api.test' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      let step1Called = false;
      let step2Called = false;

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          step1Called = true;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/saved_key.png',
                upload_url: 'https://r2.test/raw/saved_key.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          step2Called = true;
          // Binary PUT fails with 504 Gateway Timeout
          return Promise.resolve({
            ok: false,
            status: 504,
            text: () => Promise.resolve('Gateway Timeout on R2 upload'),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const blob = new Blob(['sample-pixels'], { type: 'image/png' });
      const qId = await client.submitSession({
        payload: samplePayload,
        imageBlob: blob,
        imageHash: 'e3'.repeat(32),
      });

      const res = await client.drainOutbox();
      expect(step1Called).toBe(true);
      expect(step2Called).toBe(true);
      expect(res.failed).toBe(1);

      const record = await getTelemetryRecord(qId);
      expect(record?.status).toBe('failed');
      expect(record?.retryCount).toBe(1);
      expect(record?.storageKey).toBe('raw/saved_key.png');
      expect(record?.uploadUrl).toBe('https://r2.test/raw/saved_key.png');
      expect(record?.imageBlob).toBeDefined(); // Blob NOT deleted on failure
    });

    it('handles Step 3 session commit failure after successful binary PUT', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://api.test' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/step3_fail.png',
                upload_url: 'https://r2.test/raw/step3_fail.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          // Session ingestion returns 500
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Database deadlocked'),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const blob = new Blob(['sample-pixels'], { type: 'image/png' });
      const qId = await client.submitSession({
        payload: samplePayload,
        imageBlob: blob,
        imageHash: 'e4'.repeat(32),
      });

      const res = await client.drainOutbox();
      expect(res.failed).toBe(1);

      const record = await getTelemetryRecord(qId);
      expect(record?.status).toBe('failed');
      expect(record?.retryCount).toBe(1);
      expect(record?.lastError).toContain('Session ingestion HTTP 500');
    });

    it('stops retrying when retryCount reaches maxRetries (prevents infinite loop)', async () => {
      const client = new TelemetryClient({
        baseUrl: 'http://api.test',
        maxRetries: 3, // Cutoff after 3 failed attempts
      });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      // Always fail
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      });

      const qId = await client.submitSession({
        payload: samplePayload,
        imageHash: 'e5'.repeat(32),
      });

      // Attempt 1: retryCount becomes 1
      const res1 = await client.drainOutbox();
      expect(res1.processed).toBe(1);
      expect(res1.failed).toBe(1);
      expect((await getTelemetryRecord(qId))?.retryCount).toBe(1);

      // Attempt 2: retryCount becomes 2
      const res2 = await client.drainOutbox();
      expect(res2.processed).toBe(1);
      expect(res2.failed).toBe(1);
      expect((await getTelemetryRecord(qId))?.retryCount).toBe(2);

      // Attempt 3: retryCount becomes 3 (maxRetries reached)
      const res3 = await client.drainOutbox();
      expect(res3.processed).toBe(1);
      expect(res3.failed).toBe(1);
      expect((await getTelemetryRecord(qId))?.retryCount).toBe(3);

      // Attempt 4: Item should now be excluded from getPendingTelemetry!
      const eligible = await getPendingTelemetry(10, 3);
      expect(eligible.some((r) => r.id === qId)).toBe(false);

      const res4 = await client.drainOutbox();
      expect(res4.processed).toBe(0); // Draining terminated, no infinite loop!
      expect(res4.succeeded).toBe(0);
      expect(res4.failed).toBe(0);
    });

    it('failed item does NOT cause head-of-line blocking for subsequent healthy items', async () => {
      const client = new TelemetryClient({
        baseUrl: 'http://api.test',
        maxRetries: 2,
      });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      // Insert item 1 directly with maxRetries reached
      const badId = await enqueueTelemetry({
        sessionId: 'dead-item',
        imageHash: 'bad'.repeat(21) + 'b',
        payload: { ...samplePayload, session_id: 'dead-item' },
      });
      await markTelemetryStatus(badId, 'failed', { incrementRetry: true });
      await markTelemetryStatus(badId, 'failed', { incrementRetry: true }); // retryCount = 2

      // Enqueue healthy item 2
      const goodId = await client.submitSession({
        payload: { ...samplePayload, session_id: 'good-item' },
        imageHash: 'good'.repeat(16),
      });

      // Mock fetch: succeeds for good item
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/good.png',
                upload_url: 'https://r2.test/good.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'good-item',
                persisted_annotations: 1,
                audit_log_id: 'audit-good',
              }),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const drainRes = await client.drainOutbox();
      expect(drainRes.processed).toBe(1);
      expect(drainRes.succeeded).toBe(1);

      // Verify good item is synced
      expect((await getTelemetryRecord(goodId))?.status).toBe('synced');
      // Verify bad item is untouched and still failed
      expect((await getTelemetryRecord(badId))?.status).toBe('failed');
    });
  });

  // ==========================================================================
  // Mission 5: Full Sync & Eviction
  // ==========================================================================
  describe('5. Full Sync & Blob Eviction', () => {
    it('successfully uploads binary, commits session, sets status "synced", and evicts blob', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.api' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      const uploadedBlobs: unknown[] = [];
      const postedSessions: unknown[] = [];

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/2026/09/sync_evict_01.png',
                upload_url: 'https://r2.test/raw/sync_evict_01.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          uploadedBlobs.push(opts.body);
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          postedSessions.push(JSON.parse(opts.body as string));
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'sess-sync-01',
                persisted_annotations: 5,
                audit_log_id: 'audit-sync-01',
              }),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const rawBlob = new Blob(['high-res-dish-scan-raw-data'], { type: 'image/png' });
      const qId = await client.submitSession({
        payload: { ...samplePayload, session_id: 'sess-sync-01' },
        imageBlob: rawBlob,
        imageHash: '99'.repeat(32),
      });

      // Before drain: blob is present in store
      const beforeRecord = await getTelemetryRecord(qId);
      expect(beforeRecord?.status).toBe('pending');
      expect(beforeRecord?.imageBlob).toBeDefined();

      const drainRes = await client.drainOutbox();
      expect(drainRes.succeeded).toBe(1);
      expect(uploadedBlobs).toHaveLength(1);
      expect(postedSessions).toHaveLength(1);

      // After drain: status is synced AND blob is evicted (undefined)
      const afterRecord = await getTelemetryRecord(qId);
      expect(afterRecord?.status).toBe('synced');
      expect(afterRecord?.storageKey).toBe('raw/2026/09/sync_evict_01.png');
      expect(afterRecord?.uploadUrl).toBe('https://r2.test/raw/sync_evict_01.png');
      expect(afterRecord?.imageBlob).toBeUndefined(); // Storage reclaimed!
    });

    it('prunes synced records with pruneSyncedTelemetry while preserving pending/failed records', async () => {
      const idPending = await enqueueTelemetry({
        sessionId: 'keep-pending',
        imageHash: '11'.repeat(32),
        payload: samplePayload,
      });

      const idFailed = await enqueueTelemetry({
        sessionId: 'keep-failed',
        imageHash: '22'.repeat(32),
        payload: samplePayload,
      });
      await markTelemetryStatus(idFailed, 'failed', { lastError: 'Timeout' });

      const idSynced = await enqueueTelemetry({
        sessionId: 'prune-synced',
        imageHash: '33'.repeat(32),
        payload: samplePayload,
      });
      await markTelemetryStatus(idSynced, 'synced', { evictBlob: true });

      const prunedCount = await pruneSyncedTelemetry();
      expect(prunedCount).toBe(1);

      expect(await getTelemetryRecord(idSynced)).toBeUndefined();
      expect(await getTelemetryRecord(idPending)).toBeDefined();
      expect(await getTelemetryRecord(idFailed)).toBeDefined();
    });
  });

  // ==========================================================================
  // Mission 6: Concurrency & Stress Resilience
  // ==========================================================================
  describe('6. Concurrency & Edge Cases', () => {
    it('concurrent calls to drainOutbox are mutually excluded via isDraining lock', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.api' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      let step1Calls = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          step1Calls++;
          // Simulate latency
          await new Promise((r) => setTimeout(r, 60));
          return {
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/lock.png',
                upload_url: 'https://r2.test/lock.png',
              }),
          };
        }
        if (url.includes('https://r2.test')) {
          return { ok: true, status: 200, text: () => Promise.resolve('') };
        }
        if (url.includes('/api/v1/telemetry/session')) {
          return {
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'lock-test',
                persisted_annotations: 0,
                audit_log_id: 'audit-lock',
              }),
          };
        }
        return Promise.reject(new Error('Unexpected'));
      });

      await client.submitSession({
        payload: { ...samplePayload, session_id: 'lock-test' },
        imageHash: '44'.repeat(32),
      });

      // Launch two drains simultaneously
      const [resA, resB] = await Promise.all([client.drainOutbox(), client.drainOutbox()]);

      // Exactly one should process, the other should yield { 0, 0, 0 } due to mutex lock
      const totalProcessed = resA.processed + resB.processed;
      expect(totalProcessed).toBe(1);
      expect(step1Calls).toBe(1);
    });

    it('processes metadata-only session (no imageBlob) without performing binary PUT', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.api' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      let putCalled = false;
      let sessionCommitted = false;

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/meta_only.png',
                upload_url: 'https://r2.test/meta_only.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          putCalled = true;
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          sessionCommitted = true;
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'meta-only-sess',
                persisted_annotations: 0,
                audit_log_id: 'audit-meta',
              }),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const qId = await client.submitSession({
        payload: { ...samplePayload, session_id: 'meta-only-sess' },
        // No imageBlob provided!
      });

      const res = await client.drainOutbox();
      expect(res.succeeded).toBe(1);
      expect(putCalled).toBe(false); // PUT skipped because no imageBlob
      expect(sessionCommitted).toBe(true);

      const rec = await getTelemetryRecord(qId);
      expect(rec?.status).toBe('synced');
    });

    it('attaches Bearer token to backend APIs but NOT to S3 presigned PUT URL', async () => {
      const client = new TelemetryClient({
        baseUrl: 'http://backend.api',
        getAuthToken: () => 'my-secret-jwt-token-xyz',
      });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      const capturedHeaders: Record<string, HeadersInit | undefined> = {};

      globalThis.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          capturedHeaders['presigned'] = opts.headers;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/auth.png',
                upload_url: 'https://r2.test/auth.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          capturedHeaders['s3_put'] = opts.headers;
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          capturedHeaders['session'] = opts.headers;
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'auth-sess',
                persisted_annotations: 0,
                audit_log_id: 'audit-auth',
              }),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      await client.submitSession({
        payload: { ...samplePayload, session_id: 'auth-sess' },
        imageBlob: new Blob(['auth-pixels'], { type: 'image/png' }),
      });

      await client.drainOutbox();

      // Backend presigned-url must have Authorization
      expect((capturedHeaders['presigned'] as Record<string, string>)['Authorization']).toBe(
        'Bearer my-secret-jwt-token-xyz'
      );
      // Backend session commit must have Authorization
      expect((capturedHeaders['session'] as Record<string, string>)['Authorization']).toBe(
        'Bearer my-secret-jwt-token-xyz'
      );
      // Direct S3/R2 PUT must NOT have Authorization header (prevents SigV4 conflict)
      expect((capturedHeaders['s3_put'] as Record<string, string>)['Authorization']).toBeUndefined();
    });

    it('does not re-request Presigned URL if Step 2 failed and is retried (avoids duplicate URLs)', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.api' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      let presignedUrlCalls = 0;
      let putAttempts = 0;
      let sessionCalls = 0;

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          presignedUrlCalls++;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/reuse.png',
                upload_url: 'https://r2.test/reuse.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          putAttempts++;
          if (putAttempts === 1) {
            // First PUT attempt fails (e.g. transient network glitch)
            return Promise.resolve({
              ok: false,
              status: 503,
              text: () => Promise.resolve('Service Unavailable'),
            });
          }
          // Second attempt succeeds
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          sessionCalls++;
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'reuse-sess',
                persisted_annotations: 0,
                audit_log_id: 'audit-reuse',
              }),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const qId = await client.submitSession({
        payload: { ...samplePayload, session_id: 'reuse-sess' },
        imageBlob: new Blob(['pixels'], { type: 'image/png' }),
      });

      // Drain attempt 1: Step 1 succeeds, Step 2 fails
      const res1 = await client.drainOutbox();
      expect(res1.failed).toBe(1);
      expect(presignedUrlCalls).toBe(1);
      expect(putAttempts).toBe(1);
      expect((await getTelemetryRecord(qId))?.retryCount).toBe(1);

      // Drain attempt 2 (retry): Step 1 should be skipped because uploadUrl/storageKey are preserved!
      const res2 = await client.drainOutbox();
      expect(res2.succeeded).toBe(1);
      expect(presignedUrlCalls).toBe(1); // STILL 1! No redundant presigned URL request!
      expect(putAttempts).toBe(2); // PUT retried
      expect(sessionCalls).toBe(1); // Session committed
      expect((await getTelemetryRecord(qId))?.status).toBe('synced');
    });

    it('handles 502 Bad Gateway with raw HTML response body gracefully', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.api' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('<html><head><title>502 Bad Gateway</title></head><body>502 Bad Gateway</body></html>'),
      });

      const qId = await client.submitSession({
        payload: samplePayload,
      });

      const res = await client.drainOutbox();
      expect(res.failed).toBe(1);

      const record = await getTelemetryRecord(qId);
      expect(record?.status).toBe('failed');
      expect(record?.lastError).toContain('HTTP 502: <html>');
    });

    it('handles non-Error thrown rejection gracefully (e.g. string or object)', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.api' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      globalThis.fetch = vi.fn().mockRejectedValue('Fatal socket hangup');

      const qId = await client.submitSession({
        payload: samplePayload,
      });

      const res = await client.drainOutbox();
      expect(res.failed).toBe(1);

      const record = await getTelemetryRecord(qId);
      expect(record?.status).toBe('failed');
      expect(record?.lastError).toBe('Fatal socket hangup');
    });

    it('scales gracefully with huge annotation sets (5,000 annotations)', async () => {
      const client = new TelemetryClient({ baseUrl: 'http://backend.api' });
      vi.spyOn(client, 'isOnline').mockReturnValue(true);

      const hugeAnnotations = Array.from({ length: 5000 }, (_, i) => ({
        category: i % 2 === 0 ? 'viable' : 'inviable',
        origin: 'modelo',
        confidence: 0.9 + (i % 10) * 0.01,
        pixel_polygon: [[i, i], [i + 5, i], [i + 5, i + 5], [i, i + 5]] as [number, number][],
        normalized_bbox: [0.1, 0.2, 0.01, 0.01] as [number, number, number, number],
      }));

      const hugePayload: TelemetryPayload = {
        ...samplePayload,
        session_id: 'huge-sess-5000',
        viable_count: 2500,
        inviable_count: 2500,
        annotations: hugeAnnotations,
      };

      let capturedPayload: TelemetryPayload | null = null;
      globalThis.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('/api/v1/telemetry/presigned-url')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                storage_key: 'raw/huge.png',
                upload_url: 'https://r2.test/huge.png',
              }),
          });
        }
        if (url.includes('https://r2.test')) {
          return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') });
        }
        if (url.includes('/api/v1/telemetry/session')) {
          capturedPayload = JSON.parse(opts.body as string);
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                status: 'persisted',
                session_id: 'huge-sess-5000',
                persisted_annotations: 5000,
                audit_log_id: 'audit-huge',
              }),
          });
        }
        return Promise.reject(new Error('Unexpected'));
      });

      const qId = await client.submitSession({
        payload: hugePayload,
      });

      const res = await client.drainOutbox();
      expect(res.succeeded).toBe(1);
      expect(capturedPayload).not.toBeNull();
      expect((capturedPayload as unknown as TelemetryPayload).annotations).toHaveLength(5000);

      const rec = await getTelemetryRecord(qId);
      expect(rec?.status).toBe('synced');
    });

    it('enforces time threshold on pruneSyncedTelemetry', async () => {
      const now = Date.now();
      const idOld = await enqueueTelemetry({
        sessionId: 'sess-old',
        imageHash: '00'.repeat(32),
        payload: samplePayload,
      });
      const idRecent = await enqueueTelemetry({
        sessionId: 'sess-recent',
        imageHash: '11'.repeat(32),
        payload: samplePayload,
      });

      // Mark both synced
      await markTelemetryStatus(idOld, 'synced');
      await markTelemetryStatus(idRecent, 'synced');

      // Manually set createdAt of idOld to 2 hours ago
      const oldRec = await getTelemetryRecord(idOld);
      if (oldRec) {
        oldRec.createdAt = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      }

      // Prune records older than 1 hour (3600000 ms)
      const pruned = await pruneSyncedTelemetry(60 * 60 * 1000);
      expect(pruned).toBe(1);

      // Old is gone, recent remains
      expect(await getTelemetryRecord(idOld)).toBeUndefined();
      expect(await getTelemetryRecord(idRecent)).toBeDefined();
    });
  });
});

