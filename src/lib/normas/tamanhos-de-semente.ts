// =============================================================================
// SeedCounter — tamanhos típicos de semente
//
// PARA QUE SERVE, ALÉM DE SUGERIR CALIBRAÇÃO.
//
// A ideia nasceu como atalho: "se é orquídea, sei que é da casa de mm; se é
// soja, é maior". Mas o uso mais forte da tabela não é PROPOR a escala — é
// CONFERIR a que a pessoa informou.
//
// `validateScale` hoje só olha a faixa absoluta de µm/px. Isso pega o erro
// grosseiro e deixa passar o pior: informar centímetro onde era milímetro faz a
// escala cair dentro da faixa plausível, e o laudo sai com uma semente de soja
// de 0,6 mm sem ninguém estranhar.
//
// Com o tamanho esperado da espécie, o aplicativo faz a pergunta que o analista
// faria: "nesta escala, esta semente teria 0,6 mm — soja tem 6 mm. Confere?"
//
// A TABELA É REFERÊNCIA, NÃO MEDIDA.
//
// São faixas de literatura e de catálogo, para orientar o olho e pegar erro de
// ordem de grandeza. Não substituem medição, não entram em laudo como resultado,
// e a variação entre cultivares é real. Por isso toda faixa é larga de
// propósito: ela existe para dizer "isto está absurdo", não "isto está certo".
// =============================================================================

/** Faixa de comprimento típico de uma espécie, em milímetros. */
export interface TamanhoDeSemente {
  /** Chave estável, em minúsculas sem acento. */
  chave: string;
  nomeComum: string;
  nomeCientifico: string;
  /** Comprimento mínimo típico, em mm. */
  minimo: number;
  /** Comprimento máximo típico, em mm. */
  maximo: number;
  /**
   * Razão comprimento/largura OBSERVADA na imagem, pelos eixos principais.
   *
   * É a peça mais útil da tabela, porque é INVARIANTE DE ESCALA: não depende de
   * calibração nenhuma. Um contorno de soja com razão 2,4 quase certamente
   * engoliu a vizinha, e isso dá para afirmar sem saber quantos µm tem o pixel.
   *
   * ATENÇÃO — É A RAZÃO PROJETADA, NÃO A DA SEMENTE.
   *
   * A primeira versão deste campo usava a razão das dimensões publicadas da
   * semente, e estava errada para tudo que é alongado. Uma semente é um corpo
   * de três eixos; a imagem vê a PROJEÇÃO de como ela caiu. Um grão de trigo
   * deitado mostra ~2:1, e o mesmo grão apoiado na ponta mostra ~1:1.
   *
   * Medindo 2222 blobs de trigo em imagens só com semente sadia: mediana 1,87,
   * mas p5 = 1,08 — quase metade fica abaixo do 1,8 que a literatura dá para o
   * grão. Não é erro de segmentação: é orientação.
   *
   * Consequência de projeto: o piso é BAIXO de propósito para espécie alongada,
   * e a checagem serve sobretudo para pegar o lado ALTO, que é onde mora o
   * contorno que engoliu a vizinha. Para soja o piso pode ser justo, porque
   * semente quase esférica projeta igual de qualquer lado.
   */
  razaoMinima?: number;
  razaoMaxima?: number;
  /** De onde vem a faixa, para quem quiser conferir. */
  origem: string;
}

/**
 * Faixas típicas de COMPRIMENTO, em milímetros.
 *
 * Cobre o que o laboratório vê: as duas frentes do grupo (orquídea e soja),
 * forrageiras — que são interesse declarado — e as grandes culturas que chegam
 * para análise de rotina.
 */
