import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PerfilMedidoGuardado } from '../lib/db';
import type { PerfilMedido } from '../lib/perfil-medido';

/**
 * Perfis medidos ("Medir esta pasta", B4) de UM conjunto — um registro por
 * classe. Mesmo padrão de `useReceitasSalvas`: leitura reativa (`useLiveQuery`),
 * gravação substitui o que já existia (medir de novo é o gesto de atualizar),
 * remoção por id.
 */
export function usePerfisMedidos(conjunto: string | undefined) {
  const todos =
    useLiveQuery(
      () => (conjunto ? db.perfisMedidos.where('conjunto').equals(conjunto).toArray() : Promise.resolve([])),
      [conjunto]
    ) ?? [];

  /** Grava o resultado de uma medição: um registro por classe, substituindo o anterior da mesma (conjunto, classe). */
  const gravar = useCallback(
    async (conjuntoAlvo: string, porClasse: Map<string, { perfil: PerfilMedido; descartadas: number }>) => {
      const medidoEm = Date.now();
      await db.transaction('rw', db.perfisMedidos, async () => {
        const antigos = await db.perfisMedidos.where('conjunto').equals(conjuntoAlvo).toArray();
        for (const antigo of antigos) if (antigo.id != null) await db.perfisMedidos.delete(antigo.id);
        for (const [classe, { perfil, descartadas }] of porClasse) {
          const registro: PerfilMedidoGuardado = {
            conjunto: conjuntoAlvo,
            classe,
            perfil,
            descartadas,
            medidoEm,
          };
          await db.perfisMedidos.add(registro);
        }
      });
    },
    []
  );

  const remover = useCallback(async (conjuntoAlvo: string) => {
    const registros = await db.perfisMedidos.where('conjunto').equals(conjuntoAlvo).toArray();
    await db.perfisMedidos.bulkDelete(registros.map((r) => r.id).filter((id): id is number => id != null));
  }, []);

  /**
   * Perfil de uma classe específica dentro do conjunto — o que o inspetor
   * consulta. Função simples, não `useCallback`: `todos` já é uma referência
   * nova a cada resultado de `useLiveQuery`, então memorizar aqui não evitaria
   * recomputar nada — só acrescentaria uma dependência para o lint vigiar.
   */
  const perfilDaClasse = (classe: string | undefined): PerfilMedidoGuardado | undefined =>
    classe ? todos.find((p) => p.classe === classe) : undefined;

  return { perfis: todos, gravar, remover, perfilDaClasse };
}
