import { describe, it, expect } from 'vitest';
import { foraDaMedia, MINIMO_POR_CLASSE } from '../fora-da-media';
import type { ObjetoMedido } from '../fora-da-media';

/** Um retângulo de `l × a` na posição i — área e razão de aspecto controladas. */
const retangulo = (i: number, l: number, a: number): [number, number][] => {
  const x = i * 1000;
  return [
    [x, 0],
    [x + l, 0],
    [x + l, a],
    [x, a],
  ];
};

const objeto = (i: number, classe: string, l: number, a: number): ObjetoMedido => ({
  chave: `c${i}`,
  classe,
  contorno: retangulo(i, l, a),
});

/** Uma população homogênea: `n` sementes de 40×20 na mesma classe. */
const populacao = (n: number, classe = 'viable', l = 40, a = 20) =>
  Array.from({ length: n }, (_, i) => objeto(i, classe, l, a));

describe('fora da média da classe', () => {
  it('cena homogênea não acusa ninguém', () => {
    // A resposta certa na maioria das imagens boas é lista vazia. Um detector
    // que sempre aponta alguém treina a pessoa a ignorá-lo.
    expect(foraDaMedia(populacao(20))).toEqual([]);
  });

  it('acha o contorno que pegou só o núcleo — área muito menor', () => {
    // O caso da orquídea: o contorno parou no embrião e deixou a testa fora.
    const itens = [...populacao(20), objeto(99, 'viable', 10, 5)];
    const achados = foraDaMedia(itens);
    expect(achados).toHaveLength(1);
    expect(achados[0].chave).toBe('c99');
    expect(achados[0].motivo).toBe('area-pequena');
    expect(achados[0].texto).toContain('só uma parte da semente');
  });

  it('acha o contorno grande demais — duas sementes num contorno', () => {
    const itens = [...populacao(20), objeto(99, 'viable', 90, 45)];
    const achados = foraDaMedia(itens);
    expect(achados[0].chave).toBe('c99');
    expect(achados[0].motivo).toBe('area-grande');
    expect(achados[0].texto).toContain('mais de uma semente');
  });

  it('acha a forma errada mesmo com a área certa', () => {
    // 80×10 tem a mesma área de 40×20, e não é a mesma coisa: contorno vazado,
    // ou duas sementes em fila.
    const itens = [...populacao(20), objeto(99, 'viable', 80, 10)];
    const achados = foraDaMedia(itens);
    expect(achados[0].chave).toBe('c99');
    expect(achados[0].motivo).toBe('alongado');
  });

  it('a régua é POR CLASSE: inviável menor não vira outlier', () => {
    // Em orquídea a inviável é a testa vazia, menor que a viável. Com uma
    // régua só, toda inviável seria acusada.
    const itens = [
      ...populacao(12, 'viable', 40, 20),
      ...Array.from({ length: 12 }, (_, i) => objeto(100 + i, 'inviable', 20, 10)),
    ];
    expect(foraDaMedia(itens)).toEqual([]);
  });

  it('dentro de uma classe pequena, cai na régua da cena — e diz isso', () => {
    const itens = [
      ...populacao(20, 'viable', 40, 20),
      objeto(200, 'inviable', 4, 2), // classe com um só: sem população própria
    ];
    const achados = foraDaMedia(itens);
    expect(achados).toHaveLength(1);
    expect(achados[0].reguaDaCena).toBe(true);
    expect(achados[0].texto).toContain('comparado com a cena inteira');
  });

  it('ordena do mais estranho para o menos', () => {
    const itens = [
      ...populacao(20),
      objeto(98, 'viable', 22, 11), // pouco menor
      objeto(99, 'viable', 6, 3), // muito menor
    ];
    const achados = foraDaMedia(itens);
    expect(achados[0].chave).toBe('c99');
    expect(achados[0].escore).toBeGreaterThan(achados[1].escore);
  });

  it('cena pequena demais não tem população: ninguém é julgado', () => {
    expect(foraDaMedia(populacao(MINIMO_POR_CLASSE - 1))).toEqual([]);
  });

  it('contorno degenerado é ignorado, não quebra', () => {
    const itens: ObjetoMedido[] = [
      ...populacao(20),
      { chave: 'ruim', classe: 'viable', contorno: [[0, 0]] },
      { chave: 'vazio', classe: 'viable', contorno: [] },
    ];
    const achados = foraDaMedia(itens);
    expect(achados.some((a) => a.chave === 'ruim' || a.chave === 'vazio')).toBe(false);
  });

  it('não acusa ninguém por MAD zero: cena de clones exatos', () => {
    // Vinte retângulos idênticos têm MAD zero. Sem piso, qualquer diferença
    // viraria escore infinito — e a lista inteira apareceria como suspeita.
    const itens = [...populacao(20), objeto(99, 'viable', 41, 20)];
    expect(foraDaMedia(itens)).toEqual([]);
  });
});
