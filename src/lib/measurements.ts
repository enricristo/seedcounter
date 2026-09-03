// =============================================================================
// SeedCounter — Medidas por objeto (uma linha por semente)
// GPEOrq / GPSEM · Unoeste
// =============================================================================
// Inspirado no ExportToSpreadsheet do CellProfiler: em vez de apenas o total da
// placa, cada semente vira uma linha com suas próprias medidas.
//
// DEGRADAÇÃO GRACIOSA — nada aqui é obrigatório:
//   · sem calibração   -> medidas saem em pixels (colunas em µm ficam vazias)
//   · sem segmentação  -> exporta posição e classe (colunas morfométricas vazias)
//   · sem morfometria  -> continua funcionando com marcações manuais
// =============================================================================

import { calculateSeedDimensions } from './pca-utils';
import type { Mark, YoloSegmentation, Metadata } from '../types';

export interface SeedMeasurement {
  /** Identificador sequencial dentro da amostra. */
  objectId: number;
  /** 'viavel' | 'inviavel' */
  classe: string;
  /** Origem do dado: manual, ia ou assistida. */
  origem: string;
  /** Centro em pixels da imagem. */
  x: number;
  y: number;
  /** Morfometria em pixels (vazio quando não há contorno). */
  comprimentoPx?: number;
  larguraPx?: number;
  areaPx?: number;
  /** Morfometria em micrômetros (vazio sem calibração). */
  comprimentoUm?: number;
  larguraUm?: number;
  areaUm2?: number;
  /**
   * As mesmas medidas em milímetros. Redundante por decisão: µm é a unidade
   * natural do pixel, mas mm é a unidade em que o lote é descrito e publicado
   * (semente de Cattleya tem ~1,17 × 0,34 mm). Deixar a conversão para a
   * planilha convida a erro de fator 1000 em trabalho de campo.
   */
  comprimentoMm?: number;
  larguraMm?: number;
  areaMm2?: number;
  /** Razão de aspecto (comprimento / largura). */
  razaoAspecto?: number;
  /** Circularidade aproximada: 4πA / P² — 1 = círculo perfeito. */
  circularidade?: number;
  /** Confiança do modelo, quando aplicável. */
  confianca?: number;
}

export interface MeasurementContext {
  marks: Mark[];
  segmentations?: YoloSegmentation[];
  metadata: Metadata;
  filename?: string;
  /** Distância máxima (px) para casar uma marcação com um contorno. */
  matchRadius?: number;
}

/**
 * A marcação está dentro do contorno? Lançamento de raio.
 *
 * Esta é a associação CORRETA entre marca e segmentação. A versão anterior
 * usava distância ao centroide com raio fixo de 25 px, o que falha por dois
 * motivos: uma semente de orquídea a 3600 DPI tem ~165 px de comprimento,
 * então clicar na ponta já fica a mais de 25 px do centro; e o mesmo raio fixo
 * atende imagens de 946 px e de 7992 px, onde 25 px significam coisas
 * completamente diferentes.
 */
export function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const cruza = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Maior distância do centroide a um vértice — o "raio" próprio do contorno. */
function raioDoContorno(poly: [number, number][], c: { x: number; y: number }): number {
  let maior = 0;
  for (const [x, y] of poly) {
    const d = Math.hypot(x - c.x, y - c.y);
    if (d > maior) maior = d;
  }
  return maior;
}

