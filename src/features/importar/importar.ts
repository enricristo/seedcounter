// =============================================================================
// SeedCounter — o que entra por JSON, lido e conferido sem tocar o navegador
//
// POR QUE EXISTE. `App.tsx` tinha um leitor de JSON de 140 linhas que decidia
// por tentativa o que o arquivo era — segmentações de um modelo externo,
// backup do histórico ou uma sessão avulsa — e confiava no conteúdo: `seg.id`,
// `seg.polygon_points`, `parsed.metadata`, tudo lido como se fosse do tipo
// certo. Um campo trocado virava `TypeError` no meio do `map`, e a pessoa via
// "Erro ao ler o arquivo JSON", que não diz nada. Aqui a leitura é separada
// em três passos que dá para provar em node: reconhecer o tipo, conferir a
// forma e traduzir para o vocabulário do app.
//
// AS TRÊS REGRAS DA CONFERÊNCIA.
//
//   1. Campo que o app não conhece é ignorado, nunca motivo de recusa — o
//      JSON de segmentações vem de ferramentas que escrevem mais do que o app
//      lê (`bbox`, `area`, `class_id`), e o backup é o passado do próprio app,
//      que já teve campos que hoje não existem.
//   2. Campo conhecido com o TIPO errado é erro dito, com o índice e o nome:
//      "Segmentação 3: 'polygon_points' deveria ser uma lista de pares [x, y]".
//      É o que separa "o arquivo é de outro programa" de "o arquivo foi
//      editado à mão e quebrou".
//   3. A classe vem de `categoriaImportada` (lib/classe-do-modelo), nunca de
//      `class === 1` — 1 é VIÁVEL na tabela do treino, e este importador já
//      errou isso uma vez (`fonte-unica.test.ts`, defeito 4).
//
// A ORDEM DE RECONHECIMENTO É A DE SEMPRE: segmentações, depois lista
// (backup), depois sessão avulsa. Ela importa porque um backup é uma lista e
// uma sessão é um objeto com `metadata`; um arquivo de segmentações é um
// objeto com `segmentations`, e é testado primeiro porque é o mais específico.
//
// A parte que lê `File` e escreve no estado está em `useImportacao.ts`.
// =============================================================================

import type { Mark, Metadata, Session, YoloSegmentation } from '../../types';
import { calculateSeedDimensions } from '../../lib/pca-utils';
import { categoriaDoNome, categoriaImportada, nomeDaCategoria } from '../../lib/classe-do-modelo';

export type TipoDeJSON = 'backup' | 'segmentacoes' | 'sessao';

/** Recusa com motivo — o texto vai direto para a pessoa, então diz o que faltou. */
export interface ErroDeImportacao {
  erro: string;
}

/** Uma sessão avulsa como o app a exporta (`sessaoEmJSON`), já conferida. */
export interface SessaoImportada {
  metadata: Metadata;
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  /** Ausente quando o arquivo não o traz — o App só troca o nome se vier. */
  filename?: string;
}

export type ResultadoDaImportacao =
  | { tipo: 'segmentacoes'; segmentacoes: YoloSegmentation[] }
  | { tipo: 'backup'; sessoes: Session[] }
  | { tipo: 'sessao'; sessao: SessaoImportada }
  | ErroDeImportacao;

export function ehErro(r: unknown): r is ErroDeImportacao {
  return typeof r === 'object' && r !== null && 'erro' in r && typeof r.erro === 'string';
}

// ---------------------------------------------------------------------------
// Mensagens — as mesmas que o App mostrava, num lugar só
// ---------------------------------------------------------------------------

export const MENSAGEM_JSON_ILEGIVEL =
  'Erro ao ler o arquivo JSON. Certifique-se de que é um formato válido.';
export const MENSAGEM_FORMATO_DESCONHECIDO =
  'Arquivo JSON com formato não reconhecido (não é YOLO, Backup ou Sessão).';
/** Quando a gravação no IndexedDB falha — o arquivo passou na conferência. */
export const MENSAGEM_HISTORICO_INVALIDO = 'Formato de histórico inválido.';

