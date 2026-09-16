import { describe, it, expect } from 'vitest';
import {
  agregarPerfil,
  agregarPorClasse,
  compararComPerfilMedido,
  type MedidaDeUmObjeto,
} from '../perfil-medido';

function medida(overrides: Partial<MedidaDeUmObjeto> = {}): MedidaDeUmObjeto {
  return {
    caminho: 'a.jpg',
    classe: 'viavel',
    areaPx: 100,
    feretMaxPx: 12,
    feretMinPx: 8,
    solidez: 0.95,
    razaoDeAspecto: 1.5,
    ...overrides,
  };
}

describe('agregarPerfil', () => {
  it('mediana e percentis 5/95 de uma série conhecida', () => {
    // 1..21 — mediana = 11; p5 e p95 por interpolação linear (método numpy "linear").
    const medidas = Array.from({ length: 21 }, (_, i) => medida({ areaPx: i + 1 }));
    const perfil = agregarPerfil(medidas);
    expect(perfil.n).toBe(21);
    expect(perfil.areaPx.mediana).toBe(11);
    expect(perfil.areaPx.p5).toBeCloseTo(2, 5);
    expect(perfil.areaPx.p95).toBeCloseTo(20, 5);
  });

  it('n < 20 fica marcado insuficiente; n >= 20 não', () => {
    const poucas = Array.from({ length: 19 }, () => medida());
    const bastantes = Array.from({ length: 20 }, () => medida());
    expect(agregarPerfil(poucas).insuficiente).toBe(true);
    expect(agregarPerfil(bastantes).insuficiente).toBe(false);
  });

  it('lista vazia devolve n=0 e faixas NaN, sem lançar', () => {
    const perfil = agregarPerfil([]);
    expect(perfil.n).toBe(0);
    expect(perfil.insuficiente).toBe(true);
    expect(Number.isNaN(perfil.areaPx.mediana)).toBe(true);
  });
});

describe('agregarPorClasse', () => {
  it('agrupa por classe e agrega cada grupo separadamente', () => {
    const medidas = [
      ...Array.from({ length: 25 }, () => medida({ classe: 'com mofo', areaPx: 50 })),
      ...Array.from({ length: 5 }, () => medida({ classe: 'sem mofo', areaPx: 200 })),
    ];
    const porClasse = agregarPorClasse(medidas);
    expect([...porClasse.keys()].sort()).toEqual(['com mofo', 'sem mofo']);
    expect(porClasse.get('com mofo')!.n).toBe(25);
    expect(porClasse.get('com mofo')!.insuficiente).toBe(false);
    expect(porClasse.get('sem mofo')!.n).toBe(5);
    expect(porClasse.get('sem mofo')!.insuficiente).toBe(true);
  });
});

describe('compararComPerfilMedido', () => {
  it('sem perfil (null) não decide nada: nota vazia', () => {
    const r = compararComPerfilMedido({ solidez: 0.5, razaoDeAspecto: 1 }, null);
    expect(r.perfil).toBeNull();
    expect(r.nota).toBe('');
    expect(r.solidezForaDaFaixa).toBe(false);
  });

  it('dentro da faixa: nota informa n, sem alarme', () => {
    const medidas = Array.from({ length: 30 }, (_, i) => medida({ solidez: 0.9 + (i % 5) * 0.01 }));
    const perfil = agregarPerfil(medidas);
    const r = compararComPerfilMedido({ solidez: 0.92, razaoDeAspecto: 1.5 }, perfil);
    expect(r.solidezForaDaFaixa).toBe(false);
    expect(r.nota).toContain('Dentro da faixa medida');
    expect(r.nota).toContain('n=30');
  });

  it('fora da faixa: nota nomeia a métrica e a faixa, nunca "aglomerado" nem "quebrada"', () => {
    const medidas = Array.from({ length: 30 }, () => medida({ solidez: 0.95 }));
    const perfil = agregarPerfil(medidas);
    const r = compararComPerfilMedido({ solidez: 0.5, razaoDeAspecto: 1.5 }, perfil);
    expect(r.solidezForaDaFaixa).toBe(true);
    expect(r.nota).toContain('Fora da faixa medida');
    expect(r.nota).toContain('solidez');
    expect(r.nota.toLowerCase()).not.toContain('aglomerado');
    expect(r.nota.toLowerCase()).not.toContain('quebrada');
  });

  it('amostra insuficiente aparece na nota, mesmo dentro da faixa — não é escondida', () => {
    const medidas = Array.from({ length: 5 }, () => medida({ solidez: 0.9 }));
    const perfil = agregarPerfil(medidas);
    const r = compararComPerfilMedido({ solidez: 0.9, razaoDeAspecto: 1.5 }, perfil);
    expect(perfil.insuficiente).toBe(true);
    expect(r.nota).toContain('amostra pequena');
    expect(r.nota).toContain('n=5');
  });
});
