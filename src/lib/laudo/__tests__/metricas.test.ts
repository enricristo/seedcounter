// =============================================================================
// O bloco "Métricas avançadas" do laudo, com medidas sintéticas.
//
// O que se protege: a média é POR CLASSE (no tetrazólio é a distância entre
// o a* das viáveis e o das inviáveis que interessa — uma média só mistura as
// duas e não diz nada); a área diz a unidade (px² sem calibração, mm² com);
// sem imagem as linhas de cor somem em vez de imprimir NaN; e o sinal de a*
// aparece (+ = vermelho).
// =============================================================================
import { describe, it, expect } from 'vitest';
import { montarMetricasAvancadas, montarLaudo } from '../montagem';
import type { SeedMeasurement } from '../../measurements';
import type { Metadata } from '../../../types';

const METADATA: Metadata = { researcher: 'M', project: 'P', treatment: 'T', plate: '1', quadrant: 'A', notes: '' };

function medida(over: Partial<SeedMeasurement> & { classe: 'viavel' | 'inviavel' }): SeedMeasurement {
  return { objectId: 1, origem: 'modelo', x: 0, y: 0, ...over };
}

const valorDe = (campos: { rotulo: string; valor: string }[], trecho: string) =>
  campos.find((c) => c.rotulo.includes(trecho))?.valor;

describe('montarMetricasAvancadas', () => {
  it('sem nenhum contorno, não há bloco', () => {
    expect(montarMetricasAvancadas([])).toBeNull();
    expect(montarMetricasAvancadas([medida({ classe: 'viavel' })])).toBeNull();
  });

  it('separa por classe: o a* das viáveis não se mistura com o das inviáveis', () => {
    const bloco = montarMetricasAvancadas([
      medida({ classe: 'viavel', areaPx: 100, aMean: 20, lMean: 50, labBMean: 10 }),
      medida({ classe: 'viavel', areaPx: 120, aMean: 22, lMean: 52, labBMean: 12 }),
      medida({ classe: 'inviavel', areaPx: 80, aMean: 1, lMean: 80, labBMean: 5 }),
    ]);
    expect(bloco).not.toBeNull();
    const c = bloco?.campos ?? [];
    expect(valorDe(c, 'Viáveis — a*')).toBe('+21,0');
    expect(valorDe(c, 'Inviáveis — a*')).toBe('+1,0');
    // nenhuma linha é a média geral (que seria 14,3)
    expect(c.some((x) => x.valor === '+14,3')).toBe(false);
    expect(valorDe(c, 'Viáveis — área média (n = 2)')).toBeDefined();
    expect(valorDe(c, 'Inviáveis — área média (n = 1)')).toBeDefined();
  });

  it('sem calibração a área sai em px² e o laudo DIZ que é px²', () => {
    const c = montarMetricasAvancadas([medida({ classe: 'viavel', areaPx: 4512.4 })])?.campos ?? [];
    expect(valorDe(c, 'Viáveis — área média')).toBe('4.512 px² (não calibrado)');
  });

  it('com calibração a área sai em mm²', () => {
    const c =
      montarMetricasAvancadas([
        medida({ classe: 'viavel', areaPx: 1000, areaMm2: 1.2 }),
        medida({ classe: 'viavel', areaPx: 1000, areaMm2: 1.4 }),
      ])?.campos ?? [];
    expect(valorDe(c, 'Viáveis — área média')).toBe('1,300 mm²');
  });

  it('sem imagem (laudo só de contagem) as linhas de cor somem — nem NaN, nem 0,0', () => {
    const bloco = montarMetricasAvancadas([medida({ classe: 'viavel', areaPx: 100 })]);
    const c = bloco?.campos ?? [];
    expect(c.some((x) => /CIELAB/.test(x.rotulo))).toBe(false);
    expect(JSON.stringify(bloco)).not.toMatch(/NaN/);
    expect(valorDe(c, 'Leitura')).toMatch(/sem a imagem/);
  });

  it('cor em parte das sementes: declara em quantas foi medida', () => {
    const c =
      montarMetricasAvancadas([
        medida({ classe: 'viavel', areaPx: 100, aMean: 10, lMean: 50, labBMean: 0 }),
        medida({ classe: 'viavel', areaPx: 100 }),
      ])?.campos ?? [];
    expect(c.find((x) => x.rotulo.includes('Viáveis — a*'))?.rotulo).toContain('cor em 1 de 2');
  });

  it('a* negativo (verde) sai com sinal e vírgula; b* é o b de CIELAB, não o azul do RGB', () => {
    const c =
      montarMetricasAvancadas([
        medida({ classe: 'inviavel', areaPx: 100, aMean: -3.46, lMean: 60, labBMean: -2.2, bMean: 200 }),
      ])?.campos ?? [];
    expect(valorDe(c, 'Inviáveis — a*')).toBe('-3,5');
    expect(valorDe(c, 'Inviáveis — b*')).toBe('-2,2');
    expect(valorDe(c, 'Leitura')).toMatch(/a\* positivo = vermelho/);
  });

  it('entra no documento como bloco, depois do contexto do ensaio', () => {
    const bloco = montarMetricasAvancadas([medida({ classe: 'viavel', areaPx: 100 })]);
    const doc = montarLaudo({
      filename: 'a.jpg',
      metadata: METADATA,
      viableCount: 1,
      inviableCount: 0,
      emitidoEm: new Date('2026-03-12T10:00:00'),
      metricasAvancadas: bloco ?? undefined,
    });
    expect(doc.blocos.map((b) => b.titulo)).toContain('Métricas avançadas');
    const semBloco = montarLaudo({ filename: 'a.jpg', metadata: METADATA, viableCount: 1, inviableCount: 0 });
    expect(semBloco.blocos.map((b) => b.titulo)).not.toContain('Métricas avançadas');
  });
});
