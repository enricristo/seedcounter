import React, { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useCanvasContext } from '../../components/canvas/overlays/CanvasContext';

/**
 * Germinar — o easter egg de cena, sobre o canvas.
 *
 * Digitou "germinar" com sementes marcadas: um sol sobe no canto, a luz
 * aquece a imagem, e de algumas sementes marcadas brota um caule, folhas e
 * uma flor que abre — girassol, orquídea ou rosa, alternando a cada vez.
 * Depois tudo se recolhe e a cena volta ao que era. Nada muda no estado:
 * é só SVG por cima, em coordenadas da imagem, para as flores nascerem
 * exatamente onde a pessoa clicou.
 *
 * Feito para ser brincado: `TEMAS` é o lugar de acrescentar flores; a
 * coreografia (sol → luz → caule → folhas → flor → recolher) é uma só.
 * Respeita prefers-reduced-motion: aí só a flor aparece e some, sem crescer.
 */

export type TemaDaFlor = 'girassol' | 'orquidea' | 'rosa';
export const TEMAS: TemaDaFlor[] = ['girassol', 'orquidea', 'rosa'];

export interface GerminarProps {
  ativo: boolean;
  tema: TemaDaFlor;
  /** Posições das sementes marcadas, em px da imagem. Até 5 são usadas. */
  sementes: { x: number; y: number }[];
  onFim: () => void;
}

const DURACAO_TOTAL_MS = 6500;
const MAXIMO_DE_FLORES = 5;

/** Escolha determinística pelas posições: a mesma cena floresce igual duas vezes. */
function escolher(sementes: { x: number; y: number }[]): { x: number; y: number }[] {
  if (sementes.length <= MAXIMO_DE_FLORES) return sementes;
  const passo = sementes.length / MAXIMO_DE_FLORES;
  return Array.from({ length: MAXIMO_DE_FLORES }, (_, i) => sementes[Math.floor(i * passo)]);
}

function Girassol({ r }: { r: number }) {
  const petalas = 14;
  return (
    <g>
      {Array.from({ length: petalas }, (_, i) => (
        <motion.ellipse
          key={i}
          cx={0}
          cy={-r * 0.62}
          rx={r * 0.16}
          ry={r * 0.42}
          fill="#f2c02e"
          stroke="#c9961a"
          strokeWidth={r * 0.02}
          transform={`rotate(${(360 / petalas) * i})`}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05 * i, duration: 0.5, ease: 'backOut' }}
          style={{ transformOrigin: '0px 0px' }}
        />
      ))}
      <circle r={r * 0.34} fill="#5a3b12" />
      {Array.from({ length: 28 }, (_, i) => {
        const a = i * 2.39996; // ângulo de ouro: o miolo do girassol é uma espiral
        const d = r * 0.05 * Math.sqrt(i);
        return <circle key={i} cx={Math.cos(a) * d} cy={Math.sin(a) * d} r={r * 0.028} fill="#8a5a1c" />;
      })}
    </g>
  );
}

function Orquidea({ r }: { r: number }) {
  const petala = `M0,0 C${r * 0.22},${-r * 0.3} ${r * 0.3},${-r * 0.66} 0,${-r * 0.96} C${-r * 0.3},${-r * 0.66} ${-r * 0.22},${-r * 0.3} 0,0 Z`;
  const labelo = `M0,0 C${r * 0.28},${r * 0.2} ${r * 0.32},${r * 0.52} 0,${r * 0.68} C${-r * 0.32},${r * 0.52} ${-r * 0.28},${r * 0.2} 0,0 Z`;
  return (
    <g>
      {[0, 72, 144, 216, 288].map((ang, i) => (
        <motion.path
          key={ang}
          d={petala}
          fill={i % 2 ? '#f1a7d8' : '#e879c9'}
          stroke="#b0468f"
          strokeWidth={r * 0.02}
          transform={`rotate(${ang})`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08 * i, duration: 0.55, ease: 'backOut' }}
          style={{ transformOrigin: '0px 0px' }}
        />
      ))}
      <motion.path
        d={labelo}
        fill="#c2185b"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.45, duration: 0.5, ease: 'backOut' }}
        style={{ transformOrigin: '0px 0px' }}
      />
      <circle r={r * 0.09} fill="#fff3b0" />
    </g>
  );
}

function Rosa({ r }: { r: number }) {
  const camadas = 5;
  return (
    <g>
      {Array.from({ length: camadas }, (_, c) => {
        const rc = r * (0.95 - c * 0.17);
        const n = 6 - c;
        return Array.from({ length: n }, (_, i) => (
          <motion.path
            key={`${c}-${i}`}
            d={`M0,0 C${rc * 0.7},${-rc * 0.2} ${rc * 0.7},${-rc * 0.95} 0,${-rc} C${-rc * 0.7},${-rc * 0.95} ${-rc * 0.7},${-rc * 0.2} 0,0 Z`}
            fill={c % 2 ? '#e0304f' : '#c8213f'}
            stroke="#8f1630"
            strokeWidth={r * 0.015}
            transform={`rotate(${(360 / n) * i + c * 23})`}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12 * c + 0.03 * i, duration: 0.5, ease: 'easeOut' }}
            style={{ transformOrigin: '0px 0px' }}
          />
        ));
      })}
    </g>
  );
}

