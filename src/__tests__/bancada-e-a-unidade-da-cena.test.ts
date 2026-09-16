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
});
