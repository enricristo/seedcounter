// =============================================================================
// SeedCounter — germinação: de onde os dados entram (e para onde voltam)
//
// POR QUE ESTE MÓDULO FALA A LÍNGUA DA PLANILHA.
//
// O laboratório usa hoje a planilha `Germinator_curve-fitting` (Joosen et al.,
// 2010). A aba INPUT dela é uma grade: uma linha de cabeçalho com os tempos em
// horas, e uma linha por amostra com `código`, `nº de sementes` e a contagem
// ACUMULADA em cada tempo. A tela substitui a planilha, então o caminho de
// entrada mais curto é o que a pessoa já faz: selecionar a aba INPUT no
// Excel, Ctrl+C, colar aqui. E o de saída é o inverso, porque o coautor que
// ainda usa Excel precisa receber a mesma grade de volta.
//
// O que se tolera de propósito: vírgula decimal (Excel em português), colunas
// vazias (Excel copia até a última coluna preenchida da SELEÇÃO, não da
// linha), linhas em branco no fim, e um cabeçalho que tem "t" ou "code" antes
// dos tempos — só as células numéricas do cabeçalho são tempos.
//
// O que NÃO se tolera: uma contagem que não é número, uma linha sem código,
// mais contagens do que tempos. Nesses casos o erro diz a LINHA e o que
// esperava, porque quem cola 24 linhas não vai procurar a errada sozinho.
//
// A validação de conteúdo (acumulado não decresce, tempos crescentes, poucas
// germinadas) NÃO mora aqui: é do núcleo (`lib/germinacao/hill.ts`), que
// recusa a amostra com motivo — e a tela mostra o motivo na linha, em vez de
// esconder a amostra.
//
// A SEGUNDA PORTA: O LONGITUDINAL.
//
// O experimento longitudinal (`types.ts`, `Experiment`) conta em DIAS e por
// tratamento; o Germinator conta em HORAS e por amostra. `doLongitudinal` é
// a ponte — dias × 24, acumulado — e é só isso: um botão, não uma fusão dos
// dois modelos.
// =============================================================================

import type { AmostraDeGerminacao, LeituraDeGerminacao } from '../../lib/germinacao';
import type { Experiment } from '../../types';

export type ResultadoDaLeitura =
  { amostras: AmostraDeGerminacao[]; erro: null } | { amostras: null; erro: string };

/**
 * Um número como o Excel em português cola: "21", "21,5", " 21.5 ", "1e3".
 * Devolve null para o que não é número — inclusive a célula vazia, que quem
 * chama trata separado (vazia é "sem leitura", não "leitura inválida").
 */
