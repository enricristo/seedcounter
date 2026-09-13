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
