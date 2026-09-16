import { useMemo } from 'react';
import { Mountain, ExternalLink, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { primeiraCurvaDeFucik, DISSERTACAO } from './fucik';
import { useModalEscape } from '../../hooks/useModalEscape';

export interface PassoDaMontanhaProps {
  ativo: boolean;
  onFim: () => void;
}

const LAMBDA1 = 1;
const ALCANCE = 12; // até 12·λ₁ em cada eixo: mostra a curva e as duas assíntotas
const W = 260;
const H = 260;
const M = 28;

/** Mapeia (α, β) em [0, ALCANCE]² para a caixa do SVG. */
function px(v: number): number {
  return M + ((W - 2 * M) * v) / ALCANCE;
}
function py(v: number): number {
  return H - M - ((H - 2 * M) * v) / ALCANCE;
}

/**
 * O que aparece ao digitar "fucik" (ou "montanha") no canvas.
 *
 * Um cartão, não um modal de produto: a curva se desenha sozinha em 2 s, o
 * texto liga a onda do app ao passo da montanha, e o link leva à dissertação.
 * Esc ou clique fora fecham. Sem som — regra do projeto: som é opt-in.
 */
export function PassoDaMontanha({ ativo, onFim }: PassoDaMontanhaProps) {
  useModalEscape(ativo, onFim);
  const caminho = useMemo(() => {
    const pts = primeiraCurvaDeFucik(LAMBDA1, 96, ALCANCE * 6).filter(([a, b]) => a <= ALCANCE && b <= ALCANCE);
    return pts.map(([a, b], i) => `${i === 0 ? 'M' : 'L'}${px(a).toFixed(1)},${py(b).toFixed(1)}`).join(' ');
  }, []);

  return (
    <AnimatePresence>
      {ativo && (
        <motion.div
          key="passo"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onFim}
          role="dialog"
          aria-label="Teorema do Passo da Montanha"
        >
          <motion.div
            className="bg-surface-1 border-line text-ink-1 relative flex max-w-2xl flex-col gap-4 rounded-2xl border p-5 shadow-2xl md:flex-row"
            initial={{ y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onFim}
              className="text-ink-3 hover:text-ink-1 absolute top-3 right-3 rounded p-1"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>

            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 self-center" aria-hidden="true">
              {/* eixos */}
              <line x1={M} y1={H - M} x2={W - M + 6} y2={H - M} stroke="currentColor" strokeWidth={1} opacity={0.5} />
              <line x1={M} y1={H - M} x2={M} y2={M - 6} stroke="currentColor" strokeWidth={1} opacity={0.5} />
              <text x={W - M + 2} y={H - M + 12} fontSize={10} fill="currentColor" opacity={0.7}>α</text>
              <text x={M - 12} y={M - 8} fontSize={10} fill="currentColor" opacity={0.7}>β</text>
              {/* retas triviais {λ₁}×ℝ e ℝ×{λ₁} */}
              <line x1={px(LAMBDA1)} y1={M} x2={px(LAMBDA1)} y2={H - M} stroke="currentColor" strokeDasharray="3 3" opacity={0.45} />
              <line x1={M} y1={py(LAMBDA1)} x2={W - M} y2={py(LAMBDA1)} stroke="currentColor" strokeDasharray="3 3" opacity={0.45} />
              <text x={px(LAMBDA1) + 3} y={M + 10} fontSize={9} fill="currentColor" opacity={0.6}>α = λ₁</text>
              <text x={W - M - 34} y={py(LAMBDA1) - 4} fontSize={9} fill="currentColor" opacity={0.6}>β = λ₁</text>
              {/* diagonal, só referência */}
              <line x1={M} y1={H - M} x2={W - M} y2={M} stroke="currentColor" strokeWidth={0.5} opacity={0.2} />
              {/* a primeira curva não trivial, desenhando-se */}
              <motion.path
                d={caminho}
                fill="none"
                stroke="var(--color-accent, #2f8f83)"
                strokeWidth={2.2}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
              {/* o ponto na diagonal: (4λ₁, 4λ₁), o primeiro ponto não trivial */}
              <motion.circle
                cx={px(4 * LAMBDA1)}
                cy={py(4 * LAMBDA1)}
                r={3.5}
                fill="var(--color-accent, #2f8f83)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.1 }}
              />
              <text x={px(4 * LAMBDA1) + 6} y={py(4 * LAMBDA1) - 6} fontSize={9} fill="currentColor" opacity={0.7}>
                (4λ₁, 4λ₁)
              </text>
            </svg>

            <div className="flex min-w-0 flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Mountain size={18} className="text-accent" />
                <h2 className="text-base font-bold">Teorema do Passo da Montanha</h2>
              </div>
              <p className="text-ink-2 text-xs leading-relaxed">
                A onda que contorna cada semente sobe a paisagem de ΔE a partir do clique e para no
                <em> menor nível pelo qual se consegue sair do vale</em>. Esse número é um passo da montanha:
              </p>
              <p className="bg-surface-2 rounded-lg px-3 py-2 text-center font-mono text-xs">
                c = inf<sub>γ</sub> max<sub>t</sub> E(γ(t))
              </p>
              <p className="text-ink-2 text-xs leading-relaxed">
                A curva ao lado é a <strong>primeira curva não trivial do espectro de Fučik</strong> do p-Laplaciano —
                os (α, β) em que −Δ<sub>p</sub>u = α(u⁺)<sup>p−1</sup> − β(u⁻)<sup>p−1</sup> tem solução não trivial.
                Nasce do primeiro ponto não trivial, obtido pelo passo da montanha numa variedade C¹, e é contínua,
                estritamente decrescente e assintótica às retas triviais.
              </p>
              <a
                href={DISSERTACAO.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline mt-1 inline-flex items-center gap-1.5 text-xs font-semibold"
              >
                <ExternalLink size={13} />
                {DISSERTACAO.autor} — {DISSERTACAO.titulo}
              </a>
              <p className="text-ink-3 text-[10px]">Esc fecha. Você achou o que estava escondido.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