export const TAMANHOS: TamanhoDeSemente[] = [
  {
    chave: 'orquidea',
    nomeComum: 'Orquídea',
    nomeCientifico: 'Orchidaceae',
    minimo: 0.15,
    maximo: 2.0,
    // Cattleya ~1,17 x 0,34 mm; piso rebaixado pela orientacao.
    razaoMinima: 1.4,
    razaoMaxima: 6.0,
    origem: 'Semente sem endosperma; Cattleya ~1,2 mm de comprimento',
  },
  {
    chave: 'soja',
    nomeComum: 'Soja',
    nomeCientifico: 'Glycine max',
    // Faixa alargada depois de MEDIR: nas variedades indonésias de semente
    // graúda a mediana bate 9,07 mm à resolução declarada pelo scanner, ou
    // seja, exatamente no antigo teto. Manter 9,0 faria a tabela reclamar de
    // um lote legítimo.
    minimo: 5.0,
    maximo: 11.0,
    // Medido: mediana 1,208, p99 1,364, máximo observado 1,396 (n = 1200).
    // A faixa é o p1–p99 arredondado para fora.
    razaoMinima: 1.05,
    razaoMaxima: 1.4,
    origem:
      'Medido em 1200 sementes do conjunto Mendeley c733bjz4m3 (Anjasmoro, Dega I, Grobogan), por PCA sobre a máscara de instância',
  },
  {
    chave: 'milho',
    nomeComum: 'Milho',
    nomeCientifico: 'Zea mays',
    minimo: 8.0,
    maximo: 13.0,
    // grao dentado.
    razaoMinima: 1.1,
    razaoMaxima: 1.8,
    origem: 'Grão dentado e duro, faixa comercial',
  },
  {
    chave: 'arroz',
    nomeComum: 'Arroz',
    nomeCientifico: 'Oryza sativa',
    minimo: 5.0,
    maximo: 11.0,
    // longo fino a curto; piso rebaixado pela orientacao.
    razaoMinima: 1.2,
    razaoMaxima: 4.5,
    origem: 'Grão com casca; longo fino a curto',
  },
  {
    chave: 'feijao',
    nomeComum: 'Feijão',
    nomeCientifico: 'Phaseolus vulgaris',
    minimo: 8.0,
    maximo: 15.0,
    // carioca e preto.
    razaoMinima: 1.2,
    razaoMaxima: 2.0,
    origem: 'Carioca e preto, faixa comercial',
  },
  {
    chave: 'trigo',
    nomeComum: 'Trigo',
    nomeCientifico: 'Triticum aestivum',
    minimo: 5.0,
    maximo: 8.0,
    // MEDIDO: 2222 blobs do conjunto wheat-quality, mediana 1,87, p5 1,08, p95 3,20.
    razaoMinima: 1.1,
    razaoMaxima: 3.0,
    origem: 'Cariopse',
  },
  {
    chave: 'urochloa',
    nomeComum: 'Braquiária',
    nomeCientifico: 'Urochloa brizantha',
    minimo: 3.5,
    maximo: 6.0,
    // espigueta alongada; piso rebaixado pela orientacao.
    razaoMinima: 1.3,
    razaoMaxima: 3.5,
    origem: 'Espigueta; gênero renomeado de Brachiaria',
  },
  {
    chave: 'panicum',
    nomeComum: 'Capim-colonião',
    nomeCientifico: 'Megathyrsus maximus',
    minimo: 2.0,
    maximo: 3.5,
    // espigueta; piso rebaixado pela orientacao.
    razaoMinima: 1.2,
    razaoMaxima: 3.0,
    origem: 'Espigueta; antes Panicum maximum',
  },
  {
    chave: 'stylosanthes',
    nomeComum: 'Estilosantes',
    nomeCientifico: 'Stylosanthes spp.',
    minimo: 1.5,
    maximo: 3.0,
    origem: 'Leguminosa forrageira',
  },
  {
    chave: 'alface',
    nomeComum: 'Alface',
    nomeCientifico: 'Lactuca sativa',
    minimo: 3.0,
    maximo: 5.0,
    origem: 'Aquênio',
  },
  {
    chave: 'tomate',
    nomeComum: 'Tomate',
    nomeCientifico: 'Solanum lycopersicum',
    minimo: 2.5,
    maximo: 4.0,
    origem: 'Semente pilosa',
  },
  {
    chave: 'eucalipto',
    nomeComum: 'Eucalipto',
    nomeCientifico: 'Eucalyptus spp.',
    minimo: 0.5,
    maximo: 2.5,
    origem: 'Semente florestal, muito variável entre espécies',
  },
];

const POR_CHAVE = new Map(TAMANHOS.map((t) => [t.chave, t]));

export function tamanhoDe(chave: string): TamanhoDeSemente | undefined {
  return POR_CHAVE.get(chave);
}

