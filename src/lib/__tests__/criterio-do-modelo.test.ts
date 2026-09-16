// =============================================================================
// O criterio de anotacao que o modelo YOLO aprendeu.
//
// O modelo em producao foi treinado com uma regra que nao aparece em lugar
// nenhum do app: nucleo com qualquer vermelho e viavel, branco e inviavel,
// vazia nem entra na anotacao. Este teste garante que a regra e a sua
// consequencia continuam declaradas em codigo, e nao so em comentario.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { CRITERIO_DO_MODELO, CONSEQUENCIA_DO_CRITERIO } from '../criterio-do-modelo';

describe('o criterio que o modelo aprendeu', () => {
  it('declara as tres regras da anotacao original', () => {
    const classes = CRITERIO_DO_MODELO.map((c) => c.classe);
    expect(classes).toEqual(['viavel', 'inviavel', 'nao anotada']);
  });
  it('diz a consequencia: distingue embriao, nao estima lote cheio', () => {
    expect(CONSEQUENCIA_DO_CRITERIO).toMatch(/embri/i);
    expect(CONSEQUENCIA_DO_CRITERIO).toMatch(/vazia/i);
  });
});
