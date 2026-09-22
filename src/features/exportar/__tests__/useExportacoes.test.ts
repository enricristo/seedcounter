// =============================================================================
// A parte pura da exportação (`contexto.ts`), que é o que dá para provar em
// node: o hook em si lê pixel, cronômetro e canvas e baixa arquivo — nada
// disso existe aqui, e o projeto decidiu não trazer biblioteca de componente.
//
// O que se protege: a extração de `App.tsx` prometeu que NENHUM export muda
// de conteúdo. Então os textos são comparados byte a byte com o que o App
// produzia (os literais abaixo são o formato antigo, copiado, não derivado),
// o nome de arquivo segue a regra de `lib/download.ts`, a procedência só
// fala de página quando há mais de uma, o contexto de medição carrega a
// procedência e o salto de cor, e as decisões de "com/sem" são as de sempre.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  COLUNAS_DO_CSV_DE_CONTAGEM,
  contextoDeMedicao,
  csvDeContagem,
  csvDoHistorico,
  nomeDoArquivoExportado,
  nomeDoBackupDoHistorico,
  nomeDoPngDaSessao,
  oQueEntraNoLaudo,
  procedenciaDaCena,
  relatorioEmTexto,
  sessaoEmJSON,
  sessoesComImagem,
  type ResultadoDaContagem,
} from '../contexto';
import type { Mark, Metadata, Session, YoloSegmentation } from '../../../types';

const METADATA: Metadata = {
  researcher: 'Ana',
  project: 'Orquídeas 2026',
  treatment: 'T1',
  plate: '3',
  quadrant: 'Q2',
  notes: 'linha um\r\nlinha "dois"\nlinha três',
  umPerPixel: 10,
};

const CONTAGEM: ResultadoDaContagem = {
  viableCount: 7,
  inviableCount: 3,
  totalCount: 10,
  viablePercent: '70.0',
  inviablePercent: '30.0',
};

const MARCA: Mark = { id: 1, x: 10, y: 20, type: 'viable' };
const CONTORNO: YoloSegmentation = {
  id: 9,
  category: 'inviable',
  class_name: 'inviavel',
  confidence: 1,
  polygon_points: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  visible: true,
};

/** 21/09/2026 14:05 local — o carimbo do nome usa a hora LOCAL. */
const AGORA = new Date(2026, 8, 21, 14, 5, 30);

describe('nome do arquivo exportado', () => {
  it('leva projeto, tratamento, placa, quadrante, imagem, tipo e carimbo, nesta ordem', () => {
    const nome = nomeDoArquivoExportado(
      { filename: 'placa-03.tif', metadata: METADATA },
      'csv',
      'medidas',
      AGORA
    );
    // O acento cai (não vira hífen), o espaço vira hífen, a placa e o
    // quadrante ganham prefixo, e o carimbo é AAAAMMDD-HHMM local.
    expect(nome).toBe('Orquideas-2026_T1_placa-3_q-Q2_placa-03_medidas_20260921-1405.csv');
  });

  it('sem metadado nenhum, o produto entra como piso e a extensão não dobra o ponto', () => {
    const vazio = { ...METADATA, project: '', treatment: '', plate: '', quadrant: '' };
    expect(
      nomeDoArquivoExportado({ filename: '', metadata: vazio }, '.txt', undefined, AGORA)
    ).toBe('seedcounter_20260921-1405.txt');
  });

  it('o PNG de uma sessão do histórico troca a extensão por _anotada.png', () => {
    expect(nomeDoPngDaSessao('amostra.final.jpeg')).toBe('amostra.final_anotada.png');
    expect(nomeDoPngDaSessao('sem-extensao')).toBe('sem-extensao_anotada.png');
  });

  it('o backup do histórico é um por dia, pela data ISO', () => {
    expect(nomeDoBackupDoHistorico(new Date('2026-09-21T23:59:00Z'))).toBe(
      'seed-counter-backup-2026-09-21.json'
    );
  });
});

