// =============================================================================
// Catálogo de datasets — leitura validada do JSON gerado por script.
//
// POR QUÊ.
//
// `scripts/gerar-catalogo-de-datasets.py` varre a pasta `datasets/` (fora do
// repositório) e grava `public/exemplos/catalogo-de-datasets.json`: para cada
// pasta, o formato como o app detecta, contagens, e o que a prosa do dono diz
// sobre origem, licença e citação — com `fonteDoCampo` separando o que foi LIDO
// do que foi DEDUZIDO. O explorador usa isto para dizer, ao lado da pasta
// aberta, de onde ela veio e se pode ser referenciada.
//
// POR QUE VALIDAR EM VEZ DE `as CatalogoDeDatasets`. O JSON é gerado por outro
// programa, em outra linguagem, e vai mudar antes deste tipo mudar. Campo que o
// script passou a gravar e o app ainda não conhece é ignorado; campo com tipo
// errado vira `undefined` (ou o valor "não sei" do campo) em vez de derrubar o
// painel. A única exigência dura é `nome`: entrada sem nome não tem como ser
// casada com uma pasta, então é descartada.
//
// Puro: só recebe o JSON já decodificado. Quem busca o arquivo é
// `features/datasets/catalogo-de-datasets.ts`, que pode tocar `fetch`.
// =============================================================================

import type { FormatoDeDataset } from './formato';

/** Os formatos do app mais os dois que só o catálogo conhece (pasta sem imagem). */
export type FormatoCatalogado = FormatoDeDataset | 'tabular' | 'desconhecido';

/** De onde um campo de texto saiu: a prosa do dono, um arquivo da própria pasta, ou dedução. */
export type FonteDoCampo = 'README' | 'pasta' | 'heuristica';

export type CampoComFonte = 'cultura' | 'origem' | 'licenca' | 'citacao' | 'usoNoSeedCounter';

export interface EntradaDoCatalogo {
  nome: string;
  caminhoRelativo: string;
  formatoDetectado: FormatoCatalogado;
  imagens: { total: number; porExtensao: Record<string, number> };
  outrosArquivos: Record<string, number>;
  anotacoes: string[];
  classes: string[];
  cultura?: string;
  /** Chave curta para agrupar ('orquidea', 'soja', …), sempre deduzida. */
  culturaChave?: string;
  /** URL, DOI, "laboratório" ou "doutorado". */
  origem?: string;
  url?: string;
  /** Só o que está escrito em algum lugar; senão "desconhecida" — que é valor válido. */
  licenca: string;
  citacao?: string;
  /** true só quando origem E licença foram lidas (nunca deduzidas). */
  podeSerReferenciado: boolean;
  usoNoSeedCounter?: string;
  segundoReadme?: { formato?: string; quantidade?: string };
  tamanhoBytes?: number;
  /** Amostra de cabeçalhos: quantos arquivos foram lidos e que DPI cada um declara ('sem' = nenhum). */
  dpiDeclarado?: { amostradas: number; valores: Record<string, number>; paginasNoTiff?: number };
  /** O que o app vê ao abrir a subpasta, quando difere da raiz (milho/MaizeData/<variedade>). */
  formatoDaSubpasta?: { subpasta?: string; formato: FormatoCatalogado; classes: string[] };
  observacoes: string[];
  fonteDoCampo: Partial<Record<CampoComFonte, FonteDoCampo>>;
}

export interface CatalogoDeDatasets {
  versao: number;
  entradas: EntradaDoCatalogo[];
}

const FORMATOS: readonly FormatoCatalogado[] = [
  'yolo',
  'roboflow-multiclass',
  'mascara-de-instancia',
  'mascara-binaria',
  'pasta-por-classe',
  'solto',
  'tabular',
  'desconhecido',
];

const FONTES: readonly FonteDoCampo[] = ['README', 'pasta', 'heuristica'];
const CAMPOS_COM_FONTE: readonly CampoComFonte[] = ['cultura', 'origem', 'licenca', 'citacao', 'usoNoSeedCounter'];

