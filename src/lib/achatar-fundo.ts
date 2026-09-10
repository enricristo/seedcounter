// =============================================================================
// SeedCounter — achatar o fundo
//
// O modelo de fundo (`background.ts`) já sabe prever a cor esperada do fundo em
// cada ponto. O que faltava era usá-lo para PRODUZIR UMA IMAGEM.
//
// O QUE ISTO RESOLVE.
//
// Num scanner o fundo nunca é uniforme: há um gradiente suave de iluminação da
// borda para o centro, e sob cada semente uma sombra. Os dois atrapalham a onda
// pelo mesmo motivo — ela decide a fronteira por diferença de cor, e um
// gradiente lento faz a diferença acumular sem que exista borda.
//
// Achatar o fundo remove o gradiente e deixa a borda da semente como quase a
// única variação forte que sobrou.
//
// TRÊS MODOS, E A DIFERENÇA ENTRE ELES IMPORTA.
//
//   'corrigir'  divide o gradiente fora e devolve a foto com iluminação
//               uniforme. A semente continua com a cor dela. É o modo seguro:
//               nada é apagado, só nivelado.
//
//   'isolar'    pinta de branco tudo que o modelo classificou como fundo ou
//               sombra. Dá a leitura mais limpa possível — e é destrutivo, no
//               sentido de que um erro de classificação apaga semente.
//
//   'realcar'   corrigir, e ainda esticar o contraste do que sobrou. Ajuda o
//               olho em material de baixo contraste.
//
// A REGRA QUE GOVERNA O USO: ISTO NÃO VAI PARA O YOLO.
//
// O modelo foi treinado em imagem original, e já está registrado que ele
// degrada em imagem alterada. Fundo achatado serve à ONDA e ao OLHO; para a
// detecção automática continua indo a original. Quem chamar precisa saber
// disso, e por isso está dito aqui e não só na documentação.
//
// E não vai para o LAUDO como evidência: a imagem do laudo é a original ao lado
// da analisada. Uma foto processada não é a chapa.
// =============================================================================

import { classificarPixel, estimarFundo, type ModeloDeFundo } from './background';
import { rgbParaLab, type DadosImagem } from './color-features';

export type ModoDeAchatamento = 'corrigir' | 'isolar' | 'realcar';

export interface OpcoesDeAchatamento {
  modo?: ModoDeAchatamento;
  /** Modelo já estimado. Ausente = estima na hora. */
  modelo?: ModeloDeFundo;
  /** Cor com que 'isolar' preenche o fundo. */
  corDoFundo?: [number, number, number];
}

export interface ResultadoDoAchatamento {
  /**
   * A imagem produzida, na mesma forma que `DadosImagem`.
   *
   * Não é `ImageData` de propósito: `ImageData` é tipo do DOM e não existe em
   * teste rodando em node, o que tornaria este módulo — que é aritmética pura —
   * impossível de testar. Quem desenha no canvas constrói o `ImageData` a
   * partir daqui numa linha.
   */
  imagem: ImagemProduzida;
  modelo: ModeloDeFundo;
  /**
   * O modelo não merece confiança e o resultado deve ser mostrado com ressalva.
   *
   * Vem de `ModeloDeFundo.incerto`: poucas amostras de fundo, ou resíduo grande
   * demais para o fundo ser considerado uniforme. Acontece quando a imagem é
   * quase toda semente, ou quando o fundo tem textura.
   */
  incerto: boolean;
}

/**
 * A saida e sempre `Uint8ClampedArray`, e o tipo diz isso.
 *
 * `DadosImagem.data` aceita `number[]` tambem, para poder receber dado de
 * teste. Como TIPO DE SAIDA isso seria frouxo demais: quem constroi um
 * `ImageData` a partir daqui precisa da garantia, e sem ela o compilador
 * reclama no lugar errado.
 */