/** O que dizer quando a importação deu certo. */
export function mensagemDeImportacao(r: Exclude<ResultadoDaImportacao, ErroDeImportacao>): string {
  switch (r.tipo) {
    case 'segmentacoes':
      return `YOLO segmentações importadas! Encontradas ${r.segmentacoes.length} segmentações.`;
    case 'backup':
      return `Histórico importado com sucesso! ${r.sessoes.length} sessões adicionadas/mescladas.`;
    case 'sessao':
      return 'Sessão importada com sucesso!';
  }
}

// ---------------------------------------------------------------------------
// Ler e reconhecer
// ---------------------------------------------------------------------------

type Registro = Record<string, unknown>;

function ehRegistro(v: unknown): v is Registro {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** JSON não tem `undefined`; `null` é o jeito de dizer "sem valor". */
function ausente(v: unknown): boolean {
  return v === undefined || v === null;
}

/** Nome do tipo como aparece na mensagem: "lista", "texto", "número"… */
function tipoDe(v: unknown): string {
  if (v === null) return 'nulo';
  if (Array.isArray(v)) return 'lista';
  switch (typeof v) {
    case 'string':
      return 'texto';
    case 'number':
      return 'número';
    case 'boolean':
      return 'booleano';
    case 'object':
      return 'objeto';
    default:
      return typeof v;
  }
}

function lerJSON(texto: string): { valor: unknown } | ErroDeImportacao {
  try {
    return { valor: JSON.parse(texto) };
  } catch {
    return { erro: MENSAGEM_JSON_ILEGIVEL };
  }
}

/** A mesma decisão de sempre, sobre o valor já lido. */
function classificarValor(v: unknown): TipoDeJSON | ErroDeImportacao {
  if (ehRegistro(v) && !ausente(v.segmentations)) return 'segmentacoes';
  if (Array.isArray(v)) return 'backup';
  if (
    ehRegistro(v) &&
    !ausente(v.metadata) &&
    (!ausente(v.marks) || !ausente(v.yoloSegmentations))
  ) {
    return 'sessao';
  }
  return { erro: MENSAGEM_FORMATO_DESCONHECIDO };
}

/**
 * Que tipo de arquivo é este. Só reconhece — não confere o conteúdo; para
 * isso há `segmentacoesDeJSON`, `backupDeJSON` e `sessaoDeJSON`, ou
 * `interpretarJSON`, que faz os dois passos numa leitura só.
 */
export function classificarJSON(texto: string): TipoDeJSON | ErroDeImportacao {
  const lido = lerJSON(texto);
  if (ehErro(lido)) return lido;
  return classificarValor(lido.valor);
}

// ---------------------------------------------------------------------------
// Conferir — cada campo conhecido, pelo tipo que o app espera
// ---------------------------------------------------------------------------

type TipoSimples = 'string' | 'number' | 'boolean' | 'object';
const NOME_DO_TIPO: Record<TipoSimples, string> = {
  string: 'texto',
  number: 'número',
  boolean: 'booleano',
  object: 'objeto',
};

function ehPar(p: unknown): p is [number, number] {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1])
  );
}

function ehListaDePares(v: unknown): v is [number, number][] {
  return Array.isArray(v) && v.every(ehPar);
}

/**
 * Um campo opcional de tipo simples: ausente passa, presente tem de bater.
 * Devolve a mensagem de erro, ou `null` quando está tudo certo.
 */
function conferirTipo(r: Registro, campo: string, esperado: TipoSimples, onde: string): string | null {
  const v = r[campo];
  if (ausente(v)) return null;
  const ok = esperado === 'object' ? ehRegistro(v) : typeof v === esperado;
  if (ok) return null;
  return `${onde}: "${campo}" deveria ser ${NOME_DO_TIPO[esperado]}, e é ${tipoDe(v)}.`;
}

function conferirTipos(r: Registro, campos: [string, TipoSimples][], onde: string): string | null {
  for (const [campo, esperado] of campos) {
    const erro = conferirTipo(r, campo, esperado, onde);
    if (erro) return erro;
  }
  return null;
}

/** Um campo obrigatório de número — as coordenadas e o id. */
function numeroObrigatorio(r: Registro, campo: string, onde: string): number | ErroDeImportacao {
  const v = r[campo];
  if (typeof v === 'number') return v;
  return {
    erro: ausente(v)
      ? `${onde}: falta o campo "${campo}".`
      : `${onde}: "${campo}" deveria ser número, e é ${tipoDe(v)}.`,
  };
}

