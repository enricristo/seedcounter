// =============================================================================
// Detecção de aglomerado.
//
// O teste que justifica o módulo é o último: rodar a onda nas cenas com
// sementes encostadas e verificar que os contornos que ENGOLIRAM a vizinha
// agora são marcados. Hoje 28 de 30 passam como confiáveis.
//
// Os contornos aqui são construídos por geometria, não por segmentação, para
// que a forma testada seja exatamente a pretendida.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  analisarContorno,
  areaDoPoligono,
  fechoConvexo,
  maiorDefeitoDeConvexidade,
  medianaDaCena,
  type Ponto,
} from '../aglomerado';
import { gerarCenaSintetica } from '../synthetic-scene';
import { segmentarPorClique } from '../region-growing';

// ---------------------------------------------------------------------------

function elipse(cx: number, cy: number, a: number, b: number, n = 64, angulo = 0): Ponto[] {
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  const pts: Ponto[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const u = a * Math.cos(t);
    const v = b * Math.sin(t);
    pts.push([cx + u * cos - v * sen, cy + u * sen + v * cos]);
  }
  return pts;
}

/**
 * Contorno de duas elipses que se tocam, aproximado pela envoltória: para cada
 * ângulo, o ponto mais distante do centro comum entre as duas formas.
 *
 * Não é a união exata, mas reproduz o que importa — a cintura no ponto de
 * contato, que é o sinal que o módulo tem que enxergar.
 */
function parEncostado(raio: number, separacao: number, n = 96): Ponto[] {
  const cx = 0;
  const pts: Ponto[] = [];
  const c1 = -separacao / 2;
  const c2 = separacao / 2;
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    // Distância até a borda da união, marchando do centro.
    let melhor = 0;
    for (let r = raio * 2.2; r > 0; r -= 0.5) {
      const x = cx + dx * r;
      const y = dy * r;
      const dentro1 = (x - c1) ** 2 + y ** 2 <= raio * raio;
      const dentro2 = (x - c2) ** 2 + y ** 2 <= raio * raio;
      if (dentro1 || dentro2) {
        melhor = r;
        break;
      }
    }
    pts.push([cx + dx * melhor, dy * melhor]);
  }
  return pts;
}

// ---------------------------------------------------------------------------

describe('geometria', () => {
  it('calcula a área do polígono', () => {
    const quadrado: Ponto[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(areaDoPoligono(quadrado)).toBeCloseTo(100, 5);
    // Sentido invertido dá a mesma área — o sinal não interessa aqui.
    expect(areaDoPoligono([...quadrado].reverse())).toBeCloseTo(100, 5);
  });

  it('a área da elipse bate com πab', () => {
    // 64 lados subestimam levemente; 1% é a folga da discretização.
    expect(areaDoPoligono(elipse(0, 0, 30, 20))).toBeCloseTo(Math.PI * 30 * 20, -2);
  });

  it('o fecho de uma forma convexa é ela mesma', () => {
    const e = elipse(0, 0, 25, 25, 32);
    const fecho = fechoConvexo(e);
    expect(fecho.length).toBe(32);
    expect(areaDoPoligono(fecho)).toBeCloseTo(areaDoPoligono(e), -1);
  });

  it('o fecho ignora os pontos de dentro', () => {
    const quadrado: Ponto[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5], // dentro
      [3, 7], // dentro
    ];
    expect(fechoConvexo(quadrado).length).toBe(4);
  });

  it('forma convexa quase não tem defeito', () => {
    const e = elipse(0, 0, 30, 20);
    expect(maiorDefeitoDeConvexidade(e)).toBeLessThan(1);
  });

  it('a cintura de um par vira um defeito fundo', () => {
    const par = parEncostado(25, 38);
    const d = maiorDefeitoDeConvexidade(par);
    expect(d).toBeGreaterThan(4);
  });
});

describe('medianaDaCena', () => {
  it('não declara mediana com amostras de menos', () => {
    // Dar autoridade a três sementes seria dar autoridade a ruído.
    expect(medianaDaCena([100, 110, 105])).toBeNaN();
  });

  it('resiste a alguns contornos errados no meio', () => {
    const areas = [100, 102, 98, 101, 99, 103, 5000, 4800];
    expect(medianaDaCena(areas)).toBeGreaterThan(95);
    expect(medianaDaCena(areas)).toBeLessThan(110);
  });

  it('ignora valores inválidos', () => {
    expect(medianaDaCena([100, 102, NaN, 98, -5, 101, 99])).toBeCloseTo(100, 0);
  });
});

