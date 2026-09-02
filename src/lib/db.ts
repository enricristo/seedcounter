import Dexie, { type Table } from 'dexie';
import type { Session, Metadata, Experiment } from '../types';

export class SeedCounterDB extends Dexie {
  sessions!: Table<Session, string>;
  metadataStore!: Table<{ id: string; data: Metadata }, string>;
  experiments!: Table<Experiment, string>;

  constructor() {
    super('SeedCounterDB');

    // v1 — original schema
    this.version(1).stores({
      sessions: 'id, plateId, timestamp, project',
      metadataStore: 'id'
    });

    // v2 — indexed by date (fixed history bug)
    this.version(2).stores({
      sessions: 'id, date',
      metadataStore: 'id'
    });

    // v3 — add experiments table for longitudinal tracking
    //       add experimentId + treatmentId indexes on sessions
    this.version(3).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible'
    });
  }
}

export const db = new SeedCounterDB();