/**
 * O polígono de um contorno: `polygon_points` ou, no vocabulário de alguns
 * produtores, `points`. Ausente vira lista vazia, como sempre foi — o
 * contorno entra sem forma e a tabela de medidas o deixa em branco (regra 2
 * do AGENTS: vazio em vez de inventado). Presente com o tipo errado é erro.
 */
function poligonoDe(seg: Registro, onde: string): { pontos: [number, number][] } | ErroDeImportacao {
  const campo = !ausente(seg.polygon_points) ? 'polygon_points' : 'points';
  const bruto = ausente(seg[campo]) ? [] : seg[campo];
  if (!ehListaDePares(bruto)) {
    return { erro: `${onde}: "${campo}" deveria ser uma lista de pares [x, y].` };
  }
  return { pontos: bruto };
}

// --- Segmentações de um modelo externo --------------------------------------

function segmentacoesDeValor(v: unknown): YoloSegmentation[] | ErroDeImportacao {
  if (!ehRegistro(v)) {
    return { erro: `O arquivo deveria ser um objeto com "segmentations", e é ${tipoDe(v)}.` };
  }
  const lista = v.segmentations;
  if (!Array.isArray(lista)) {
    return { erro: `O campo "segmentations" deveria ser uma lista, e é ${tipoDe(lista)}.` };
  }

  const saida: YoloSegmentation[] = [];
  for (let idx = 0; idx < lista.length; idx++) {
    const seg: unknown = lista[idx];
    const onde = `Segmentação ${idx + 1}`;
    if (!ehRegistro(seg)) {
      return { erro: `${onde}: deveria ser um objeto, e é ${tipoDe(seg)}.` };
    }
    const tipos = conferirTipos(
      seg,
      [
        ['id', 'number'],
        ['confidence', 'number'],
        ['edited', 'boolean'],
      ],
      onde
    );
    if (tipos) return { erro: tipos };

    const poligono = poligonoDe(seg, onde);
    if (ehErro(poligono)) return poligono;
    const polygon_points = poligono.pontos;
    const { width, height } = calculateSeedDimensions(polygon_points);

    // `category` → `class_name` (com ou sem acento) → índice pela tabela do
    // treino. Antes `class === 1` virava inviável aqui, mas 1 é VIÁVEL em
    // `YOLO_CLASSES` — o mesmo engano que a fila com IA teve.
    const category = categoriaImportada(seg);

    saida.push({
      id: typeof seg.id === 'number' ? seg.id : idx,
      category,
      class_name: nomeDaCategoria(category),
      confidence: typeof seg.confidence === 'number' ? seg.confidence : 1.0,
      polygon_points,
      // Qualquer coisa que não seja `false` é visível — inclusive ausente.
      visible: seg.visible !== false,
      edited: seg.edited === true,
      width,
      height,
    });
  }
  return saida;
}

/** Segmentações de um JSON externo (`{ segmentations: [...] }`). */
export function segmentacoesDeJSON(texto: string): YoloSegmentation[] | ErroDeImportacao {
  const lido = lerJSON(texto);
  if (ehErro(lido)) return lido;
  return segmentacoesDeValor(lido.valor);
}

// --- Backup do histórico ------------------------------------------------------

const CAMPOS_DA_SESSAO_DO_BACKUP: [string, TipoSimples][] = [
  ['id', 'string'],
  ['date', 'string'],
  ['filename', 'string'],
  ['viableCount', 'number'],
  ['inviableCount', 'number'],
  ['metadata', 'object'],
];

/**
 * Cada sessão do backup precisa do que a tabela do histórico lê e do que o
 * IndexedDB exige (`id`). O que está DENTRO — marcas, contornos — não é
 * conferido de propósito: o backup é o passado do próprio app, e recusar um
 * histórico inteiro por um campo que uma versão antiga não escrevia seria
 * pior que abri-lo. O objeto vai para o banco como veio, sem cópia.
 */
