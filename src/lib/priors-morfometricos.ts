// =============================================================================
// SeedCounter — Priors Morfométricos
//
// ESTES NUMEROS SAO REFERENCIA, NAO VEREDITO.
//
// A primeira versao deste modulo usava a solidez de literatura para DECIDIR
// "aglomerado", "danificada", "impureza". Foi retirada porque contradiz a
// medicao do projeto: limiar absoluto de solidez reprova 78% das orquideias
// sadias (3530 contornos reais). E os perfis vem de outros scanners e outras
// segmentacoes — a solidez 0,987 do feijao de Koklu e a solidez do contorno
// DELES.
//
// Quem decide aglomerado e `aglomerado.ts`, com limiar relativo a populacao da
// propria imagem. Aqui fica o que a literatura diz, para orientar o olho — o
// mesmo estatuto de `tamanhos-de-semente.ts`.
//
// PERFIL MEDIDO (B4): `compararComPerfil` aceita, como ULTIMO parametro
// opcional, um `PerfilMedido` — o resultado de "Medir esta pasta"
// (`lib/perfil-medido.ts`), medido com a MESMA onda que o app usa no clique.
// Quando ele existe, e preferido ao perfil de literatura: e uma referencia
// nas nossas condicoes, nao de outro scanner. Continua sendo so referencia —
// a nota muda de fonte, o veredito continua sem existir aqui.
// =============================================================================

import { compararComPerfilMedido, type PerfilMedido } from './perfil-medido';
export type { PerfilMedido };

export interface PerfilBiometrico {
  id: string;
  nomeCientifico: string;
  nomePopular: string;
  solidezMedia: number;
  /** Limiar abaixo do qual o contorno tem forte indício de aglomerado ou dano */
  solidezMinimaTipica: number;
  circularidadeMedia: number;
  circularidadeMinimaTipica: number;
  aspectRatioMedio: number;
  excentricidadeMedia: number;
  /** Indica se a espécie possui testa irregular/alças que reduzem a solidez natural */
  contornoNaturalmenteIrregular: boolean;
  observacoes: string;
}

/**
 * Base de conhecimento biométrico de referência baseada nos datasets catalogados:
 * - Feijão Seco: Koklu & Ozkan (2020) — 13.611 sementes
 * - Abóbora: Koklu et al. (2021) — 2.500 sementes
 * - Arroz: Cinar & Koklu (2019) / Seymasa — 18.185 sementes
 * - Soja: Mendeley c733bjz4m3 — 12.683 sementes segmentadas
 * - Milho: Yungprof123 — 17.724 sementes
 * - Orquídea: Dados do grupo GPEOrq / Prof. Nelson
 */
export const PERFIS_BIOMETRICOS: Record<string, PerfilBiometrico> = {
  soja: {
    id: 'soja',
    nomeCientifico: 'Glycine max',
    nomePopular: 'Soja',
    solidezMedia: 0.985,
    solidezMinimaTipica: 0.93,
    circularidadeMedia: 0.92,
    circularidadeMinimaTipica: 0.82,
    aspectRatioMedio: 1.18,
    excentricidadeMedia: 0.52,
    contornoNaturalmenteIrregular: false,
    observacoes: 'Contorno liso e esferoidal. Queda de solidez indica toque com vizinha ou dano no tegumento.',
  },
  feijao: {
    id: 'feijao',
    nomeCientifico: 'Phaseolus vulgaris',
    nomePopular: 'Feijão',
    solidezMedia: 0.987,
    solidezMinimaTipica: 0.92,
    circularidadeMedia: 0.87,
    circularidadeMinimaTipica: 0.75,
    aspectRatioMedio: 1.58,
    excentricidadeMedia: 0.75,
    contornoNaturalmenteIrregular: false,
    observacoes: 'Forma reniforme ou elíptica regular. Hilo discreto não reduz solidez abaixo de 0,92.',
  },
  arroz: {
    id: 'arroz',
    nomeCientifico: 'Oryza sativa',
    nomePopular: 'Arroz',
    solidezMedia: 0.982,
    solidezMinimaTipica: 0.90,
    circularidadeMedia: 0.65,
    circularidadeMinimaTipica: 0.50,
    aspectRatioMedio: 3.10,
    excentricidadeMedia: 0.92,
    contornoNaturalmenteIrregular: false,
    observacoes: 'Grão alongado (alta excentricidade). Circularidade naturalmente mais baixa devido à proporção.',
  },
  milho: {
    id: 'milho',
    nomeCientifico: 'Zea mays',
    nomePopular: 'Milho',
    solidezMedia: 0.972,
    solidezMinimaTipica: 0.89,
    circularidadeMedia: 0.84,
    circularidadeMinimaTipica: 0.72,
    aspectRatioMedio: 1.38,
    excentricidadeMedia: 0.68,
    contornoNaturalmenteIrregular: false,
    observacoes: 'Semente achatada/dentada, formato angular característico.',
  },
  abobora: {
    id: 'abobora',
    nomeCientifico: 'Cucurbita pepo',
    nomePopular: 'Abóbora',
    solidezMedia: 0.985,
    solidezMinimaTipica: 0.91,
    circularidadeMedia: 0.80,
    circularidadeMinimaTipica: 0.68,
    aspectRatioMedio: 1.85,
    excentricidadeMedia: 0.84,
    contornoNaturalmenteIrregular: false,
    observacoes: 'Semente plana e elíptica com margem contínua.',
  },
  orquidea: {
    id: 'orquidea',
    nomeCientifico: 'Orchidaceae',
    nomePopular: 'Orquídea',
    solidezMedia: 0.88,
    solidezMinimaTipica: 0.78,
    circularidadeMedia: 0.58,
    circularidadeMinimaTipica: 0.40,
    aspectRatioMedio: 2.6,
    excentricidadeMedia: 0.88,
    contornoNaturalmenteIrregular: true,
    observacoes: 'Semente minúscula com testa papirácea estriada e aberta; solidez naturalmente mais baixa.',
  },
};

