// =============================================================================
// SeedCounter — Motor de Regras Semi-Automáticas de Curadoria
//
// Permite ao analista aplicar critérios paramétricos em lote sobre a população
// de sementes (descarte de detritos por área, sinalização de aglomerados por
// solidez, e reclassificação de viabilidade por morfometria/cor).
// =============================================================================

import type { Mark, YoloSegmentation } from '../../types';
import type { SeedMeasurement } from '../../lib/measurements';

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

  // Mapeia objectId (1-based da lista de marks) para mark
  const marksAfetadas = new Set<number>();
  medicoes.forEach((m) => {
    if (idsAfetados.has(m.objectId)) {
      // O objectId corresponde ao índice i + 1 de marks
      const markIndex = m.objectId - 1;
      if (marks[markIndex]) {
        marksAfetadas.add(marks[markIndex].id);
      }
    }
  });

  if (regra.acao === 'remover') {
    const novasMarcas = marks.filter((m) => !marksAfetadas.has(m.id));
    // Remove também as segmentações vinculadas às marcas removidas
    const novasSegs = segmentacoes.filter(
      (s) => s.marcaId == null || !marksAfetadas.has(s.marcaId)
    );
    return {
      marks: novasMarcas,
      segmentacoes: novasSegs,
      totalAfetadas: marksAfetadas.size,
    };
  }

  if (regra.acao === 'marcar-inviavel' || regra.acao === 'marcar-viavel') {
    const novoTipo: 'viable' | 'inviable' =
      regra.acao === 'marcar-viavel' ? 'viable' : 'inviable';
    const novaClasse: 'viavel' | 'inviavel' =
      novoTipo === 'viable' ? 'viavel' : 'inviavel';

    const novasMarcas = marks.map((m) =>
      marksAfetadas.has(m.id) ? { ...m, type: novoTipo } : m
    );

    const novasSegs = segmentacoes.map((s) => {
      if (s.marcaId != null && marksAfetadas.has(s.marcaId)) {
        return {
          ...s,
          category: novoTipo,
          class_name: novaClasse,
        };
      }
      return s;
    });

    return {
      marks: novasMarcas,
      segmentacoes: novasSegs,
      totalAfetadas: marksAfetadas.size,
    };
  }

  // Se a ação for apenas sinalizar-corte, não muta a lista, apenas devolve o total afetado
  return {
    marks,
    segmentacoes,
    totalAfetadas: marksAfetadas.size,
  };
}