describe('procedência', () => {
  const tempo = { ativoMs: 1234, paredeMs: 5678, modo: 'assistida' as const, aproveitamento: 0.2 };

  it('num arquivo de uma página só, não fala de página', () => {
    const p = procedenciaDaCena({
      tempo,
      paginasDoTiff: 1,
      paginaDoTiff: 0,
      dpiDeclarado: null,
      calibracaoConferida: null,
      versaoDoApp: '3.7.0',
      commit: 'abc1234',
    });
    expect(p).toEqual({
      versaoDoApp: '3.7.0',
      commit: 'abc1234',
      paginaDaImagem: undefined,
      totalDePaginas: undefined,
      dpiDeclarado: undefined,
      dpiMedido: undefined,
      leiturasDeCalibracao: undefined,
      cvDaCalibracaoPercent: undefined,
      modo: 'assistida',
      tempoAtivoMs: 1234,
      tempoParedeMs: 5678,
    });
  });

  it('num TIFF de várias páginas, a página sai em base 1 e a calibração conferida vira coluna', () => {
    const p = procedenciaDaCena({
      tempo,
      paginasDoTiff: 4,
      paginaDoTiff: 2,
      dpiDeclarado: 4800,
      calibracaoConferida: { dpiMedido: 3200, leituras: 5, cvPercent: 0.8 },
    });
    expect(p.paginaDaImagem).toBe(3);
    expect(p.totalDePaginas).toBe(4);
    expect(p.dpiDeclarado).toBe(4800);
    expect(p.dpiMedido).toBe(3200);
    expect(p.leiturasDeCalibracao).toBe(5);
    expect(p.cvDaCalibracaoPercent).toBe(0.8);
    // Sem versão conhecida (teste, fora do build) o campo fica ausente, não inventado.
    expect(p.versaoDoApp).toBeUndefined();
  });
});

describe('contexto de medição', () => {
  it('carrega a procedência dentro do metadado e o salto de cor de 2', () => {
    const procedencia = { versaoDoApp: '3.7.0', modo: 'manual' as const };
    const marcas = [MARCA];
    const contornos = [CONTORNO];
    const ctx = contextoDeMedicao({
      marks: marcas,
      segmentacoes: contornos,
      metadata: METADATA,
      filename: 'placa-03.tif',
      procedencia,
      imageData: undefined,
    });
    // As listas passam por referência: nada é copiado nem reordenado.
    expect(ctx.marks).toBe(marcas);
    expect(ctx.segmentations).toBe(contornos);
    expect(ctx.filename).toBe('placa-03.tif');
    expect(ctx.colorSampling).toBe(2);
    expect(ctx.metadata.procedencia).toEqual(procedencia);
    // O metadado original não é tocado: a procedência entra numa cópia.
    expect(METADATA.procedencia).toBeUndefined();
    expect(ctx.imageData).toBeUndefined();
  });
});

describe('com ou sem', () => {
  it('o laudo calcula métricas quando há qualquer objeto, e diz se tem imagem', () => {
    expect(oQueEntraNoLaudo({ marks: [], segmentacoes: [], temImagem: true })).toEqual({
      temImagem: true,
      comMetricas: false,
    });
    expect(oQueEntraNoLaudo({ marks: [MARCA], segmentacoes: [], temImagem: false })).toEqual({
      temImagem: false,
      comMetricas: true,
    });
    expect(oQueEntraNoLaudo({ marks: [], segmentacoes: [CONTORNO], temImagem: false })).toEqual({
      temImagem: false,
      comMetricas: true,
    });
  });

  it('só as sessões com foto guardada viram PNG, na ordem do histórico', () => {
    const sessoes: Session[] = [
      sessao('a', 'data:image/jpeg;base64,AAAA'),
      sessao('b', undefined),
      sessao('c', 'data:image/jpeg;base64,CCCC'),
    ];
    expect(sessoesComImagem(sessoes).map((s) => s.id)).toEqual(['a', 'c']);
  });
});

