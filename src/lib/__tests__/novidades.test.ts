// =============================================================================
// Notas de versão.
//
// Dois erros clássicos moram aqui, e os dois só aparecem tarde: comparar versão
// como texto (que quebra na décima publicação) e despejar o histórico inteiro
// em quem abriu o aplicativo pela primeira vez.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  ROTULOS,
  VERSOES,
  compararVersoes,
  decidirAbertura,
  novidadesDesde,
  versaoAtual,
} from '../novidades';

describe('comparação de versões', () => {
  it('compara por número, não como texto', () => {
    // Como texto, '3.10.0' < '3.9.0' — o erro so aparece na decima publicacao.
    expect(compararVersoes('3.10.0', '3.9.0')).toBe(1);
    expect(compararVersoes('3.9.0', '3.10.0')).toBe(-1);
  });

  it('trata igualdade e partes faltando', () => {
    expect(compararVersoes('3.2.0', '3.2.0')).toBe(0);
    expect(compararVersoes('3.2', '3.2.0')).toBe(0);
    expect(compararVersoes('4', '3.9.9')).toBe(1);
  });

  it('não quebra com texto inválido', () => {
    expect(compararVersoes('abc', '1.0.0')).toBe(-1);
  });
});

describe('quando abrir', () => {
  it('NÃO abre na primeira visita', () => {
    // Quem abre pela primeira vez quer contar sementes, não ler o histórico de
    // um programa que ainda não usou.
    expect(decidirAbertura('3.2.0', null).abrir).toBe(false);
  });

  it('abre quando a versão avançou desde a última visita', () => {
    const r = decidirAbertura('3.2.0', '3.1.0');
    expect(r.abrir).toBe(true);
    expect(r.versoes.map((v) => v.numero)).toContain('3.2.0');
  });

  it('não abre quando já viu a versão atual', () => {
    expect(decidirAbertura('3.2.0', '3.2.0').abrir).toBe(false);
  });

  it('não abre quando a pessoa viu uma versão MAIS NOVA', () => {
    // Acontece ao voltar para um ambiente mais antigo; mostrar o passado como
    // novidade seria confuso.
    expect(decidirAbertura('3.2.0', '3.5.0').abrir).toBe(false);
  });

  it('não anuncia versão futura que ainda não está rodando', () => {
    // Um item escrito antes da publicacao nao pode vazar para quem esta numa
    // versao anterior.
    const r = decidirAbertura('3.1.0', '3.0.0');
    expect(r.versoes.every((v) => compararVersoes(v.numero, '3.1.0') <= 0)).toBe(true);
  });
});

describe('novidadesDesde', () => {
  it('lista só o que veio depois', () => {
    expect(novidadesDesde('3.2.0')).toEqual([]);
    expect(novidadesDesde('3.0.0').length).toBeGreaterThan(0);
  });

  it('sem referência, não lista nada', () => {
    expect(novidadesDesde(null)).toEqual([]);
  });
});

describe('o conteúdo', () => {
  it('há pelo menos uma versão, e ela é a atual', () => {
    expect(VERSOES.length).toBeGreaterThan(0);
    expect(versaoAtual()).toBe(VERSOES[0]);
  });

  it('está em ordem decrescente — entrada nova vai no topo', () => {
    for (let i = 1; i < VERSOES.length; i++) {
      expect(compararVersoes(VERSOES[i - 1].numero, VERSOES[i].numero)).toBe(1);
    }
  });

  it('toda mudança tem tipo conhecido e título', () => {
    for (const versao of VERSOES) {
      expect(versao.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(versao.mudancas.length).toBeGreaterThan(0);
      for (const m of versao.mudancas) {
        expect(Object.keys(ROTULOS)).toContain(m.tipo);
        expect(m.titulo.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
