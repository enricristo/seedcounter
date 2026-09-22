// =============================================================================
// SeedCounter — os metadados que um exemplo propõe, extraídos do App
//
// POR QUE EXISTE. `handleCarregarExemplo` e `handleCarregarExemploReal`
// (App.tsx) montavam o metadado novo a partir do anterior inline, dentro do
// `setMetadata(prev => ...)`. Aqui fica só essa montagem — pura, sem `fetch`
// nem canvas — para provar contra o formato antigo por `toEqual`. Quem busca
// o arquivo, mexe na fila e liga/desliga o "carregando" é `useExemplos.ts`.
// =============================================================================

import type { Metadata } from '../../types';
import type { CenaSintetica } from '../../lib/synthetic-scene';
import { AVISO_CENA } from '../../lib/synthetic-scene';

/**
 * Metadados depois de abrir uma cena SIMULADA (soja / orquídea-tz /
 * forrageira). A escala vem declarada pela própria cena — sem ela a
 * morfometria sairia em pixels, e metade do ponto do exemplo (mostrar
 * milímetros) se perderia. `dataset` é apagado: a imagem anterior pode ter
 * vindo do explorador de datasets, e a classe dela não é desta cena.
 */
export function metadadosDaCena(
  prev: Metadata,
  cena: Pick<CenaSintetica, 'umPorPixel'>,
  projeto: string
): Metadata {
  return {
    ...prev,
    project: projeto,
    treatment: '',
    plate: '',
    quadrant: '',
    notes: AVISO_CENA,
    umPerPixel: cena.umPorPixel,
    dataset: undefined,
  };
}

/**
 * Metadados depois de abrir um exemplo REAL. O que o exemplo conhece
 * (espécie, origem, classe, escala quando medida) entra por cima do que já
 * estava; `amostra` mescla campo a campo, para não apagar o que a pessoa já
 * tinha preenchido numa amostra que o exemplo novo não fala nada sobre. O que
 * o exemplo não conhece continua vazio — o app pede, não inventa (Lei 2).
 */
export function metadadosDoExemploReal(prev: Metadata, metadados: Partial<Metadata>): Metadata {
  return {
    ...prev,
    ...metadados,
    plate: '',
    quadrant: '',
    // A imagem anterior pode ter vindo do explorador; a classe dela não é desta.
    dataset: undefined,
    amostra: { ...prev.amostra, ...metadados.amostra },
  };
}
