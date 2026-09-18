// =============================================================================
// SeedCounter — o que o arquivo já conta sobre a amostra
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Quem digitaliza já escreveu a identificação da amostra — no nome do arquivo,
// no nome da pasta, na página do TIFF. "Repetição Cattleya rupestris.tif" tem
// a espécie e a repetição; a pasta tem o ensaio; a página tem qual das dez
// espécies é. Pedir para a pessoa digitar de novo o que ela acabou de escrever
// é a forma mais barata de fazer alguém desistir de preencher metadado — e
// metadado não preenchido é a razão número um de dado que não se reaproveita.
//
// A REGRA: ISTO SUGERE, NUNCA PREENCHE SOZINHO.
//
// A mesma regra do resto do produto — a máquina propõe, a pessoa confere. Um
// palpite de espécie que entra calado no laudo é pior que campo vazio: o campo
// vazio se vê, o palpite errado não. Por isso cada sugestão vem com o TRECHO
// que a originou, para quem lê poder julgar em um segundo se faz sentido, e
// com uma confiança que separa "li isto no nome" de "deduzi".
//
// E POR QUE O PALPITE É CONSERVADOR.
//
// Só reconhece o que tem forma reconhecível: binômio latino (dois termos, o
// primeiro capitalizado), número de repetição, data. Não tenta adivinhar
// tratamento nem projeto a partir de texto livre, porque a taxa de acerto
// disso é baixa e cada erro custa a confiança em TODAS as outras sugestões —
// inclusive nas boas.
// =============================================================================

export type ConfiancaDaSugestao = 'lido' | 'deduzido';

export interface Sugestao<T = string> {
  valor: T;
  /** O pedaço do nome que produziu isto, para a pessoa conferir num relance. */
  origem: string;
  confianca: ConfiancaDaSugestao;
}

export interface SugestoesDaAmostra {
  especieNomeCientifico?: Sugestao;
  repeticao?: Sugestao<number>;
  data?: Sugestao;
  /** Nome da pasta, que costuma ser o ensaio. */
  projeto?: Sugestao;
  /** Página do arquivo, base 1, quando veio de um TIFF de várias. */
  pagina?: Sugestao<number>;
}

