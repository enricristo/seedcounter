import Dexie, { type Table } from 'dexie';
import type { Session, Metadata } from '../types';

export class SeedCounterDB extends Dexie {
  sessions!: Table<Session, string>;
  metadataStore!: Table<{ id: string; data: Metadata }, string>;

  constructor() {
    super('SeedCounterDB');
    
    // Define the database schema
    this.version(1).stores({
      sessions: 'id, plateId, timestamp, project',
      metadataStore: 'id'
    });

    this.version(2).stores({
      sessions: 'id, date',
      metadataStore: 'id'
    });
  }
}

export const db = new SeedCounterDB();
