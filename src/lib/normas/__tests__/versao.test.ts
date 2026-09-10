// =============================================================================
// Versão da norma aplicada.
//
// A RAS 2025 é digital e viva: 15 capítulos, cada um com revisão própria, e o
// Cap. 5 já mudou duas vezes num ano. Dois laudos sob revisões diferentes do
// mesmo capítulo podem não ser comparáveis — e é isso que estes testes
// protegem.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  CAPITULOS_RAS_2025,
  PORTARIA_DA_RAS_2025_NAO_CONFIRMADA,
  RAS_2025_EM_VIGOR_DESDE,
  capituloDaRas,
  descrever,
  descreverCurto,
  mesmaVersao,
  type VersaoDaNorma,
} from '../versao';

describe('o catálogo dos capítulos', () => {
  it('tem os 15 capítulos da RAS 2025', () => {
    expect(Object.keys(CAPITULOS_RAS_2025)).toHaveLength(15);
  });

  it('traz os capítulos que o aplicativo usa', () => {
    // Pureza, germinação, tetrazólio e peso de mil sementes são os quatro que
    // o produto toca hoje ou vai tocar na próxima rodada.
    expect(capituloDaRas('2')?.titulo).toMatch(/Pureza/);
    expect(capituloDaRas('4')?.titulo).toMatch(/Germinação/);
    expect(capituloDaRas('5')?.titulo).toMatch(/Tetrazólio/);
    expect(capituloDaRas('9')?.titulo).toMatch(/Peso de Mil Sementes/);
  });

  it('traz o Cap. 11, que é o precedente de análise de imagem', () => {
    // É o primeiro capítulo da RAS a autorizar avaliação automática por
    // imagem, e é ele que se cita quando alguém pergunta se pode.
    expect(capituloDaRas('11')?.titulo).toMatch(/Raios X/);
  });

  it('devolve indefinido para capítulo que não existe', () => {
    expect(capituloDaRas('99')).toBeUndefined();
  });

  it('toda entrada declara norma, edição, capítulo e revisão', () => {
    for (const [numero, v] of Object.entries(CAPITULOS_RAS_2025)) {
      expect(v.norma, numero).toBe('RAS');
      expect(v.edicao, numero).toBe('2025');
      expect(v.capitulo, numero).toBe(numero);
      expect(v.revisao.length, numero).toBeGreaterThan(0);
      expect(v.titulo.length, numero).toBeGreaterThan(0);
    }
  });
});

describe('descrição para o laudo', () => {
  it('diz capítulo, título, revisão e data', () => {
    expect(descrever(capituloDaRas('5')!)).toBe(
      'RAS 2025, Cap. 5 — Teste de Tetrazólio, rev. 1.2 (01/12/2025)'
    );
  });

  it('omite a data quando ela não foi confirmada', () => {
    // Inventar data de revisão seria pior que não ter.
    const d = descrever(capituloDaRas('2')!);
    expect(d).toBe('RAS 2025, Cap. 2 — Análise de Pureza, rev. 1.3');
    expect(d).not.toMatch(/\(/);
  });

  it('a forma curta cabe em tabela e rodapé', () => {
    expect(descreverCurto(capituloDaRas('4')!)).toBe('RAS 2025 4 rev. 1.5');
  });
});

describe('comparabilidade', () => {
  const base = capituloDaRas('4')!;

  it('mesma revisão é comparável', () => {
    expect(mesmaVersao(base, { ...base })).toBe(true);
  });

  it('REVISÃO diferente não é comparável, e é o ponto do módulo', () => {
    // O Cap. 5 mudou duas vezes em 2025. Comparar resultados entre revisões é
    // o erro que não aparece no número e aparece na conclusão.
    expect(mesmaVersao(base, { ...base, revisao: '1.4' })).toBe(false);
  });

  it('capítulo, edição e norma diferentes também separam', () => {
    expect(mesmaVersao(base, { ...base, capitulo: '5' })).toBe(false);
    expect(mesmaVersao(base, { ...base, edicao: '2009' })).toBe(false);
    const ista: VersaoDaNorma = { ...base, norma: 'ISTA', edicao: '2026' };
    expect(mesmaVersao(base, ista)).toBe(false);
  });
});

describe('o que fica registrado como pendência', () => {
  it('a portaria da RAS 2025 continua não confirmada', () => {
    // Enquanto for verdade, este teste existe para que ninguém escreva um
    // número de portaria num laudo sem antes confirmar com a CGAL. Quando for
    // confirmado, o teste cai junto com a constante.
    expect(PORTARIA_DA_RAS_2025_NAO_CONFIRMADA).toBe(true);
  });

  it('sabe desde quando a RAS 2025 vale', () => {
    expect(RAS_2025_EM_VIGOR_DESDE).toBe('2025-06-26');
  });
});