export interface ImagemProduzida {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const BRANCO: [number, number, number] = [255, 255, 255];

/**
 * Devolve a imagem com o fundo nivelado.
 *
 * `null` quando não há modelo utilizável — e nesse caso quem chama deve manter
 * a imagem original, não mostrar um achatamento pela metade.
 */
export function achatarFundo(
  imagem: DadosImagem,
  opcoes: OpcoesDeAchatamento = {}
): ResultadoDoAchatamento | null {
  const { modo = 'corrigir', corDoFundo = BRANCO } = opcoes;

  const modelo = opcoes.modelo ?? estimarFundo(imagem);
  if (!modelo) return null;

  const { width: W, height: H } = imagem;
  const saida: ImagemProduzida = {
    data: new Uint8ClampedArray(W * H * 4),
    width: W,
    height: H,
  };

  // A referência é a MEDIANA do fundo previsto, não um branco fixo: dividir
  // pelo branco levantaria a imagem inteira e estouraria o realce numa
  // digitalização de fundo cinza.
  const alvo = luzDeReferencia(modelo, W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = imagem.data[i];
      const g = imagem.data[i + 1];
      const b = imagem.data[i + 2];
      const [L, ca, cb] = rgbParaLab(r, g, b);

      if (modo === 'isolar') {
        const classe = classificarPixel(modelo, L, ca, cb, x, y);
        if (classe !== 'objeto') {
          saida.data[i] = corDoFundo[0];
          saida.data[i + 1] = corDoFundo[1];
          saida.data[i + 2] = corDoFundo[2];
          saida.data[i + 3] = 255;
          continue;
        }
        saida.data[i] = r;
        saida.data[i + 1] = g;
        saida.data[i + 2] = b;
        saida.data[i + 3] = 255;
        continue;
      }

      // Correção multiplicativa: a iluminação é um fator, não uma soma. Subtrair
      // o gradiente escureceria as sementes das bordas junto com o fundo delas.
      const [Lfundo] = modelo.predizer(x, y);
      const fator = Lfundo > 1 ? alvo / Lfundo : 1;

      let nr = r * fator;
      let ng = g * fator;
      let nb = b * fator;

      if (modo === 'realcar') {
        // Estica em torno do próprio alvo, para o fundo continuar no lugar e só
        // o desvio crescer.
        const k = 1.35;
        const base = (alvo / 100) * 255;
        nr = base + (nr - base) * k;
        ng = base + (ng - base) * k;
        nb = base + (nb - base) * k;
      }

      saida.data[i] = limitar(nr);
      saida.data[i + 1] = limitar(ng);
      saida.data[i + 2] = limitar(nb);
      saida.data[i + 3] = 255;
    }
  }

  return { imagem: saida, modelo, incerto: modelo.incerto };
}

/**
 * A luminosidade típica do fundo previsto.
 *
 * Amostra uma grade em vez de percorrer tudo: o modelo é uma superfície suave
 * de segunda ordem, então dezenas de pontos descrevem-na tão bem quanto
 * milhões — e isto roda antes do laço principal, que já é o caro.
 */
export function luzDeReferencia(modelo: ModeloDeFundo, W: number, H: number): number {
  const amostras: number[] = [];
  const passo = 16;
  for (let y = 0; y < H; y += Math.max(1, Math.floor(H / passo))) {
    for (let x = 0; x < W; x += Math.max(1, Math.floor(W / passo))) {
      amostras.push(modelo.predizer(x, y)[0]);
    }
  }
  if (amostras.length === 0) return 100;
  amostras.sort((a, b) => a - b);
  return amostras[Math.floor(amostras.length / 2)];
}

function limitar(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export const AVISO_SOBRE_O_YOLO =
  'A imagem com fundo achatado serve à segmentação por clique e à conferência visual. ' +
  'A detecção automática continua recebendo a imagem original, porque o modelo foi ' +
  'treinado nela e degrada em imagem alterada.';