export function lerNumero(celula: string): number | null {
  const texto = celula.trim();
  if (texto === '') return null;
  // Uma vírgula só e nenhum ponto: é decimal em português. Com os dois
  // ("1.234,5") o formato é ambíguo e fica como não-número.
  const normalizado = texto.includes(',') && !texto.includes('.') ? texto.replace(',', '.') : texto;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** Divide uma linha nas células: tabulação (o que o Excel cola) ou ponto e vírgula. */
function celulasDe(linha: string): string[] {
  const separador = linha.includes('\t') ? '\t' : ';';
  return linha.split(separador).map((c) => c.trim());
}

/**
 * Lê o texto colado da aba INPUT.
 *
 * Primeira linha não vazia: o cabeçalho, de onde saem os tempos (toda célula
 * numérica, na ordem). Linhas seguintes: `código`, `sementes`, e uma contagem
 * por tempo. Célula de contagem vazia significa "não houve leitura nesse
 * tempo para esta amostra" — a amostra fica com menos leituras, não com zero.
 */
export function lerTabelaColada(texto: string): ResultadoDaLeitura {
  const linhas = texto.split(/\r\n|\r|\n/);

  // A numeração de linha nas mensagens é a do texto colado (1 = primeira
  // linha, vazia ou não), para bater com o que a pessoa vê no Excel.
  let indiceDoCabecalho = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (celulasDe(linhas[i]).some((c) => c !== '')) {
      indiceDoCabecalho = i;
      break;
    }
  }
  if (indiceDoCabecalho === -1)
    return { amostras: null, erro: 'Nada para ler: o texto está vazio.' };

  const tempos: number[] = [];
  for (const celula of celulasDe(linhas[indiceDoCabecalho])) {
    const n = lerNumero(celula);
    if (n !== null) tempos.push(n);
  }
  if (tempos.length === 0) {
    return {
      amostras: null,
      erro: `Linha ${indiceDoCabecalho + 1}: esperava os tempos em horas no cabeçalho (ex.: "t  48  96  168…"), mas não há nenhum número nela.`,
    };
  }
  for (let k = 1; k < tempos.length; k++) {
    if (tempos[k] <= tempos[k - 1]) {
      return {
        amostras: null,
        erro: `Linha ${indiceDoCabecalho + 1}: os tempos precisam ser crescentes, mas ${tempos[k - 1]} vem antes de ${tempos[k]}.`,
      };
    }
  }
  if (tempos[0] < 0) {
    return {
      amostras: null,
      erro: `Linha ${indiceDoCabecalho + 1}: o tempo ${tempos[0]} é negativo.`,
    };
  }

  const amostras: AmostraDeGerminacao[] = [];
  for (let i = indiceDoCabecalho + 1; i < linhas.length; i++) {
    const celulas = celulasDe(linhas[i]);
    if (celulas.every((c) => c === '')) continue; // linha em branco: pula
    const numero = i + 1;

    const codigo = celulas[0] ?? '';
    if (codigo === '') {
      return {
        amostras: null,
        erro: `Linha ${numero}: esperava o código da amostra na 1ª coluna, mas ela está vazia.`,
      };
    }

    const sementes = lerNumero(celulas[1] ?? '');
    if (sementes === null || !(sementes > 0)) {
      return {
        amostras: null,
        erro: `Linha ${numero} (${codigo}): esperava o número de sementes na 2ª coluna, encontrei "${celulas[1] ?? ''}".`,
      };
    }

    const contagens = celulas.slice(2);
    // O Excel pode colar células vazias além da última coluna; só o que
    // tem conteúdo conta contra o número de tempos.
    let ultimaPreenchida = -1;
    for (let k = 0; k < contagens.length; k++) if (contagens[k] !== '') ultimaPreenchida = k;
    if (ultimaPreenchida >= tempos.length) {
      return {
        amostras: null,
        erro: `Linha ${numero} (${codigo}): há ${ultimaPreenchida + 1} contagens, mas o cabeçalho tem só ${tempos.length} tempos.`,
      };
    }

    const leituras: LeituraDeGerminacao[] = [];
    for (let k = 0; k < tempos.length; k++) {
      const celula = contagens[k] ?? '';
      if (celula === '') continue;
      const acumulado = lerNumero(celula);
      if (acumulado === null) {
        return {
          amostras: null,
          erro: `Linha ${numero} (${codigo}), tempo ${tempos[k]} h: esperava uma contagem, encontrei "${celula}".`,
        };
      }
      leituras.push({ horas: tempos[k], acumulado });
    }
    if (leituras.length === 0) {
      return { amostras: null, erro: `Linha ${numero} (${codigo}): nenhuma contagem preenchida.` };
    }

    amostras.push({ codigo, sementes, leituras });
  }

  if (amostras.length === 0) {
    return { amostras: null, erro: 'Só há o cabeçalho: nenhuma linha de amostra abaixo dele.' };
  }
  return { amostras, erro: null };
}

