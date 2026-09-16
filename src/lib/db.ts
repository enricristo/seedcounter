/* global FileSystemDirectoryHandle */
import Dexie, { type Table } from 'dexie';
import type { Session, Metadata, Experiment } from '../types';
import type { IdentificacaoDoLaboratorio } from './normas/identificacao';
import type { TelemetryQueueRecord } from './telemetry/types';
import type { DetectionOptions } from './detect';
import type { OpcoesDaOnda } from './region-growing';

/**
 * Uma pasta de datasets que a pessoa abriu e o app lembra.
 *
 * Guardamos o `FileSystemDirectoryHandle` (quando veio do File System Access
 * API — Chrome/Edge) porque ele é serializável pelo IndexedDB e a permissão
 * de leitura persiste entre sessões nesses navegadores; é o que evita pedir
 * "escolha a pasta de novo" toda vez. `aberta` marca qual foi a última pasta
 * usada, para `reabrirUltimaPasta()` saber qual pegar sem precisar de outro
 * store. Uma pasta aberta pelo `<input webkitdirectory>` (Firefox/Safari) não
 * tem handle — não é gravada aqui, porque não há nada para revalidar depois.
 */
export interface PastaDeDatasetGuardada {
  id?: number;
  nome: string;
  handle: FileSystemDirectoryHandle;
  aberta: boolean;
}

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

/**
 * Uma receita do painel "Encontrar" (C5), salva pela pessoa com um nome.
 *
 * "Uma receita, três momentos" (ensaio ao carregar → painel Encontrar →
 * regras semi-automáticas) — salvar aqui é o que faz a receita ajustada virar
 * uma 4ª opção do ensaio nas próximas imagens da MESMA espécie. `especie` é a
 * chave de filtro: o nome comum normalizado (minúsculo, sem acento), ou
 * `'generica'` quando a pessoa salva sem espécie declarada — essas aparecem
 * para qualquer espécie, porque não têm do que discordar.
 */
export interface ReceitaSalva {
  id?: number;
  especie: string;
  nome: string;
  quando: string;
  localizacao: DetectionOptions;
  onda: OpcoesDaOnda;
  criadaEm: number;
}

export class SeedCounterDB extends Dexie {
  sessions!: Table<Session, string>;
  metadataStore!: Table<{ id: string; data: Metadata }, string>;
  experiments!: Table<Experiment, string>;
  laboratorio!: Table<RegistroDoLaboratorio, string>;
  telemetryQueue!: Table<TelemetryQueueRecord, string>;
  pastasDeDatasets!: Table<PastaDeDatasetGuardada, number>;
  receitas!: Table<ReceitaSalva, number>;

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

    // v5 — telemetria assíncrona (outbox offline)
    this.version(5).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible',
      laboratorio: 'id',
      telemetryQueue: 'id, status, createdAt, retryCount',
    });

    // v6 — taxonomia como caminho. Sem migracao de dado: contorno antigo nao tem
    // `classe`, e isso significa exatamente "so viavel/inviavel", que e o que
    // ele sempre foi. Mesmos stores; a versao existe para o Dexie registrar a
    // mudanca de forma.
    this.version(6).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible',
      laboratorio: 'id',
      telemetryQueue: 'id, status, createdAt, retryCount',
    });

    // v7 — explorador de datasets (Lote B). Guarda o handle da pasta que a
    // pessoa abriu para não pedir de novo a cada visita — só nos navegadores
    // que dão handle serializável (File System Access API); sem migração de
    // dado, os stores anteriores repetem tal como estavam na v6.
    this.version(7).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible',
      laboratorio: 'id',
      telemetryQueue: 'id, status, createdAt, retryCount',
      pastasDeDatasets: '++id, nome, aberta',
    });

    // v8 — receitas salvas do painel "Encontrar" (C5). Uma receita ajustada
    // manualmente e salva com nome vira 4ª opção do ensaio ao carregar, para
    // a mesma espécie, sem migração de dado — sessão antiga simplesmente não
    // tem receita salva nenhuma.
    this.version(8).stores({
      sessions: 'id, date, experimentId, treatmentId',
      metadataStore: 'id',
      experiments: 'id, createdAt, species, responsible',
      laboratorio: 'id',
      telemetryQueue: 'id, status, createdAt, retryCount',
      pastasDeDatasets: '++id, nome, aberta',
      receitas: '++id, especie, nome',
    });
  }
}

export const db = new SeedCounterDB();
