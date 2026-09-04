// =============================================================================
// Região de interesse e planejamento das janelas de inferência.
//
// O teste mais importante daqui é o de EQUIVALÊNCIA: com a região igual à
// imagem inteira, `planejarJanelas` tem que produzir exatamente as mesmas
// janelas que o laço embutido em `detectWithYolo` produzia antes. Se isso
// mudar, a contagem de todo mundo muda em silêncio.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  LADO_MINIMO_DA_REGIAO,
  contarJanelas,
  fracaoDaImagem,
  limitarRegiao,
  planejarJanelas,
  regiaoDeDoisPontos,
  regiaoUtilizavel,
  type Janela,
} from '../region';

/** O laço original de detectWithYolo, preservado como referência. */
function janelasComoAntes(srcW: number, srcH: number, tile: number, overlap: number): Janela[] {
  const step = Math.max(1, Math.round(tile * (1 - overlap)));
  const tiles: Janela[] = [];
  if (srcW <= tile && srcH <= tile) {
    tiles.push({ x: 0, y: 0, w: srcW, h: srcH });
  } else {
    for (let y = 0; y < srcH; y += step) {
      for (let x = 0; x < srcW; x += step) {
        const w = Math.min(tile, srcW - x);
        const h = Math.min(tile, srcH - y);
        if (w > 8 && h > 8) tiles.push({ x, y, w, h });
      }
    }
  }
  return tiles;
}

describe('regiaoDeDoisPontos', () => {
  it('aceita arraste em qualquer direção', () => {
    // Arrastar da direita para a esquerda é tão natural quanto o contrário.
    const canonica = { x: 10, y: 20, width: 90, height: 60 };
    expect(regiaoDeDoisPontos(10, 20, 100, 80)).toEqual(canonica);
    expect(regiaoDeDoisPontos(100, 80, 10, 20)).toEqual(canonica);
    expect(regiaoDeDoisPontos(100, 20, 10, 80)).toEqual(canonica);
    expect(regiaoDeDoisPontos(10, 80, 100, 20)).toEqual(canonica);
  });

  it('clique sem arrastar dá região de área zero', () => {
    expect(regiaoDeDoisPontos(50, 50, 50, 50)).toEqual({ x: 50, y: 50, width: 0, height: 0 });
  });
});

describe('limitarRegiao', () => {
  it('não muda uma região inteiramente dentro da imagem', () => {
    expect(limitarRegiao({ x: 10, y: 10, width: 100, height: 50 }, 500, 500)).toEqual({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });
  });

  it('corta o que passa das bordas', () => {
    expect(limitarRegiao({ x: -20, y: -30, width: 100, height: 100 }, 500, 500)).toEqual({
      x: 0,
      y: 0,
      width: 80,
      height: 70,
    });
    expect(limitarRegiao({ x: 450, y: 460, width: 200, height: 200 }, 500, 500)).toEqual({
      x: 450,
      y: 460,
      width: 50,
      height: 40,
    });
  });

  it('devolve null quando não sobra nada', () => {
    // Fora da imagem, e clique sem arrastar. Quem chama precisa distinguir
    // isso de "região vazia" — inferir num retângulo de área zero devolve
    // nenhuma detecção e parece que o modelo falhou.
    expect(limitarRegiao({ x: 600, y: 600, width: 50, height: 50 }, 500, 500)).toBeNull();
    expect(limitarRegiao({ x: 10, y: 10, width: 0, height: 0 }, 500, 500)).toBeNull();
    expect(limitarRegiao({ x: -100, y: 10, width: 50, height: 50 }, 500, 500)).toBeNull();
  });

  it('devolve pixels inteiros', () => {
    const r = limitarRegiao({ x: 10.7, y: 20.2, width: 30.6, height: 40.9 }, 500, 500)!;
    for (const v of [r.x, r.y, r.width, r.height]) expect(Number.isInteger(v)).toBe(true);
    // Arredonda para FORA: perder uma fatia da borda perderia semente.
    expect(r.x).toBe(10);
    expect(r.x + r.width).toBe(42);
  });
});

describe('regiaoUtilizavel', () => {
  it('rejeita arraste curto demais e null', () => {
    expect(regiaoUtilizavel(null)).toBe(false);
    expect(regiaoUtilizavel({ x: 0, y: 0, width: 4, height: 300 })).toBe(false);
    expect(regiaoUtilizavel({ x: 0, y: 0, width: 300, height: 4 })).toBe(false);
  });

  it('aceita a partir do lado mínimo', () => {
    const lado = LADO_MINIMO_DA_REGIAO;
    expect(regiaoUtilizavel({ x: 0, y: 0, width: lado, height: lado })).toBe(true);
  });
});