/**
 * Encontra a espécie pelo nome que a pessoa digitou no boletim.
 *
 * Compara sem acento e sem caixa, no nome comum e no científico, porque o campo
 * do boletim é texto livre: "Soja", "soja", "Glycine max" e "GLYCINE MAX" têm de
 * chegar todos na mesma linha da tabela.
 */
export function acharPorNome(texto: string | undefined): TamanhoDeSemente | undefined {
  if (!texto?.trim()) return undefined;
  const alvo = normalizar(texto);
  if (!alvo) return undefined;

  return TAMANHOS.find((t) => {
    const comum = normalizar(t.nomeComum);
    const cientifico = normalizar(t.nomeCientifico);
    const genero = cientifico.split(' ')[0];
    return (
      alvo === t.chave ||
      alvo === comum ||
      alvo === cientifico ||
      // O gênero sozinho basta: quem escreve "Urochloa decumbens" não deve
      // ficar sem referência só por não ser a espécie exata da tabela.
      (genero.length > 3 && alvo.startsWith(genero))
    );
  });
}

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// Conferência da calibração
// ---------------------------------------------------------------------------

export type VeredictoDaEscala = 'plausivel' | 'suspeita' | 'sem-referencia';

export interface ConferenciaDaEscala {
  veredicto: VeredictoDaEscala;
  /** Comprimento que o objeto medido teria na escala informada, em mm. */
  comprimentoImplicado?: number;
  referencia?: TamanhoDeSemente;
  /** Frase pronta para a interface. Vazia quando não há o que dizer. */
  recado: string;
}

/**
 * Tolerância sobre a faixa da tabela.
 *
 * Larga de propósito: a tabela existe para pegar erro de ORDEM DE GRANDEZA
 * (milímetro por centímetro, um fator de dez), não para reprovar um lote de
 * sementes graúdas. Um fator de dois para cada lado deixa passar variação real
 * de cultivar e ainda assim acusa o erro de unidade.
 */
export const FATOR_DE_TOLERANCIA = 2;

/**
 * A escala informada faz sentido para esta espécie?
 *
 * `comprimentoEmPixels` é o maior lado de um objeto típico da imagem — pode vir
 * da mediana dos contornos já segmentados.
 */
export function conferirEscala(
  comprimentoEmPixels: number,
  umPerPixel: number | undefined,
  especie: string | undefined
): ConferenciaDaEscala {
  const referencia = acharPorNome(especie);

  if (!referencia || !umPerPixel || umPerPixel <= 0 || !(comprimentoEmPixels > 0)) {
    return { veredicto: 'sem-referencia', referencia, recado: '' };
  }

  const comprimentoImplicado = (comprimentoEmPixels * umPerPixel) / 1000;
  const piso = referencia.minimo / FATOR_DE_TOLERANCIA;
  const teto = referencia.maximo * FATOR_DE_TOLERANCIA;

  if (comprimentoImplicado >= piso && comprimentoImplicado <= teto) {
    return { veredicto: 'plausivel', comprimentoImplicado, referencia, recado: '' };
  }

  const medido = formatarMm(comprimentoImplicado);
  const esperado = `${formatarMm(referencia.minimo)} a ${formatarMm(referencia.maximo)} mm`;
  const fator =
    comprimentoImplicado > teto
      ? comprimentoImplicado / referencia.maximo
      : referencia.minimo / comprimentoImplicado;

  return {
    veredicto: 'suspeita',
    comprimentoImplicado,
    referencia,
    recado:
      `Nesta escala, um objeto típico desta imagem teria ${medido} mm. ` +
      `${referencia.nomeComum} costuma ter ${esperado}. ` +
      (proximoDePotenciaDeDez(fator)
        ? 'A diferença é de cerca de dez vezes — confira se a unidade informada era milímetro e não centímetro.'
        : 'Confira a calibração ou a espécie informada.'),
  };
}

/** Um fator perto de 10, 100 ou 1000 denuncia troca de unidade. */
function proximoDePotenciaDeDez(fator: number): boolean {
  if (!Number.isFinite(fator) || fator <= 0) return false;
  for (const potencia of [10, 100, 1000]) {
    if (fator >= potencia / 2.5 && fator <= potencia * 2.5) return true;
  }
  return false;
}

