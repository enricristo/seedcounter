// =============================================================================
// SeedCounter — MenuRadial
//
// O desenho do spike: um circulo com zona morta no centro e uma fatia por
// opcao, ao redor do ponto onde o botao direito desceu. A fatia realcada e a
// que `fatiaDoAngulo` escolheria SE o botao fosse solto agora — a pessoa ve o
// que o gesto vai fazer antes de soltar.
//
// Posicionamento em `fixed`, com coordenadas de TELA (clientX/clientY): o
// menu segue o ponteiro em qualquer zoom ou rolagem, sem precisar saber nada
// da transformacao da imagem por baixo.
// =============================================================================

import React from 'react';
import { fatiaDoAngulo, RAIO_MORTO } from './geometria';

export interface OpcaoRadial {
  chave: string;
  rotulo: string;
}

export function MenuRadial({
  origem,
  atual,
  opcoes,
}: {
  origem: { x: number; y: number };
  atual: { x: number; y: number } | null;
  opcoes: OpcaoRadial[];
}) {
  const escolhida = atual
    ? fatiaDoAngulo(atual.x - origem.x, atual.y - origem.y, opcoes.length)
    : null;
  const R = 64;
  return (
    <svg
      className="pointer-events-none fixed z-50"
      style={{ left: origem.x - R - 8, top: origem.y - R - 8 }}
      width={R * 2 + 16}
      height={R * 2 + 16}
      aria-hidden
    >
      <circle
        cx={R + 8}
        cy={R + 8}
        r={RAIO_MORTO}
        fill="var(--color-surface-1)"
        stroke="var(--color-line)"
      />
      {opcoes.map((o, i) => {
        const a = (i / opcoes.length) * Math.PI * 2;
        const x = R + 8 + Math.cos(a) * (R - 18);
        const y = R + 8 + Math.sin(a) * (R - 18);
        const ativa = escolhida === i;
        return (
          <g key={o.chave}>
            <circle
              cx={x}
              cy={y}
              r={18}
              fill={ativa ? 'var(--color-accent)' : 'var(--color-surface-1)'}
              stroke="var(--color-line)"
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill={ativa ? 'var(--color-accent-on)' : 'var(--color-ink-2)'}
            >
              {o.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