const FLORES: Record<TemaDaFlor, (p: { r: number }) => React.ReactElement> = { girassol: Girassol, orquidea: Orquidea, rosa: Rosa };

export function Germinar({ ativo, tema, sementes, onFim }: GerminarProps) {
  const { image } = useCanvasContext();
  const W = image.width;
  const H = image.height;
  const escolhidas = useMemo(() => escolher(sementes), [sementes]);
  const reduzido = useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!ativo) return;
    const t = setTimeout(onFim, reduzido ? 2500 : DURACAO_TOTAL_MS);
    return () => clearTimeout(t);
  }, [ativo, onFim, reduzido]);

  if (!ativo || escolhidas.length === 0) return null;

  const Flor = FLORES[tema];
  const altura = Math.min(W, H) * 0.22; // caule
  const raio = altura * 0.32; // flor
  const sol = { x: W * 0.9, y: H * 0.12, r: Math.min(W, H) * 0.06 };
  const caule = (x: number, y: number) => `M${x},${y} C${x + altura * 0.15},${y - altura * 0.35} ${x - altura * 0.12},${y - altura * 0.65} ${x},${y - altura}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} ${H}`}
      style={{ zIndex: 12 }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="luz-do-sol" cx={sol.x / W} cy={sol.y / H} r={0.9}>
          <stop offset="0%" stopColor="#ffd84d" stopOpacity={0.35} />
          <stop offset="55%" stopColor="#ffb347" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#ffb347" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* A luz: aquece a imagem inteira a partir do sol. */}
      <motion.rect
        x={0}
        y={0}
        width={W}
        height={H}
        fill="url(#luz-do-sol)"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: DURACAO_TOTAL_MS / 1000, times: [0, 0.15, 0.85, 1] }}
      />

      {/* O sol, feliz, subindo no canto. */}
      <motion.g
        initial={{ y: sol.r * 3, opacity: 0 }}
        animate={{ y: [sol.r * 3, 0, 0, sol.r * 3], opacity: [0, 1, 1, 0] }}
        transition={{ duration: DURACAO_TOTAL_MS / 1000, times: [0, 0.12, 0.88, 1], ease: 'easeInOut' }}
      >
        <motion.g
          style={{ transformOrigin: `${sol.x}px ${sol.y}px` }}
          animate={{ rotate: reduzido ? 0 : 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1={sol.x + Math.cos((i * Math.PI) / 6) * sol.r * 1.25}
              y1={sol.y + Math.sin((i * Math.PI) / 6) * sol.r * 1.25}
              x2={sol.x + Math.cos((i * Math.PI) / 6) * sol.r * 1.7}
              y2={sol.y + Math.sin((i * Math.PI) / 6) * sol.r * 1.7}
              stroke="#f5b400"
              strokeWidth={sol.r * 0.12}
              strokeLinecap="round"
            />
          ))}
        </motion.g>
        <circle cx={sol.x} cy={sol.y} r={sol.r} fill="#ffd23f" stroke="#e6a100" strokeWidth={sol.r * 0.06} />
        <circle cx={sol.x - sol.r * 0.32} cy={sol.y - sol.r * 0.15} r={sol.r * 0.09} fill="#5a3b12" />
        <circle cx={sol.x + sol.r * 0.32} cy={sol.y - sol.r * 0.15} r={sol.r * 0.09} fill="#5a3b12" />
        <path
          d={`M${sol.x - sol.r * 0.4},${sol.y + sol.r * 0.2} Q${sol.x},${sol.y + sol.r * 0.65} ${sol.x + sol.r * 0.4},${sol.y + sol.r * 0.2}`}
          fill="none"
          stroke="#5a3b12"
          strokeWidth={sol.r * 0.08}
          strokeLinecap="round"
        />
      </motion.g>

      {/* De cada semente escolhida: caule → folhas → flor → recolher. */}
      {escolhidas.map((s, i) => {
        const atraso = 0.9 + i * 0.35;
        return (
          <motion.g
            key={`${s.x}-${s.y}`}
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: DURACAO_TOTAL_MS / 1000, times: [0, 0.86, 1] }}
          >
            <motion.path
              d={caule(s.x, s.y)}
              fill="none"
              stroke="#3e8e41"
              strokeWidth={Math.max(2, altura * 0.05)}
              strokeLinecap="round"
              initial={{ pathLength: reduzido ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: atraso, duration: 1.1, ease: 'easeOut' }}
            />
            {[0.45, 0.7].map((f, k) => (
              <motion.ellipse
                key={k}
                cx={s.x + (k ? -1 : 1) * altura * 0.16}
                cy={s.y - altura * f}
                rx={altura * 0.15}
                ry={altura * 0.06}
                fill="#57a85a"
                transform={`rotate(${k ? 25 : -25} ${s.x + (k ? -1 : 1) * altura * 0.16} ${s.y - altura * f})`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: atraso + 0.6 + k * 0.2, duration: 0.4, ease: 'backOut' }}
                style={{ transformOrigin: `${s.x}px ${s.y - altura * f}px` }}
              />
            ))}
            <motion.g
              transform={`translate(${s.x} ${s.y - altura})`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: atraso + 1.0, duration: 0.7, ease: 'backOut' }}
              style={{ transformOrigin: `${s.x}px ${s.y - altura}px` }}
            >
              <Flor r={raio} />
            </motion.g>
          </motion.g>
        );
      })}
    </svg>
  );
}
