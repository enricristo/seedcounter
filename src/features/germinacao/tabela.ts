// =============================================================================
// SeedCounter — germinação: a grade editável e o que ela vira
//
// A tela guarda a grade como TEXTO célula a célula (`TabelaDeEntrada`), não
// como números. É deliberado: enquanto a pessoa digita "21," a célula é
// inválida, e um estado numérico teria que escolher entre apagar o que ela
// digitou ou inventar um zero. Texto guarda o que está na tela; a conversão
// para amostra (`entradasDaTabela`) acontece a cada render e diz, linha por
// linha, o que ainda não dá para ler — sem derrubar as outras linhas.
//
// A grade também é o que persiste entre visitas à aba (`localStorage`): o
// painel desmonta quando a pessoa vai à Contagem e volta, e perder 24 linhas
// coladas por causa de um clique seria o tipo de defeito que faz voltar para
// a planilha.
// =============================================================================

import type { AmostraDeGerminacao, LeituraDeGerminacao } from '../../lib/germinacao';
import { lerNumero } from './entrada';
import {
  CONFIGURACAO_PADRAO,
  UNIFORMIDADES,
  type ConfiguracaoDaAnalise,
  type EntradaDeAmostra,
  type Uniformidade,
} from './analise';

export interface LinhaDaTabela {
  codigo: string;
  sementes: string;
  /** Uma célula por tempo, na ordem de `tempos`. Vazia = sem leitura. */
  contagens: string[];
}

export interface TabelaDeEntrada {
  /** Os tempos em horas, como texto (o cabeçalho é editável). */
  tempos: string[];
  linhas: LinhaDaTabela[];
}

export const TABELA_VAZIA: TabelaDeEntrada = { tempos: [], linhas: [] };

/** Texto de célula com vírgula decimal, como o Excel em português mostra. */
function celula(n: number): string {
  return String(n).replace('.', ',');
}

/** Amostras → grade. Os tempos são a união dos tempos de todas as amostras. */
export function tabelaDasAmostras(amostras: readonly AmostraDeGerminacao[]): TabelaDeEntrada {
  const horas = [...new Set(amostras.flatMap((a) => a.leituras.map((l) => l.horas)))].sort(
    (x, y) => x - y
  );
  return {
    tempos: horas.map(celula),
    linhas: amostras.map((a) => {
      const porTempo = new Map(a.leituras.map((l) => [l.horas, l.acumulado]));
      return {
        codigo: a.codigo,
        sementes: celula(a.sementes),
        contagens: horas.map((h) => {
          const v = porTempo.get(h);
          return v === undefined ? '' : celula(v);
        }),
      };
    }),
  };
}

export type TemposLidos = { horas: number[]; erro: null } | { horas: null; erro: string };

/** O cabeçalho de tempos, lido. Um tempo inválido invalida a grade inteira: sem eixo não há leitura. */
export function lerTempos(tempos: readonly string[]): TemposLidos {
  const horas: number[] = [];
  for (let k = 0; k < tempos.length; k++) {
    const n = lerNumero(tempos[k]);
    if (n === null)
      return { horas: null, erro: `O tempo da coluna ${k + 1} ("${tempos[k]}") não é um número.` };
    if (n < 0) return { horas: null, erro: `O tempo da coluna ${k + 1} é negativo.` };
    if (k > 0 && n <= horas[k - 1]) {
      return {
        horas: null,
        erro: `Os tempos precisam ser crescentes: a coluna ${k + 1} (${tempos[k]} h) não é maior que a anterior (${tempos[k - 1]} h).`,
      };
    }
    horas.push(n);
  }
  return { horas, erro: null };
}

/**
 * Grade → entradas para a análise, linha a linha. Uma célula inválida
 * invalida a LINHA (com a mensagem), nunca a grade. Linhas totalmente vazias
 * são ignoradas — são o espaço em branco que a pessoa deixou para digitar.
 */
export function entradasDaTabela(tabela: TabelaDeEntrada): {
  entradas: EntradaDeAmostra[];
  erroDosTempos: string | null;
} {
  const tempos = lerTempos(tabela.tempos);
  if (tempos.horas === null) return { entradas: [], erroDosTempos: tempos.erro };
  const horas = tempos.horas;

  const entradas: EntradaDeAmostra[] = [];
  for (const linha of tabela.linhas) {
    const vazia =
      linha.codigo.trim() === '' &&
      linha.sementes.trim() === '' &&
      linha.contagens.every((c) => c.trim() === '');
    if (vazia) continue;

    const codigo = linha.codigo.trim();
    if (codigo === '') {
      entradas.push({ codigo: '', amostra: null, erro: 'sem código' });
      continue;
    }
    const sementes = lerNumero(linha.sementes);
    if (sementes === null || !(sementes > 0)) {
      entradas.push({
        codigo,
        amostra: null,
        erro: `número de sementes inválido ("${linha.sementes}")`,
      });
      continue;
    }
    const leituras: LeituraDeGerminacao[] = [];
    let erro: string | null = null;
    for (let k = 0; k < horas.length; k++) {
      const texto = linha.contagens[k] ?? '';
      if (texto.trim() === '') continue;
      const acumulado = lerNumero(texto);
      if (acumulado === null) {
        erro = `a contagem em ${tabela.tempos[k]} h ("${texto}") não é um número`;
        break;
      }
      leituras.push({ horas: horas[k], acumulado });
    }
    if (erro !== null) {
      entradas.push({ codigo, amostra: null, erro });
      continue;
    }
    // O ponto (0, 0) é o que a curva já assume; deixá-lo faria o núcleo
    // recusar por "tempo ≤ 0". Um t = 0 com germinadas > 0 fica, e é
    // recusado com a mensagem certa.
    const semOrigem = leituras.filter((l) => !(l.horas <= 0 && l.acumulado === 0));
    entradas.push({ codigo, amostra: { codigo, sementes, leituras: semOrigem }, erro: null });
  }
  return { entradas, erroDosTempos: null };
}

