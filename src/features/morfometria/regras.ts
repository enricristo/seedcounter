// =============================================================================
// SeedCounter — Motor de Regras Semi-Automáticas de Curadoria
//
// Permite ao analista aplicar critérios paramétricos em lote sobre a população
// de sementes (descarte de detritos por área, sinalização de aglomerados por
// solidez, e reclassificação de viabilidade por morfometria/cor).
// =============================================================================

import type { Mark, YoloSegmentation } from '../../types';
import type { SeedMeasurement } from '../../lib/measurements';
import { enumerarObjetos } from '../../lib/objetos';
import { nomeDaCategoria, type Categoria } from '../../lib/classe-do-modelo';

export type TipoDeRegra = 'filtro-impurezas' | 'deteccao-aglomerados' | 'limiar-viabilidade';

export interface RegraParametrica {
  id: string;
  tipo: TipoDeRegra;
  nome: string;
  descricao: string;
  campo: 'areaMm2' | 'areaPx' | 'solidez' | 'circularidade' | 'comprimentoMm' | 'aMean';
  operador: '<' | '<=' | '>' | '>=';
  limiar: number;
  acao: 'marcar-inviavel' | 'marcar-viavel' | 'sinalizar-corte' | 'remover';
}

export const REGRAS_PADRAO: RegraParametrica[] = [
  {
    id: 'regra-detritos',
    tipo: 'filtro-impurezas',
    nome: 'Filtro de Impurezas e Detritos',
    descricao: 'Sementes ou fragmentos com área excessivamente pequena',
    campo: 'areaMm2',
    operador: '<',
    limiar: 5.0,
    acao: 'remover',
  },
  {
    id: 'regra-aglomerados',
    tipo: 'deteccao-aglomerados',
    nome: 'Suspeita de Aglomerado (Cintura/Fusão)',
    descricao: 'Contornos com baixa solidez geométrica sugerindo sementes tocadas',
    campo: 'solidez',
    operador: '<',
    limiar: 0.90,
    acao: 'sinalizar-corte',
  },
  {
    id: 'regra-chocha',
    tipo: 'limiar-viabilidade',
    nome: 'Semente Chocha / Anormal',
    descricao: 'Circularidade muito baixa ou formato irregular para a espécie',
    campo: 'circularidade',
    operador: '<',
    limiar: 0.65,
    acao: 'marcar-inviavel',
  },
];

/**
 * Testa se uma medição individual atende aos critérios da regra.
 */
export function atendeRegra(medida: SeedMeasurement, regra: RegraParametrica): boolean {
  // Se a regra usa mm² e a imagem não foi calibrada, usamos fallback proporcional ou falhamos seguro
  let valor = medida[regra.campo as keyof SeedMeasurement] as number | undefined;

  // Fallback quando não há calibração em mm: se a regra pede areaMm2 mas só temos areaPx
  if (valor === undefined && regra.campo === 'areaMm2' && medida.areaPx !== undefined) {
    // Não avalia mm sem calibração
    return false;
  }

  if (valor === undefined || !Number.isFinite(valor)) {
    return false;
  }

  switch (regra.operador) {
    case '<':
      return valor < regra.limiar;
    case '<=':
      return valor <= regra.limiar;
    case '>':
      return valor > regra.limiar;
    case '>=':
      return valor >= regra.limiar;
    default:
      return false;
  }
}

/**
 * Retorna os índices / objectIds das sementes que satisfazem a regra.
 */
export function simularRegra(
  medicoes: SeedMeasurement[],
  regra: RegraParametrica
): number[] {
  return medicoes
    .filter((m) => atendeRegra(m, regra))
    .map((m) => m.objectId);
}

export interface ResultadoAplicacaoRegra {
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  totalAfetadas: number;
}

/**
 * Executa a aplicação da regra sobre as anotações atuais, retornando o novo estado.
 * Compatível com o histórico de `useMarks` para suporte integral a `Ctrl+Z`.
 */
export function aplicarRegra(
  marks: Mark[],
  segmentacoes: YoloSegmentation[],
  medicoes: SeedMeasurement[],
  regra: RegraParametrica
): ResultadoAplicacaoRegra {
  const idsAfetados = new Set(simularRegra(medicoes, regra));
  if (idsAfetados.size === 0) {
    return { marks, segmentacoes, totalAfetadas: 0 };
  }

  // `objectId` é o `indice` de `enumerarObjetos` — a MESMA lista que
  // `buildMeasurements` percorreu para produzir `medicoes`. Traduzir para
  // posição em `marks` (`objectId - 1`) só funcionava porque as marcas vêm
  // primeiro na enumeração, e deixava de fora os contornos órfãos: uma
  // semente que só o modelo viu passava ilesa pela regra, sem aviso.
  const objetos = enumerarObjetos(marks, segmentacoes).filter((o) => idsAfetados.has(o.indice));
  const marcasAfetadas = new Set<number>();
  const contornosAfetados = new Set<number>();
  for (const o of objetos) {
    if (o.marca) marcasAfetadas.add(o.marca.id);
    if (o.contorno) contornosAfetados.add(o.contorno.id);
  }
  // Um contorno é afetado se é o da semente, ou se declara pertencer a uma
  // marca afetada (`marcaId`) — o vínculo explícito vale mesmo quando a
  // enumeração não o pareou (polígono degenerado, por exemplo).
  const contornoAfetado = (s: YoloSegmentation): boolean =>
    contornosAfetados.has(s.id) || (s.marcaId != null && marcasAfetadas.has(s.marcaId));
  const totalAfetadas = objetos.length;

  if (regra.acao === 'remover') {
    return {
      marks: marks.filter((m) => !marcasAfetadas.has(m.id)),
      segmentacoes: segmentacoes.filter((s) => !contornoAfetado(s)),
      totalAfetadas,
    };
  }

  if (regra.acao === 'marcar-inviavel' || regra.acao === 'marcar-viavel') {
    const novoTipo: Categoria = regra.acao === 'marcar-viavel' ? 'viable' : 'inviable';
    const novaClasse = nomeDaCategoria(novoTipo);

    return {
      marks: marks.map((m) => (marcasAfetadas.has(m.id) ? { ...m, type: novoTipo } : m)),
      segmentacoes: segmentacoes.map((s) =>
        contornoAfetado(s) ? { ...s, category: novoTipo, class_name: novaClasse } : s
      ),
      totalAfetadas,
    };
  }

  // Se a ação for apenas sinalizar-corte, não muta a lista, apenas devolve o total afetado
  return { marks, segmentacoes, totalAfetadas };
}
