// =============================================================================
// SeedCounter — as marcações que fogem da média DA CLASSE
//
// POR QUE ESTE MÓDULO EXISTE.
//
// O pedido, em 24/09/2026: "conseguir achar fácil as marcações que estão
// saindo da média da classe — às vezes na orquídea o contorno pega só o
// núcleo, ou segmenta metade da semente". São erros que o olho encontra numa
// grade de 120 miniaturas só se passar por todas; e são justamente os que
// envenenam a morfometria, porque entram no CSV com cara de medida boa.
//
// A RÉGUA É A POPULAÇÃO, NÃO UMA CONSTANTE. É a terceira vez que este projeto
// aprende a mesma lição (razão comprimento/largura, limiares do detector de
// aglomerado, e agora aqui): constante absoluta não serve, porque a forma e o
// tamanho da semente mudam tudo. Uma orquídea de 34 px e uma soja de 260 px
// não têm nada em comum a não ser que, DENTRO DA MESMA IMAGEM, a maioria se
// parece.
//
// E É POR CLASSE. Semente viável e inviável de orquídea têm tamanhos
// diferentes — a inviável costuma ser só a testa vazia. Misturar as duas numa
// régua só faria toda inviável parecer fora da média. Quando uma classe tem
// gente de menos para formar população, ela cai na régua da cena inteira, e o
// motivo diz isso.
//
// O QUE É UM DESVIO. Mediana e MAD (desvio absoluto mediano), não média e
// desvio padrão: com 5% de contornos horríveis, a média e o desvio já estão
// contaminados pelos próprios erros que se quer achar. O escore é
// `|x − mediana| / (1,4826 · MAD)`, que é o z-escore robusto — 1,4826 põe o
// MAD na escala do desvio padrão de uma normal, para que "3" signifique o
// mesmo que a pessoa espera de um "3 sigmas".
//
// NADA AQUI MUDA NÚMERO. Isto é uma LENTE: ordena e explica. Quem decide se o
// contorno está errado é quem olha — e é por isso que o motivo vem escrito.
// =============================================================================

import { areaDoPoligono, estatisticaRobusta } from '../../lib/aglomerado';
import { calculateSeedDimensions } from '../../lib/pca-utils';

/** O fator que põe o MAD na escala do desvio padrão de uma distribuição normal. */
const ESCALA_DO_MAD = 1.4826;

/** Abaixo disto, uma classe não tem população própria e usa a régua da cena. */
export const MINIMO_POR_CLASSE = 8;

/** A partir deste escore robusto, a marcação entra na lista. */
export const ESCORE_SUSPEITO = 3.5;

/** Piso do MAD relativo: numa cena de clones o MAD é zero e tudo viraria outlier. */
const MAD_MINIMO_RELATIVO = 0.05;

export interface ObjetoMedido {
  chave: string;
  /** A classe para a qual este objeto será comparado. */
  classe: string;
  contorno: [number, number][];
}

export type MotivoDoDesvio = 'area-pequena' | 'area-grande' | 'alongado' | 'achatado' | 'nenhum';

export interface DesvioDaClasse {
  chave: string;
  classe: string;
  /** O maior escore robusto entre as grandezas olhadas. */
  escore: number;
  motivo: MotivoDoDesvio;
  /** A frase que a pessoa lê. Vazia quando `motivo` é 'nenhum'. */
  texto: string;
  /** `true` quando a classe não tinha população e usou a régua da cena. */
  reguaDaCena: boolean;
}

interface Medidas {
  area: number;
  razao: number;
}

function medir(contorno: [number, number][]): Medidas | null {
  if (contorno.length < 3) return null;
  const area = areaDoPoligono(contorno);
  if (!(area > 0)) return null;
  const { width, height } = calculateSeedDimensions(contorno);
  const maior = Math.max(width, height);
  const menor = Math.min(width, height);
  if (!(menor > 0)) return null;
  return { area, razao: maior / menor };
}

/**
 * O escore robusto de `valor` contra a população, e o lado do desvio.
 *
 * O MAD entra RELATIVO à mediana (um piso de 5%), porque uma cena de sementes
 * quase idênticas tem MAD perto de zero — e aí qualquer diferença viraria
 * "dez sigmas", enchendo a lista de falso alarme.
 */
