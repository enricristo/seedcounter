// =============================================================================
// Carregar imagem com cena aberta — a decisão.
//
// A regra que não pode cair: o diálogo NÃO aparece na primeira imagem do dia,
// nem em cima de uma imagem sem marcação. Só com cena ocupada.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { decidirAoCarregar, haTrabalhoNaoSalvo, type EstadoParaDecidir } from '../decisao';

const vazio: EstadoParaDecidir = {
  temImagem: false,
  totalDeMarcas: 0,
  totalDeContornos: 0,
  ultimaGravacao: null,
};

describe('decidirAoCarregar', () => {
  it('abre direto na primeira imagem do dia (sem imagem aberta)', () => {
    expect(decidirAoCarregar(vazio)).toBe('abrir');
  });

  it('abre direto com imagem aberta mas sem nenhuma marcação nem contorno', () => {
    expect(decidirAoCarregar({ ...vazio, temImagem: true })).toBe('abrir');
  });

  it('pergunta com imagem aberta e marcações', () => {
    expect(decidirAoCarregar({ ...vazio, temImagem: true, totalDeMarcas: 3 })).toBe('perguntar');
  });

  it('pergunta com imagem aberta e só contornos (proposta de modelo sem marca)', () => {
    expect(decidirAoCarregar({ ...vazio, temImagem: true, totalDeContornos: 1 })).toBe('perguntar');
  });

  it('marcação sem imagem (estado inconsistente) não pergunta: não há cena a perder', () => {
    expect(decidirAoCarregar({ ...vazio, totalDeMarcas: 5 })).toBe('abrir');
  });
});

describe('haTrabalhoNaoSalvo', () => {
  it('avisa quando há marcação e nunca gravou desta imagem', () => {
    expect(haTrabalhoNaoSalvo({ ...vazio, temImagem: true, totalDeMarcas: 1 })).toBe(true);
  });

  it('não avisa quando a cena foi gravada', () => {
    expect(
      haTrabalhoNaoSalvo({
        ...vazio,
        temImagem: true,
        totalDeMarcas: 1,
        ultimaGravacao: Date.now(),
      })
    ).toBe(false);
  });

  it('não avisa sem marcação — não há o que perder', () => {
    expect(haTrabalhoNaoSalvo({ ...vazio, temImagem: true })).toBe(false);
  });
});
