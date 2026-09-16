import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LoteGuardado, type ResultadoDoLoteGuardado } from '../lib/db';

/**
 * O lote persistido (Dexie v10, `db.lotes`) — mesmo padrão de
 * `usePerfisMedidos`/`useReceitasSalvas` (leitura reativa via
 * `useLiveQuery`, escrita por função dedicada). Grava a cada imagem
 * concluída, sem as imagens originais ("lote redondo", item 5).
 *
 * `pendente` é o lote mais recente ainda NÃO totalmente aceito — "totalmente"
 * conta só as imagens sem erro (uma imagem com erro nunca vira sessão, então
 * nunca entra em `aceitos`; contar contra ela deixaria o lote eternamente
 * pendente). É o que o painel oferece para retomar ao abrir.
 */
export function useLotes() {
  const pendente =
    useLiveQuery(async () => {
      const todos = await db.lotes.orderBy('criadoEm').reverse().toArray();
      return todos.find((l) => l.aceitos.length < l.resultados.filter((r) => !r.erro).length) ?? null;
    }, []) ?? null;

  const criar = useCallback(async (base: Omit<LoteGuardado, 'id' | 'resultados' | 'aceitos'>) => {
    return db.lotes.add({ ...base, resultados: [], aceitos: [] });
  }, []);

  const salvarResultados = useCallback(async (id: number, resultados: ResultadoDoLoteGuardado[]) => {
    await db.lotes.update(id, { resultados });
  }, []);

  const marcarAceito = useCallback(async (id: number, resultadoId: string) => {
    const registro = await db.lotes.get(id);
    if (!registro || registro.aceitos.includes(resultadoId)) return;
    await db.lotes.update(id, { aceitos: [...registro.aceitos, resultadoId] });
  }, []);

  const descartar = useCallback(async (id: number) => {
    await db.lotes.delete(id);
  }, []);

  return { pendente, criar, salvarResultados, marcarAceito, descartar };
}
