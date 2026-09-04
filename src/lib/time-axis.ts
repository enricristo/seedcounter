// =============================================================================
// SeedCounter — o que o eixo de tempo de um experimento significa
//
// POR QUE ISTO EXISTE.
//
// Os painéis longitudinais rotulavam tudo como "DAP — dias após plantio" e
// calculavam IVG, TMG e t50 para qualquer série. Isso está certo para
// germinação in vitro, onde a MESMA placa é reavaliada e a germinação é
// acumulada.
//
// Está errado para ensaio de armazenamento, que é metade do que o grupo publica
// em forrageira: ali cada data é uma amostra NOVA do lote guardado, a curva é
// de deterioração, e "índice de velocidade de germinação" não descreve nada —
// mas aparecia com um número ao lado, que é pior do que não aparecer.
// =============================================================================

import type { Experiment } from '../types';

export interface RotulosDoEixo {
  /** Rótulo do eixo x do gráfico. */
  eixo: string;
  /** Prefixo curto usado em chip e cabeçalho de tabela: "DAP 30", "Arm. 360". */
  prefixo: string;
  /** Se os índices de velocidade de germinação descrevem esta série. */
  aplicaIndicesDeVigor: boolean;
}

const DAP: RotulosDoEixo = {
  eixo: 'Dias Após Semeadura (DAP)',
  prefixo: 'DAP',
  aplicaIndicesDeVigor: true,
};

const ARMAZENAMENTO: RotulosDoEixo = {
  eixo: 'Dias de armazenamento',
  prefixo: 'Arm.',
  aplicaIndicesDeVigor: false,
};

/** Experimento sem `timeAxis` é DAP — é o que todo experimento existente é. */
export function rotulosDoEixo(experimento?: Pick<Experiment, 'timeAxis'> | null): RotulosDoEixo {
  return experimento?.timeAxis === 'armazenamento' ? ARMAZENAMENTO : DAP;
}

/** Explicação de por que os índices de vigor estão ausentes. */
export const MOTIVO_SEM_INDICES_DE_VIGOR =
  'IVG, TMG e t50 medem a velocidade de germinação de uma mesma placa reavaliada. ' +
  'Neste ensaio cada data é uma amostra nova do lote armazenado, então esses índices não se aplicam.';
