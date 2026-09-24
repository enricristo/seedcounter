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

describe('circularidade: o valor cru, e o aviso de quando ele não vale', () => {
  // Todo contorno do app é cortado em 48 vértices, e a corda é mais curta que
  // o arco: perímetro subestimado, circularidade superestimada (+9,9% na
  // mediana medida, até +191% no pior caso). O `Math.min(1, …)` que havia
  // aqui não corrigia o viés — escondia o sintoma justamente nas sementes
  // mais redondas, que é onde ele estoura.
  const metadata: Metadata = {
    researcher: '',
    project: '',
    treatment: '',
    plate: '',
    quadrant: '',
    notes: '',
  };

  /** Polígono regular de `n` lados — o quadrado é o caso mais reentrante possível sem concavidade. */
  const regular = (n: number, raio: number): [number, number][] =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return [100 + raio * Math.cos(a), 100 + raio * Math.sin(a)] as [number, number];
    });

  const medir = (poly: [number, number][]) => {
    const marks: Mark[] = [{ id: 1, x: 100, y: 100, type: 'viable' }];
    const segmentations: YoloSegmentation[] = [
      { id: 1, category: 'viable', class_name: 'viavel', confidence: 1, polygon_points: poly },
    ];
    return buildMeasurements({ marks, segmentations, metadata })[0];
  };

  it('o teto em 1 era código morto: nenhum polígono válido passa de 1', () => {
    // Desigualdade isoperimétrica: 4πA/P² ≤ 1 para QUALQUER polígono simples,
    // e as duas funções daqui fecham o polígono (o último vértice liga no
    // primeiro). O `Math.min(1, …)` que havia aqui nunca disparava — e, por
    // sugerir que a conta pode estourar, mandava procurar o problema no lugar
    // errado. O viés real (+9,9% na mediana) é OUTRO: está entre o contorno
    // de 48 vértices e a borda verdadeira da semente, e nenhum teto o toca.
    const quase = medir(regular(48, 50));
    expect(quase.circularidade).toBeLessThanOrEqual(1);
    expect(quase.circularidade).toBeGreaterThan(0.99);
    // Quanto menos vértices, mais longe de 1 — e nunca acima.
    expect(medir(regular(8, 50)).circularidade).toBeLessThan(0.95);
  });

  it('o viés é do CORTE em 48 vértices, e a solidez é quem o denuncia', () => {
    // Uma borda serrilhada tem perímetro longo e área quase igual à da forma
    // lisa: circularidade baixa. Cortada em 48 vértices, os dentes somem, o
    // perímetro encurta e a circularidade SOBE — medindo uma semente mais
    // redonda do que ela é. É por isso que o valor precisa vir com aviso.
    const raio = 50;
    const serrilhado: [number, number][] = Array.from({ length: 240 }, (_, i) => {
      const a = (2 * Math.PI * i) / 240;
      const r = raio + (i % 2 === 0 ? 4 : -4);
      return [100 + r * Math.cos(a), 100 + r * Math.sin(a)] as [number, number];
    });
    const comDentes = medir(serrilhado);
    const cortado = medir(regular(48, raio));
    expect(comDentes.circularidade).toBeLessThan(0.6);
    expect(cortado.circularidade ?? 0).toBeGreaterThan((comDentes.circularidade ?? 0) * 1.5);
  });

  it('contorno bem comportado: circularidade não é estimativa', () => {
    const linha = medir(regular(48, 50));
    expect(linha.solidez).toBeGreaterThanOrEqual(0.975);
    expect(linha.circularidadeEstimada).toBe('nao');
  });

  it('contorno com reentrância profunda vira estimativa', () => {
    // Uma "cintura": dois lóbulos ligados, o formato de duas sementes
    // encostadas. A solidez despenca e a circularidade deixa de valer.
    const poly: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 40],
      [55, 45],
      [55, 55],
      [100, 60],
      [100, 100],
      [0, 100],
      [0, 60],
      [45, 55],
      [45, 45],
      [0, 40],
    ];
    const linha = medir(poly);
    expect(linha.solidez).toBeLessThan(0.975);
    expect(linha.circularidadeEstimada).toBe('sim');
  });

  it('sem contorno não há circularidade nem marca de estimativa', () => {
    const linha = buildMeasurements({
      marks: [{ id: 1, x: 1, y: 1, type: 'viable' }],
      segmentations: [],
      metadata,
    })[0];
    expect(linha.circularidade).toBeUndefined();
    expect(linha.circularidadeEstimada).toBeUndefined();
  });

  it('o CSV declara a convenção do comprimento e traz a marca de estimativa', () => {
    const marks: Mark[] = [{ id: 1, x: 100, y: 100, type: 'viable' }];
    const segmentations: YoloSegmentation[] = [
      {
        id: 1,
        category: 'viable',
        class_name: 'viavel',
        confidence: 1,
        polygon_points: regular(48, 50),
      },
    ];
    const csv = measurementsToCSV(buildMeasurements({ marks, segmentations, metadata }), {
      marks,
      segmentations,
      metadata,
    });
    const cabecalho = csv.split('\n')[0].split(';');
    expect(cabecalho).toContain('circularidade_estimada');
    // O app mede no eixo principal (PCA); a literatura costuma publicar o
    // eixo da elipse. 1 a 2% de diferença, e ninguém dizia qual era.
    expect(cabecalho).toContain('convencao_comprimento');
    expect(csv).toContain('eixo-principal-pca');
  });
});
