/**
 * Telemetry Outbox Queue Operations (IndexedDB via Dexie with Memory Fallback)
 * File: seedcounter/src/lib/telemetry/telemetry-queue.ts
 *
 * Implements 100% local-first outbox pattern for reliable telemetry persistence.
 * Operates on Dexie IndexedDB when available; falls back smoothly to in-memory
 * queue in environments without IndexedDB (e.g. Node.js test runner or SSR).
 */

import { db } from '../db';
import type { TelemetryQueueRecord, TelemetryStatus, TelemetryPayload } from './types';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'tel_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// In-memory queue fallback for Node.js / environments without IndexedDB
const memoryOutbox = new Map<string, TelemetryQueueRecord>();

function isIndexedDBAvailable(): boolean {
  if (typeof indexedDB !== 'undefined') return true;
  if (typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB) return true;
  return false;
}

export interface EnqueueTelemetryParams {
  sessionId: string;
  imageHash: string;
  imageBlob?: Blob;
  payload: TelemetryPayload;
  id?: string;
  storageKey?: string;
  uploadUrl?: string;
}

/**
 * Enqueue a new telemetry item to the outbox (IndexedDB or memory fallback).
 * Returns the generated or supplied queue item ID.
 */
export async function enqueueTelemetry(params: EnqueueTelemetryParams): Promise<string> {
  const id = params.id || generateId();
  const record: TelemetryQueueRecord = {
    id,
    sessionId: params.sessionId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
    imageBlob: params.imageBlob,
    imageHash: params.imageHash,
    storageKey: params.storageKey,
    uploadUrl: params.uploadUrl,
    payload: params.payload,
  };

  if (isIndexedDBAvailable()) {
    try {
      await db.telemetryQueue.put(record);
      return id;
    } catch {
      // Fallback to memory
    }
  }

  memoryOutbox.set(id, { ...record });
  return id;
}

/**
 * Recover in-flight records that were interrupted (e.g. browser crash or tab close).
 * Resets stalled 'uploading' records to 'pending' so they can be processed by the outbox.
 * Also clears any cached presigned uploadUrl/storageKey so retries request fresh URLs.
 * If stalledTimeoutMs is 0, resets all 'uploading' records (ideal for queue startup).
 * If stalledTimeoutMs > 0, resets 'uploading' records older than the threshold.
 */
export async function resetStalledUploads(stalledTimeoutMs = 0): Promise<number> {
  const now = Date.now();
  let count = 0;

  if (isIndexedDBAvailable()) {
    try {
      const records = await db.telemetryQueue.toArray();
      for (const record of records) {
        if (record.status === 'uploading') {
          const recordTime = new Date(record.createdAt).getTime();
          if (stalledTimeoutMs === 0 || isNaN(recordTime) || now - recordTime >= stalledTimeoutMs) {
            record.status = 'pending';
            delete record.uploadUrl;
            delete record.storageKey;
            await db.telemetryQueue.put(record);
            count++;
          }
        }
      }
      return count;
    } catch {
      // Fallback to memory
    }
  }

  for (const [id, record] of memoryOutbox.entries()) {
    if (record.status === 'uploading') {
      const recordTime = new Date(record.createdAt).getTime();
      if (stalledTimeoutMs === 0 || isNaN(recordTime) || now - recordTime >= stalledTimeoutMs) {
        record.status = 'pending';
        delete record.uploadUrl;
        delete record.storageKey;
        memoryOutbox.set(id, { ...record });
        count++;
      }
    }
  }

  return count;
}

/**
 * Get pending or retryable telemetry records from the queue.
 * Automatically recovers in-flight 'uploading' records older than stalledTimeoutMs (default 5 min).
 */
export async function getPendingTelemetry(
  limit = 10,
  maxRetries = 5,
  stalledTimeoutMs = 5 * 60 * 1000
): Promise<TelemetryQueueRecord[]> {
  let allRecords: TelemetryQueueRecord[] = [];

  if (isIndexedDBAvailable()) {
    try {
      allRecords = await db.telemetryQueue.toArray();
      if (memoryOutbox.size > 0) {
        const idSet = new Set(allRecords.map((r) => r.id));
        for (const memRec of memoryOutbox.values()) {
          if (!idSet.has(memRec.id)) {
            allRecords.push(memRec);
          }
        }
      }
    } catch {
      allRecords = Array.from(memoryOutbox.values());
    }
  } else {
    allRecords = Array.from(memoryOutbox.values());
  }

  const now = Date.now();
  const eligible = allRecords.filter((record) => {
    if (record.status === 'pending') return true;
    if (record.status === 'failed' && record.retryCount < maxRetries) return true;
    if (record.status === 'uploading' && record.retryCount < maxRetries) {
      const recordTime = new Date(record.createdAt).getTime();
      if (stalledTimeoutMs === 0 || isNaN(recordTime) || now - recordTime >= stalledTimeoutMs) {
        return true;
      }
    }
    return false;
  });

  // Sort chronologically ascending
  eligible.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return eligible.slice(0, limit);
}