// ---------------------------------------------------------------------------
// Edições da grade — funções puras, para o componente só despachar
// ---------------------------------------------------------------------------

export function linhaVazia(nTempos: number): LinhaDaTabela {
  return { codigo: '', sementes: '', contagens: Array.from({ length: nTempos }, () => '') };
}

export function acrescentarLinha(tabela: TabelaDeEntrada): TabelaDeEntrada {
  return { ...tabela, linhas: [...tabela.linhas, linhaVazia(tabela.tempos.length)] };
}

export function removerLinha(tabela: TabelaDeEntrada, indice: number): TabelaDeEntrada {
  return { ...tabela, linhas: tabela.linhas.filter((_, i) => i !== indice) };
}

export function acrescentarTempo(tabela: TabelaDeEntrada): TabelaDeEntrada {
  return {
    tempos: [...tabela.tempos, ''],
    linhas: tabela.linhas.map((l) => ({ ...l, contagens: [...l.contagens, ''] })),
  };
}

export function removerTempo(tabela: TabelaDeEntrada, coluna: number): TabelaDeEntrada {
  return {
    tempos: tabela.tempos.filter((_, k) => k !== coluna),
    linhas: tabela.linhas.map((l) => ({
      ...l,
      contagens: l.contagens.filter((_, k) => k !== coluna),
    })),
  };
}

export function editarTempo(
  tabela: TabelaDeEntrada,
  coluna: number,
  valor: string
): TabelaDeEntrada {
  return { ...tabela, tempos: tabela.tempos.map((t, k) => (k === coluna ? valor : t)) };
}

export type CampoDaLinha =
  { campo: 'codigo' } | { campo: 'sementes' } | { campo: 'contagem'; coluna: number };

export function editarCelula(
  tabela: TabelaDeEntrada,
  indice: number,
  campo: CampoDaLinha,
  valor: string
): TabelaDeEntrada {
  return {
    ...tabela,
    linhas: tabela.linhas.map((l, i) => {
      if (i !== indice) return l;
      if (campo.campo === 'codigo') return { ...l, codigo: valor };
      if (campo.campo === 'sementes') return { ...l, sementes: valor };
      return { ...l, contagens: l.contagens.map((c, k) => (k === campo.coluna ? valor : c)) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Persistência — o que sobrevive a sair da aba e voltar
// ---------------------------------------------------------------------------

export const CHAVE_DO_ESTADO = 'sc:germinacao';

export interface EstadoGravado {
  tabela: TabelaDeEntrada;
  configuracao: ConfiguracaoDaAnalise;
}

export function serializarEstado(estado: EstadoGravado): string {
  return JSON.stringify(estado);
}

const ehTextos = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Lê o que foi gravado. Qualquer coisa fora do formato — versão antiga, JSON
 * corrompido — devolve null e a tela começa vazia: perder o rascunho é
 * melhor que quebrar. Nunca lança.
 */
export function lerEstadoGravado(texto: string | null | undefined): EstadoGravado | null {
  if (!texto) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof bruto !== 'object' || bruto === null) return null;
  const obj = bruto as Record<string, unknown>;

  const tabela = obj.tabela;
  if (typeof tabela !== 'object' || tabela === null) return null;
  const t = tabela as Record<string, unknown>;
  if (!ehTextos(t.tempos) || !Array.isArray(t.linhas)) return null;
  const nTempos = t.tempos.length;
  const linhas: LinhaDaTabela[] = [];
  for (const l of t.linhas as unknown[]) {
    if (typeof l !== 'object' || l === null) return null;
    const r = l as Record<string, unknown>;
    if (typeof r.codigo !== 'string' || typeof r.sementes !== 'string' || !ehTextos(r.contagens))
      return null;
    if (r.contagens.length !== nTempos) return null;
    linhas.push({ codigo: r.codigo, sementes: r.sementes, contagens: r.contagens });
  }

  const configuracao = { ...CONFIGURACAO_PADRAO };
  const c =
    typeof obj.configuracao === 'object' && obj.configuracao !== null
      ? (obj.configuracao as Record<string, unknown>)
      : {};
  if (typeof c.germinacaoMinima === 'number' && Number.isFinite(c.germinacaoMinima))
    configuracao.germinacaoMinima = c.germinacaoMinima;
  if (
    c.tMaxParaAuc === null ||
    (typeof c.tMaxParaAuc === 'number' && Number.isFinite(c.tMaxParaAuc))
  )
    configuracao.tMaxParaAuc = c.tMaxParaAuc;
  if (typeof c.percentualParaTx === 'number' && Number.isFinite(c.percentualParaTx))
    configuracao.percentualParaTx = c.percentualParaTx;
  if (typeof c.uniformidade === 'string' && c.uniformidade in UNIFORMIDADES)
    configuracao.uniformidade = c.uniformidade as Uniformidade;

  return { tabela: { tempos: t.tempos, linhas }, configuracao };
}
