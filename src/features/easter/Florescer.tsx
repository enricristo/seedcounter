// =============================================================================
// SeedCounter — "florescer": a surpresa visual
//
// Uma orquídea estilizada abre no centro da tela por ~1,8s e some. É
// decoração pura — por isso `aria-hidden` e `pointer-events-none`: quem usa
// leitor de tela não perde nada ignorando, e ninguém fica impedido de clicar
// no que está por baixo.
//
// Traço fino, cinco pétalas + labelo, na paleta do acento e do grafite —
// nunca ciano/magenta, que na Bancada Óptica significam viável/inviável.
// Uma orquídea pintada com a cor de uma marca de inviabilidade seria uma
// piada de mau gosto para quem trabalha o dia inteiro olhando essa cor num
// embrião morto.
//
// `prefers-reduced-motion`: a pétala aparece já aberta, sem a animação de
// abertura — mas continua sumindo no mesmo prazo, porque o prazo é sobre
// não ficar no caminho, não sobre o movimento em si.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';

export interface FlorescerProps {
  ativo: boolean;
  onFim: () => void;
}

const DURACAO_MS = 1800;
const DURACAO_S = DURACAO_MS / 1000;

/** Uma pétala em forma de amêndoa, desenhada com a base no centro da flor
 * (0,0) e a ponta voltada para "cima" (y negativo). Rotacionada por pétala. */
const PETALA_D = 'M0,0 C11,-15 15,-33 0,-48 C-15,-33 -11,-15 0,0 Z';

/** Cinco pétalas, 72° uma da outra. */
const ANGULOS_PETALAS = [0, 72, 144, 216, 288];

/** O labelo (lábio) da orquídea — mais largo e curto, sempre para baixo,
 * é a peça que distingue uma orquídea de uma flor genérica de cinco pontas. */
const LABELO_D = 'M0,0 C14,10 16,26 0,34 C-16,26 -14,10 0,0 Z';

function usePrefereMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const aoMudar = () => setReduzido(mql.matches);
    mql.addEventListener('change', aoMudar);
    return () => mql.removeEventListener('change', aoMudar);
  }, []);

  return reduzido;
}

export function Florescer({ ativo, onFim }: FlorescerProps) {
  const reduzMovimento = usePrefereMovimentoReduzido();

  useEffect(() => {
    if (!ativo) return;
    const t = setTimeout(onFim, DURACAO_MS);
    return () => clearTimeout(t);
  }, [ativo, onFim]);

  if (!ativo) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
      aria-hidden="true"
    >
      {/* Keyframes escopadas ao componente — nada em index.css muda por
          causa de um easter egg. */}
      <style>{`
        @keyframes sc-florescer-parte {
          0%   { transform: rotate(var(--sc-rot, 0deg)) scale(0); opacity: 0; }
          45%  { transform: rotate(var(--sc-rot, 0deg)) scale(1.08); opacity: 1; }
          70%  { transform: rotate(var(--sc-rot, 0deg)) scale(1); opacity: 1; }
          100% { transform: rotate(var(--sc-rot, 0deg)) scale(1); opacity: 0; }
        }
      `}</style>
      <svg width="220" height="220" viewBox="-110 -110 220 220">
        <g>
          {ANGULOS_PETALAS.map((angulo, i) => {
            const estilo: CSSProperties = reduzMovimento
              ? { transform: `rotate(${angulo}deg) scale(1)`, transformOrigin: '0px 0px' }
              : ({
                  '--sc-rot': `${angulo}deg`,
                  transformOrigin: '0px 0px',
                  animation: `sc-florescer-parte ${DURACAO_S}s ease-out ${i * 0.06}s both`,
                } as CSSProperties);
            return (
              <path
                key={angulo}
                d={PETALA_D}
                style={estilo}
                fill="var(--color-graphite-50)"
                stroke="var(--color-accent)"
                strokeWidth={1.4}
              />
            );
          })}

          {/* Labelo — nasce por último, como na abertura real da flor. */}
          <path
            d={LABELO_D}
            style={
              reduzMovimento
                ? { transform: 'scale(1)', transformOrigin: '0px 0px' }
                : ({
                    transformOrigin: '0px 0px',
                    animation: `sc-florescer-parte ${DURACAO_S}s ease-out ${
                      ANGULOS_PETALAS.length * 0.06
                    }s both`,
                  } as CSSProperties)
            }
            fill="var(--color-accent)"
            stroke="var(--color-accent-strong)"
            strokeWidth={1}
          />

          {/* A coluna, no centro — um detalhe, não um foco. */}
          <circle r={3} fill="var(--color-graphite-600)" />
        </g>
      </svg>
    </div>
  );
}
