import { describe, it, expect } from 'vitest';
import { resumir } from '../resumo';
import { simularRegra, REGRAS_PADRAO } from '../regras';
import type { SeedMeasurement } from '../../../lib/measurements';

function mockMedida(parcial: Partial<SeedMeasurement>): SeedMeasurement {
  return {
    objectId: 1,
    classe: 'viavel',
    origem: 'ia',
    x: 10,
    y: 10,
    comprimentoPx: 50,
    larguraPx: 25,
    areaPx: 1000,
    circularidade: 0.85,
    solidez: 0.96,
    ...parcial,
  };
}

describe('Métricas de Cartões e Painel de Morfometria', () => {
  it('resumir agrega solidez e circularidade corretamente', () => {
    const sementes: SeedMeasurement[] = [
      mockMedida({ objectId: 1, solidez: 0.95, circularidade: 0.80 }),
      mockMedida({ objectId: 2, solidez: 0.85, circularidade: 0.70 }),
      mockMedida({ objectId: 3, solidez: 0.98, circularidade: 0.90 }),
    ];

    const resumo = resumir(sementes);
    expect(resumo.solidez).not.toBeNull();
    expect(resumo.solidez?.mediana).toBe(0.95);
    expect(resumo.circularidade).not.toBeNull();
    expect(resumo.circularidade?.mediana).toBe(0.80);
  });

  it('regras padrões identificam anomalias na população', () => {
    const sementes: SeedMeasurement[] = [
      mockMedida({ objectId: 1, areaMm2: 2.0 }), // detrito (< 5mm²)
      mockMedida({ objectId: 2, areaMm2: 15.0, solidez: 0.82 }), // aglomerado (< 0.90)
      mockMedida({ objectId: 3, areaMm2: 12.0, circularidade: 0.50 }), // chocha (< 0.65)
      mockMedida({ objectId: 4, areaMm2: 14.0, solidez: 0.97, circularidade: 0.88 }), // normal
    ];

    const regraDetrito = REGRAS_PADRAO.find((r) => r.id === 'regra-detritos')!;
    const regraAglomerado = REGRAS_PADRAO.find((r) => r.id === 'regra-aglomerados')!;
    const regraChocha = REGRAS_PADRAO.find((r) => r.id === 'regra-chocha')!;

    expect(simularRegra(sementes, regraDetrito)).toEqual([1]);
    expect(simularRegra(sementes, regraAglomerado)).toEqual([2]);
    expect(simularRegra(sementes, regraChocha)).toEqual([3]);
  });
});
