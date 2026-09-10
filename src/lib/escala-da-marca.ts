// =============================================================================
// SeedCounter — o tamanho da marca
//
// O DEFEITO QUE ORIGINOU ESTE MÓDULO.
//
// A marca era desenhada com raio FIXO de 4,5 px no espaço da imagem. Numa
// digitalização de soja de 2400 px, exibida a ~800 px de largura, isso vira um
// ponto de 1,5 pixel de tela: praticamente invisível. Numa imagem de orquídea de
// 900 px, o mesmo 4,5 dava um ponto confortável — e é por isso que o defeito
// sobreviveu tanto tempo, aparecendo só em quem digitaliza grande.
//
// O detalhe que denuncia o erro: o ALVO DE CLIQUE ao lado já escalava com a
// imagem (`image.width / 130`). Dava para clicar na marca e não para vê-la. A
// interação estava certa e o desenho não.
//
// A REGRA: A MARCA É ANOTAÇÃO, NÃO É OBJETO DA CENA.
//
// Uma semente tem tamanho físico e deve crescer com o zoom. Uma marca é um
// SINAL SOBRE a cena — como alfinete em mapa — e o que ela precisa é de tamanho
// aparente estável. Como o desenho acontece no espaço da imagem, "aparente
// estável" quer dizer proporcional à largura da imagem.
//
// O alvo de clique continua maior que a marca de propósito: alvo menor que o
// desenho faz a pessoa errar o clique no que está vendo.
// =============================================================================

/**
 * Divisor da largura da imagem.
 *
 * Escolhido para PRESERVAR o que já funcionava: a 900 px — a largura das cenas
 * de orquídea — devolve exatamente os 4,5 px que eram confortáveis ali. Assim a
 * mudança não mexe no fluxo que já estava bom, e só corrige o que estava
 * quebrado: a 2400 px o raio sobe de 4,5 para 12.
 */
const DIVISOR = 200;

/** Piso: abaixo disso a marca some mesmo em imagem pequena. */
const RAIO_MINIMO = 3;

/** Teto: acima disso a marca tapa a semente que deveria apontar. */
const RAIO_MAXIMO = 40;

/** Quanto o alvo de clique é maior que o desenho. */
export const FATOR_DO_ALVO = 2;

/** Faixa do ajuste manual, para quem quer a marca mais discreta ou mais óbvia. */
export const AJUSTE_MINIMO = 0.5;
export const AJUSTE_MAXIMO = 2.5;
export const AJUSTE_PADRAO = 1;

/**
 * O raio da marca, em pixels da imagem.
 *
 * `ajuste` é o multiplicador que a pessoa controla. Fora da faixa, é preso nos
 * limites em vez de recusado: um valor herdado de uma sessão antiga não deve
 * impedir a imagem de desenhar.
 */
export function raioDaMarca(larguraDaImagem: number, ajuste = AJUSTE_PADRAO): number {
  if (!Number.isFinite(larguraDaImagem) || larguraDaImagem <= 0) return RAIO_MINIMO;

  const fator = Number.isFinite(ajuste)
    ? Math.min(AJUSTE_MAXIMO, Math.max(AJUSTE_MINIMO, ajuste))
    : AJUSTE_PADRAO;

  const base = larguraDaImagem / DIVISOR;
  return Math.min(RAIO_MAXIMO, Math.max(RAIO_MINIMO, base)) * fator;
}

/**
 * O raio do alvo de clique.
 *
 * Sempre maior que o desenho — inclusive quando o ajuste manual deixa a marca
 * minúscula, e é justamente aí que o alvo generoso mais importa.
 */
export function raioDoAlvo(larguraDaImagem: number, ajuste = AJUSTE_PADRAO): number {
  return Math.max(raioDaMarca(larguraDaImagem, ajuste) * FATOR_DO_ALVO, RAIO_MINIMO * 2);
}

/**
 * Espessura de traço que acompanha a escala.
 *
 * Contorno de espessura fixa some pelo mesmo motivo que a marca sumia.
 */
export function espessuraNaImagem(larguraDaImagem: number, base = 2): number {
  if (!Number.isFinite(larguraDaImagem) || larguraDaImagem <= 0) return base;
  return Math.max(base * 0.75, (larguraDaImagem / 900) * base);
}

/**
 * Corpo da fonte para o modo de índices, na escala da imagem.
 *
 * O número dentro da marca precisa caber nela: fonte fixa num raio que cresce
 * deixa um número perdido no meio de um disco grande.
 */
export function corpoDaFonte(raio: number): number {
  return Math.max(7, raio * 1.7);
}
