// =============================================================================
// SeedCounter — o criterio que o modelo YOLO aprendeu
//
// O modelo em producao foi treinado com uma regra de anotacao que nao aparecia
// em lugar nenhum da interface. Quem usa sem saber interpreta o numero errado:
// o modelo distingue sementes QUE TEM EMBRIAO, nao estima quantas do lote
// estao cheias — porque a semente visivelmente vazia foi tratada como fundo
// na anotacao.
//
// Isto e uma decisao metodologica com consequencia no laudo, e por isso e dado
// exibido, nao comentario de codigo.
// =============================================================================

export interface CriterioDeAnotacao {
  classe: string;
  regra: string;
}

/** As tres regras com que o conjunto de treino foi anotado (Roboflow v8). */
export const CRITERIO_DO_MODELO: CriterioDeAnotacao[] = [
  { classe: 'viavel', regra: 'Nucleo com QUALQUER grau de vermelho (tetrazolio).' },
  { classe: 'inviavel', regra: 'Nucleo branco ou opaco.' },
  {
    classe: 'nao anotada',
    regra: 'Semente visivelmente VAZIA, sem nucleo — tratada como fundo.',
  },
];

export const CONSEQUENCIA_DO_CRITERIO =
  'O modelo distingue sementes que tem embriao; nao estima quantas do lote estao vazias. ' +
  'Para forrageira, a espigueta vazia precisa ser contada a parte — ela e material inerte.';
