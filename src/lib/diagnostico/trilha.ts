// =============================================================================
// SeedCounter — a trilha: o que aconteceu antes do erro
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Um erro de render deixava tela branca e mais nada. O relato que chega de um
// treinamento é sempre o mesmo — "travou quando eu cliquei ali" — e sem uma
// lista do que veio antes, descobrir qual "ali" custa meia hora de conversa.
// A trilha é essa lista: os poucos momentos que explicam um defeito, na ordem
// em que aconteceram, guardados em memória e entregues só quando a pessoa
// escolhe exportar.
//
// A REGRA DE PRIVACIDADE, QUE NÃO TEM EXCEÇÃO.
//
// NUNCA entra pixel. NUNCA entra dataURL. NUNCA entra conteúdo de imagem.
// NUNCA entra o nome completo de um arquivo do disco de quem usa — só a
// extensão e o tamanho em bytes, que é o que explica um defeito de leitura
// sem dizer que a pasta se chama "tese da fulana".
//
// A regra é dura porque o material fotografado é resultado de pesquisa não
// publicada. Um relatório de diagnóstico que vaze uma imagem é pior que
// nenhum relatório. Por isso ela não é combinada de palavra: `sanitizar`
// abaixo joga fora toda string com mais de 300 caracteres (o tamanho onde
// texto vira carga) ou que comece com `data:` (o prefixo de toda imagem
// embutida), e põe '[omitido]' no lugar.
//
// E POR QUE ELE NÃO PODE LANÇAR.
//
// Registrar um evento é sempre a coisa MENOS importante acontecendo naquele
// instante. Se `registrarEvento` explodisse dentro de um `try` alheio — ou
// pior, fora de um —, o instrumento de diagnóstico viraria a causa do defeito.
// Toda função pública daqui engole o próprio erro em silêncio.
// =============================================================================

/** Um momento registrado. `t` é o milissegundo desde o início da sessão. */
export interface EventoDaTrilha {
  t: number;
  tipo: string;
  detalhe?: Record<string, unknown>;
}

/** De onde o erro chegou: render do React, `window`, promessa ou chamada manual. */
export type OrigemDoErro = 'render' | 'window' | 'promise' | 'manual';

export interface ErroDaTrilha {
  t: number;
  origem: OrigemDoErro;
  mensagem: string;
  /** Pilha, cortada — ver `LIMITE_DA_PILHA`. Ausente quando não veio nenhuma. */
  pilha?: string;
}

/** Teto do anel. Duzentos cobre uma sessão inteira de trabalho sem virar peso. */
export const LIMITE_DE_EVENTOS = 200;

/**
 * Só os últimos erros vão ao relatório em separado. O anel de eventos já
 * guarda todos como evento; esta lista curta existe para o resumo colado numa
 * mensagem, onde três erros são o que cabe.
 */
export const LIMITE_DE_ERROS = 20;

/** Acima disto, uma string do `detalhe` é carga, não informação. */
const LIMITE_DE_TEXTO = 300;

/** Pilha maior que isto não ajuda mais ninguém a ler, e infla o arquivo. */
const LIMITE_DA_PILHA = 4000;

/** Mensagem de erro é uma linha; o resto é ruído copiado de alguma biblioteca. */
const LIMITE_DA_MENSAGEM = 500;

/** Profundidade máxima que `sanitizar` percorre dentro de objetos e listas. */
const PROFUNDIDADE_MAXIMA = 3;

const eventos: EventoDaTrilha[] = [];
const erros: ErroDaTrilha[] = [];

/**
 * O zero do relógio da trilha.
 *
 * `performance.now()` é monotônico: ele não anda para trás quando o sistema
 * acerta o relógio no meio de uma contagem longa, e `Date.now()` anda. Fora do
 * navegador (testes em node) o `performance` pode não existir.
 */
function agora(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch {
    // Ambiente sem `performance` acessível. Segue para o relógio comum.
  }
  return Date.now();
}

const INICIO = agora();

function desdeOInicio(): number {
  return Math.round(agora() - INICIO);
}

