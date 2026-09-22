// =============================================================================
// Medidas exportadas — Feret nas colunas do CSV.
//
// Arquivo novo: measurements.ts não tinha teste próprio (measurements-mm.test.ts
// cobre só a conversão em mm); os testes de Feret vêm aqui, como o plano do
// Degrau 1 (Tarefa 3) descreve.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { buildMeasurements, measurementsToCSV } from '../measurements';
import type { Mark, YoloSegmentation, Metadata } from '../../types';

describe('exportação de medidas', () => {
  it('exporta Feret nas colunas do CSV', () => {
    const marks: Mark[] = [{ id: 1, x: 10, y: 5, type: 'viable' }];
    const segmentations: YoloSegmentation[] = [
      {
        id: 1,
        category: 'viable',
        class_name: 'viavel',
        confidence: 1,
        polygon_points: [
          [0, 0],
          [20, 0],
          [20, 10],
          [0, 10],
        ],
      },
    ];
    const metadata: Metadata = {
      researcher: '',
      project: '',
      treatment: '',
      plate: '',
      quadrant: '',
      notes: '',
      umPerPixel: 100,
    };

    const rows = buildMeasurements({ marks, segmentations, metadata });

    expect(rows[0].feretMinPx).toBeCloseTo(10, 5);
    expect(rows[0].feretMaxMm).toBeCloseTo(Math.hypot(20, 10) * 0.1, 5);

    // measurementsToCSV exige o contexto (metadados/arquivo) para montar o
    // cabeçalho — a assinatura real tem `ctx` obrigatório, diferente do
    // esboço do plano que chamava só com `rows`.
    const csv = measurementsToCSV(rows, { marks, segmentations, metadata });
    expect(csv.split('\n')[0]).toMatch(/feret_max_px/);
  });
});

describe('a classe fina no CSV', () => {
  // A classe fina (`Mark.subclasse`) era gravada pela galeria e pelo menu
  // radial e NÃO saía na exportação: a curadoria morria no arquivo. Aqui ela
  // sai em três colunas, e a que muda conta — `conta_como_semente` — é a razão
  // de tudo: pela RAS, unidade de dispersão vazia é material inerte e sai do
  // denominador da germinação.
  const metadata: Metadata = {
    researcher: '',
    project: '',
    treatment: '',
    plate: '',
    quadrant: '',
    notes: '',
  };

  const linhas = (marks: Mark[]) => buildMeasurements({ marks, segmentations: [], metadata });

  it('sem classe declarada, as três colunas ficam vazias — não "normal"', () => {
    const [linha] = linhas([{ id: 1, x: 1, y: 1, type: 'viable' }]);
    expect(linha.classe).toBe('viavel');
    expect(linha.classeNorma).toBeUndefined();
    expect(linha.classeRotulo).toBeUndefined();
    expect(linha.contaComoSemente).toBeUndefined();
  });

  it('semente vazia é inerte: NÃO conta como semente', () => {
    const [linha] = linhas([{ id: 1, x: 1, y: 1, type: 'inviable', subclasse: 'vazia' }]);
    expect(linha.classeNorma).toBe('vazia');
    expect(linha.classeRotulo).toBe('Vazia (inerte)');
    expect(linha.contaComoSemente).toBe('nao');
  });

  it('dormente é semente: conta, mesmo não tendo germinado', () => {
    const [linha] = linhas([{ id: 1, x: 1, y: 1, type: 'inviable', subclasse: 'dormente' }]);
    expect(linha.classeNorma).toBe('dormente');
    expect(linha.contaComoSemente).toBe('sim');
  });

  it('as quatro colunas novas estão no cabeçalho, depois de classe', () => {
    const marks: Mark[] = [{ id: 1, x: 1, y: 1, type: 'viable', subclasse: 'normal' }];
    const csv = measurementsToCSV(linhas(marks), { marks, segmentations: [], metadata });
    const cabecalho = csv.split('\n')[0].split(';');
    expect(cabecalho).toContain('classe_norma');
    expect(cabecalho).toContain('classe_rotulo');
    expect(cabecalho).toContain('conta_como_semente');
    expect(cabecalho).toContain('classe_externa');
    expect(cabecalho.indexOf('classe_norma')).toBe(cabecalho.indexOf('classe') + 1);
  });

  it('o nome cru de um dataset de terceiros sai na coluna própria', () => {
    const marks: Mark[] = [
      { id: 1, x: 1, y: 1, type: 'viable', classeExterna: 'amendoim com mofo' },
    ];
    const csv = measurementsToCSV(linhas(marks), { marks, segmentations: [], metadata });
    expect(csv).toContain('amendoim com mofo');
  });
});