/**
 * Update the status of a telemetry queue record.
 * Supports image blob eviction upon successful sync to reclaim storage.
 * Supports clearing presigned URL cache on failure or reset.
 */
export async function markTelemetryStatus(
  id: string,
  status: TelemetryStatus,
  options?: {
    lastError?: string;
    storageKey?: string;
    uploadUrl?: string;
    evictBlob?: boolean;
    incrementRetry?: boolean;
    clearPresignedUrl?: boolean;
  }
): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const record = await db.telemetryQueue.get(id);
      if (record) {
        record.status = status;
        if (options?.lastError !== undefined) record.lastError = options.lastError;
        if (options?.storageKey !== undefined) record.storageKey = options.storageKey;
        if (options?.uploadUrl !== undefined) record.uploadUrl = options.uploadUrl;
        if (options?.incrementRetry) record.retryCount = (record.retryCount || 0) + 1;
        if (options?.evictBlob) delete record.imageBlob;
        if (options?.clearPresignedUrl) {
          delete record.uploadUrl;
          delete record.storageKey;
        }

        await db.telemetryQueue.put(record);
        return;
      }
    } catch {
      // Fallback to memory
    }
  }

  const memRecord = memoryOutbox.get(id);
  if (memRecord) {
    memRecord.status = status;
    if (options?.lastError !== undefined) memRecord.lastError = options.lastError;
    if (options?.storageKey !== undefined) memRecord.storageKey = options.storageKey;
    if (options?.uploadUrl !== undefined) memRecord.uploadUrl = options.uploadUrl;
    if (options?.incrementRetry) memRecord.retryCount = (memRecord.retryCount || 0) + 1;
    if (options?.evictBlob) delete memRecord.imageBlob;
    if (options?.clearPresignedUrl) {
      delete memRecord.uploadUrl;
      delete memRecord.storageKey;
    }
    memoryOutbox.set(id, memRecord);
  }
}

/**
 * Prune synced telemetry records from storage.
 * Optionally filter by records older than olderThanMs.
 */
export async function pruneSyncedTelemetry(olderThanMs?: number): Promise<number> {
  const now = Date.now();

  if (isIndexedDBAvailable()) {
    try {
      const allRecords = await db.telemetryQueue.toArray();
      const toDelete = allRecords.filter((record) => {
        if (record.status !== 'synced') return false;
        if (olderThanMs !== undefined) {
          const createdTime = new Date(record.createdAt).getTime();
          return now - createdTime >= olderThanMs;
        }
        return true;
      });

      const ids = toDelete.map((r) => r.id);
      await db.telemetryQueue.bulkDelete(ids);
      return ids.length;
    } catch {
      // Fallback to memory
    }
  }

  let count = 0;
  for (const [id, record] of memoryOutbox.entries()) {
    if (record.status === 'synced') {
      if (olderThanMs !== undefined) {
        const createdTime = new Date(record.createdAt).getTime();
        if (now - createdTime < olderThanMs) continue;
      }
      memoryOutbox.delete(id);
      count++;
    }
  }
  return count;
}

/**
 * Retrieve a specific telemetry record by its ID.
 */
export async function getTelemetryRecord(id: string): Promise<TelemetryQueueRecord | undefined> {
  if (isIndexedDBAvailable()) {
    try {
      const rec = await db.telemetryQueue.get(id);
      if (rec) return rec;
    } catch {
      // Fallback to memory
    }
  }
  return memoryOutbox.get(id);
}

/**
 * Return summary metrics of the current outbox queue.
 */
export async function getQueueStats(): Promise<{
  pending: number;
  uploading: number;
  synced: number;
  failed: number;
  total: number;
}> {
  let records: TelemetryQueueRecord[] = [];

  if (isIndexedDBAvailable()) {
    try {
      records = await db.telemetryQueue.toArray();
    } catch {
      records = Array.from(memoryOutbox.values());
    }
  } else {
    records = Array.from(memoryOutbox.values());
  }

  const stats = { pending: 0, uploading: 0, synced: 0, failed: 0, total: records.length };

  for (const r of records) {
    if (r.status === 'pending') stats.pending++;
    else if (r.status === 'uploading') stats.uploading++;
    else if (r.status === 'synced') stats.synced++;
    else if (r.status === 'failed') stats.failed++;
  }

  return stats;
}

/**
 * Clear all items from the telemetry queue (useful for testing and resets).
 */
export async function clearTelemetryQueue(): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await db.telemetryQueue.clear();
    } catch {
      // Fallback to memory
    }
  }
  memoryOutbox.clear();
}
