// =============================================================================
// SeedCounter — volume da semente, do embrião e do ar entre os dois
//
// POR QUE ESTE MÓDULO EXISTE.
//
// A semente de orquídea é quase só ar. O embrião é uma bolinha solta dentro de
// uma testa fusiforme translúcida, e a FRAÇÃO DE AR desse arranjo prediz
// longevidade em banco de sementes: as três espécies de semente mais longeva
// medidas por Francisqueti et al. (2024) tinham os menores espaços de ar,
// 9–11%. Medir comprimento e largura, então, não é o fim — é o insumo de um
// número que responde a uma pergunta de conservação.
//
// Este módulo é a aritmética desse número, e só isso: recebe medidas em
// micrômetros e devolve volumes. Não segmenta, não mede, não decide o que é
// embrião. Separado de propósito, porque é a parte que precisa estar
// obviamente correta ao ser lida ao lado do artigo.
//
// AS EQUAÇÕES, COMO O PROJETO AS ESCREVE.
//
//   Equação 1 — embrião, esferoide prolato:  Ev = (4/3)·π·a·b²
//               a = semieixo maior, b = semieixo menor.
//
//   Equação 2 — semente, cone × 2:           Sv = 2·(1/3)·π·r²·h
//
//   Volume de ar = Sv − Ev.
//
// UMA AMBIGUIDADE QUE NÃO DÁ PARA ESCONDER, E QUE MUDA O RESULTADO EM 2×.
//
// Na Equação 2, `h` é a altura de UM cone. A semente fusiforme são dois cones
// unidos pela base, e o "× 2" existe justamente para somar os dois — o que só
// fecha se cada cone tiver metade do comprimento da semente, `h = L/2`. É
// assim que este módulo calcula, e é a única leitura em que a figura fechada
// tem o comprimento que foi medido.
//
// A outra leitura possível — `h = L`, dois cones de altura igual ao
// comprimento inteiro — descreveria um corpo com o DOBRO do comprimento
// medido, e dobraria `Sv`. Como a fração de ar é Sv−Ev sobre Sv, essa escolha
// muda o número publicado.
//
// Por isso `convencaoDaAltura` é um parâmetro explícito e não um detalhe
// enterrado: quem for publicar confere contra o artigo qual convenção usou,
// escolhe, e o laudo registra a escolha. O padrão é 'metade', que é a leitura
// geométrica coerente. NÃO mude o padrão sem conferir no artigo original.
// =============================================================================

/** Qual é a altura de cada cone, na Equação 2. Ver a nota acima. */
export type ConvencaoDaAltura = 'metade' | 'inteiro';

export interface MedidasDaSemente {
  /** Comprimento da semente, em micrômetros. */
  comprimentoUm: number;
  /** Largura da semente, em micrômetros. */
  larguraUm: number;
  /** Comprimento do embrião, em micrômetros. Ausente quando não foi medido. */
  embriaoComprimentoUm?: number;
  /** Largura do embrião, em micrômetros. Ausente quando não foi medido. */
  embriaoLarguraUm?: number;
}

export interface VolumesDaSemente {
  /** Volume da semente, µm³. */
  sementeUm3: number;
  /** Volume do embrião, µm³. `null` quando o embrião não foi medido. */
  embriaoUm3: number | null;
  /** Volume de ar, µm³ — semente menos embrião. `null` sem embrião. */
  arUm3: number | null;
  /** Fração de ar, de 0 a 1. `null` sem embrião. */
  fracaoDeAr: number | null;
  /** A convenção usada, para o laudo poder declará-la. */
  convencao: ConvencaoDaAltura;
  /**
   * Presente quando o resultado é geometricamente impossível e por isso não
   * deve ser publicado sem revisão: embrião maior que a semente que o contém.
   * Não é exceção — é aviso. Medida ruim acontece, e esconder não ajuda.
   */
  aviso?: string;
}

