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
import { acharPorNome } from '../../lib/normas/tamanhos-de-semente';
import { FRACAO_MINIMA_PADRAO } from '../../lib/limites-adaptaveis';
import type { ReceitaSalva } from '../../lib/db';

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
  {
    id: 'ia',
    nome: 'IA (YOLO)',
    quando: 'Orquídeas, forrageiras ou sementes muito pequenas/aglomeradas.',
    localizacao: { usaModeloDeIA: true, sensitivity: 50 },
    onda: {},
  },
];

/**
 * As receitas que o ENSAIO AO CARREGAR pode rodar.
 *
 * O ensaio existe com uma premissa: ser barato o suficiente para rodar sem
 * worker toda vez que uma imagem abre. A receita de IA quebra a premissa — e
 * pior: `detectObjects` ignora `usaModeloDeIA`, então a prévia rotulada
 * "IA (YOLO)" seria na verdade a localização clássica a 50% de sensibilidade,
 * com o nome errado em cima. Um resultado com rótulo errado é pior que
 * nenhum. A IA continua disponível onde é tratada de verdade: no Lote
 * (`processar-imagem.ts`) e em "Processar Fila".
 */
export const RECEITAS_DO_ENSAIO: Receita[] = RECEITAS.filter((r) => !r.localizacao.usaModeloDeIA);

/**
 * Converte uma receita salva no Dexie (`useReceitasSalvas`) de volta para o
 * formato que o ensaio e o painel Encontrar entendem. O `id` ganha o prefixo
 * `salva-` para não colidir com os ids fixos de `RECEITAS` nem com o
 * `especie-*` de `receitaPelaEspecie`.
 */
export function receitaDeSalva(salva: ReceitaSalva & { id: number }): Receita {
  return {
    id: `salva-${salva.id}`,
    nome: salva.nome,
    quando: salva.quando,
    localizacao: salva.localizacao,
    onda: salva.onda,
  };
}

export interface ContextoDeReceitaPelaEspecie {
  /** Calibração da imagem, em micrômetros por pixel. Ausente = sem calibração. */
  umPerPixel?: number;
  /** Área total da imagem (ou da região de varredura), em px². */
  areaDaImagemPx: number;
}

/**
 * Uma 4ª receita, derivada do que a literatura diz sobre a espécie declarada
 * (`PERFIS_BIOMETRICOS` / `TAMANHOS` — `lib/normas/tamanhos-de-semente.ts`).
 *
 * É REFERÊNCIA, NÃO VEREDITO — mesmo estatuto de `tamanhos-de-semente.ts`: a
 * pessoa vê de onde vieram os números (`quando`) e escolhe como qualquer
 * outra receita do ensaio. `null` quando a espécie não está na tabela.
 *
 * Com calibração, tamanho mínimo/máximo saem da área de uma elipse com o
 * comprimento típico (mm → px) e a largura implícita na razão comprimento/
 * largura típica, com folga generosa para os dois lados — é para orientar,
 * não para reprovar semente sadia por variação de cultivar. Sem calibração,
 * não há como converter mm em px: cai no mesmo padrão mínimo por fração da
 * área da imagem que `limites-adaptaveis.ts` usa sem mediana, e não arrisca
 * um `maxArea` que dependeria de escala que não existe.
 *
 * `maxElongation` é o único que não precisa de calibração nenhuma — a razão
 * comprimento/largura é invariante de escala — e por isso é o que mais vale
 * mesmo sem calibrar (mesma lógica de `conferirForma`).
 */
export function receitaPelaEspecie(
  especieOuCultura: string | undefined,
  ctx: ContextoDeReceitaPelaEspecie
): Receita | null {
  const referencia = acharPorNome(especieOuCultura);
  if (!referencia) return null;

  const razaoMedia =
    referencia.razaoMinima && referencia.razaoMaxima
      ? (referencia.razaoMinima + referencia.razaoMaxima) / 2
      : 1.3;

  let minArea: number;
  let maxArea: number | undefined;

  if (ctx.umPerPixel && ctx.umPerPixel > 0) {
    const mmParaPx = (mm: number) => (mm * 1000) / ctx.umPerPixel!;
    const areaDaElipsePx2 = (comprimentoMm: number) => {
      const comprimentoPx = mmParaPx(comprimentoMm);
      const larguraPx = comprimentoPx / razaoMedia;
      return (Math.PI / 4) * comprimentoPx * larguraPx;
    };
    // Folga generosa para os dois lados: é referência de literatura, não a
    // medida desta imagem — melhor deixar passar do que reprovar semente sadia.
    minArea = Math.max(1, Math.round(areaDaElipsePx2(referencia.minimo) * 0.35));
    maxArea = Math.round(areaDaElipsePx2(referencia.maximo) * 3);
  } else {
    minArea = Math.max(1, Math.round(FRACAO_MINIMA_PADRAO * ctx.areaDaImagemPx));
  }

  const maxElongation = referencia.razaoMaxima ? Math.ceil(referencia.razaoMaxima * 1.5) : 0;

  return {
    id: `especie-${referencia.chave}`,
    nome: `Pela espécie: ${referencia.nomeComum}`,
    quando: `Tamanho típico da literatura para ${referencia.nomeComum} (${referencia.origem}).`,
    localizacao: { sensitivity: 50, minArea, maxArea, maxElongation, splitTouching: false },
    onda: {},
  };
}

export interface ContornoProposto {
  contorno: Ponto[];
  areaPx: number;
  /** Marcado por `analisarContorno` com o limiar da própria população. */
  suspeitoDeAglomerado: boolean;
  categoria?: 'viable' | 'inviable';
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
