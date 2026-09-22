// =============================================================================
// A parte pura da sessão (`sessao.ts`), que é o que dá para provar em node:
// o hook gera JPEG num canvas, grava no IndexedDB e navega — nada disso
// existe aqui.
//
// O que se protege: a extração de `App.tsx` prometeu que o registro gravado
// no histórico é o MESMO de antes. O objeto `ANTIGO` abaixo é o formato que
// `saveCurrentSession` montava, copiado do App antes da mudança (campos,
// ordem e o `{ ...metadata }`), não derivado do código novo — e a comparação
// é byte a byte, via `JSON.stringify`, porque é assim que ele vai ao banco e
// ao backup. Também: que `sessaoEstaVazia` conta pela enumeração canônica
// (contorno de modelo conta, contorno de clique não) e que as frases que a
// pessoa lê não mudaram.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  MENSAGEM_IMAGEM_DA_SESSAO_FALHOU,
  MENSAGEM_SESSAO_SALVA,
  mensagemDeSessaoSemImagem,
  montarSessao,
  nomeDaSessao,
  sessaoEstaVazia,
  type CenaParaSessao,
} from '../sessao';
import type { Mark, Metadata, Session, YoloSegmentation } from '../../../types';

const METADATA: Metadata = {
  researcher: 'Ana',
  project: 'Orquídeas 2026',
  treatment: 'T1',
  plate: '3',
  quadrant: 'Q2',
  notes: 'placa úmida',
  baselineCount: 0,
  useDifferential: false,
  umPerPixel: 10,
  amostra: { especieNomeCientifico: 'Cattleya labiata' },
};

const MARCAS: Mark[] = [
  { id: 1, x: 10, y: 20, type: 'viable' },
  { id: 2, x: 30, y: 40, type: 'inviable', subclasse: 'morta' },
];

const CONTORNO_DE_MODELO: YoloSegmentation = {
  id: 9,
  category: 'viable',
  class_name: 'viavel',
  confidence: 0.9,
  polygon_points: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  visible: true,
  origem: 'modelo',
};

const CONTORNO_DE_CLIQUE: YoloSegmentation = {
  ...CONTORNO_DE_MODELO,
  id: 10,
  origem: 'clique',
  marcaId: 1,
};

/** 21/09/2026 17:05:30.123 UTC — id e data saem do mesmo instante. */
const AGORA = new Date('2026-09-21T17:05:30.123Z');

const CENA: CenaParaSessao = {
  filename: 'placa-03.tif',
  metadata: METADATA,
  marks: MARCAS,
  segmentacoes: [CONTORNO_DE_MODELO, CONTORNO_DE_CLIQUE],
  contagem: { viableCount: 2, inviableCount: 1 },
  imagem: 'data:image/jpeg;base64,/9j/4AAQSkZJRg',
};

describe('montarSessao — o registro que vai para o histórico', () => {
  it('é, byte a byte, o objeto que o App montava', () => {
    // O formato antigo, copiado de `saveCurrentSession` (App.tsx, antes da
    // extração):
    //   { id: Date.now().toString(), date: new Date().toISOString(), filename,
    //     viableCount, inviableCount, metadata: { ...metadata }, marks,
    //     yoloSegmentations, imageData: imageDataStr }
    const ANTIGO: Session = {
      id: '1790010330123',
      date: '2026-09-21T17:05:30.123Z',
      filename: 'placa-03.tif',
      viableCount: 2,
      inviableCount: 1,
      metadata: { ...METADATA },
      marks: MARCAS,
      yoloSegmentations: [CONTORNO_DE_MODELO, CONTORNO_DE_CLIQUE],
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg',
    };
    const nova = montarSessao(CENA, AGORA);
    expect(nova).toEqual(ANTIGO);
    expect(JSON.stringify(nova)).toBe(JSON.stringify(ANTIGO));
  });

  it('a contagem gravada é a que chegou — com o diferencial já aplicado pelo App', () => {
    // Quem semeou 50 e marcou 2 viáveis grava 48 inviáveis, não 1. O App faz
    // essa conta uma vez; a sessão guarda o número da tela, não refaz.
    const nova = montarSessao({ ...CENA, contagem: { viableCount: 2, inviableCount: 48 } }, AGORA);
    expect(nova.viableCount).toBe(2);
    expect(nova.inviableCount).toBe(48);
  });

  it('o metadado é uma cópia rasa: mudar a cena depois não muda o registro', () => {
    const cena = { ...CENA, metadata: { ...METADATA } };
    const nova = montarSessao(cena, AGORA);
    cena.metadata.plate = '4';
    expect(nova.metadata.plate).toBe('3');
  });

  it('sem imagem, `imageData` é undefined — e some do JSON, como antes', () => {
    const nova = montarSessao({ ...CENA, imagem: undefined }, AGORA);
    expect(nova.imageData).toBeUndefined();
    expect(JSON.stringify(nova)).not.toContain('imageData');
  });

  it('id e data saem do mesmo instante', () => {
    const nova = montarSessao(CENA, AGORA);
    expect(Number(nova.id)).toBe(AGORA.getTime());
    expect(new Date(nova.date).getTime()).toBe(AGORA.getTime());
  });
});

describe('nomeDaSessao e sessaoEstaVazia', () => {
  it('o nome é o do arquivo — o que a tabela do histórico mostra', () => {
    expect(nomeDaSessao({ filename: 'placa-03.tif' })).toBe('placa-03.tif');
  });

  it('vazia é "nenhuma semente contada", pela enumeração canônica', () => {
    expect(sessaoEstaVazia({})).toBe(true);
    expect(sessaoEstaVazia({ marks: [], yoloSegmentations: [] })).toBe(true);
    expect(sessaoEstaVazia({ marks: MARCAS })).toBe(false);
    // Contorno de modelo conta como semente (não há marca humana equivalente)…
    expect(sessaoEstaVazia({ yoloSegmentations: [CONTORNO_DE_MODELO] })).toBe(false);
    // …contorno de clique não: a marca que o criou é quem conta, e aqui não há marca.
    expect(sessaoEstaVazia({ yoloSegmentations: [CONTORNO_DE_CLIQUE] })).toBe(true);
    // Contorno oculto é proposta rejeitada.
    expect(sessaoEstaVazia({ yoloSegmentations: [{ ...CONTORNO_DE_MODELO, visible: false }] })).toBe(true);
  });
});

describe('as frases que a pessoa lê são as de sempre', () => {
  it('ao salvar e ao falhar a foto', () => {
    expect(MENSAGEM_SESSAO_SALVA).toBe('Sessão salva com sucesso no histórico local!');
    expect(MENSAGEM_IMAGEM_DA_SESSAO_FALHOU).toBe('Erro ao carregar a imagem salva da sessão.');
  });

  it('sessão antiga sem foto: pede o arquivo pelo nome, em duas linhas', () => {
    expect(mensagemDeSessaoSemImagem({ filename: 'placa-03.tif' })).toBe(
      'Sessão carregada, mas esta sessão antiga não possui a imagem salva no banco.\nPor favor, carregue o arquivo de imagem "placa-03.tif" manualmente.'
    );
  });
});