/** Perímetro de um polígono fechado, em pixels. */
function polygonPerimeter(points: [number, number][]): number {
  let p = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

/** Área de um polígono pela fórmula do laço (shoelace), em pixels². */
function polygonArea(points: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Centroide de um polígono. */
function polygonCentroid(points: [number, number][]): { x: number; y: number } {
  let sx = 0,
    sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/**
 * Monta a tabela de medidas. Cada marcação vira uma linha; se houver um
 * contorno correspondente, a linha ganha as colunas morfométricas.
 */
export function buildMeasurements(ctx: MeasurementContext): SeedMeasurement[] {
  const { marks, segmentations = [], metadata } = ctx;
  const umPerPixel = metadata.umPerPixel;
  const matchRadius = ctx.matchRadius ?? 25;

  // Índice dos contornos visíveis, com centroide pré-calculado.
  const contours = segmentations
    .filter((s) => s.visible !== false && s.polygon_points?.length >= 3)
    .map((s) => ({ seg: s, c: polygonCentroid(s.polygon_points) }));
  const used = new Set<number>();

  return marks.map((mark, i) => {
    const row: SeedMeasurement = {
      objectId: i + 1,
      classe: mark.type === 'viable' ? 'viavel' : 'inviavel',
      origem: 'manual',
      x: Math.round(mark.x),
      y: Math.round(mark.y),
    };

    // Duas etapas, nesta ordem.
    //
    // 1. O contorno que CONTÉM a marcação. É exato e independe de escala: o
    //    técnico clica em cima da semente, não no centro geométrico dela.
    // 2. Se nenhum contém — a marcação caiu na borda, ou o contorno é côncavo
    //    e ela ficou numa reentrância —, o mais próximo cujo raio próprio
    //    alcança a marcação. O raio vem do contorno, não de uma constante:
    //    matchRadius fixo em 25 px era menor que meia semente a 3600 DPI.
    let best: (typeof contours)[number] | null = null;

    for (const c of contours) {
      if (used.has(c.seg.id)) continue;
      if (pointInPolygon(mark.x, mark.y, c.seg.polygon_points)) {
        best = c;
        break;
      }
    }

    if (!best) {
      let melhorDist = Infinity;
      for (const c of contours) {
        if (used.has(c.seg.id)) continue;
        const d = Math.hypot(c.c.x - mark.x, c.c.y - mark.y);
        // Tolerância: o próprio tamanho do contorno, com uma folga de 20%.
        // matchRadius continua servindo de piso, para contornos minúsculos.
        const limite = Math.max(matchRadius, raioDoContorno(c.seg.polygon_points, c.c) * 1.2);
        if (d < limite && d < melhorDist) {
          melhorDist = d;
          best = c;
        }
      }
    }

    if (best) {
      used.add(best.seg.id);
      const poly = best.seg.polygon_points;
      const { width, height } = calculateSeedDimensions(poly);
      const comprimento = Math.max(width, height);
      const largura = Math.min(width, height);
      const area = polygonArea(poly);
      const perim = polygonPerimeter(poly);

      row.origem = 'ia';
      row.comprimentoPx = Number(comprimento.toFixed(2));
      row.larguraPx = Number(largura.toFixed(2));
      row.areaPx = Number(area.toFixed(1));
      row.razaoAspecto = largura > 0 ? Number((comprimento / largura).toFixed(3)) : undefined;
      row.circularidade =
        perim > 0
          ? Number(Math.min(1, (4 * Math.PI * area) / (perim * perim)).toFixed(3))
          : undefined;
      if (best.seg.confidence) row.confianca = Number(best.seg.confidence.toFixed(3));

      // Conversão para micrômetros só quando há calibração.
      if (umPerPixel && umPerPixel > 0) {
        const compUm = comprimento * umPerPixel;
        const largUm = largura * umPerPixel;
        const areaUm2 = area * umPerPixel * umPerPixel;

        row.comprimentoUm = Number(compUm.toFixed(1));
        row.larguraUm = Number(largUm.toFixed(1));
        row.areaUm2 = Number(areaUm2.toFixed(0));

        // Três casas em mm preservam a resolução: a 7,06 µm/px, um pixel vale
        // 0,007 mm — arredondar antes disso jogaria fora precisão real.
        row.comprimentoMm = Number((compUm / 1000).toFixed(3));
        row.larguraMm = Number((largUm / 1000).toFixed(3));
        row.areaMm2 = Number((areaUm2 / 1e6).toFixed(4));
      }
    }

    return row;
  });
}

// ---------------------------------------------------------------------------
// Exportação em CSV
// ---------------------------------------------------------------------------

const COLUMNS: { key: keyof SeedMeasurement; label: string }[] = [
  { key: 'objectId', label: 'objeto_id' },
  { key: 'classe', label: 'classe' },
  { key: 'origem', label: 'origem' },
  { key: 'x', label: 'x_px' },
  { key: 'y', label: 'y_px' },
  { key: 'comprimentoPx', label: 'comprimento_px' },
  { key: 'larguraPx', label: 'largura_px' },
  { key: 'areaPx', label: 'area_px2' },
  { key: 'comprimentoUm', label: 'comprimento_um' },
  { key: 'larguraUm', label: 'largura_um' },
  { key: 'areaUm2', label: 'area_um2' },
  { key: 'comprimentoMm', label: 'comprimento_mm' },
  { key: 'larguraMm', label: 'largura_mm' },
  { key: 'areaMm2', label: 'area_mm2' },
  { key: 'razaoAspecto', label: 'razao_aspecto' },
  { key: 'circularidade', label: 'circularidade' },
  { key: 'confianca', label: 'confianca' },
];

/** Escapa um campo para CSV (aspas e separadores). */
function csvField(v: unknown, separator: string): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return s.includes(separator) || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export interface CsvOptions {
  /** Separador: ',' (padrão internacional) ou ';' (Excel em português). */
  separator?: ',' | ';';
  /** Repete os metadados da amostra em cada linha (facilita empilhar arquivos). */
  includeMetadata?: boolean;
}

/**
 * Gera o CSV com uma linha por semente. Os metadados da amostra são repetidos
 * em cada linha para que vários arquivos possam ser concatenados numa única
 * planilha sem perder a procedência.
 */
export function measurementsToCSV(
  rows: SeedMeasurement[],
  ctx: MeasurementContext,
  options: CsvOptions = {}
): string {
  const sep = options.separator ?? ';';
  const withMeta = options.includeMetadata ?? true;
  const { metadata, filename } = ctx;

  const metaCols = withMeta
    ? [
        { label: 'arquivo', value: filename ?? '' },
        { label: 'data', value: new Date().toISOString().slice(0, 10) },
        { label: 'pesquisador', value: metadata.researcher ?? '' },
        { label: 'projeto', value: metadata.project ?? '' },
        { label: 'tratamento', value: metadata.treatment ?? '' },
        { label: 'placa', value: metadata.plate ?? '' },
        { label: 'quadrante', value: metadata.quadrant ?? '' },
        { label: 'um_por_px', value: metadata.umPerPixel ?? '' },
        { label: 'origem_imagem', value: metadata.imageSource ?? '' },
      ]
    : [];

  const header = [...metaCols.map((m) => m.label), ...COLUMNS.map((c) => c.label)]
    .map((h) => csvField(h, sep))
    .join(sep);

  const body = rows.map((r) =>
    [
      ...metaCols.map((m) => csvField(m.value, sep)),
      ...COLUMNS.map((c) => csvField(r[c.key], sep)),
    ].join(sep)
  );

  // BOM para o Excel reconhecer acentuação corretamente.
  return '﻿' + [header, ...body].join('\r\n');
}

// ---------------------------------------------------------------------------
// Exportação em SQL (esquema normalizado)
// ---------------------------------------------------------------------------
// Mesmos dados do CSV, porém em duas tabelas relacionadas — pensado para
// acumular várias amostras, safras e culturas num banco único e poder
// consultar por espécie, tratamento, período ou equipamento.
//
// Compatível com SQLite e PostgreSQL. O CSV continua sendo o caminho simples
// para quem só quer abrir no Excel; o SQL é para o uso científico acumulativo.
// ---------------------------------------------------------------------------

export const SQL_SCHEMA = `-- SeedCounter — esquema de medidas
-- Compatível com SQLite e PostgreSQL.

CREATE TABLE IF NOT EXISTS amostra (
  amostra_id      TEXT PRIMARY KEY,
  arquivo         TEXT,
  data_analise    TEXT NOT NULL,
  pesquisador     TEXT,
  projeto         TEXT,
  especie         TEXT,
  tratamento      TEXT,
  placa           TEXT,
  quadrante       TEXT,
  um_por_px       REAL,          -- escala espacial; NULL = não calibrado
  origem_imagem   TEXT,          -- scanner, lupa, câmera…
  observacoes     TEXT
);

CREATE TABLE IF NOT EXISTS medida (
  amostra_id      TEXT NOT NULL REFERENCES amostra(amostra_id) ON DELETE CASCADE,
  objeto_id       INTEGER NOT NULL,
  classe          TEXT NOT NULL,  -- 'viavel' | 'inviavel'
  origem          TEXT,           -- 'manual' | 'ia' | 'assistida'
  x_px            REAL,
  y_px            REAL,
  comprimento_px  REAL,
  largura_px      REAL,
  area_px2        REAL,
  comprimento_um  REAL,
  largura_um      REAL,
  area_um2        REAL,
  comprimento_mm  REAL,          -- mesma medida em mm: unidade do relatorio
  largura_mm      REAL,
  area_mm2        REAL,
  razao_aspecto   REAL,
  circularidade   REAL,
  confianca       REAL,
  PRIMARY KEY (amostra_id, objeto_id)
);

CREATE INDEX IF NOT EXISTS idx_medida_classe  ON medida(classe);
CREATE INDEX IF NOT EXISTS idx_amostra_data   ON amostra(data_analise);
CREATE INDEX IF NOT EXISTS idx_amostra_esp    ON amostra(especie);
`;

/** Escapa um literal SQL (aspas simples duplicadas); NULL quando vazio. */
function sqlValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

export interface SqlOptions {
  /** Inclui o CREATE TABLE antes dos INSERTs. */
  includeSchema?: boolean;
  /** Identificador da amostra; gerado a partir da data/arquivo se ausente. */
  sampleId?: string;
}

export function measurementsToSQL(
  rows: SeedMeasurement[],
  ctx: MeasurementContext,
  options: SqlOptions = {}
): string {
  const { metadata, filename } = ctx;
  const stamp = new Date().toISOString();
  const sampleId =
    options.sampleId ??
    `${(filename ?? 'amostra').replace(/\.[^.]+$/, '')}_${stamp.slice(0, 19).replace(/[:T]/g, '')}`;

  const parts: string[] = [];
  parts.push(`-- Gerado pelo SeedCounter em ${stamp}`);
  if (options.includeSchema !== false) parts.push(SQL_SCHEMA);

  parts.push(`
BEGIN;

INSERT INTO amostra (amostra_id, arquivo, data_analise, pesquisador, projeto, especie, tratamento, placa, quadrante, um_por_px, origem_imagem, observacoes)
VALUES (${[
    sampleId,
    filename ?? '',
    stamp.slice(0, 10),
    metadata.researcher ?? '',
    metadata.project ?? '',
    '', // espécie: campo dedicado ainda não existe nos metadados
    metadata.treatment ?? '',
    metadata.plate ?? '',
    metadata.quadrant ?? '',
    metadata.umPerPixel ?? null,
    metadata.imageSource ?? '',
    metadata.notes ?? '',
  ]
    .map(sqlValue)
    .join(', ')});
`);

  if (rows.length > 0) {
    const values = rows.map(
      (r) =>
        `  (${[
          sampleId,
          r.objectId,
          r.classe,
          r.origem,
          r.x,
          r.y,
          r.comprimentoPx,
          r.larguraPx,
          r.areaPx,
          r.comprimentoUm,
          r.larguraUm,
          r.areaUm2,
          r.comprimentoMm,
          r.larguraMm,
          r.areaMm2,
          r.razaoAspecto,
          r.circularidade,
          r.confianca,
        ]
          .map(sqlValue)
          .join(', ')})`
    );
    parts.push(
      `INSERT INTO medida (amostra_id, objeto_id, classe, origem, x_px, y_px, comprimento_px, largura_px, area_px2, comprimento_um, largura_um, area_um2, comprimento_mm, largura_mm, area_mm2, razao_aspecto, circularidade, confianca)\nVALUES\n${values.join(',\n')};\n`
    );
  }

  parts.push('COMMIT;');
  parts.push(`
-- Exemplos de consulta:
--   Taxa de viabilidade por tratamento:
--     SELECT a.tratamento,
--            ROUND(100.0 * SUM(CASE WHEN m.classe='viavel' THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_viavel,
--            COUNT(*) AS n
--     FROM medida m JOIN amostra a USING (amostra_id)
--     GROUP BY a.tratamento;
--
--   Comprimento médio por espécie (apenas amostras calibradas):
--     SELECT a.especie, ROUND(AVG(m.comprimento_um),1) AS comp_um, COUNT(*) AS n
--     FROM medida m JOIN amostra a USING (amostra_id)
--     WHERE m.comprimento_um IS NOT NULL
--     GROUP BY a.especie;`);

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Resumo agregado (para conferência rápida)
// ---------------------------------------------------------------------------

export interface MeasurementSummary {
  total: number;
  viaveis: number;
  inviaveis: number;
  percentViaveis: number;
  /** Quantos objetos têm morfometria disponível. */
  comMedidas: number;
  mediaComprimento?: number;
  mediaLargura?: number;
  mediaArea?: number;
  desvioComprimento?: number;
  unidade: 'µm' | 'px';
}

export function summarize(rows: SeedMeasurement[], umPerPixel?: number): MeasurementSummary {
  const total = rows.length;
  const viaveis = rows.filter((r) => r.classe === 'viavel').length;
  const calibrado = !!umPerPixel && umPerPixel > 0;

  const medidos = rows.filter((r) =>
    calibrado ? r.comprimentoUm !== undefined : r.comprimentoPx !== undefined
  );
  const get = (r: SeedMeasurement, k: 'comprimento' | 'largura' | 'area') => {
    if (k === 'area') return calibrado ? r.areaUm2 : r.areaPx;
    if (k === 'comprimento') return calibrado ? r.comprimentoUm : r.comprimentoPx;
    return calibrado ? r.larguraUm : r.larguraPx;
  };

  const mean = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;
  const comps = medidos.map((r) => get(r, 'comprimento') ?? 0);

  const summary: MeasurementSummary = {
    total,
    viaveis,
    inviaveis: total - viaveis,
    percentViaveis: total > 0 ? Number(((viaveis / total) * 100).toFixed(1)) : 0,
    comMedidas: medidos.length,
    unidade: calibrado ? 'µm' : 'px',
  };

  if (medidos.length > 0) {
    const m = mean(comps);
    summary.mediaComprimento = Number(m.toFixed(1));
    summary.mediaLargura = Number(mean(medidos.map((r) => get(r, 'largura') ?? 0)).toFixed(1));
    summary.mediaArea = Number(mean(medidos.map((r) => get(r, 'area') ?? 0)).toFixed(0));
    // Desvio-padrão amostral do comprimento.
    if (medidos.length > 1) {
      const variance = comps.reduce((s, v) => s + (v - m) ** 2, 0) / (comps.length - 1);
      summary.desvioComprimento = Number(Math.sqrt(variance).toFixed(1));
    }
  }

  return summary;
}