function sessaoDoBackup(v: unknown, idx: number): Session | ErroDeImportacao {
  const onde = `Sessão ${idx + 1} do backup`;
  if (!ehRegistro(v)) return { erro: `${onde}: deveria ser um objeto, e é ${tipoDe(v)}.` };

  for (const [campo] of CAMPOS_DA_SESSAO_DO_BACKUP) {
    if (ausente(v[campo])) return { erro: `${onde}: falta o campo "${campo}".` };
  }
  const tipos = conferirTipos(v, CAMPOS_DA_SESSAO_DO_BACKUP, onde);
  if (tipos) return { erro: tipos };
  for (const campo of ['marks', 'yoloSegmentations'] as const) {
    if (!ausente(v[campo]) && !Array.isArray(v[campo])) {
      return { erro: `${onde}: "${campo}" deveria ser lista, e é ${tipoDe(v[campo])}.` };
    }
  }
  const imagem = conferirTipo(v, 'imageData', 'string', onde);
  if (imagem) return { erro: imagem };

  // Conferido campo a campo acima; o compilador só não acompanhou o laço.
  return v as unknown as Session;
}

function backupDeValor(v: unknown): Session[] | ErroDeImportacao {
  if (!Array.isArray(v)) {
    return { erro: `Um backup do histórico é uma lista de sessões, e o arquivo é ${tipoDe(v)}.` };
  }
  const sessoes: Session[] = [];
  for (let i = 0; i < v.length; i++) {
    const s = sessaoDoBackup(v[i], i);
    if (ehErro(s)) return s;
    sessoes.push(s);
  }
  return sessoes;
}

/** As sessões de um backup do histórico (a lista que `handleExportHistoryJSON` grava). */
export function backupDeJSON(texto: string): Session[] | ErroDeImportacao {
  const lido = lerJSON(texto);
  if (ehErro(lido)) return lido;
  return backupDeValor(lido.valor);
}

// --- Sessão avulsa --------------------------------------------------------------

/**
 * O metadado da sessão. Os seis campos de texto alimentam campos controlados
 * do formulário, então ausência vira '' — o valor que o app já usa para "não
 * preenchido" — e não `undefined`. Todo o resto passa como veio: a amostra,
 * o protocolo, a calibração, a procedência.
 */
function metadataDe(v: unknown): Metadata | ErroDeImportacao {
  if (!ehRegistro(v)) {
    return { erro: `"metadata" deveria ser um objeto, e é ${tipoDe(v)}.` };
  }
  const tipos = conferirTipos(
    v,
    [
      ['researcher', 'string'],
      ['project', 'string'],
      ['treatment', 'string'],
      ['plate', 'string'],
      ['quadrant', 'string'],
      ['notes', 'string'],
      ['baselineCount', 'number'],
      ['useDifferential', 'boolean'],
      ['umPerPixel', 'number'],
    ],
    'metadata'
  );
  if (tipos) return { erro: tipos };

  const texto = (campo: string): string => (typeof v[campo] === 'string' ? (v[campo] as string) : '');
  return {
    ...v,
    researcher: texto('researcher'),
    project: texto('project'),
    treatment: texto('treatment'),
    plate: texto('plate'),
    quadrant: texto('quadrant'),
    notes: texto('notes'),
  };
}

function marcasDe(v: unknown): Mark[] | ErroDeImportacao {
  if (ausente(v)) return [];
  if (!Array.isArray(v)) return { erro: `"marks" deveria ser lista, e é ${tipoDe(v)}.` };
  const marcas: Mark[] = [];
  for (let i = 0; i < v.length; i++) {
    const m: unknown = v[i];
    const onde = `Marcação ${i + 1}`;
    if (!ehRegistro(m)) return { erro: `${onde}: deveria ser um objeto, e é ${tipoDe(m)}.` };
    const x = numeroObrigatorio(m, 'x', onde);
    if (ehErro(x)) return x;
    const y = numeroObrigatorio(m, 'y', onde);
    if (ehErro(y)) return y;
    const id = numeroObrigatorio(m, 'id', onde);
    if (ehErro(id)) return id;
    // Pela tabela canônica, e não por comparação literal: aceita 'Viável'
    // de um arquivo editado à mão e recusa qualquer outra coisa com nome.
    const type = typeof m.type === 'string' ? categoriaDoNome(m.type) : null;
    if (!type) return { erro: `${onde}: "type" deveria ser "viable" ou "inviable".` };
    marcas.push({ ...m, x, y, id, type });
  }
  return marcas;
}