/** Tira extensão, troca separadores por espaço e colapsa o que sobrou. */
function limpar(nome: string): string {
  return nome
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Binômio latino: `Genero especie`.
 *
 * Exige a primeira palavra capitalizada. O epíteto vem minúsculo pela regra de
 * escrita do nome científico, mas é aceito maiúsculo também — ver a nota longa
 * no corpo, que é onde essa concessão está justificada.
 *
 * Aceita erro de grafia no epíteto, porque corrigir grafia não é tarefa deste
 * módulo — a pessoa confere, e o trecho de origem está ali para isso. O que
 * NÃO faz é inventar o gênero.
 */
export function acharBinomio(
  texto: string
): { binomio: string; trecho: string; foraDaConvencao: boolean } | null {
  // \p{Lu}/\p{Ll} com a flag u: nome científico não tem acento, mas o resto do
  // nome do arquivo tem, e classes ASCII quebrariam a segmentação em "Repetição".
  // O EPÍTETO PODE VIR MAIÚSCULO, e isso não é teoria: o arquivo real do
  // laboratório se chama "Repetição Cattleya Ruspestris.tif". A convenção manda
  // minúscula, mas quem nomeia arquivo às 18h não segue convenção — e recusar o
  // caso real para honrar a regra seria o software estar certo e inútil.
  //
  // Aceitar maiúscula custa: "Projeto Mayara" passa a ter a mesma forma de
  // "Cattleya rupestris". Duas defesas, e as duas precisam existir: a lista de
  // primeiras palavras proibidas barra as que aparecem em nome de arquivo de
  // laboratório, e o epíteto maiúsculo sai marcado como fora da convenção, o
  // que rebaixa a confiança da sugestão em vez de afirmar.
  //
  // PARES DESLIZANTES, e não `matchAll` com /g — custou um teste vermelho.
  // Com /g, o primeiro par de "Repetição Cattleya rupestris" é
  // "Repetição Cattleya"; ele é descartado por "repetição" estar na lista
  // proibida, MAS a varredura já consumiu "Cattleya" junto, e o binômio de
  // verdade nunca chega a ser testado. Descartar um par não pode custar a
  // palavra seguinte, e por isso a varredura anda de uma em uma.
  const palavras = texto.split(/\s+/).filter(Boolean);
  const proibidas = new Set([
    'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'para', 'por', 'em',
    'repeticao', 'repetição', 'placa', 'lote', 'amostra', 'teste', 'foto',
    'imagem', 'pagina', 'página', 'especies', 'espécies', 'scan', 'digitalizar',
    'projeto', 'ensaio', 'copia', 'cópia', 'novo', 'nova', 'final', 'versao',
    'versão', 'doc', 'tese', 'qualificacao', 'qualificação',
  ]);
  const ehGenero = (w: string) => /^\p{Lu}\p{Ll}{2,}$/u.test(w);
  const ehEpiteto = (w: string) => /^\p{L}\p{Ll}{2,}$/u.test(w);

  for (let i = 0; i + 1 < palavras.length; i++) {
    const genero = palavras[i];
    const epiteto = palavras[i + 1];
    if (!ehGenero(genero) || !ehEpiteto(epiteto)) continue;
    if (proibidas.has(genero.toLowerCase()) || proibidas.has(epiteto.toLowerCase())) continue;
    const foraDaConvencao = epiteto[0] === epiteto[0].toUpperCase();
    return { binomio: `${genero} ${epiteto}`, trecho: `${genero} ${epiteto}`, foraDaConvencao };
  }
  return null;
}

/** "Repetição 2", "rep 3", "R4" — o número da repetição, quando declarado. */
function acharRepeticao(texto: string): { n: number; trecho: string } | null {
  const re = /\b(?:repeti[cç][aã]o|repeticao|rep|r)\s*[:-]?\s*(\d{1,2})\b/iu;
  const m = texto.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 && n <= 99 ? { n, trecho: m[0] } : null;
}

/** Data em AAAA-MM-DD ou AAAAMMDD dentro do nome. */
function acharData(texto: string): { iso: string; trecho: string } | null {
  const m = texto.match(/\b(20\d{2})[ -]?(0[1-9]|1[0-2])[ -]?(0[1-9]|[12]\d|3[01])\b/);
  if (!m) return null;
  return { iso: `${m[1]}-${m[2]}-${m[3]}`, trecho: m[0] };
}

export interface ContextoDoArquivo {
  nomeDoArquivo: string;
  /** Nome da pasta que contém o arquivo, quando conhecido. */
  pasta?: string;
  /** Página aberta, base 0, e total — para um TIFF de várias. */
  pagina?: number;
  totalDePaginas?: number;
}

/**
 * O que dá para propor a partir do arquivo e do contexto.
 *
 * O nome do arquivo é lido primeiro e a pasta depois: o arquivo é mais
 * específico. Uma pasta chamada "Cattleya" com um arquivo "Cattleya rupestris"
 * deve propor a espécie do arquivo, não a do diretório.
 */
export function sugerirDoArquivo(ctx: ContextoDoArquivo): SugestoesDaAmostra {
  const doArquivo = limpar(ctx.nomeDoArquivo ?? '');
  const daPasta = ctx.pasta ? limpar(ctx.pasta) : '';
  const s: SugestoesDaAmostra = {};

  const bin = acharBinomio(doArquivo) ?? (daPasta ? acharBinomio(daPasta) : null);
  if (bin) {
    s.especieNomeCientifico = {
      valor: bin.binomio,
      origem: bin.trecho,
      // Epíteto maiúsculo quebra a convenção do binômio, então pode ser nome
      // de pessoa, de projeto ou de pasta com a mesma forma. Continua valendo
      // como proposta — mas como DEDUZIDO, para quem confere olhar duas vezes.
      confianca: bin.foraDaConvencao ? 'deduzido' : 'lido',
    };
  }

  const rep = acharRepeticao(doArquivo);
  if (rep) s.repeticao = { valor: rep.n, origem: rep.trecho, confianca: 'lido' };

  const data = acharData(doArquivo) ?? (daPasta ? acharData(daPasta) : null);
  if (data) s.data = { valor: data.iso, origem: data.trecho, confianca: 'lido' };

  if (daPasta) {
    s.projeto = { valor: daPasta, origem: ctx.pasta ?? '', confianca: 'deduzido' };
  }

  // A página só vira sugestão quando há mais de uma: num arquivo de página
  // única, dizer "página 1" é ruído com cara de informação.
  if (
    typeof ctx.pagina === 'number' &&
    typeof ctx.totalDePaginas === 'number' &&
    ctx.totalDePaginas > 1
  ) {
    s.pagina = {
      valor: ctx.pagina + 1,
      origem: `página ${ctx.pagina + 1} de ${ctx.totalDePaginas}`,
      confianca: 'lido',
    };
  }

  return s;
}

/** Quantas sugestões saíram — para a interface decidir se vale mostrar algo. */
export function quantasSugestoes(s: SugestoesDaAmostra): number {
  return Object.values(s).filter((v) => v !== undefined).length;
}