describe('planejarJanelas', () => {
  it('reproduz exatamente o laço antigo para a imagem inteira', () => {
    // A garantia de que extrair o laço não mudou contagem de ninguém.
    for (const [w, h] of [
      [800, 600],
      [960, 960],
      [4000, 3000],
      [1500, 900],
      [2000, 5000],
    ]) {
      for (const overlap of [0, 0.2, 0.4]) {
        expect(
          planejarJanelas({ x: 0, y: 0, width: w, height: h }, 960, overlap),
          `${w}x${h} overlap=${overlap}`
        ).toEqual(janelasComoAntes(w, h, 960, overlap));
      }
    }
  });

  it('imagem menor que a janela vira uma janela só', () => {
    expect(planejarJanelas({ x: 0, y: 0, width: 400, height: 300 }, 960, 0.2)).toEqual([
      { x: 0, y: 0, w: 400, h: 300 },
    ]);
  });

  it('as janelas saem em coordenadas absolutas da imagem', () => {
    // decodeOutput já devolve as detecções ao espaço da imagem usando estas
    // coordenadas; convertê-las depois seria uma segunda chance de errar.
    const janelas = planejarJanelas({ x: 1000, y: 500, width: 300, height: 200 }, 960, 0.2);
    expect(janelas).toEqual([{ x: 1000, y: 500, w: 300, h: 200 }]);
  });

  it('cobre toda a região, sem buraco', () => {
    const regiao = { x: 100, y: 50, width: 2500, height: 1800 };
    const janelas = planejarJanelas(regiao, 960, 0.2);
    // Um ponto qualquer da região tem que cair em pelo menos uma janela.
    for (const px of [100, 900, 1600, 2400, 2599]) {
      for (const py of [50, 700, 1300, 1849]) {
        const cobre = janelas.some(
          (j) => px >= j.x && px < j.x + j.w && py >= j.y && py < j.y + j.h
        );
        expect(cobre, `(${px}, ${py}) descoberto`).toBe(true);
      }
    }
  });

  it('nenhuma janela escapa da região', () => {
    const regiao = { x: 100, y: 50, width: 2500, height: 1800 };
    for (const j of planejarJanelas(regiao, 960, 0.2)) {
      expect(j.x).toBeGreaterThanOrEqual(regiao.x);
      expect(j.y).toBeGreaterThanOrEqual(regiao.y);
      expect(j.x + j.w).toBeLessThanOrEqual(regiao.x + regiao.width);
      expect(j.y + j.h).toBeLessThanOrEqual(regiao.y + regiao.height);
    }
  });

  it('as janelas se sobrepõem — semente na emenda não pode ser cortada', () => {
    const janelas = planejarJanelas({ x: 0, y: 0, width: 3000, height: 960 }, 960, 0.2);
    const linha = janelas.filter((j) => j.y === 0).sort((a, b) => a.x - b.x);
    expect(linha.length).toBeGreaterThan(1);
    for (let i = 1; i < linha.length; i++) {
      expect(linha[i].x).toBeLessThan(linha[i - 1].x + linha[i - 1].w);
    }
  });

  it('descarta faixa fina de borda', () => {
    // Faixa de poucos pixels não tem contexto para o modelo e só custa tempo.
    const janelas = planejarJanelas({ x: 0, y: 0, width: 1541, height: 1000 }, 960, 0.2);
    for (const j of janelas) {
      expect(j.w).toBeGreaterThan(8);
      expect(j.h).toBeGreaterThan(8);
    }
  });
});

describe('custo antes de rodar', () => {
  it('a região reduz drasticamente o número de janelas', () => {
    // É o ponto inteiro da funcionalidade: um scan a 3600 dpi varrido por
    // inteiro são centenas de janelas; uma região são poucas.
    const inteira = contarJanelas({ x: 0, y: 0, width: 6000, height: 4000 }, 960, 0.2);
    const pedaco = contarJanelas({ x: 2000, y: 1500, width: 900, height: 700 }, 960, 0.2);
    expect(inteira).toBeGreaterThan(30);
    expect(pedaco).toBe(1);
  });

  it('a fração da imagem fica entre 0 e 1', () => {
    expect(fracaoDaImagem({ x: 0, y: 0, width: 500, height: 500 }, 1000, 1000)).toBeCloseTo(0.25);
    expect(fracaoDaImagem({ x: 0, y: 0, width: 2000, height: 2000 }, 1000, 1000)).toBe(1);
    expect(fracaoDaImagem({ x: 0, y: 0, width: 10, height: 10 }, 0, 0)).toBe(0);
  });
});