describe('os textos saem iguais aos de antes', () => {
  it('relatório em texto', () => {
    const esperado =
      `Relatório de Contagem de Sementes\n` +
      `----------------------------------\n` +
      `Arquivo da Imagem: placa-03.tif\n` +
      `Data: ${AGORA.toLocaleString()}\n\n` +
      `[ Metadados ]\n` +
      `Usuário / Pesquisador: Ana\n` +
      `Projeto de Pesquisa: Orquídeas 2026\n` +
      `Tratamento / Experimento: T1\n` +
      `Placa: 3\n` +
      `Quadrante: Q2\n` +
      `Comentários: linha um\r\nlinha "dois"\nlinha três\n\n` +
      `[ Resultados ]\n` +
      `Sementes Viáveis (Vermelho): 7 (70.0%)\n` +
      `Sementes Inviáveis/Detritos (Amarelo): 3 (30.0%)\n` +
      `Total: 10\n`;
    expect(
      relatorioEmTexto({ filename: 'placa-03.tif', metadata: METADATA, contagem: CONTAGEM }, AGORA)
    ).toBe(esperado);
  });

  it('relatório em texto: campo vazio vira traço', () => {
    const vazio = { ...METADATA, researcher: '', notes: '' };
    const texto = relatorioEmTexto(
      { filename: 'x.jpg', metadata: vazio, contagem: CONTAGEM },
      AGORA
    );
    expect(texto).toContain('Usuário / Pesquisador: -\n');
    expect(texto).toContain('Comentários: -\n');
  });

  it('JSON da sessão: mesmas chaves, na mesma ordem, percentuais como número', () => {
    const json = sessaoEmJSON(
      {
        filename: 'placa-03.tif',
        metadata: METADATA,
        contagem: CONTAGEM,
        marks: [MARCA],
        segmentacoes: [CONTORNO],
      },
      AGORA
    );
    const lido = JSON.parse(json);
    expect(Object.keys(lido)).toEqual([
      'filename',
      'date',
      'metadata',
      'results',
      'marks',
      'yoloSegmentations',
    ]);
    expect(lido.date).toBe(AGORA.toISOString());
    expect(lido.results).toEqual({
      viableCount: 7,
      inviableCount: 3,
      totalCount: 10,
      viablePercent: 70,
      inviablePercent: 30,
    });
    expect(lido.marks).toEqual([MARCA]);
    expect(lido.yoloSegmentations).toEqual([CONTORNO]);
    // Indentado com dois espaços, como o importador e o diff sempre viram.
    expect(json.startsWith('{\n  "filename"')).toBe(true);
  });

  it('CSV de contagem: cabeçalho fixo, tudo entre aspas, aspa dobrada, comentário numa linha só', () => {
    const csv = csvDeContagem(
      { filename: 'placa-03.tif', metadata: METADATA, contagem: CONTAGEM },
      AGORA
    );
    const [cabecalho, linha, ...resto] = csv.split('\n');
    expect(resto).toEqual([]);
    expect(cabecalho).toBe(COLUNAS_DO_CSV_DE_CONTAGEM.map((c) => `"${c}"`).join(','));
    expect(linha).toBe(
      `"${AGORA.toLocaleString()}","placa-03.tif","Ana","Orquídeas 2026","T1","3","Q2","7","3","10","70.0","30.0","linha um linha ""dois"" linha três"`
    );
  });

  it('CSV do histórico: uma linha por sessão, percentuais refeitos e 0 sem objeto', () => {
    const s1 = { ...sessao('a', undefined), viableCount: 1, inviableCount: 2 };
    const s2 = { ...sessao('b', undefined), viableCount: 0, inviableCount: 0 };
    const csv = csvDoHistorico([s1, s2]);
    const linhas = csv.split('\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toBe(COLUNAS_DO_CSV_DE_CONTAGEM.map((c) => `"${c}"`).join(','));
    expect(linhas[1]).toBe(
      `"${new Date(s1.date).toLocaleString()}","a.jpg","Ana","Orquídeas 2026","T1","3","Q2","1","2","3","33.3","66.7","linha um linha ""dois"" linha três"`
    );
    expect(linhas[2]).toContain('"0","0","0","0","0"');
  });
});

function sessao(id: string, imageData: string | undefined): Session {
  return {
    id,
    date: '2026-09-21T12:00:00.000Z',
    filename: `${id}.jpg`,
    viableCount: 1,
    inviableCount: 1,
    metadata: METADATA,
    marks: [],
    yoloSegmentations: [],
    imageData,
  };
}
