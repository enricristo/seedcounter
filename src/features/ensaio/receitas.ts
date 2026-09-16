// =============================================================================
// SeedCounter — receitas do ensaio ao carregar
//
// Numa espécie nova ninguém sabe qual parâmetro de localização/onda funciona.
// Em vez de a pessoa tentar um por um, o app roda um conjunto pequeno de
// receitas ao carregar a imagem e mostra cada resultado lado a lado — a
// pessoa escolhe uma ou nenhuma (`EnsaioPanel`). Este arquivo é só dados e
// funções puras: a receita em si, e o resumo de um conjunto de contornos.
// =============================================================================

import type { DetectionOptions } from '../../lib/detect';
import type { OpcoesDaOnda } from '../../lib/region-growing';
import type { Ponto } from '../../lib/aglomerado';
import { areaDoPoligono, limiaresDaPopulacao, analisarContorno } from '../../lib/aglomerado';
import { feret } from '../../lib/feret';

/**
 * Uma receita é um conjunto de parâmetros com nome. Três, não trinta: o
 * objetivo é a pessoa olhar e escolher, e três miniaturas cabem na lateral.
 */
export interface Receita {
  id: string;
  nome: string;
  /** Uma frase: em que cena esta receita tende a acertar. */
  quando: string;
  localizacao: DetectionOptions;
  onda: OpcoesDaOnda;
}

// `DetectionOptions.sensitivity` é 0–100 (o padrão em `detect.ts` é 50), não
// 0–1 — conferido contra a assinatura real antes de escrever isto.
export const RECEITAS: Receita[] = [
  {
    id: 'padrao',
    nome: 'Padrão',
    quando: 'Semente clara em fundo escuro (ou o inverso), bem separada.',
    localizacao: { sensitivity: 50, splitTouching: false },
    onda: {},
  },
  {
    id: 'sensivel',
    nome: 'Sensível',
    quando: 'Semente pequena ou de cor próxima do fundo; pega mais, erra mais.',
    localizacao: { sensitivity: 70, splitTouching: false, denoise: 1 },
    onda: { recuoDoEscape: 0.15 },
  },
  {
    id: 'conservador',
    nome: 'Conservador',
    quando: 'Cena com sujeira ou sombra; só o que é inequívoco.',
    localizacao: { sensitivity: 35, splitTouching: false, denoise: 2, maxElongation: 4 },
    onda: { recuoDoEscape: 0.05 },
  },
];

export interface ContornoProposto {
  contorno: Ponto[];
  areaPx: number;
  /** Marcado por `analisarContorno` com o limiar da própria população. */
  suspeitoDeAglomerado: boolean;
}

export interface ResumoDaReceita {
  contagem: number;
  medianaDaAreaPx: number | null;
  medianaDoFeretMaxPx: number | null;
  suspeitos: number;
}

function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Marca suspeitos com o limiar DA PRÓPRIA população (Degrau 1, Task 4) e
 * resume. Tudo em px: o resumo é para comparar receitas entre si na mesma
 * imagem, não para o laudo — por isso não passa por `valor-de-boletim`.
 */
export function resumir(contornos: Ponto[][]): {
  propostos: ContornoProposto[];
  resumo: ResumoDaReceita;
} {
  const limiares = limiaresDaPopulacao(contornos) ?? undefined;
  const propostos = contornos.map((c) => {
    // `analisarContorno(contorno, referenciaDeArea, limiares)` — o 2º
    // parâmetro é a referência de área (NaN = sem referência), não os
    // limiares; conferido contra `src/lib/aglomerado.ts`.
    const analise = analisarContorno(c, NaN, limiares);
    return {
      contorno: c,
      areaPx: areaDoPoligono(c),
      suspeitoDeAglomerado: analise.veredito === 'aglomerado',
    };
  });
  const ferets = contornos.map((c) => feret(c)?.maximo).filter((v): v is number => typeof v === 'number');
  return {
    propostos,
    resumo: {
      contagem: propostos.length,
      medianaDaAreaPx: mediana(propostos.map((p) => p.areaPx)),
      medianaDoFeretMaxPx: mediana(ferets),
      suspeitos: propostos.filter((p) => p.suspeitoDeAglomerado).length,
    },
  };
}