function contornosDaSessao(v: unknown): YoloSegmentation[] | ErroDeImportacao {
  if (ausente(v)) return [];
  if (!Array.isArray(v)) return { erro: `"yoloSegmentations" deveria ser lista, e é ${tipoDe(v)}.` };
  const saida: YoloSegmentation[] = [];
  for (let i = 0; i < v.length; i++) {
    const seg: unknown = v[i];
    const onde = `Contorno ${i + 1}`;
    if (!ehRegistro(seg)) return { erro: `${onde}: deveria ser um objeto, e é ${tipoDe(seg)}.` };
    const id = numeroObrigatorio(seg, 'id', onde);
    if (ehErro(id)) return id;
    const tipos = conferirTipos(
      seg,
      [
        ['confidence', 'number'],
        ['width', 'number'],
        ['height', 'number'],
      ],
      onde
    );
    if (tipos) return { erro: tipos };
    const poligono = poligonoDe(seg, onde);
    if (ehErro(poligono)) return poligono;

    // Largura e altura gravadas valem; sem elas, medidas do contorno — como
    // o App sempre fez ao importar uma sessão.
    const medidas = calculateSeedDimensions(poligono.pontos);
    const category = categoriaImportada(seg);
    saida.push({
      ...seg,
      id,
      category,
      class_name: nomeDaCategoria(category),
      confidence: typeof seg.confidence === 'number' ? seg.confidence : 1.0,
      polygon_points: poligono.pontos,
      width: typeof seg.width === 'number' ? seg.width : medidas.width,
      height: typeof seg.height === 'number' ? seg.height : medidas.height,
    });
  }
  return saida;
}

function sessaoDeValor(v: unknown): SessaoImportada | ErroDeImportacao {
  if (!ehRegistro(v)) {
    return { erro: `Uma sessão é um objeto com "metadata", e o arquivo é ${tipoDe(v)}.` };
  }
  const metadata = metadataDe(v.metadata);
  if (ehErro(metadata)) return metadata;
  const marks = marcasDe(v.marks);
  if (ehErro(marks)) return marks;
  const segmentacoes = contornosDaSessao(v.yoloSegmentations);
  if (ehErro(segmentacoes)) return segmentacoes;
  const nome = conferirTipo(v, 'filename', 'string', 'Sessão');
  if (nome) return { erro: nome };

  const sessao: SessaoImportada = { metadata, marks, segmentacoes };
  // Nome vazio também não troca o da cena — o App sempre testou por verdade.
  if (typeof v.filename === 'string' && v.filename) sessao.filename = v.filename;
  return sessao;
}

/** Uma sessão avulsa, como `sessaoEmJSON` a exporta. */
export function sessaoDeJSON(texto: string): SessaoImportada | ErroDeImportacao {
  const lido = lerJSON(texto);
  if (ehErro(lido)) return lido;
  return sessaoDeValor(lido.valor);
}

// ---------------------------------------------------------------------------
// Tudo de uma vez
// ---------------------------------------------------------------------------

/**
 * Reconhece e confere numa leitura só — é o que o hook chama. Um backup com
 * as fotos embutidas passa de 100 MB; ler duas vezes para classificar e
 * depois conferir dobraria o pico de memória sem motivo.
 */
export function interpretarJSON(texto: string): ResultadoDaImportacao {
  const lido = lerJSON(texto);
  if (ehErro(lido)) return lido;
  const tipo = classificarValor(lido.valor);
  if (ehErro(tipo)) return tipo;

  switch (tipo) {
    case 'segmentacoes': {
      const segmentacoes = segmentacoesDeValor(lido.valor);
      return ehErro(segmentacoes) ? segmentacoes : { tipo, segmentacoes };
    }
    case 'backup': {
      const sessoes = backupDeValor(lido.valor);
      return ehErro(sessoes) ? sessoes : { tipo, sessoes };
    }
    case 'sessao': {
      const sessao = sessaoDeValor(lido.valor);
      return ehErro(sessao) ? sessao : { tipo, sessao };
    }
  }
}