/** Positivo e finito. Medida ausente, zero ou NaN não vira volume zero em silêncio. */
function valido(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Equação 1 — volume do embrião como esferoide prolato.
 *
 * `a` é o semieixo maior (metade do comprimento) e `b` o semieixo menor
 * (metade da largura). O esferoide prolato é o sólido de revolução em torno do
 * eixo maior, e por isso o semieixo menor entra ao quadrado: as duas dimensões
 * transversais são iguais.
 */
export function volumeDoEmbriao(comprimentoUm: number, larguraUm: number): number | null {
  if (!valido(comprimentoUm) || !valido(larguraUm)) return null;
  const a = comprimentoUm / 2;
  const b = larguraUm / 2;
  return (4 / 3) * Math.PI * a * b * b;
}

/**
 * Equação 2 — volume da semente como dois cones unidos pela base.
 *
 * `r` é o raio (metade da largura). A altura de cada cone depende da
 * convenção — ver a nota no topo do arquivo, que é onde essa decisão está
 * justificada.
 */
export function volumeDaSemente(
  comprimentoUm: number,
  larguraUm: number,
  convencao: ConvencaoDaAltura = 'metade'
): number | null {
  if (!valido(comprimentoUm) || !valido(larguraUm)) return null;
  const r = larguraUm / 2;
  const h = convencao === 'metade' ? comprimentoUm / 2 : comprimentoUm;
  return 2 * (1 / 3) * Math.PI * r * r * h;
}

/**
 * Os três volumes e a fração de ar, de uma vez.
 *
 * Sem medida de embrião o resultado não é erro: é uma semente medida por fora,
 * que continua tendo volume. O que não existe vem `null`, e não 0 — zero seria
 * uma afirmação ("não há ar"), e `null` é a verdade ("não foi medido").
 */
export function volumesDaSemente(
  m: MedidasDaSemente,
  convencao: ConvencaoDaAltura = 'metade'
): VolumesDaSemente | null {
  const sementeUm3 = volumeDaSemente(m.comprimentoUm, m.larguraUm, convencao);
  if (sementeUm3 === null) return null;

  const embriaoUm3 =
    m.embriaoComprimentoUm !== undefined && m.embriaoLarguraUm !== undefined
      ? volumeDoEmbriao(m.embriaoComprimentoUm, m.embriaoLarguraUm)
      : null;

  if (embriaoUm3 === null) {
    return { sementeUm3, embriaoUm3: null, arUm3: null, fracaoDeAr: null, convencao };
  }

  const arUm3 = sementeUm3 - embriaoUm3;
  const base: VolumesDaSemente = {
    sementeUm3,
    embriaoUm3,
    arUm3,
    fracaoDeAr: arUm3 / sementeUm3,
    convencao,
  };

  if (arUm3 < 0) {
    return {
      ...base,
      aviso:
        'Embrião maior que a semente: o volume de ar deu negativo. Confira as medidas — ' +
        'é o sinal típico de ter medido a semente inteira como se fosse o embrião, ' +
        'ou de comprimento e largura trocados.',
    };
  }
  return base;
}

/**
 * Quantos micrômetros tem um pixel, a partir de uma resolução em DPI.
 *
 * Existe aqui porque a pergunta "dá para medir o embrião nesta imagem?" é uma
 * conta de duas linhas que ninguém faz antes de digitalizar, e depois é tarde.
 */
export function umPorPixel(dpi: number): number | null {
  if (!valido(dpi)) return null;
  return 25400 / dpi;
}

/**
 * Quantos pixels de largura terá um objeto deste tamanho, nesta resolução.
 *
 * O uso é de bancada, antes de digitalizar: um embrião de orquídea tem 76 a
 * 120 µm de diâmetro, e a 1200 DPI isso são 4 a 6 pixels. Nenhum algoritmo
 * mede forma com 4 pixels — a resposta não é "o software é ruim", é
 * "digitalize em resolução maior". Melhor descobrir antes da bancada montada.
 */
export function pixelsPara(tamanhoUm: number, dpi: number): number | null {
  const upp = umPorPixel(dpi);
  if (upp === null || !valido(tamanhoUm)) return null;
  return tamanhoUm / upp;
}
