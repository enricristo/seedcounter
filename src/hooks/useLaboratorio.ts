import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ID_DO_LABORATORIO } from '../lib/db';
import type { IdentificacaoDoLaboratorio } from '../lib/normas/identificacao';

/** Laboratório em branco — o ponto de partida de quem nunca preencheu. */
const VAZIO: IdentificacaoDoLaboratorio = {
  nome: '',
  renasem: '',
  portariaDeCredenciamento: '',
  endereco: '',
  responsavelTecnico: '',
};

/**
 * O laboratório que emite o laudo.
 *
 * Registro ÚNICO da instalação, e não dado de sessão: o RENASEM e a Portaria de
 * credenciamento valem para todo boletim que sai daqui, e mudam uma vez a cada
 * renovação. Guardá-los por sessão seria convidar duas sessões a discordarem
 * sobre qual é o RENASEM do mesmo laboratório.
 *
 * Devolve `undefined` enquanto a consulta não voltou E quando nunca foi
 * preenchido — que é o estado normal de quem usa o aplicativo para pesquisa e
 * não emite laudo nenhum.
 */
export function useLaboratorio() {
  const registro = useLiveQuery(() => db.laboratorio.get(ID_DO_LABORATORIO));
  const laboratorio = registro?.dados;

  const salvarLaboratorio = useCallback(
    (dados: IdentificacaoDoLaboratorio) =>
      db.laboratorio.put({ id: ID_DO_LABORATORIO, dados }),
    []
  );

  const atualizarCampo = useCallback(
    async <K extends keyof IdentificacaoDoLaboratorio>(
      campo: K,
      valor: IdentificacaoDoLaboratorio[K]
    ) => {
      const existente = await db.laboratorio.get(ID_DO_LABORATORIO);
      // O laboratório é editado num formulário só, campo a campo, sem
      // concorrência entre abas — por isso ler-modificar-gravar direto basta
      // aqui, diferente dos metadados, que são digitados a cada tecla.
      const base = existente?.dados ?? VAZIO;
      await db.laboratorio.put({
        id: ID_DO_LABORATORIO,
        dados: { ...base, [campo]: valor },
      });
    },
    []
  );

  return { laboratorio, salvarLaboratorio, atualizarCampo };
}