describe('analisarContorno', () => {
  it('aceita uma semente isolada', () => {
    const s = analisarContorno(elipse(0, 0, 30, 24), Math.PI * 30 * 24);
    expect(s.veredito).toBe('semente');
    expect(s.solidez).toBeGreaterThan(0.97);
  });

  it('marca um par pela forma, mesmo sem referência de tamanho', () => {
    // É o caso de quem acabou de abrir a imagem e ainda não curou nada.
    const s = analisarContorno(parEncostado(25, 38));
    expect(s.veredito).toBe('aglomerado');
    expect(s.motivo).toMatch(/cintura|reentrância/);
  });

  it('marca pela área quando ela é o dobro da mediana', () => {
    // Duas sementes que se tocam de lado quase não têm cintura visível; aqui
    // quem denuncia é o tamanho.
    const grande = elipse(0, 0, 42, 34);
    const s = analisarContorno(grande, Math.PI * 30 * 24);
    expect(s.veredito).toBe('aglomerado');
    expect(s.sementesEstimadas).toBe(2);
    expect(s.motivo).toMatch(/mediana/);
  });

  it('diz quantas sementes parecem estar ali', () => {
    const s = analisarContorno(elipse(0, 0, 52, 42), Math.PI * 30 * 24);
    expect(s.sementesEstimadas).toBe(3);
    expect(s.motivo).toMatch(/Parecem 3/);
  });

  it('não avalia contorno curto demais em vez de chutar', () => {
    const s = analisarContorno([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(s.veredito).toBe('nao-avaliavel');
  });

  it('funciona sem referência de área nenhuma', () => {
    const s = analisarContorno(elipse(0, 0, 30, 24));
    expect(s.veredito).toBe('semente');
    expect(s.razaoDeArea).toBeNaN();
    expect(s.motivo).toMatch(/sem referência/);
  });

  it('a profundidade é comparável entre tamanhos diferentes', () => {
    // Normalizar pelo raio equivalente é o que faz o limiar servir para soja e
    // para orquídea ao mesmo tempo.
    const pequeno = analisarContorno(parEncostado(12, 18));
    const grande = analisarContorno(parEncostado(60, 90));
    expect(pequeno.profundidadeRelativa).toBeCloseTo(grande.profundidadeRelativa, 1);
  });
});

describe('sobre os contornos que a onda realmente produz', () => {
  // Trinta segmentações de verdade não cabem no limite padrão de 5 s do
  // vitest. Não é lentidão: é o teste fazendo trabalho real, que é justamente
  // o que dá valor a ele.
  it('marca os contornos que engoliram a vizinha na forrageira', { timeout: 30_000 }, () => {
    // É a razão de o módulo existir. Sem ele, 28 de 30 passam como confiáveis.
    const c = gerarCenaSintetica('forrageira', { quantidade: 30, semente: 77 });

    const areasVerdadeiras = c.sementes.map((s) => s.areaPx);
    const referencia = medianaDaCena(areasVerdadeiras);
    expect(referencia).toBeGreaterThan(0);

    let engoliramEForamMarcados = 0;
    let engoliram = 0;
    let isoladasMarcadasAtoa = 0;
    let isoladas = 0;

    for (const s of c.sementes) {
      const r = segmentarPorClique(c.imagem, { x: s.x, y: s.y });
      if (!r || r.contorno.length < 8) continue;

      const sinais = analisarContorno(r.contorno, referencia);
      const engoliu = r.areaPx > s.areaPx * 1.6;

      if (engoliu) {
        engoliram++;
        if (sinais.veredito === 'aglomerado') engoliramEForamMarcados++;
      } else {
        isoladas++;
        if (sinais.veredito === 'aglomerado') isoladasMarcadasAtoa++;
      }
    }

    expect(engoliram, 'a cena precisa ter casos de engolir').toBeGreaterThan(3);
    // Pega a maioria dos erros...
    expect(
      engoliramEForamMarcados / engoliram,
      `pegou ${engoliramEForamMarcados} de ${engoliram}`
    ).toBeGreaterThan(0.6);
    // ...sem transformar tudo em suspeito, o que não ajudaria ninguém.
    expect(
      isoladasMarcadasAtoa / Math.max(1, isoladas),
      `${isoladasMarcadasAtoa} falsos de ${isoladas}`
    ).toBeLessThan(0.5);
  });

  it('não marca as sementes de soja, que estão isoladas de verdade', { timeout: 30_000 }, () => {
    const c = gerarCenaSintetica('soja', { quantidade: 12, semente: 77 });
    const referencia = medianaDaCena(c.sementes.map((s) => s.areaPx));

    let marcadas = 0;
    for (const s of c.sementes) {
      const r = segmentarPorClique(c.imagem, { x: s.x, y: s.y });
      if (!r || r.contorno.length < 8) continue;
      if (analisarContorno(r.contorno, referencia).veredito === 'aglomerado') marcadas++;
    }
    // A soja está resolvida (+0,6% de erro). Marcar aqui seria alarme falso.
    expect(marcadas, `${marcadas} de ${c.sementes.length} marcadas à toa`).toBeLessThanOrEqual(2);
  });
});
