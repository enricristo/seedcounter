import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A cena é uma UNIDADE. Este teste existe porque a tentação, sempre que
 * aparece um estado novo de imagem, é declará-lo no App "só desta vez" — e
 * foi assim que o App chegou a 3.672 linhas com a cena espalhada. Com quatro
 * bancadas, estado de cena solto no App vira estado COMPARTILHADO entre elas:
 * mexer numa mudaria a outra, e o defeito seria sutil.
 */
const APP = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf8');
const BANCADA = readFileSync(join(__dirname, '..', 'hooks', 'useBancada.ts'), 'utf8');

const ESTADO_DE_CENA = [
  'fundoAchatado',
  'adjustments',
  'adjustEnabled',
  'mascara',
  'contornoSelecionado',
  'regiaoDeDeteccao',
  'ultimaGravacao',
  'forcarOriginalNasAutomacoes',
  'referenciaJaCarregada',
];

describe('a cena é uma unidade', () => {
  it('nenhum estado de cena é declarado direto no App', () => {
    for (const nome of ESTADO_DE_CENA) {
      const declaracao = new RegExp(`const \\[${nome},`);
      expect(APP, `${nome} precisa morar em useBancada, não no App`).not.toMatch(declaracao);
    }
  });

  it('todo estado de cena mora em useBancada', () => {
    for (const nome of ESTADO_DE_CENA) {
      expect(BANCADA, `${nome} faltando em useBancada`).toMatch(new RegExp(`const \\[${nome},`));
    }
  });

  it('os hooks por-cena são chamados dentro da bancada, não no App', () => {
    for (const hook of ['useImageQueue(', 'useMarks(', 'useMetadata(', 'useZoom(', 'usePanning(']) {
      expect(BANCADA, `${hook} precisa ser chamado em useBancada`).toContain(hook);
      expect(APP, `${hook} não pode ser chamado no App`).not.toContain(hook);
    }
  });

  it('o App fala com a bancada ATIVA, não com uma bancada fixa', () => {
    expect(APP).toContain('bancadas.ativa');
    expect(APP).not.toMatch(/useBancada\(/);
  });

  /**
   * `marcasRef`, `segmentacoesRef`, `anotacoesPorImagem` e `chaveAtual`
   * guardam a anotação da imagem anterior ao trocar na fila — são cache da
   * CENA. Task 1 as deixou no App por falta do índice da bancada em
   * `onImageLoaded`; a Task 2 resolve isso e as move para dentro de
   * `useBancada`. Se voltarem a ser declaradas soltas no App, quatro
   * bancadas passam a compartilhar o mesmo cache — a da bancada 1 serviria a
   * imagem da bancada 3.
   */
  it('as refs de cache de anotações não são declaradas direto no App', () => {
    for (const nome of ['marcasRef', 'segmentacoesRef', 'anotacoesPorImagem', 'chaveAtual']) {
      const declaracao = new RegExp(`const ${nome} = useRef`);
      expect(APP, `${nome} precisa morar em useBancada, não no App`).not.toMatch(declaracao);
    }
  });

  it('as refs de cache de anotações moram em useBancada', () => {
    for (const nome of ['marcasRef', 'segmentacoesRef', 'anotacoesPorImagem', 'chaveAtual']) {
      const declaracao = new RegExp(`const ${nome} = useRef`);
      expect(BANCADA, `${nome} faltando em useBancada`).toMatch(declaracao);
    }
  });
});
