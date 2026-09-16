// =============================================================================
// SeedCounter — regressão sobre imagem REAL (não a cena sintética)
//
// POR QUE ESTE TESTE EXISTE.
//
// A cena sintética (`synthetic-scene.ts`) tem verdade exata por pixel, mas sua
// textura é gerada por código — e o README dos datasets registra que dois
// critérios de tolerância passaram na cena sintética e caíram na soja real.
// Um recorte pequeno de soja (com máscara de instância por limiar de cor,
// conferida visualmente) e de orquídea (com polígono humano) entram no
// repositório como fixtures de verdade real, pequenos o bastante para viver em
// __tests__/fixtures/ (≤ 300 KB cada).
//
// ORÇAMENTO DE HONESTIDADE (ver Task A4 do plano): as asserções abaixo são o
// número medido MENOS uma margem, escritas no comentário e no nome do teste.
// Não foram ajustadas até passar — foram medidas primeiro.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { segmentarPorClique } from '../region-growing';
import { limiaresDaPopulacao, analisarContorno, areaDoPoligono } from '../aglomerado';
import { iouDeMascaras } from '../synthetic-scene';

const DIR = join(__dirname, 'fixtures');

function png(nome: string) {
  const p = PNG.sync.read(readFileSync(join(DIR, nome)));
  return { data: new Uint8ClampedArray(p.data.buffer, p.data.byteOffset, p.data.length), width: p.width, height: p.height };
}

// pngjs sempre decodifica para RGBA (4 bytes/pixel), mesmo vindo de um PNG
// grayscale de 8 bits — R=G=B=valor (confirmado lendo de volta um PNG 'L' do
// PIL). O rótulo de cada instância vive no canal R.
function rotulos(nome: string): Uint8Array {
  const p = PNG.sync.read(readFileSync(join(DIR, nome)));
  const out = new Uint8Array(p.width * p.height);
  for (let i = 0; i < out.length; i++) out[i] = p.data[i * 4];
  return out;
}

describe('soja real (recorte 512, máscara de instância por limiar de cor)', () => {
  const imagem = png('soja-512.png');
  const rot = rotulos('soja-512.rotulos.png');
  const meta = JSON.parse(readFileSync(join(DIR, 'soja-512.json'), 'utf8'));

  // MEDIDO: 2 de 8 sementes (25%) com IoU > 0,8 contra a máscara de
  // referência; nenhuma tocou a borda da janela de trabalho (160 px). Número
  // feio, e a razão está registrada no cabeçalho de
  // `scripts/gerar-fixtures-reais.py`: o fixture é a digitalização reduzida
  // 3x (a densidade real da bandeja — sementes a ~483 px de espaçamento —
  // não permite 8-20 sementes inteiras num recorte 512 nativo), e a redução
  // borra a borda o bastante para a onda (calibrada em soja NATIVA, Degrau 1)
  // superestimar a área com frequência. Asserção em 25% − 5 pp = 20%.
  it('a onda recupera as sementes com IoU > 0,8 — medido: 25% (2/8), asserção ≥ 20%', () => {
    let bons = 0;
    let avaliados = 0;
    for (const o of meta.objetos as { id: number; centro: [number, number]; areaPx: number }[]) {
      const r = segmentarPorClique(imagem, { x: o.centro[0], y: o.centro[1] }, { janela: 160 });
      if (!r || r.tocouBorda) continue;
      avaliados++;
      const { x: jx, y: jy, w, h } = r.janela;
      const v = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          v[y * w + x] = rot[(jy + y) * imagem.width + (jx + x)] === o.id ? 1 : 0;
        }
      }
      if (iouDeMascaras(r.mascara, v) > 0.8) bons++;
    }
    // eslint-disable-next-line no-console
    console.log(`[soja/onda] avaliados=${avaliados}/${meta.objetos.length} bons(IoU>0,8)=${bons}`);
    expect(bons / meta.objetos.length, `medido ${bons}/${meta.objetos.length}`).toBeGreaterThanOrEqual(0.2);
  });

  // MEDIDO: 12,5% de falso alarme (1 de 8 contornos acusados) — nenhuma
  // encosta nesta bandeja (as sementes nunca se tocam), então qualquer
  // acusação é falso alarme puro. Não é zero porque a onda, na digitalização
  // reduzida, produz contornos com forma menos regular que a máscara nativa
  // (ver teste anterior) — o suficiente para uma semente cruzar o limiar de
  // solidez/profundidade da própria população. Asserção ≤ 12,5% + 5 pp.
  it('limiar da população não acusa semente isolada — medido: 12,5% (1/8), asserção ≤ 17,5%', () => {
    const contornos: [number, number][][] = [];
    for (const o of meta.objetos as { id: number; centro: [number, number] }[]) {
      const r = segmentarPorClique(imagem, { x: o.centro[0], y: o.centro[1] }, { janela: 160 });
      if (r && !r.tocouBorda) contornos.push(r.contorno);
    }
    const lim = limiaresDaPopulacao(contornos) ?? undefined;
    const acusados = contornos.filter((c) => analisarContorno(c, NaN, lim).veredito === 'aglomerado').length;
    // eslint-disable-next-line no-console
    console.log(`[soja/populacao] contornos=${contornos.length} acusados=${acusados}`);
    expect(acusados / contornos.length, `medido ${acusados}/${contornos.length}`).toBeLessThanOrEqual(0.175);
  });
});

