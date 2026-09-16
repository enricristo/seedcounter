import { describe, it, expect } from 'vitest';
import {
  atendeRegra,
  simularRegra,
  aplicarRegra,
  type RegraParametrica,
} from '../regras';
import type { Mark, YoloSegmentation } from '../../../types';
import type { SeedMeasurement } from '../../../lib/measurements';

function mockMedida(parcial: Partial<SeedMeasurement>): SeedMeasurement {
  return {
    objectId: 1,
    classe: 'viavel',
    origem: 'ia',
    x: 10,
    y: 10,
    ...parcial,
  };
}

describe('Motor de Regras Analíticas', () => {
  it('identifica sementes menores que o limiar de área (detritos)', () => {
    const regra: RegraParametrica = {
      id: 'r1',
      tipo: 'filtro-impurezas',
      nome: 'Detritos',
      descricao: 'Menor que 5mm²',
      campo: 'areaMm2',
      operador: '<',
      limiar: 5.0,
      acao: 'remover',
    };

    const sementePequena = mockMedida({ objectId: 1, areaMm2: 2.5 });
    const sementeNormal = mockMedida({ objectId: 2, areaMm2: 12.0 });

    expect(atendeRegra(sementePequena, regra)).toBe(true);
    expect(atendeRegra(sementeNormal, regra)).toBe(false);

    const simulados = simularRegra([sementePequena, sementeNormal], regra);
    expect(simulados).toEqual([1]);
  });

  it('identifica sementes com baixa solidez (suspeita de aglomerado)', () => {
    const regra: RegraParametrica = {
      id: 'r2',
      tipo: 'deteccao-aglomerados',
      nome: 'Aglomerado',
      descricao: 'Solidez menor que 0.90',
      campo: 'solidez',
      operador: '<',
      limiar: 0.90,
      acao: 'sinalizar-corte',
    };

    const sementeFundida = mockMedida({ objectId: 1, solidez: 0.84 });
    const sementeConvexa = mockMedida({ objectId: 2, solidez: 0.98 });

    expect(atendeRegra(sementeFundida, regra)).toBe(true);
    expect(atendeRegra(sementeConvexa, regra)).toBe(false);
  });

  it('aplica remoção de marcas e segmentações correspondentes', () => {
    const marks: Mark[] = [
      { id: 101, x: 10, y: 10, type: 'viable' },
      { id: 102, x: 50, y: 50, type: 'viable' },
    ];
    const segs: YoloSegmentation[] = [
      { id: 201, category: 'viable', class_name: 'viavel', confidence: 0.9, polygon_points: [[10,10]], visible: true, marcaId: 101 },
      { id: 202, category: 'viable', class_name: 'viavel', confidence: 0.9, polygon_points: [[50,50]], visible: true, marcaId: 102 },
    ];
    const medicoes: SeedMeasurement[] = [
      mockMedida({ objectId: 1, areaMm2: 1.0 }), // correspondente a mark 101
      mockMedida({ objectId: 2, areaMm2: 10.0 }), // correspondente a mark 102
    ];

    const regra: RegraParametrica = {
      id: 'r1',
      tipo: 'filtro-impurezas',
      nome: 'Limpar Detrito',
      descricao: '',
      campo: 'areaMm2',
      operador: '<',
      limiar: 3.0,
      acao: 'remover',
    };

    const resultado = aplicarRegra(marks, segs, medicoes, regra);
    expect(resultado.totalAfetadas).toBe(1);
    expect(resultado.marks.map((m) => m.id)).toEqual([102]);
    expect(resultado.segmentacoes.map((s) => s.id)).toEqual([202]);
  });

  it('aplica reclassificação para inviável', () => {
    const marks: Mark[] = [
      { id: 101, x: 10, y: 10, type: 'viable' },
      { id: 102, x: 50, y: 50, type: 'viable' },
    ];
    const segs: YoloSegmentation[] = [
      { id: 201, category: 'viable', class_name: 'viavel', confidence: 0.9, polygon_points: [[10,10]], visible: true, marcaId: 101 },
    ];
    const medicoes: SeedMeasurement[] = [
      mockMedida({ objectId: 1, circularidade: 0.50 }), // irregular
      mockMedida({ objectId: 2, circularidade: 0.90 }),
    ];

    const regra: RegraParametrica = {
      id: 'r3',
      tipo: 'limiar-viabilidade',
      nome: 'Chocha',
      descricao: '',
      campo: 'circularidade',
      operador: '<',
      limiar: 0.65,
      acao: 'marcar-inviavel',
    };

    const resultado = aplicarRegra(marks, segs, medicoes, regra);
    expect(resultado.totalAfetadas).toBe(1);
    expect(resultado.marks.find((m) => m.id === 101)?.type).toBe('inviable');
    expect(resultado.marks.find((m) => m.id === 102)?.type).toBe('viable');
    expect(resultado.segmentacoes.find((s) => s.id === 201)?.category).toBe('inviable');
  });
});