/** Corta um texto e avisa que cortou, em vez de mentir um final que não existe. */
function cortar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite)}… [cortado]`;
}

/**
 * Passa o `detalhe` pelo filtro de privacidade.
 *
 * Aceita string, número, booleano, nulo, lista e objeto simples — e nada mais.
 * Função, `Symbol`, elemento de DOM e afins viram `'[ignorado]'`: nenhum deles
 * é serializável, e um deles poderia carregar uma imagem inteira pendurada.
 *
 * O corte por tamanho é o que protege de verdade: uma dataURL de 7992×3672
 * tem dezenas de megabytes, e mesmo um pedaço dela num relatório já seria
 * conteúdo de imagem vazando.
 */
export function sanitizar(detalhe: Record<string, unknown>): Record<string, unknown> {
  try {
    const saida = sanitizarValor(detalhe, 0);
    // `sanitizarValor` devolve objeto para entrada objeto; a checagem existe
    // porque o parâmetro pode chegar de JavaScript sem tipo (um `null`, por
    // exemplo) e o retorno prometido é sempre um registro.
    if (saida !== null && typeof saida === 'object' && !Array.isArray(saida)) {
      return saida as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function sanitizarValor(valor: unknown, profundidade: number): unknown {
  if (valor === null || valor === undefined) return valor ?? null;

  if (typeof valor === 'string') {
    // Ordem deliberada: o prefixo `data:` é barrado ANTES do tamanho, porque
    // uma dataURL curta (um ícone de 1 px) também é conteúdo de imagem.
    if (valor.startsWith('data:')) return '[omitido]';
    if (valor.length > LIMITE_DE_TEXTO) return '[omitido]';
    return valor;
  }

  if (typeof valor === 'number') {
    // NaN e Infinity não sobrevivem a JSON.stringify — viram `null` silencioso.
    return Number.isFinite(valor) ? valor : null;
  }

  if (typeof valor === 'boolean') return valor;

  if (profundidade >= PROFUNDIDADE_MAXIMA) return '[profundo demais]';

  if (Array.isArray(valor)) {
    return valor.slice(0, 50).map((item) => sanitizarValor(item, profundidade + 1));
  }

  if (typeof valor === 'object') {
    // Só objeto simples. Qualquer instância de classe pode arrastar junto um
    // canvas, um `File` ou uma imagem inteira pela cadeia de protótipos.
    const prototipo = Object.getPrototypeOf(valor);
    if (prototipo !== Object.prototype && prototipo !== null) return '[ignorado]';

    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = sanitizarValor(v, profundidade + 1);
    }
    return saida;
  }

  return '[ignorado]';
}

/** Guarda no anel, descartando o mais antigo quando ele enche. */
function empilhar(evento: EventoDaTrilha): void {
  eventos.push(evento);
  if (eventos.length > LIMITE_DE_EVENTOS) {
    eventos.splice(0, eventos.length - LIMITE_DE_EVENTOS);
  }
}

/**
 * Registra um momento que explica um defeito.
 *
 * O que instrumentar é uma decisão de economia, não de cobertura: abrir
 * imagem, calibrar, rodar uma receita, rodar um lote, exportar, trocar de
 * bancada, um worker cair. Instrumentar cada clique encheria o anel de ruído
 * e empurraria para fora justamente o evento de meia hora atrás que explicava
 * tudo.
 */
export function registrarEvento(tipo: string, detalhe?: Record<string, unknown>): void {
  try {
    const evento: EventoDaTrilha = { t: desdeOInicio(), tipo: cortar(String(tipo), 80) };
    if (detalhe) {
      const limpo = sanitizar(detalhe);
      if (Object.keys(limpo).length > 0) evento.detalhe = limpo;
    }
    empilhar(evento);
  } catch {
    // Ver o cabeçalho: o instrumento nunca pode ser a causa.
  }
}

/** Extrai mensagem e pilha do que quer que tenha sido lançado. */
function descrever(erro: unknown): { mensagem: string; pilha?: string } {
  if (erro instanceof Error) {
    const pilha = typeof erro.stack === 'string' ? cortar(erro.stack, LIMITE_DA_PILHA) : undefined;
    return { mensagem: cortar(`${erro.name}: ${erro.message}`, LIMITE_DA_MENSAGEM), pilha };
  }
  if (typeof erro === 'string') return { mensagem: cortar(erro, LIMITE_DA_MENSAGEM) };
  if (erro === null || erro === undefined) return { mensagem: 'Erro sem descrição.' };
  try {
    return { mensagem: cortar(JSON.stringify(erro) ?? String(erro), LIMITE_DA_MENSAGEM) };
  } catch {
    return { mensagem: cortar(String(erro), LIMITE_DA_MENSAGEM) };
  }
}

/**
 * Registra um erro: no anel (para manter a ordem junto dos eventos) e na lista
 * curta de erros (para o resumo que se cola numa mensagem).
 *
 * A pilha entra porque ela é o único jeito de saber QUAL botão quebrou. Ela
 * aponta para arquivo e linha do código do aplicativo — não carrega dado de
 * quem usa.
 */
export function registrarErro(erro: unknown, origem: OrigemDoErro): void {
  try {
    const { mensagem, pilha } = descrever(erro);
    const t = desdeOInicio();

    const registro: ErroDaTrilha = { t, origem, mensagem };
    if (pilha) registro.pilha = pilha;
    erros.push(registro);
    if (erros.length > LIMITE_DE_ERROS) {
      erros.splice(0, erros.length - LIMITE_DE_ERROS);
    }

    empilhar({ t, tipo: 'erro', detalhe: { origem, mensagem } });
  } catch {
    // Idem.
  }
}

/** Cópia do anel, do mais antigo para o mais recente. */
export function lerTrilha(): EventoDaTrilha[] {
  try {
    return eventos.map((e) => ({ ...e, detalhe: e.detalhe ? { ...e.detalhe } : undefined }));
  } catch {
    return [];
  }
}

/** Cópia dos erros, do mais antigo para o mais recente. */
export function lerErros(): ErroDaTrilha[] {
  try {
    return erros.map((e) => ({ ...e }));
  } catch {
    return [];
  }
}

/** Zera tudo. Existe para os testes — o aplicativo nunca chama. */
export function limparTrilha(): void {
  eventos.length = 0;
  erros.length = 0;
}

/**
 * A extensão de um nome de arquivo, em minúsculas e sem o ponto.
 *
 * É o único pedaço do nome que pode entrar na trilha: `.tif` explica um
 * defeito de leitura, "Tese_Maria_placa3.tif" não explica nada a mais e
 * carrega o que não é nosso.
 */
export function extensaoDe(nome: string | undefined): string {
  if (!nome) return 'sem-extensao';
  const ponto = nome.lastIndexOf('.');
  if (ponto < 0 || ponto === nome.length - 1) return 'sem-extensao';
  return nome.slice(ponto + 1).toLowerCase().slice(0, 12);
}
