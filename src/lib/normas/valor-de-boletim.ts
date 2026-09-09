// =============================================================================
// SeedCounter — o valor de um campo de Boletim de Análise de Sementes
//
// POR QUE UM CAMPO DE BOLETIM NÃO É UM NÚMERO.
//
// O aplicativo hoje guarda contagens e porcentagens como `number`. Num laudo,
// isso é insuficiente: a norma distingue **quatro estados** que um `number`
// colapsa num só, e a IN 40/2010 é explícita ao dizer que "nenhum campo do
// Boletim deve ficar em branco".
//
//   0  ou  0,0   MEDIDO. Contou-se, e o resultado é zero.
//   -0-          NÃO APLICÁVEL. A espécie não tem essa fração; não há o que
//                medir. Diferente de ter medido e dado zero.
//   -N-          NÃO REALIZADO. A determinação não foi feita.
//   Traço        Existe, mas abaixo de 0,05 % na pureza — fica FORA do cálculo
//                que fecha 100 %, e mesmo assim precisa aparecer.
//
// Confundir "não medi" com "medi e deu zero" num laudo não é detalhe de
// interface: é erro de laboratório. Um lote que teve a determinação de outras
// sementes pulada e um lote em que ela deu zero são situações completamente
// diferentes para quem compra a semente, e o boletim tem símbolos distintos
// justamente por isso.
//
// Guardar os quatro estados num tipo — em vez de num `number` mais uma
// convenção de -1, NaN ou null espalhada pelo código — é o que faz a distinção
// sobreviver ao caminho inteiro: banco, cálculo, exportação e PDF.
//
// Fundamentação: docs/superpowers/specs/2026-09-08-norma-e-pratica-de-laboratorio.md
// =============================================================================

/** Os quatro estados que um campo de boletim pode ter. */
export type ValorDeBoletim =
  | { estado: 'medido'; valor: number }
  | { estado: 'nao-aplicavel' }
  | { estado: 'nao-realizado' }
  | { estado: 'traco' };

// ---------------------------------------------------------------------------
// Construtores
// ---------------------------------------------------------------------------

/** Mediu-se, e o resultado é este. Zero é um resultado legítimo. */
export function medido(valor: number): ValorDeBoletim {
  return { estado: 'medido', valor };
}

/** A espécie não tem essa fração — não há o que medir. Sai como `-0-`. */
export const NAO_APLICAVEL: ValorDeBoletim = { estado: 'nao-aplicavel' };

/** A determinação não foi feita. Sai como `-N-`. */
export const NAO_REALIZADO: ValorDeBoletim = { estado: 'nao-realizado' };

/** Existe, mas abaixo de 0,05 % — fica fora da soma. Sai como `Traço`. */
export const TRACO: ValorDeBoletim = { estado: 'traco' };

/** Fração abaixo da qual a norma manda registrar como Traço, na pureza. */
export const LIMIAR_DE_TRACO = 0.05;

/**
 * Converte uma porcentagem medida no valor que a norma manda registrar.
 *
 * Abaixo de 0,05 % o componente vira `Traço` — presente no boletim, ausente do
 * cálculo. Escrever "0,0" ali seria dizer que não há, e há.
 */
export function porcentagemDePureza(valor: number): ValorDeBoletim {
  if (valor > 0 && valor < LIMIAR_DE_TRACO) return TRACO;
  return medido(valor);
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * O número para efeito de CÁLCULO, ou `null` quando não há número.
 *
 * `Traço` devolve `null` de propósito: a norma manda excluí-lo da soma que
 * fecha 100 %. Tratá-lo como zero daria o mesmo total e perderia o motivo.
 */
export function paraCalculo(v: ValorDeBoletim): number | null {
  return v.estado === 'medido' ? v.valor : null;
}

/** Há número aqui? */
export function temValor(v: ValorDeBoletim): v is { estado: 'medido'; valor: number } {
  return v.estado === 'medido';
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/** Como cada estado sem número aparece no boletim. */
const SIMBOLOS: Record<Exclude<ValorDeBoletim['estado'], 'medido'>, string> = {
  'nao-aplicavel': '-0-',
  'nao-realizado': '-N-',
  traco: 'Traço',
};

/**
 * Arredondamento decimal meio-para-cima, previsível.
 *
 * POR QUE NÃO `toFixed`.
 *
 * `(99.85).toFixed(1)` devolve **"99.8"**, não "99.9". Não é bug do
 * interpretador: 99,85 não é exatamente representável em binário e fica
 * guardado como 99,8499999…, então o arredondamento honesto do valor guardado
 * é para baixo. O mesmo acontece com `(1.005).toFixed(2)` → "1.00" e
 * `(2.675).toFixed(2)` → "2.67".
 *
 * Num relatório qualquer isso é um centésimo. Num boletim é outra coisa: a
 * norma prescreve arredondamento, a soma tem de fechar 100,0 %, e um analista
 * que confere a conta na calculadora encontra um número diferente do impresso.
 * Uma ferramenta que erra o arredondamento perde a confiança antes de chegar
 * na parte difícil.
 *
 * A volta pela notação exponencial em texto reancora o valor na base dez antes
 * de arredondar: "99.85e1" é lido como 998,5, que É exatamente representável,
 * e aí `Math.round` faz o meio-para-cima que se espera.
 */
export function arredondar(valor: number, casas: number): number {
  if (!Number.isFinite(valor)) return valor;
  const sinal = valor < 0 ? -1 : 1;
  const absoluto = Math.abs(valor);
  const subido = Number(`${absoluto}e${casas}`);
  if (!Number.isFinite(subido)) return valor;
  return sinal * Number(`${Math.round(subido)}e-${casas}`);
}

/**
 * O texto que vai para o boletim.
 *
 * Vírgula decimal, porque é um documento brasileiro. `casas` é o número de
 * casas que a norma prescreve para aquele campo: pureza usa uma, germinação
 * usa zero (inteiros), o peso de mil sementes varia por espécie (Tabela 9.1).
 */
export function formatar(v: ValorDeBoletim, casas = 1): string {
  if (v.estado !== 'medido') return SIMBOLOS[v.estado];
  const arredondado = arredondar(v.valor, casas);
  // toFixed aqui é seguro: o valor já está na casa certa, e o que resta é só
  // completar zeros à direita.
  return arredondado.toFixed(casas).replace('.', ',');
}

/** Descrição em linguagem de gente, para a interface explicar o símbolo. */
export function explicar(v: ValorDeBoletim): string {
  switch (v.estado) {
    case 'medido':
      return 'Medido.';
    case 'nao-aplicavel':
      return 'Não aplicável a esta espécie — não há o que medir.';
    case 'nao-realizado':
      return 'Determinação não realizada.';
    case 'traco':
      return `Presente, abaixo de ${LIMIAR_DE_TRACO.toString().replace('.', ',')} % — fora do cálculo.`;
  }
}

// ---------------------------------------------------------------------------
// Migração
// ---------------------------------------------------------------------------

/**
 * Converte um número solto do modelo antigo.
 *
 * Todo número que já existe no banco foi medido — não havia como registrar
 * outra coisa. `null` e `undefined` viram "não realizado", que é a leitura
 * conservadora: afirmar que mediu e deu zero seria inventar um resultado.
 */
export function deNumeroAntigo(valor: number | null | undefined): ValorDeBoletim {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return NAO_REALIZADO;
  return medido(valor);
}