function formatarMm(valor: number): string {
  if (valor < 0.1) return valor.toFixed(3).replace('.', ',');
  if (valor < 10) return valor.toFixed(2).replace('.', ',');
  return valor.toFixed(1).replace('.', ',');
}

/**
 * Escala que uma espécie sugere, em micrômetros por pixel.
 *
 * Serve de PONTO DE PARTIDA quando não há régua nem DPI: se um objeto típico da
 * imagem tem tantos pixels e a espécie costuma ter tantos milímetros, a escala
 * sai por divisão. É um chute informado — e a interface tem de dizer isso.
 */
export function escalaSugerida(
  comprimentoEmPixels: number,
  especie: string | undefined
): number | null {
  const referencia = acharPorNome(especie);
  if (!referencia || !(comprimentoEmPixels > 0)) return null;
  const meio = (referencia.minimo + referencia.maximo) / 2;
  return (meio * 1000) / comprimentoEmPixels;
}

// ---------------------------------------------------------------------------
// Conferência de FORMA — sem calibração
// ---------------------------------------------------------------------------

export type VeredictoDaForma = 'plausivel' | 'alongado-demais' | 'redondo-demais' | 'sem-referencia';

export interface ConferenciaDaForma {
  veredicto: VeredictoDaForma;
  razao?: number;
  referencia?: TamanhoDeSemente;
  recado: string;
}

/**
 * A forma do contorno bate com a da espécie?
 *
 * POR QUE ISTO VALE MAIS QUE A CONFERÊNCIA DE TAMANHO.
 *
 * A razão comprimento/largura não depende de escala. Ela responde sem
 * calibração nenhuma — e a calibração é justamente o que costuma faltar, ou
 * estar errada.
 *
 * E ela pega o modo de falha dominante da segmentação. Medindo 1200 sementes de
 * soja isoladas, a razão ficou entre 1,05 e 1,40 (mediana 1,21). Um contorno
 * que engole a vizinha encostada tem o comprimento dobrado e a largura igual —
 * razão perto de 2,4, muito fora da faixa.
 *
 * RESSALVA QUE PRECISA ACOMPANHAR O NÚMERO: o conjunto medido não tem sementes
 * encostadas (foram dispostas em grade à mão), então o 2,4 é o que a aritmética
 * prevê para um par, não uma medição de par. O que está medido é a faixa da
 * semente ISOLADA — e é essa faixa que o teste usa.
 *
 * É TRIAGEM, NÃO VEREDITO. Semente quebrada, semente germinando e variedade
 * atípica também saem da faixa. O papel é dizer "olhe este aqui".
 */
export function conferirForma(
  comprimento: number,
  largura: number,
  especie: string | undefined
): ConferenciaDaForma {
  const referencia = acharPorNome(especie);

  if (
    !referencia?.razaoMinima ||
    !referencia.razaoMaxima ||
    !(comprimento > 0) ||
    !(largura > 0)
  ) {
    return { veredicto: 'sem-referencia', referencia, recado: '' };
  }

  const razao = Math.max(comprimento, largura) / Math.min(comprimento, largura);
  const esperado = `${virgula(referencia.razaoMinima)} a ${virgula(referencia.razaoMaxima)}`;

  if (razao >= referencia.razaoMinima && razao <= referencia.razaoMaxima) {
    return { veredicto: 'plausivel', razao, referencia, recado: '' };
  }

  if (razao > referencia.razaoMaxima) {
    // O dobro do comprimento com a mesma largura é a assinatura de duas
    // sementes encostadas dentro de um contorno só.
    const pareceDuas = razao >= referencia.razaoMaxima * 1.5;
    return {
      veredicto: 'alongado-demais',
      razao,
      referencia,
      recado:
        `Contorno com razão ${virgula(razao)} — ${referencia.nomeComum} costuma ficar entre ${esperado}. ` +
        (pareceDuas
          ? 'O alongamento é compatível com duas sementes encostadas num contorno só.'
          : 'Confira se o contorno pegou sombra ou parte da vizinha.'),
    };
  }

  return {
    veredicto: 'redondo-demais',
    razao,
    referencia,
    recado:
      `Contorno com razão ${virgula(razao)} — ${referencia.nomeComum} costuma ficar entre ${esperado}. ` +
      'Confira se o contorno cobre a semente inteira.',
  };
}

function virgula(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}