/** Número com vírgula decimal, sem zeros à direita — como a planilha mostra. */
function celulaNumerica(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Escreve a grade da aba INPUT: `t`, célula vazia sobre a coluna de sementes,
 * e os tempos — depois uma linha por amostra. Tabulação entre células e CRLF
 * no fim da linha, que é o que o Excel espera ao colar.
 *
 * Os tempos são a UNIÃO dos tempos de todas as amostras, em ordem: amostras
 * vindas do longitudinal podem ter grades diferentes, e a planilha só tem uma
 * linha de tempos. Onde a amostra não tem leitura, a célula fica vazia —
 * `lerTabelaColada` lê isso de volta como "sem leitura", então a ida e a
 * volta são inversas.
 */
export function escreverTabelaINPUT(amostras: readonly AmostraDeGerminacao[]): string {
  const tempos = [...new Set(amostras.flatMap((a) => a.leituras.map((l) => l.horas)))].sort(
    (x, y) => x - y
  );
  const cabecalho = ['t', '', ...tempos.map(celulaNumerica)];
  const linhas = amostras.map((a) => {
    const porTempo = new Map(a.leituras.map((l) => [l.horas, l.acumulado]));
    return [
      a.codigo,
      celulaNumerica(a.sementes),
      ...tempos.map((t) => {
        const v = porTempo.get(t);
        return v === undefined ? '' : celulaNumerica(v);
      }),
    ];
  });
  return [cabecalho, ...linhas].map((l) => l.join('\t')).join('\r\n') + '\r\n';
}

/**
 * Por que um experimento não pode virar amostras do Germinator. null = pode.
 *
 * O eixo 'armazenamento' é a razão de existir desta checagem: nele cada data
 * é uma amostra NOVA e a curva é de deterioração, não de germinação acumulada
 * — ajustar Hill a isso daria um t50 sem significado. Ver `Experiment.timeAxis`.
 */
export function motivoParaNaoImportar(experiment: Experiment): string | null {
  if (experiment.timeAxis === 'armazenamento') {
    return 'Este experimento mede dias de armazenamento: cada data é uma amostra nova, e a curva não é de germinação acumulada.';
  }
  if (experiment.treatments.every((t) => t.plates.length === 0)) {
    return 'Este experimento ainda não tem nenhuma avaliação registrada.';
  }
  return null;
}

/**
 * Do experimento longitudinal para amostras do Germinator: uma amostra por
 * tratamento, código = código do tratamento, horas = dias × 24, acumulado =
 * germinadas naquele dia.
 *
 * Por que por TRATAMENTO e não por placa: `PlateRun` não carrega qual placa
 * é — só o dia e a contagem — e as avaliações de um mesmo dia já são somadas
 * pela vista de Estatísticas. A soma por dia é a leitura mais fina que o
 * modelo permite. `sementes` é o maior total visto, para que o acumulado
 * nunca passe do total quando o número de placas varia entre dias.
 *
 * Um dia zero com zero germinadas é o ponto (0, 0) que a curva já assume; é
 * removido para o núcleo não recusar a amostra por "tempo ≤ 0".
 */
export function doLongitudinal(experiment: Experiment): AmostraDeGerminacao[] {
  if (motivoParaNaoImportar(experiment) !== null) return [];
  const amostras: AmostraDeGerminacao[] = [];
  for (const tratamento of experiment.treatments) {
    if (tratamento.plates.length === 0) continue;
    const porDia = new Map<number, { germinadas: number; total: number }>();
    for (const placa of tratamento.plates) {
      const atual = porDia.get(placa.dayIndex) ?? { germinadas: 0, total: 0 };
      atual.germinadas += placa.germinatedSeeds;
      atual.total += placa.totalSeeds;
      porDia.set(placa.dayIndex, atual);
    }
    const dias = [...porDia.keys()].sort((a, b) => a - b);
    const sementes = Math.max(...dias.map((d) => porDia.get(d)?.total ?? 0));
    if (!(sementes > 0)) continue;
    const leituras: LeituraDeGerminacao[] = [];
    for (const dia of dias) {
      const { germinadas } = porDia.get(dia) ?? { germinadas: 0 };
      if (dia <= 0 && germinadas === 0) continue;
      leituras.push({ horas: dia * 24, acumulado: Math.min(germinadas, sementes) });
    }
    if (leituras.length === 0) continue;
    amostras.push({ codigo: tratamento.code || tratamento.name, sementes, leituras });
  }
  return amostras;
}