// --- Leitores de campo: tipo errado vira undefined, nunca exceção -----------

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function numero(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function listaDeTextos(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function mapaDeNumeros(v: unknown): Record<string, number> {
  if (!ehObjeto(v)) return {};
  const saida: Record<string, number> = {};
  for (const [k, x] of Object.entries(v)) {
    const n = numero(x);
    if (n !== undefined) saida[k] = n;
  }
  return saida;
}

function formato(v: unknown): FormatoCatalogado {
  return typeof v === 'string' && (FORMATOS as readonly string[]).includes(v) ? (v as FormatoCatalogado) : 'desconhecido';
}

function lerImagens(v: unknown): EntradaDoCatalogo['imagens'] {
  if (!ehObjeto(v)) return { total: 0, porExtensao: {} };
  return { total: numero(v.total) ?? 0, porExtensao: mapaDeNumeros(v.porExtensao) };
}

function lerSegundoReadme(v: unknown): EntradaDoCatalogo['segundoReadme'] {
  if (!ehObjeto(v)) return undefined;
  const formatoDito = texto(v.formato);
  const quantidade = texto(v.quantidade);
  return formatoDito || quantidade ? { formato: formatoDito, quantidade } : undefined;
}

function lerDpi(v: unknown): EntradaDoCatalogo['dpiDeclarado'] {
  if (!ehObjeto(v)) return undefined;
  const amostradas = numero(v.amostradas);
  if (amostradas === undefined) return undefined;
  const paginas = numero(v.paginasNoTiff);
  return { amostradas, valores: mapaDeNumeros(v.valores), ...(paginas !== undefined ? { paginasNoTiff: paginas } : {}) };
}

function lerSubpasta(v: unknown): EntradaDoCatalogo['formatoDaSubpasta'] {
  if (!ehObjeto(v)) return undefined;
  const f = texto(v.formato);
  if (!f) return undefined;
  return { subpasta: texto(v.subpasta), formato: formato(f), classes: listaDeTextos(v.classes) };
}

function lerFontes(v: unknown): EntradaDoCatalogo['fonteDoCampo'] {
  const saida: EntradaDoCatalogo['fonteDoCampo'] = {};
  if (!ehObjeto(v)) return saida;
  for (const campo of CAMPOS_COM_FONTE) {
    const f = v[campo];
    if (typeof f === 'string' && (FONTES as readonly string[]).includes(f)) saida[campo] = f as FonteDoCampo;
  }
  return saida;
}

/** Uma entrada validada, ou `null` quando não há `nome` para casar com pasta alguma. */
export function lerEntrada(v: unknown): EntradaDoCatalogo | null {
  if (!ehObjeto(v)) return null;
  const nome = texto(v.nome);
  if (!nome) return null;
  const licenca = texto(v.licenca) ?? 'desconhecida';
  const fonteDoCampo = lerFontes(v.fonteDoCampo);
  const origem = texto(v.origem);
  // `podeSerReferenciado` vem gravado, mas o app confere a regra de novo: um
  // JSON editado à mão não pode dizer "referenciável" com licença desconhecida.
  const origemLida = origem !== undefined && origem !== 'desconhecida' && fonteDoCampo.origem !== 'heuristica' && fonteDoCampo.origem !== undefined;
  const podeSerReferenciado = v.podeSerReferenciado === true && origemLida && licenca !== 'desconhecida';
  return {
    nome,
    caminhoRelativo: texto(v.caminhoRelativo) ?? nome,
    formatoDetectado: formato(v.formatoDetectado),
    imagens: lerImagens(v.imagens),
    outrosArquivos: mapaDeNumeros(v.outrosArquivos),
    anotacoes: listaDeTextos(v.anotacoes),
    classes: listaDeTextos(v.classes),
    cultura: texto(v.cultura),
    culturaChave: texto(v.culturaChave),
    origem,
    url: texto(v.url),
    licenca,
    citacao: texto(v.citacao),
    podeSerReferenciado,
    usoNoSeedCounter: texto(v.usoNoSeedCounter),
    segundoReadme: lerSegundoReadme(v.segundoReadme),
    tamanhoBytes: numero(v.tamanhoBytes),
    dpiDeclarado: lerDpi(v.dpiDeclarado),
    formatoDaSubpasta: lerSubpasta(v.formatoDaSubpasta),
    observacoes: listaDeTextos(v.observacoes),
    fonteDoCampo,
  };
}

/** O catálogo inteiro. JSON que não é objeto, ou sem `entradas`, vira catálogo vazio — o painel só deixa de mostrar o chip. */
export function lerCatalogo(json: unknown): CatalogoDeDatasets {
  if (!ehObjeto(json)) return { versao: 0, entradas: [] };
  const lista = Array.isArray(json.entradas) ? json.entradas : [];
  const entradas: EntradaDoCatalogo[] = [];
  for (const item of lista) {
    const e = lerEntrada(item);
    if (e) entradas.push(e);
  }
  return { versao: numero(json.versao) ?? 0, entradas };
}

function normalizar(nome: string): string {
  return nome.trim().toLowerCase();
}

/**
 * Entrada pelo nome da pasta. Exato primeiro; depois sem diferenciar caixa nem
 * espaço nas pontas — no Windows a pasta `images` e `Images` são a mesma, e o
 * handle do navegador devolve o nome como está no disco.
 */
export function entradaPorNome(catalogo: CatalogoDeDatasets, nome: string): EntradaDoCatalogo | undefined {
  const exata = catalogo.entradas.find((e) => e.nome === nome);
  if (exata) return exata;
  const alvo = normalizar(nome);
  return catalogo.entradas.find((e) => normalizar(e.nome) === alvo);
}

/**
 * Origem curta para caber num chip: URL vira só o domínio (sem `www.`);
 * "laboratório", "doutorado" e frases curtas passam como estão.
 */
export function resumirOrigem(entrada: Pick<EntradaDoCatalogo, 'origem' | 'url'>): string {
  const candidato = entrada.origem ?? entrada.url;
  if (!candidato) return 'origem desconhecida';
  const m = candidato.match(/^https?:\/\/(?:www\.)?([^/\s]+)/i);
  if (m) return m[1];
  return candidato.length > 48 ? `${candidato.slice(0, 45)}…` : candidato;
}
