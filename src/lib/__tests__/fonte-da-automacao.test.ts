import { describe, it, expect } from 'vitest';
import { fontesDasAutomacoes, resumoDaFonte, modificacoesAtivas, type EstadoDaImagem } from '../fonte-da-automacao';

const limpo: EstadoDaImagem = {
  fundoAchatado: false,
  ajusteEmPixels: false,
  ajusteEmTela: false,
  forcarOriginal: false,
};

describe('que imagem cada automação lê', () => {
  it('sem alteração, tudo lê a original', () => {
    const fontes = fontesDasAutomacoes(limpo);
    expect(fontes.every((f) => f.fonte === 'original')).toBe(true);
    expect(resumoDaFonte(limpo)).toEqual({ texto: 'original', alterada: false });
  });

  it('fundo achatado: onda e Encontrar leem a modificada; o modelo continua na original', () => {
    const e = { ...limpo, fundoAchatado: true };
    const fontes = fontesDasAutomacoes(e);
    expect(fontes.find((f) => f.automacao === 'onda')!.fonte).toBe('modificada');
    expect(fontes.find((f) => f.automacao === 'encontrar')!.fonte).toBe('modificada');
    // Não é preferência de interface: o modelo foi treinado em imagem crua.
    expect(fontes.find((f) => f.automacao === 'modelo')!.fonte).toBe('original');
    expect(resumoDaFonte(e)).toEqual({ texto: 'modificada · fundo achatado', alterada: true });
  });

  it('forçar original vence qualquer ajuste, e o resumo diz que foi forçado', () => {
    const e = { ...limpo, fundoAchatado: true, ajusteEmPixels: true, forcarOriginal: true };
    expect(fontesDasAutomacoes(e).every((f) => f.fonte === 'original')).toBe(true);
    expect(resumoDaFonte(e)).toEqual({ texto: 'original (forçada)', alterada: false });
  });

  it('lista as modificações em ordem, para o rodapé dizer quais são', () => {
    expect(modificacoesAtivas({ ...limpo, fundoAchatado: true, ajusteEmPixels: true, ajusteEmTela: true })).toEqual([
      'fundo achatado',
      'canal/gama/cor',
      'brilho/contraste',
    ]);
    expect(modificacoesAtivas(limpo)).toEqual([]);
  });

  it('o motivo do modelo é sempre o mesmo, e explica o porquê', () => {
    for (const e of [limpo, { ...limpo, fundoAchatado: true }, { ...limpo, forcarOriginal: true }]) {
      const m = fontesDasAutomacoes(e).find((f) => f.automacao === 'modelo')!;
      expect(m.motivo).toContain('treinado');
    }
  });
});
