// =============================================================================
// SeedCounter — Limites adaptáveis (C5)
//
// O painel "Encontrar" (antiga Detecção Assistida) media tamanho em px²
// absolutos: "tamanho mínimo 200 px" não significa a mesma coisa numa foto de
// 640 px de lado e numa digitalização de 6800 px. Este módulo dá à mesma
// grandeza três roupagens equivalentes — a pessoa escolhe a que faz sentido
// para a cena que tem na mão, e por baixo tudo vira px² antes de chegar em
// `detectObjects` (`lib/detect.ts`), que não muda de assinatura.
//
//   mm²             — só funciona com calibração (`umPerPixel`).
//   fracaoDaMediana — relativo à mediana de área dos objetos já encontrados
//                     nesta imagem; viaja entre imagens e entre culturas.
//   px2             — a unidade que `detectObjects` sempre entendeu; mostrada
//                     sempre, como referência, mesmo quando outra é a editada.
//
// SEM MEDIANA (primeira rodada, antes de qualquer objeto localizado) o modo
// `fracaoDaMediana` não tem o que dividir — cai num padrão por fração da área
// da imagem. É um chute deliberadamente pequeno: existe para não deixar o
// motor sem limite nenhum, não para acertar de cara.
// =============================================================================

export type ModoDeLimite = 'mm2' | 'fracaoDaMediana' | 'px2';

export interface LimiteDeTamanho {
  modo: ModoDeLimite;
  /** No modo do próprio campo: mm², vezes a mediana, ou px² — conforme `modo`. */
  valor: number;
}

export interface ContextoDeLimite {
  /** Calibração da imagem, em micrômetros por pixel. Ausente = sem calibração. */
  umPerPixel?: number;
  /** Mediana de área dos objetos já encontrados nesta imagem, em px². */
  medianaAreaPx?: number;
  /** Área total da imagem (ou da região de varredura), em px². */
  areaDaImagemPx: number;
}

/**
 * Fração da área da imagem usada como área mínima padrão quando o modo é
 * `fracaoDaMediana` e ainda não há mediana (primeira rodada, sem objetos).
 *
 * Deliberadamente pequena: numa digitalização de 6800×9359 px (63,7 Mpx) dá
 * ~640 px² — perto do que já era o padrão manual (60 px²) para uma foto comum
 * de 640×480 (~307 Kpx, ~3 px²... arredondado para o piso de 1 px²). A ideia
 * não é acertar a semente, é não deixar o motor recolher poeira como objeto.
 */
export const FRACAO_MINIMA_PADRAO = 1e-5;

/**
 * Fração da área da imagem usada como área "típica" de objeto quando não há
 * mediana ainda — só para estimar o raio de fundo (`raioDeFundoSugerido`).
 * Maior que `FRACAO_MINIMA_PADRAO`: o objeto típico não é o menor ruído
 * aceitável, é o tamanho que se espera que a semente tenha.
 */
export const FRACAO_TIPICA_PADRAO = 1e-3;

/**
 * Converte um limite de tamanho para px², a unidade que `detectObjects`
 * sempre entendeu. Devolve `null` quando o modo escolhido não tem como ser
 * calculado no contexto atual (mm² sem calibração) — quem chama decide o
 * que fazer (manter o valor anterior, cair para px², etc.).
 */
export function paraPx2(limite: LimiteDeTamanho, ctx: ContextoDeLimite): number | null {
  switch (limite.modo) {
    case 'px2':
      return Math.max(0, limite.valor);

    case 'mm2': {
      if (!ctx.umPerPixel || ctx.umPerPixel <= 0) return null;
      // 1 px² = umPerPixel² µm² = umPerPixel² / 1e6 mm² → px² por mm² = 1e6 / umPerPixel².
      const px2PorMm2 = 1e6 / (ctx.umPerPixel * ctx.umPerPixel);
      return Math.max(0, limite.valor * px2PorMm2);
    }

    case 'fracaoDaMediana': {
      if (ctx.medianaAreaPx && ctx.medianaAreaPx > 0) {
        return Math.max(0, limite.valor * ctx.medianaAreaPx);
      }
      // Sem mediana: padrão por fração da área da imagem, independente do
      // `valor` escolhido — não há "vezes a mediana" sem mediana.
      return Math.max(1, FRACAO_MINIMA_PADRAO * ctx.areaDaImagemPx);
    }

    default:
      return null;
  }
}

/**
 * O raio de fundo (`backgroundRadius` de `detectObjects`) deixa de ser um
 * número de px digitado a esmo: vira "2 × o raio do maior objeto esperado",
 * derivado da mediana de área já encontrada. Sem mediana ainda, usa uma
 * fração da área da imagem como estimativa do objeto típico.
 */
export function raioDeFundoSugerido(ctx: ContextoDeLimite): number {
  const areaTipica =
    ctx.medianaAreaPx && ctx.medianaAreaPx > 0
      ? ctx.medianaAreaPx
      : FRACAO_TIPICA_PADRAO * ctx.areaDaImagemPx;
  const raioEsperado = Math.sqrt(Math.max(0, areaTipica) / Math.PI);
  return Math.max(1, Math.round(2 * raioEsperado));
}

// ---------------------------------------------------------------------------
// Texto para o painel
// ---------------------------------------------------------------------------

/** "1234" → "1 234" — separador de milhar por espaço, como no texto da especificação. */
function comEspacoDeMilhar(inteiro: number): string {
  const sinal = inteiro < 0 ? '-' : '';
  const digitos = Math.round(Math.abs(inteiro)).toString();
  const partes: string[] = [];
  for (let i = digitos.length; i > 0; i -= 3) {
    partes.unshift(digitos.slice(Math.max(0, i - 3), i));
  }
  return sinal + partes.join(' ');
}

function formatarPx2(px2: number): string {
  return `${comEspacoDeMilhar(px2)} px²`;
}

function formatarMm2(mm2: number): string {
  const casas = mm2 < 0.1 ? 3 : mm2 < 10 ? 2 : 1;
  return `${mm2.toFixed(casas).replace('.', ',')} mm²`;
}

function formatarValorDoModo(limite: LimiteDeTamanho): string {
  switch (limite.modo) {
    case 'mm2':
      return formatarMm2(limite.valor);
    case 'px2':
      return formatarPx2(limite.valor);
    case 'fracaoDaMediana': {
      const valor = limite.valor.toFixed(2).replace(/\.?0+$/, '').replace('.', ',') || '0';
      return `${valor}× a mediana`;
    }
  }
}

/**
 * Descreve o limite em texto para o painel, sempre com o px² de referência e,
 * quando há calibração, o equivalente em mm² — mesmo que nenhum dos dois seja
 * o modo escolhido para editar. Ex.: "0,3× a mediana ≈ 1 240 px² ≈ 0,035 mm²".
 */
export function descreverLimite(limite: LimiteDeTamanho, ctx: ContextoDeLimite): string {
  const px2 = paraPx2(limite, ctx);
  if (px2 == null) {
    // mm² sem calibração: não há conta a fazer.
    return `${formatarValorDoModo(limite)} (sem calibração para converter)`;
  }

  const partes = [formatarValorDoModo(limite)];
  if (limite.modo !== 'px2') partes.push(formatarPx2(px2));
  if (limite.modo !== 'mm2' && ctx.umPerPixel && ctx.umPerPixel > 0) {
    const mm2 = px2 / (1e6 / (ctx.umPerPixel * ctx.umPerPixel));
    partes.push(formatarMm2(mm2));
  }
  return partes.join(' ≈ ');
}
