/**
 * Telemetry Client and Background Outbox Manager
 * File: seedcounter/src/lib/telemetry/telemetry-client.ts
 *
 * Provides silent, non-blocking telemetry streaming with 0 FPS drop on UI thread.
 * Complies with PROJECT.md Interface Contracts 1 & 2 and Local-First Outbox Pattern.
 */

import {
  enqueueTelemetry,
  getPendingTelemetry,
  markTelemetryStatus,
  pruneSyncedTelemetry,
  resetStalledUploads,
} from './telemetry-queue';
import type {
  PresignedUrlRequest,
  PresignedUrlResponse,
  SessionCommitResponse,
  TelemetryConfig,
  TelemetryPayload,
  TelemetryQueueRecord,
} from './types';

// ============================================================================
// Zero-FPS Scheduling Helper
// ============================================================================

function scheduleIdleWork(callback: () => void, timeoutMs = 2000): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => void })
      .requestIdleCallback(callback, { timeout: timeoutMs });
  } else {
    setTimeout(callback, 50);
  }
}

// ============================================================================
// Pure SHA-256 Implementation (Fallback if Web Crypto unavailable)
// ============================================================================

function sha256Fallback(buffer: ArrayBuffer): string {
  // Standard SHA-256 implementation
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bytes = new Uint8Array(buffer);
  const bitLen = bytes.length * 8;

  // Pre-processing
  const numBlocks = Math.ceil((bytes.length + 9) / 64);
  const padded = new Uint8Array(numBlocks * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen & 0xffffffff, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);

  for (let b = 0; b < padded.length; b += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(b + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
                 ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
                 (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
                 ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
                 (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b0 = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b0) ^ (a & c) ^ (b0 & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b0;
      b0 = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b0) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = [h0, h1, h2, h3, h4, h5, h6, h7];
  return out.map((val) => val.toString(16).padStart(8, '0')).join('');
}

/**
 * Computes SHA-256 hash using Web Crypto API with pure JS fallback.
 */
export async function computeSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();

  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    try {
      const digestBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digestBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to pure implementation
    }
  }

  return sha256Fallback(buffer);
}

// ============================================================================
// Telemetry Client Implementation
// ============================================================================

export class TelemetryClient {
  private config: Required<TelemetryConfig>;
  private isDraining = false;
  private isDrainScheduled = false;
  private onlineListenerAttached = false;

  constructor(config: TelemetryConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? '',
      maxRetries: config.maxRetries ?? 5,
      batchSize: config.batchSize ?? 5,
      autoDrainOnOnline: config.autoDrainOnOnline ?? true,
      getAuthToken: config.getAuthToken ?? (() => null),
      enabled: config.enabled ?? true,
    };

    this.initOnlineListener();
    resetStalledUploads().catch(() => {});
  }

  /**
   * Initialize online listener to auto-drain queue when connectivity returns.
   */
  private initOnlineListener(): void {
    if (
      !this.onlineListenerAttached &&
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('online', () => {
        if (this.config.autoDrainOnOnline) {
          this.scheduleDrain();
        }
      });
      this.onlineListenerAttached = true;
    }
  }

  /**
   * Check whether client is currently online.
   */
  public isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Update client configuration at runtime.
   */
  public configure(newConfig: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Enqueue a session for background telemetry ingestion.
   * Runs in non-blocking manner: returns queue ID immediately.
   */
  public async submitSession(params: {
    payload: TelemetryPayload;
    imageBlob?: Blob;
    imageHash?: string;
  }): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    let hash = params.imageHash;
    if (!hash && params.imageBlob) {
      hash = await computeSha256(params.imageBlob);
    }
    if (!hash) {
      hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    }

    const queueId = await enqueueTelemetry({
      sessionId: params.payload.session_id,
      imageHash: hash,
      imageBlob: params.imageBlob,
      payload: params.payload,
    });

    this.scheduleDrain();
    return queueId;
  }

  /**
   * Schedule outbox drain using requestIdleCallback to guarantee 0 FPS drop.
   */
  public scheduleDrain(): void {
    if (!this.config.enabled || this.isDraining || this.isDrainScheduled) return;
    this.isDrainScheduled = true;
    scheduleIdleWork(() => {
      this.isDrainScheduled = false;
      this.drainOutbox().catch(() => {
        // Silent error capture - telemetry never interrupts UI thread
      });
    });
  }

  /**
   * Process pending items in the outbox queue.
   */
  public async drainOutbox(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isDraining || !this.config.enabled) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!this.isOnline()) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isDraining = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      await resetStalledUploads(5 * 60 * 1000).catch(() => {});

      const pendingRecords = await getPendingTelemetry(
        this.config.batchSize,
        this.config.maxRetries
      );

      for (const record of pendingRecords) {
        if (!this.isOnline()) break;

        processed++;
        const ok = await this.processRecord(record);
        if (ok) {
          succeeded++;
        } else {
          failed++;
        }
      }

      // Automatically prune synced records older than 24h
      if (succeeded > 0) {
        await pruneSyncedTelemetry(24 * 60 * 60 * 1000).catch(() => {});
      }
    } finally {
      this.isDraining = false;
    }

    return { processed, succeeded, failed };
  }

  /**
   * Process an individual record:
   * 1. Acquire presigned URL from backend
   * 2. Direct binary PUT upload to R2 / MinIO
   * 3. Commit session metadata and annotations
   * 4. Evict local blob upon success
   */
  private async processRecord(record: TelemetryQueueRecord): Promise<boolean> {
    await markTelemetryStatus(record.id, 'uploading');

    try {
      const token = this.config.getAuthToken();
      const authHeaders: Record<string, string> = {};
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }

      let storageKey = record.storageKey;
      let uploadUrl = record.uploadUrl;

      // Step 1: Acquire Presigned URL if not already obtained
      if (!uploadUrl || !storageKey) {
        const presignedReq: PresignedUrlRequest = {
          filename: record.payload.filename || `scan_${record.sessionId}.png`,
          content_type: record.imageBlob?.type || 'image/png',
          file_size: record.imageBlob?.size,
          sha256: record.imageHash,
        };

        const presignedRes = await fetch(
          `${this.config.baseUrl}/api/v1/telemetry/presigned-url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders,
            },
            body: JSON.stringify(presignedReq),
          }
        );

        if (!presignedRes.ok) {
          const errText = await presignedRes.text().catch(() => 'Presigned URL request failed');
          throw new Error(`HTTP ${presignedRes.status}: ${errText}`);
        }

        const presignedData: PresignedUrlResponse = await presignedRes.json();
        storageKey = presignedData.storage_key;
        uploadUrl = presignedData.upload_url;

        await markTelemetryStatus(record.id, 'uploading', {
          storageKey,
          uploadUrl,
        });
      }

      // Step 2: Binary PUT directly to presigned URL (R2 / MinIO / Mock)
      if (record.imageBlob && uploadUrl) {
        const putHeaders: Record<string, string> = {
          'Content-Type': record.imageBlob.type || 'image/png',
        };

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: putHeaders,
          body: record.imageBlob,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => 'Direct binary PUT failed');
          throw new Error(`Upload failed with HTTP ${uploadRes.status}: ${errText}`);
        }
      }

      // Step 3: Ingest session metadata and annotations
      const sessionPayload = {
        ...record.payload,
        storage_key: storageKey,
      };

      const commitRes = await fetch(`${this.config.baseUrl}/api/v1/telemetry/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(sessionPayload),
      });

      if (!commitRes.ok) {
        const errText = await commitRes.text().catch(() => 'Session ingestion failed');
        throw new Error(`Session ingestion HTTP ${commitRes.status}: ${errText}`);
      }

      const commitData: SessionCommitResponse = await commitRes.json();

      // Step 4: Mark as synced and evict local blob to reclaim storage
      await markTelemetryStatus(record.id, 'synced', {
        storageKey,
        uploadUrl,
        evictBlob: true,
      });

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.handleUploadFailure(record.id, errorMessage, record.retryCount);
      return false;
    }
  }

  /**
   * Handle failure by recording error, incrementing retry count, and clearing cached
   * uploadUrl and storageKey on auth/expiry errors (401, 403, 'expired') or repeated failures
   * so retrying the upload requests a fresh presigned URL from the backend instead of looping
   * on an expired S3/R2 presigned URL with HTTP 403.
   */
  private async handleUploadFailure(
    recordId: string,
    errorMessage: string,
    retryCount = 0
  ): Promise<void> {
    const isExpiredOrForbidden =
      errorMessage.includes('403') ||
      errorMessage.includes('401') ||
      errorMessage.toLowerCase().includes('expired') ||
      errorMessage.toLowerCase().includes('forbidden') ||
      retryCount >= 2;

    await markTelemetryStatus(recordId, 'failed', {
      lastError: errorMessage,
      incrementRetry: true,
      clearPresignedUrl: isExpiredOrForbidden,
    });
  }
}

/**
 * Singleton instance of TelemetryClient.
 */
export const telemetryClient = new TelemetryClient();
