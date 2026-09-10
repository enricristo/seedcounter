import { describe, it, expect } from 'vitest';
import {
  arestaMaisProxima,
  contornoSobOPonto,
  inserirVertice,
  pontoNoPoligono,
  verticeMaisProximo,
  type Ponto,
} from '../edicao-de-contorno';

// Um quadrado de 100 de lado, com origem em (100, 100).
const QUADRADO: Ponto[] = [
  [100, 100],
  [200, 100],
  [200, 200],
  [100, 200],
];

describe('verticeMaisProximo', () => {
  it('acha o vértice dentro do alcance', () => {
    const r = verticeMaisProximo(QUADRADO, [203, 98], 6);
    expect(r?.indice).toBe(1);
    expect(r?.distancia).toBeCloseTo(Math.hypot(3, 2));
  });

  it('fora do alcance devolve null — o clique não é "quase" um vértice', () => {
    expect(verticeMaisProximo(QUADRADO, [210, 100], 6)).toBeNull();
  });

  it('entre dois vértices, escolhe o mais próximo', () => {
    expect(verticeMaisProximo(QUADRADO, [140, 100], 50)?.indice).toBe(0);
    expect(verticeMaisProximo(QUADRADO, [160, 100], 50)?.indice).toBe(1);
  });
});

describe('arestaMaisProxima', () => {
  it('acha a aresta e o pé da perpendicular', () => {
    // Um pouco acima do lado de cima, no meio.
    const r = arestaMaisProxima(QUADRADO, [150, 96], 6);
    expect(r?.aresta).toBe(0);
    expect(r?.ponto[0]).toBeCloseTo(150);
    expect(r?.ponto[1]).toBeCloseTo(100);
    expect(r?.distancia).toBeCloseTo(4);
  });

  it('a última aresta fecha o polígono (último vértice ao primeiro)', () => {
    // Lado esquerdo: do vértice 3 (100,200) ao vértice 0 (100,100).
    const r = arestaMaisProxima(QUADRADO, [104, 150], 6);
    expect(r?.aresta).toBe(3);
    expect(r?.ponto).toEqual([100, 150]);
  });

  it('o pé fica preso ao segmento: além do extremo, a distância é até o vértice', () => {
    // Na linha do lado de cima, mas 10 px além do vértice 1.
    const r = arestaMaisProxima(QUADRADO, [210, 100], 12);
    expect(r?.distancia).toBeCloseTo(10);
    expect(r?.ponto).toEqual([200, 100]);
  });

  it('fora do alcance devolve null', () => {
    expect(arestaMaisProxima(QUADRADO, [150, 80], 6)).toBeNull();
  });
});

describe('inserirVertice', () => {
  it('insere depois do vértice que abre a aresta', () => {
    const r = inserirVertice(QUADRADO, 0, [150, 100]);
    expect(r).toEqual([
      [100, 100],
      [150, 100],
      [200, 100],
      [200, 200],
      [100, 200],
    ]);
  });

  it('na última aresta, entra no fim — entre o último e o primeiro', () => {
    const r = inserirVertice(QUADRADO, 3, [100, 150]);
    expect(r[r.length - 1]).toEqual([100, 150]);
    expect(r.length).toBe(5);
  });

  it('não altera o polígono original', () => {
    const copia = QUADRADO.map((p) => [...p] as Ponto);
    inserirVertice(QUADRADO, 1, [200, 150]);
    expect(QUADRADO).toEqual(copia);
  });

  it('inserir na aresta e arrastar mantém o polígono simples', () => {
    // O caso de uso real: clicar na borda, puxar para fora. O vértice novo
    // fica entre os dois vizinhos certos, então o contorno não se cruza.
    const r = inserirVertice(QUADRADO, 0, [150, 100]);
    r[1] = [150, 80];
    // O ponto puxado fica dentro do novo polígono e fora do antigo.
    expect(pontoNoPoligono(150, 90, r)).toBe(true);
    expect(pontoNoPoligono(150, 90, QUADRADO)).toBe(false);
  });
});

describe('contornoSobOPonto', () => {
  const grande = { id: 1, polygon_points: QUADRADO };
  const pequeno: { id: number; polygon_points: Ponto[] } = {
    id: 2,
    polygon_points: [
      [120, 120],
      [140, 120],
      [140, 140],
      [120, 140],
    ],
  };

  it('dentro de um só, devolve esse', () => {
    expect(contornoSobOPonto([grande, pequeno], [180, 180])?.id).toBe(1);
  });

  it('dentro de dois sobrepostos, devolve o menor — é o que está por cima', () => {
    expect(contornoSobOPonto([grande, pequeno], [130, 130])?.id).toBe(2);
  });

  it('fora de todos devolve null', () => {
    expect(contornoSobOPonto([grande, pequeno], [50, 50])).toBeNull();
  });
});

