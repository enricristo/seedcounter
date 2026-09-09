import Dexie, { type Table } from 'dexie';
import type { Session, Metadata, Experiment } from '../types';
import type { IdentificacaoDoLaboratorio } from './normas/identificacao';

/**
 * O laboratório, guardado como registro único.
 *
 * A identidade do laboratório — RENASEM, Portaria de credenciamento, Responsável
 * Técnico — é a mesma para todo laudo que sai da instalação, e muda uma vez a
 * cada renovação de registro. Não é dado de amostra, e repeti-la em cada sessão
 * seria convidar duas sessões a discordarem sobre qual é o RENASEM.
 */
export interface RegistroDoLaboratorio {
  id: string;
  dados: IdentificacaoDoLaboratorio;
}

/** A chave do registro único do laboratório. */
export const ID_DO_LABORATORIO = 'laboratorio_atual';

export class SeedCounterDB extends Dexie {
  sessions!: Table<Session, string>;
  metadataStore!: Table<{ id: string; data: Metadata }, string>;
  experiments!: Table<Experiment, string>;
  laboratorio!: Table<RegistroDoLaboratorio, string>;

  constructor() {
    super('SeedCounterDB');

    // v1 — original schema
    this.version(1).stores({
      sessions: 'id, plateId, timestamp, project',
      metadataStore: 'id',
    });

    // v2 — indexed by date (fixed history bug)
    this.version(2).stores({
      sessions: 'id, date',
      metadataStore: 'id',
    });

    // v3 — add experiments table for longitudinal tracking
    //       add experimentId + treatmentId indexes on sessions
    this.version(3).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible',
    });

    // v4 — identidade normativa (BAS/BASO).
    //
    // A identidade do LABORATÓRIO ganha tabela própria porque é registro único
    // da instalação. A identidade da AMOSTRA não ganha: ela entra como campo
    // opcional dentro do `Metadata` que já viaja com cada sessão, e por isso
    // não exige migração de dados — sessão antiga simplesmente não tem o campo,
    // que é exatamente o que "amostra sem identificação normativa" significa.
    this.version(4).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible',
      laboratorio: 'id',
    });
  }
}

export const db = new SeedCounterDB();
