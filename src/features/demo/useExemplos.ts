// =============================================================================
// SeedCounter — carregar exemplos (cena simulada e exemplo real), fora do App
//
// POR QUE EXISTE. Mesmo molde de `features/sessao` e `features/importar`: o
// App entrega o que os dois handlers precisam ESCREVER (`loadFiles`,
// `setMetadata`, `setLoadError`) e recebe de volta os dois pares
// handler+estado-de-carregamento que `Sidebar` sempre recebeu —
// `handleCarregarExemplo`/`exemploCarregando` (um botão por preset) e
// `handleCarregarExemploReal`/`exemploRealCarregando` (a lista embutida de
// `ExemplosReais`).
//
// A MONTAGEM DO METADADO NÃO MORA AQUI. `metadadosDaCena` e
// `metadadosDoExemploReal`, em `metadados-do-exemplo.ts`, são a parte pura —
// o que dá para provar em node contra o formato antigo do App. Este arquivo
// só orquestra: busca o arquivo (`carregarExemplo`/`carregarExemploReal`),
// entrega à fila e liga/desliga os dois estados de "carregando".
//
// Até 23/09 o `finally` do exemplo simulado desligava `filaIARodando` — o
// estado do cabeçalho da fila com IA, que nada tem a ver com exemplos. Era
// uma cópia no lugar errado: a fila ligava o estado e nunca desligava; quem
// desligava era este handler. A fila agora desliga o que liga (App.tsx,
// `handleProcessarFilaIA`), e daqui saiu.
// =============================================================================

import { useCallback, useState } from 'react';
import type { Metadata } from '../../types';
import type { PresetDeCena } from '../../lib/synthetic-scene';
import { carregarExemplo } from './exemplos';
import { carregarExemploReal, type ExemploReal } from './exemplos-reais';
import { metadadosDaCena, metadadosDoExemploReal } from './metadados-do-exemplo';

export interface EntradaDeExemplos {
  loadFiles: (files: File[]) => void;
  setMetadata: (m: Metadata | ((prev: Metadata) => Metadata)) => void;
  setLoadError: (mensagem: string) => void;
}

export function useExemplos(entrada: EntradaDeExemplos) {
  const { loadFiles, setMetadata, setLoadError } = entrada;

  // Cena de exemplo: entra pela mesma porta que qualquer imagem, para
  // exercitar o fluxo real — fila, contagem, medida, exportação — e não um
  // caminho paralelo que só funciona na demonstração.
  const [exemploCarregando, setExemploCarregando] = useState<PresetDeCena | null>(null);

  const handleCarregarExemplo = useCallback(
    async (preset: PresetDeCena) => {
      setExemploCarregando(preset);
      try {
        const { arquivo, cena, projeto } = await carregarExemplo(preset);
        loadFiles([arquivo]);
        setMetadata((prev) => metadadosDaCena(prev, cena, projeto));
      } catch (err) {
        console.error('Falha ao gerar a cena de exemplo', err);
      } finally {
        setExemploCarregando(null);
      }
    },
    [loadFiles, setMetadata]
  );

  const [exemploRealCarregando, setExemploRealCarregando] = useState<string | null>(null);

  /**
   * Exemplo REAL: a imagem vem de public/exemplos e os metadados que se
   * conhecem (espécie, origem, classe, escala quando medida) já entram — o
   * que não se conhece fica vazio e o app pede, em vez de inventar.
   */
  const handleCarregarExemploReal = useCallback(
    async (e: ExemploReal) => {
      setExemploRealCarregando(e.slug);
      try {
        const { arquivo, metadados } = await carregarExemploReal(e);
        loadFiles([arquivo]);
        setMetadata((prev) => metadadosDoExemploReal(prev, metadados));
      } catch (err) {
        console.error('Falha ao abrir o exemplo real', err);
        setLoadError(`Não foi possível abrir o exemplo "${e.rotulo}".`);
      } finally {
        setExemploRealCarregando(null);
      }
    },
    [loadFiles, setMetadata, setLoadError]
  );

  return { exemploCarregando, handleCarregarExemplo, exemploRealCarregando, handleCarregarExemploReal };
}