describe('arraste suave', () => {
  // Um polígono regular de 48 lados, raio 100 — o que a onda entrega.
  const N = 48;
  const CIRCULO: Ponto[] = Array.from({ length: N }, (_, i) => [
    100 * Math.cos((2 * Math.PI * i) / N),
    100 * Math.sin((2 * Math.PI * i) / N),
  ]);

  it('o perímetro do 48-gono de raio 100 é quase 2π·100', async () => {
    const { perimetro } = await import('../edicao-de-contorno');
    expect(perimetro(CIRCULO)).toBeCloseTo(2 * Math.PI * 100, -1);
  });

  it('o vértice puxado chega inteiro ao destino; o oposto não se move', async () => {
    const { moverVerticeSuave, raioDeInfluencia } = await import('../edicao-de-contorno');
    const r = moverVerticeSuave(CIRCULO, 0, [130, 0], raioDeInfluencia(CIRCULO));
    expect(r[0][0]).toBeCloseTo(130);
    expect(r[0][1]).toBeCloseTo(0);
    expect(r[N / 2]).toEqual(CIRCULO[N / 2]);
  });

  it('os vizinhos acompanham com peso decrescente, simétrico dos dois lados', async () => {
    const { pesosDeInfluencia, raioDeInfluencia } = await import('../edicao-de-contorno');
    const w = pesosDeInfluencia(CIRCULO, 0, raioDeInfluencia(CIRCULO));
    expect(w[0]).toBe(1);
    expect(w[1]).toBeGreaterThan(w[2]);
    expect(w[2]).toBeGreaterThan(w[3]);
    expect(w[1]).toBeCloseTo(w[N - 1]);
    expect(w[3]).toBeCloseTo(w[N - 3]);
    // Um oitavo do perímetro para cada lado = seis vértices de 48.
    expect(w[5]).toBeGreaterThan(0);
    expect(w[6]).toBe(0);
    expect(w[N - 6]).toBe(0);
  });

  it('raio zero é o arraste rígido: só o vértice muda', async () => {
    const { moverVerticeSuave } = await import('../edicao-de-contorno');
    const r = moverVerticeSuave(CIRCULO, 0, [130, 0], 0);
    expect(r[0]).toEqual([130, 0]);
    expect(r[1]).toEqual(CIRCULO[1]);
    expect(r[N - 1]).toEqual(CIRCULO[N - 1]);
  });

  it('não deixa espinho: a aresta do vértice puxado não cresce mais que a vizinha', async () => {
    const { moverVerticeSuave, raioDeInfluencia } = await import('../edicao-de-contorno');
    const r = moverVerticeSuave(CIRCULO, 0, [140, 0], raioDeInfluencia(CIRCULO));
    const aresta = (i: number) => Math.hypot(r[(i + 1) % N][0] - r[i][0], r[(i + 1) % N][1] - r[i][1]);
    // No arraste rígido a aresta 0 dispararia (40 px de puxão numa aresta de 13).
    // No suave, as arestas perto do vértice puxado ficam da mesma ordem.
    expect(aresta(0) / aresta(3)).toBeLessThan(1.6);
  });

  it('aplicado sobre o polígono já deformado, o arraste em passos DERIVA — por isso o app aplica sobre o original', async () => {
    const { moverVerticeSuave, raioDeInfluencia } = await import('../edicao-de-contorno');
    // O mouse entrega um movimento por evento. Se cada um for aplicado sobre
    // o resultado do anterior, o raio (que vem do perímetro, que cresceu) e
    // as distâncias mudam a cada passo, e dez passos de 4 px não chegam onde
    // um passo de 40 chega. O App guarda o polígono do início do gesto e
    // recalcula a partir dele: aí é exato por construção.
    const raio = raioDeInfluencia(CIRCULO);
    const deUmaVez = moverVerticeSuave(CIRCULO, 0, [140, 0], raio);
    let deformando: Ponto[] = CIRCULO;
    let sobreOriginal: Ponto[] = CIRCULO;
    for (let k = 1; k <= 10; k++) {
      deformando = moverVerticeSuave(deformando, 0, [100 + 4 * k, 0], raioDeInfluencia(deformando));
      sobreOriginal = moverVerticeSuave(CIRCULO, 0, [100 + 4 * k, 0], raio);
    }
    const desvio = (a: Ponto[]) => Math.max(...a.map((p, i) => Math.hypot(p[0] - deUmaVez[i][0], p[1] - deUmaVez[i][1])));
    expect(desvio(deformando)).toBeGreaterThan(1);
    expect(desvio(sobreOriginal)).toBeCloseTo(0);
  });
});