export interface MetricasContorno {
  areaPx: number;
  perimetroPx?: number;
  solidez: number;
  circularidade: number;
  razaoDeAspecto?: number;
  areaMm2?: number;
  comprimentoMm?: number;
  larguraMm?: number;
  /** Área dividida pela mediana da cena, se calculada */
  razaoDeArea?: number;
}

export interface ComparacaoComPerfil {
  perfil: PerfilBiometrico | null;
  /** Presente quando um perfil MEDIDO foi passado e preferido ao de literatura. */
  perfilMedido?: PerfilMedido | null;
  solidezForaDaFaixa: boolean;
  circularidadeForaDaFaixa: boolean;
  /** Frase para a interface. Vazia quando dentro da faixa ou sem perfil. */
  nota: string;
}

/**
 * Compara o contorno com um perfil de referência da espécie.
 *
 * `perfilMedido`, quando presente, é PREFERIDO ao de literatura — é uma
 * referência medida nas nossas condições (`lib/perfil-medido.ts`), não a de
 * outro scanner. Sem `perfilMedido` (ou com `n === 0`), cai no perfil de
 * literatura de sempre.
 *
 * Devolve SO a comparacao. Nao diz "aglomerado", nao diz "quebrada": isso
 * seria transformar um numero de outro laboratorio (ou de outra pasta) em
 * veredito sobre este contorno.
 */
export function compararComPerfil(
  metricas: { solidez: number; circularidade: number; razaoDeAspecto?: number },
  especieId?: string,
  perfilMedido?: PerfilMedido | null
): ComparacaoComPerfil {
  if (perfilMedido && perfilMedido.n > 0) {
    const comparacaoMedida = compararComPerfilMedido(
      { solidez: metricas.solidez, razaoDeAspecto: metricas.razaoDeAspecto },
      perfilMedido
    );
    return {
      perfil: null,
      perfilMedido,
      solidezForaDaFaixa: comparacaoMedida.solidezForaDaFaixa,
      // O perfil medido não guarda circularidade (não faz parte de
      // `MedidaDeUmObjeto`) — só a literatura avalia esse eixo.
      circularidadeForaDaFaixa: false,
      nota: comparacaoMedida.nota,
    };
  }

  const perfil = especieId ? (PERFIS_BIOMETRICOS[especieId.toLowerCase()] ?? null) : null;
  if (!perfil) {
    return { perfil: null, solidezForaDaFaixa: false, circularidadeForaDaFaixa: false, nota: '' };
  }

  // Testa irregular: a faixa de literatura nao se aplica com rigor, entao o
  // piso e afrouxado — nao se acusa o que a especie tem por natureza.
  const pisoSolidez = perfil.contornoNaturalmenteIrregular
    ? perfil.solidezMinimaTipica - 0.25
    : perfil.solidezMinimaTipica;

  const solidezForaDaFaixa = Number.isFinite(metricas.solidez) && metricas.solidez < pisoSolidez;
  const circularidadeForaDaFaixa =
    Number.isFinite(metricas.circularidade) &&
    metricas.circularidade < perfil.circularidadeMinimaTipica;

  if (!solidezForaDaFaixa && !circularidadeForaDaFaixa) {
    return { perfil, solidezForaDaFaixa, circularidadeForaDaFaixa, nota: '' };
  }

  const partes: string[] = [];
  if (solidezForaDaFaixa) {
    partes.push(`solidez ${metricas.solidez.toFixed(2)} abaixo do tipico na literatura (${pisoSolidez.toFixed(2)})`);
  }
  if (circularidadeForaDaFaixa) {
    partes.push(`circularidade ${metricas.circularidade.toFixed(2)} abaixo do tipico na literatura (${perfil.circularidadeMinimaTipica.toFixed(2)})`);
  }
  return {
    perfil,
    solidezForaDaFaixa,
    circularidadeForaDaFaixa,
    nota: `Fora da faixa de literatura para ${perfil.nomePopular}: ${partes.join('; ')}. Confira o contorno.`,
  };
}
