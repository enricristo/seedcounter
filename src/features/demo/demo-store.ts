// =============================================================================
// SeedCounter — gravação e remoção dos dados de demonstração
//
// Separado de `synthetic-data.ts` de propósito: aquele módulo é puro e roda no
// vitest sem navegador; este toca o IndexedDB e só faz sentido no app.
//
// A remoção é por PREFIXO de id, nunca por nome ou por data. Nome o usuário
// edita; data colide. O prefixo é a única marca que sobrevive a qualquer
// edição — e apagar dado de pesquisa por engano não é um erro recuperável.
// =============================================================================

import { db } from '../../lib/db';
import {
  PREFIXO_DEMO,
  gerarDadosDeDemonstracao,
  type OpcoesDeDemonstracao,
} from '../../lib/synthetic-data';

export interface ContagemDemo {
  sessoes: number;
  experimentos: number;
}

/** Quantos registros de demonstração já existem no banco. */
export async function contarDemonstracao(): Promise<ContagemDemo> {
  const [sessoes, experimentos] = await Promise.all([
    db.sessions.toArray(),
    db.experiments.toArray(),
  ]);
  return {
    sessoes: sessoes.filter((s) => s.id.startsWith(PREFIXO_DEMO)).length,
    experimentos: experimentos.filter((e) => e.id.startsWith(PREFIXO_DEMO)).length,
  };
}

/**
 * Grava o conjunto de demonstração.
 *
 * Usa `bulkPut` com os ids estáveis do gerador: carregar de novo com a mesma
 * semente sobrescreve os mesmos registros em vez de acumular cópias.
 */
export async function carregarDemonstracao(
  opcoes: OpcoesDeDemonstracao = {}
): Promise<ContagemDemo> {
  const { experimentos, sessoes } = gerarDadosDeDemonstracao(opcoes);
  await db.experiments.bulkPut(experimentos);
  await db.sessions.bulkPut(sessoes);
  return { sessoes: sessoes.length, experimentos: experimentos.length };
}

/** Apaga tudo que tem o prefixo de demonstração. Não toca em mais nada. */
export async function removerDemonstracao(): Promise<ContagemDemo> {
  const [sessoes, experimentos] = await Promise.all([
    db.sessions.toArray(),
    db.experiments.toArray(),
  ]);

  const idsSessoes = sessoes.filter((s) => s.id.startsWith(PREFIXO_DEMO)).map((s) => s.id);
  const idsExperimentos = experimentos.filter((e) => e.id.startsWith(PREFIXO_DEMO)).map((e) => e.id);

  await db.sessions.bulkDelete(idsSessoes);
  await db.experiments.bulkDelete(idsExperimentos);

  return { sessoes: idsSessoes.length, experimentos: idsExperimentos.length };
}