function escoreRobusto(valor: number, mediana: number, mad: number): number {
  const escala = Math.max(mad, Math.abs(mediana) * MAD_MINIMO_RELATIVO) * ESCALA_DO_MAD;
  return escala > 0 ? Math.abs(valor - mediana) / escala : 0;
}

/** Quantas vezes menor ou maior, para a frase. */
function vezes(valor: number, mediana: number): string {
  const r = valor > mediana ? valor / mediana : mediana / valor;
  return r.toFixed(1).replace('.', ',');
}

/**
 * Ordena os objetos pelo quanto fogem da mediana da PRÓPRIA CLASSE.
 *
 * Devolve só os que passam de `ESCORE_SUSPEITO`, do mais estranho para o
 * menos. Lista vazia é a resposta certa quando a cena é homogênea — e é o que
 * acontece na maioria das imagens boas.
 */
export function foraDaMedia(objetos: ObjetoMedido[], limiar = ESCORE_SUSPEITO): DesvioDaClasse[] {
  const medidos = objetos
    .map((o) => ({ o, m: medir(o.contorno) }))
    .filter((x): x is { o: ObjetoMedido; m: Medidas } => x.m !== null);
  if (medidos.length < MINIMO_POR_CLASSE) return [];

  const porClasse = new Map<string, Medidas[]>();
  for (const { o, m } of medidos) {
    const lista = porClasse.get(o.classe) ?? [];
    lista.push(m);
    porClasse.set(o.classe, lista);
  }

  const cena = {
    area: estatisticaRobusta(medidos.map((x) => x.m.area)),
    razao: estatisticaRobusta(medidos.map((x) => x.m.razao)),
  };

  const saida: DesvioDaClasse[] = [];
  for (const { o, m } of medidos) {
    const daClasse = porClasse.get(o.classe) ?? [];
    const temPopulacao = daClasse.length >= MINIMO_POR_CLASSE;
    const area = temPopulacao ? estatisticaRobusta(daClasse.map((x) => x.area)) : cena.area;
    const razao = temPopulacao ? estatisticaRobusta(daClasse.map((x) => x.razao)) : cena.razao;
    if (!area || !razao) continue;

    const eArea = escoreRobusto(m.area, area.mediana, area.mad);
    const eRazao = escoreRobusto(m.razao, razao.mediana, razao.mad);

    let motivo: MotivoDoDesvio = 'nenhum';
    let texto = '';
    let escore = 0;
    if (eArea >= eRazao) {
      escore = eArea;
      if (m.area < area.mediana) {
        motivo = 'area-pequena';
        texto = `Área ${vezes(m.area, area.mediana)}× menor que a mediana da classe — o contorno pode ter pegado só uma parte da semente.`;
      } else {
        motivo = 'area-grande';
        texto = `Área ${vezes(m.area, area.mediana)}× maior que a mediana da classe — pode ser mais de uma semente no mesmo contorno.`;
      }
    } else {
      escore = eRazao;
      if (m.razao > razao.mediana) {
        motivo = 'alongado';
        texto = `Mais alongado que o resto da classe (${m.razao.toFixed(1).replace('.', ',')} contra ${razao.mediana.toFixed(1).replace('.', ',')}) — contorno vazado ou duas sementes em fila.`;
      } else {
        motivo = 'achatado';
        texto = `Mais redondo que o resto da classe (${m.razao.toFixed(1).replace('.', ',')} contra ${razao.mediana.toFixed(1).replace('.', ',')}) — o contorno pode ter parado no meio.`;
      }
    }

    if (escore < limiar) continue;
    saida.push({
      chave: o.chave,
      classe: o.classe,
      escore: Number(escore.toFixed(2)),
      motivo,
      texto: temPopulacao
        ? texto
        : `${texto} (comparado com a cena inteira: a classe tem menos de ${MINIMO_POR_CLASSE} objetos)`,
      reguaDaCena: !temPopulacao,
    });
  }

  return saida.sort((a, b) => b.escore - a.escore);
}
