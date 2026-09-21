// =============================================================================
// SeedCounter — o menu "Exibir", no cabeçalho
//
// É a SEMENTE da barra de menu (Arquivo, Editar, Exibir, Ferramentas, Ajuda),
// não a barra. Só "Exibir" existe, e como um botão de ícone no lugar onde a
// barra vai ficar. Quando os outros menus chegarem, este vira um item entre
// eles sem mudar de conteúdo: os modos em cima (rádio), as partes embaixo
// (caixas), e "restaurar" quando há sobrescrita.
//
// MESMO PADRÃO DE `ChipDeEspecie` E `BotaoDeConta`: gatilho e popover no mesmo
// componente, Esc e clique fora fecham, o foco volta ao gatilho. Sem
// biblioteca de menu — o projeto não tem uma, e três popovers iguais não
// justificam adicionar.
//
// Inputs nativos (radio e checkbox) em vez de botões estilizados: teclado e
// leitor de tela vêm de graça, e o menu é o único lugar onde isto aparece.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, RotateCcw } from 'lucide-react';
import { MODOS, PARTES, ROTULO_DA_PARTE, descricaoDoModo } from './modo';
import { useVisibilidade } from './useModoDeVisualizacao';

/** O mesmo passo de controle dos outros botões de ícone do cabeçalho. */
const botaoIcone =
  'rounded-control border-line text-ink-2 hover:text-ink-1 hover:bg-surface-2 focus-visible:ring-accent/40 flex cursor-pointer items-center border p-2 transition-all focus-visible:ring-2 focus-visible:outline-none';

export function MenuExibir() {
  const { modo, definirModo, visibilidade, sobrescritas, alternar, redefinir, fixadoPelaUrl } =
    useVisibilidade();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);

  const fechar = useCallback(() => {
    setAberto(false);
    botaoRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar();
    }
    function aoClicarFora(e: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) fechar();
    }
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('mousedown', aoClicarFora);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, [aberto, fechar]);

  const temSobrescrita = Object.keys(sobrescritas).length > 0;
  const atual = descricaoDoModo(modo);

  return (
    <div className="relative" ref={painelRef}>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        onMouseDown={(e) => e.stopPropagation()}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Exibir — modo ${atual.rotulo}`}
        title={`Exibir: ${atual.rotulo}. ${atual.frase}`}
        className={`${botaoIcone} ${temSobrescrita ? 'text-accent' : ''}`}
      >
        <Eye size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Exibir"
          className="border-line bg-surface-1 rounded-panel absolute top-full right-0 z-50 mt-2 w-64 border p-3 shadow-2xl"
        >
          <fieldset className="space-y-0.5">
            <legend className="text-ink-3 mb-1.5 text-[10px] font-bold tracking-wider uppercase">Modo</legend>
            {MODOS.map((m) => {
              const d = descricaoDoModo(m);
              return (
                <label
                  key={m}
                  className="hover:bg-surface-2 rounded-control flex cursor-pointer items-start gap-2 px-2 py-1.5 transition-colors"
                >
                  <input
                    type="radio"
                    name="modo-de-visualizacao"
                    value={m}
                    checked={modo === m}
                    onChange={() => definirModo(m)}
                    className="accent-accent mt-0.5"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink-1 text-xs font-semibold">{d.rotulo}</span>
                    <span className="text-ink-3 text-[10px] leading-snug">{d.frase}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {fixadoPelaUrl && (
            <p className="text-ink-3 mt-2 px-2 text-[10px] leading-snug">
              Este modo veio do endereço da página: recarregar volta a ele.
            </p>
          )}

          <div className="bg-line my-2.5 h-px" />

          <fieldset className="max-h-72 space-y-0 overflow-y-auto">
            <legend className="text-ink-3 mb-1.5 text-[10px] font-bold tracking-wider uppercase">Partes</legend>
            {PARTES.map((parte) => {
              const sobrescrita = parte in sobrescritas;
              return (
                <label
                  key={parte}
                  className="hover:bg-surface-2 rounded-control flex cursor-pointer items-center gap-2 px-2 py-1 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={visibilidade[parte]}
                    onChange={() => alternar(parte)}
                    className="accent-accent"
                  />
                  <span className={`text-xs ${sobrescrita ? 'text-accent font-semibold' : 'text-ink-2'}`}>
                    {ROTULO_DA_PARTE[parte]}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {temSobrescrita && (
            <button
              type="button"
              onClick={redefinir}
              className="border-line text-ink-3 hover:border-accent hover:text-accent focus-visible:ring-accent/40 rounded-control mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 border py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Restaurar o padrão de {atual.rotulo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
