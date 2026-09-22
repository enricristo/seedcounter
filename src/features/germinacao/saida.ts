// =============================================================================
// SeedCounter — germinação: o que sai para o Excel do coautor
//
// Duas saídas, porque são dois leitores:
//
//   • CSV — para quem vai analisar em R, Python ou noutra planilha: nomes de
//     coluna curtos e sem espaço, ponto e vírgula e vírgula decimal (a
//     convenção do produto para Excel em português, ver `PainelDeComparacao`),
//     BOM para a acentuação, e uma segunda seção com as médias e as letras.
//
//   • TSV "no formato da planilha" — para quem vai COLAR na aba `output` do
//     Germinator e comparar com o que a planilha calculou: os mesmos nomes de
//     coluna, na mesma ordem, inclusive os espaços esquisitos de
//     "t50 totS   (hr)", porque a comparação é célula a célula.
//
// Os números saem com todas as casas: arredondar é decisão de quem lê.
// =============================================================================

import { UNIFORMIDADES, type Analise, type ConfiguracaoDaAnalise, type LinhaAnalisada, type ParametroResumido } from './analise';

/** Número com vírgula decimal; null e NaN viram célula vazia. */
export function celulaNumerica(v: number | null | undefined, casas?: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  const texto = casas === undefined ? String(v) : v.toFixed(casas);
  return texto.replace('.', ',');
}

const BOM = '﻿';

/** Cabeçalho da seção por amostra do CSV (mesma ordem da tabela na tela). */
const COLUNAS_CSV = [
  'codigo',
  'tratamento',
  'repeticao',
  'sementes',
  'gmax',
  't50_maxG_h',
  'tX_maxG_h',
  't50_totS_h',
  'tX_totS_h',
  'uniformidade_h',
  'r2',
  'auc',
  'mgt_h',
  't50_por_mgt',
  'a',
  'b',
  'c',
  'motivo',
] as const;

function linhaCsv(l: LinhaAnalisada): string[] {
  const p = l.parametros;
  return [
    l.codigo,
    l.tratamento,
    String(l.repeticao),
    celulaNumerica(l.sementes),
    celulaNumerica(p?.gMax),
    celulaNumerica(p?.t50MaxG),
    celulaNumerica(p?.tXMaxG),
    celulaNumerica(p?.t50TotS),
    celulaNumerica(p?.tXTotS),
    celulaNumerica(l.uniformidade),
    celulaNumerica(p?.r2),
    celulaNumerica(p?.auc),
    celulaNumerica(p?.mgt),
    celulaNumerica(p?.assimetria),
    celulaNumerica(p?.ajuste.a),
    celulaNumerica(p?.ajuste.b),
    celulaNumerica(p?.ajuste.c),
    l.motivo ?? '',
  ];
}

const COLUNAS_DAS_MEDIAS: readonly { chave: ParametroResumido; nome: string }[] = [
  { chave: 'gMax', nome: 'gmax' },
  { chave: 't50MaxG', nome: 't50_maxG_h' },
  { chave: 'tXMaxG', nome: 'tX_maxG_h' },
  { chave: 't50TotS', nome: 't50_totS_h' },
  { chave: 'tXTotS', nome: 'tX_totS_h' },
  { chave: 'uniformidade', nome: 'uniformidade_h' },
  { chave: 'r2', nome: 'r2' },
  { chave: 'auc', nome: 'auc' },
  { chave: 'mgt', nome: 'mgt_h' },
  { chave: 'assimetria', nome: 't50_por_mgt' },
];

export function escreverCsv(analise: Analise, config: ConfiguracaoDaAnalise): string {
  const sep = ';';
  const saida: string[] = [];
  saida.push(`# uniformidade=${UNIFORMIDADES[config.uniformidade].rotulo}${sep}x_para_tx=${config.percentualParaTx}${sep}tmax_auc_h=${celulaNumerica(analise.tMax)}${sep}germinacao_minima=${config.germinacaoMinima}`);
  saida.push(COLUNAS_CSV.join(sep));
  for (const l of analise.linhas) saida.push(linhaCsv(l).join(sep));

  if (analise.tratamentos.length > 0) {
    saida.push('');
    const cabecalho = ['tratamento', 'n', 'n_ajustadas'];
    for (const c of COLUNAS_DAS_MEDIAS) cabecalho.push(`${c.nome}_media`, `${c.nome}_sd`);
    for (const c of analise.comparacoes) cabecalho.push(`tukey_${c.parametro}`);
    saida.push(cabecalho.join(sep));
    for (const t of analise.tratamentos) {
      const linha = [t.tratamento, String(t.n), String(t.nAjustadas)];
      for (const c of COLUNAS_DAS_MEDIAS) {
        const m = t.medias[c.chave];
        linha.push(celulaNumerica(m?.media), celulaNumerica(m?.sd));
      }
      for (const c of analise.comparacoes) linha.push(c.letras.get(t.tratamento) ?? '');
      saida.push(linha.join(sep));
    }
    for (const c of analise.comparacoes) {
      saida.push(
        `# ANOVA ${c.parametro}: F(${c.anova.dfBetween}; ${c.anova.dfWithin}) = ${celulaNumerica(c.anova.fStat, 3)}${sep}p = ${celulaNumerica(c.anova.pValue, 4)}${sep}Tukey a 5 %`,
      );
    }
  }
  return BOM + saida.join('\r\n') + '\r\n';
}

/**
 * A aba `output` da planilha, coluna por coluna. `x` é o percentual de t-x
 * (20 na planilha original), e a coluna de uniformidade leva o nome da que
 * foi escolhida (u7525 na original).
 */
export function escreverTabelaOUTPUT(analise: Analise, config: ConfiguracaoDaAnalise): string {
  const x = config.percentualParaTx;
  const u = UNIFORMIDADES[config.uniformidade].rotulo.toLowerCase();
  const cabecalho = [
    'code',
    'max hrs',
    'gMAX (%)',
    'yo',
    'a',
    'b',
    't50 maxG (Cs, hr)',
    `${u} (hr)`,
    'r2',
    `${x}(%seeds)`,
    `t${x} maxG (hr)`,
    'tMAX for AUC (hr)',
    'AUC',
    't50 totS   (hr)',
    `t${x}  totS   (hr)`,
    'MGT',
    't50 maxG / MGT',
  ];
  const linhas = analise.linhas.map((l) => {
    const p = l.parametros;
    const ultimoTempo = l.amostra !== null && l.amostra.leituras.length > 0 ? l.amostra.leituras[l.amostra.leituras.length - 1].horas : null;
    if (p === null) return [l.codigo, celulaNumerica(ultimoTempo), '', '', '', '', '', '', '', '', '', '', '', '', '', '', l.motivo ?? ''];
    return [
      l.codigo,
      celulaNumerica(ultimoTempo),
      celulaNumerica(p.gMax),
      celulaNumerica(p.ajuste.y0),
      celulaNumerica(p.ajuste.a),
      celulaNumerica(p.ajuste.b),
      celulaNumerica(p.t50MaxG),
      celulaNumerica(l.uniformidade),
      celulaNumerica(p.r2),
      celulaNumerica(x),
      celulaNumerica(p.tXMaxG),
      celulaNumerica(p.tMax),
      celulaNumerica(p.auc),
      celulaNumerica(p.t50TotS),
      celulaNumerica(p.tXTotS),
      celulaNumerica(p.mgt),
      celulaNumerica(p.assimetria),
    ];
  });
  return [cabecalho, ...linhas].map((l) => l.join('\t')).join('\r\n') + '\r\n';
}
