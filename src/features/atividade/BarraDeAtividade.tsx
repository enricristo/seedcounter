// =============================================================================
// SeedCounter — a barra no topo
//
// O rodape diz O QUE esta em curso; esta barra diz QUE algo esta em curso, no
// lugar para onde o olho vai primeiro. Sao dois sinais do mesmo registro, e
// existem os dois porque o do rodape passou despercebido — e imagem de 512 px
// abre rapido demais para alguem olhar para baixo a tempo.
//
// Com progresso conhecido, a barra enche. Sem, ela corre — o padrao que
// GitHub e YouTube tornaram reconhecivel.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { ouvirAtividades, type Atividade } from './atividade';

export function BarraDeAtividade() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  useEffect(() => ouvirAtividades(setAtividades), []);

  if (atividades.length === 0) return null;

  const comProgresso = atividades.find((a) => a.progresso !== undefined);

  return (
    <div
      aria-hidden="true"
      className="bg-accent/15 pointer-events-none fixed top-0 right-0 left-0 z-[60] h-[3px] overflow-hidden"
    >
      {comProgresso ? (
        <div
          className="bg-accent h-full transition-[width] duration-300"
          style={{ width: `${Math.round((comProgresso.progresso ?? 0) * 100)}%` }}
        />
      ) : (
        <div className="bg-accent animate-correr h-full w-1/3 motion-reduce:w-full motion-reduce:animate-none" />
      )}
    </div>
  );
}