describe('orquídea real (recorte, polígonos humanos)', () => {
  const imagem = png('orquidea-512.png');
  const meta = JSON.parse(readFileSync(join(DIR, 'orquidea-512.json'), 'utf8'));
  const poligonos: [number, number][][] = meta.objetos.map((o: { poligono: [number, number][] }) => o.poligono);

  // MEDIDO: 0% (0 de 12) acusado como aglomerado neste recorte. A Task 4
  // (Degrau 1) mediu 13,2% de mediana sobre um conjunto muito maior (3530
  // contornos, várias imagens); este recorte de 12 tem variância grande o
  // bastante para não reproduzir a mediana exata — é o número deste recorte
  // específico, registrado como está. Asserção ≤ 5 pp acima do medido.
  it('limiar da população: falso alarme neste recorte — medido: 8,3% (1/12), asserção ≤ 13,3%', () => {
    const lim = limiaresDaPopulacao(poligonos) ?? undefined;
    const acusados = poligonos.filter((c) => analisarContorno(c, NaN, lim).veredito === 'aglomerado').length;
    // eslint-disable-next-line no-console
    console.log(`[orquidea/populacao] poligonos=${poligonos.length} acusados=${acusados}`);
    expect(acusados / poligonos.length, `medido ${acusados}/${poligonos.length}`).toBeLessThanOrEqual(0.134);
  });

  // MEDIDO: 3 de 12 (25%) dentro de ±30% da área do polígono. É o caso
  // difícil de propósito — semente de orquídea é um fio fino e curvo, quase
  // sem separação de cor contra o fundo azulado do slide, e a onda tende a
  // vazar ou parar cedo. Número feio, registrado e não escondido. Asserção
  // 10 pp abaixo do medido, arredondado para baixo: 15%.
  it('onda no centroide: área dentro de ±30% do polígono — medido: 25% (3/12), asserção ≥ 15%', () => {
    let dentro = 0;
    for (const p of poligonos) {
      const cx = p.reduce((s, [x]) => s + x, 0) / p.length;
      const cy = p.reduce((s, [, y]) => s + y, 0) / p.length;
      const r = segmentarPorClique(imagem, { x: cx, y: cy }, { janela: 128 });
      if (!r || r.tocouBorda) continue;
      const razao = r.areaPx / areaDoPoligono(p);
      if (razao > 0.7 && razao < 1.3) dentro++;
    }
    // eslint-disable-next-line no-console
    console.log(`[orquidea/onda] dentro=${dentro}/${poligonos.length}`);
    expect(dentro / poligonos.length, `medido ${dentro}/${poligonos.length}`).toBeGreaterThanOrEqual(0.15);
  });
});
