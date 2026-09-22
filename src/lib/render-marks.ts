import type { Mark, YoloSegmentation } from '../types';
import { corDoEspecime, ESPECIME, desenharMarca, type EstiloDaMarca } from '../theme/specimen';
import { AJUSTE_PADRAO, raioDaMarca, espessuraNaImagem, corpoDaFonte } from './escala-da-marca';
import { enumerarObjetos } from './objetos';

export function renderMarksToContext(
  ctx: CanvasRenderingContext2D,
  marks: Mark[],
  mode: 'dots' | 'numbers',
  larguraDaImagem: number,
  ajusteDaMarca = AJUSTE_PADRAO,
  segmentacoes: YoloSegmentation[] = [],
  estiloDaMarca: EstiloDaMarca = 'disco',
  opacidadeDaMarca = 1
) {
  const raio = raioDaMarca(larguraDaImagem, ajusteDaMarca);
  const traco = espessuraNaImagem(larguraDaImagem, 1.5);

  const objetos = enumerarObjetos(marks, segmentacoes);

  objetos.forEach((objeto) => {
    const { x, y, categoria } = objeto;
    const num = objeto.indice;
    const soContorno = objeto.natureza === 'contorno';

    if (mode === 'dots') {
      if (!soContorno) desenharMarca(ctx, categoria, x, y, raio, estiloDaMarca, opacidadeDaMarca);
    } else {
      const cor = corDoEspecime(categoria);
      const raioDoIndice = raio * 1.8;
      ctx.beginPath();
      ctx.arc(x, y, raioDoIndice, 0, Math.PI * 2);
      ctx.fillStyle = cor;
      ctx.fill();
      ctx.strokeStyle = ESPECIME.halo;
      ctx.lineWidth = traco;
      ctx.stroke();

      if (categoria === 'inviable') {
        ctx.beginPath();
        ctx.arc(x, y, raioDoIndice * 1.3, 0, Math.PI * 2);
        ctx.strokeStyle = cor;
        ctx.lineWidth = traco;
        ctx.stroke();
      }

      ctx.fillStyle = '#101719';
      ctx.font = `bold ${corpoDaFonte(raioDoIndice)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num.toString(), x, y + 0.5);
    }
  });
}
