import { FLUXO_DE_TRABALHO } from '../../features/ajuda/atalhos';

/**
 * O fluxo de trabalho como diagrama, dentro das instruções.
 *
 * SVG desenhado a partir da mesma lista da aba em texto (`FLUXO_DE_TRABALHO`)
 * — uma fonte, duas formas. Caixas em coluna, setas entre elas, e ao lado de
 * cada caixa as ENTRADAS daquela etapa (o que a alimenta), porque é isso que
 * um diagrama mostra melhor que uma lista: de onde vem cada coisa.
 */
const ENTRADAS: Record<string, string[]> = {
  Abrir: ['digitalização · câmera', 'exemplo real · pasta de datasets'],
  Calibrar: ['DPI do scanner', 'régua na imagem · micrômetro'],
  Encontrar: ['marcar (V/I) · onda (S)', 'ensaio: 3 receitas + “pela espécie”'],
  Curar: ['galeria · inspetor', 'corte · regras em lote (fantasma)'],
  Medir: ['área · C×L · Feret · solidez', 'eixos PCA/Feret (≠ avisa)'],
  Identificar: ['espécie · lote · protocolo', 'referência de literatura'],
  Exportar: ['CSV (origem por objeto)', 'laudo PDF · sessão JSON'],
};

const LARGURA = 268;
const CAIXA_W = 88;
const CAIXA_H = 32;
const PASSO = 60;
const X0 = 8;

export function Fluxograma() {
  const altura = FLUXO_DE_TRABALHO.length * PASSO + 6;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${LARGURA} ${altura}`}
      role="img"
      aria-label="Fluxo de trabalho: abrir, calibrar, encontrar, curar, medir, identificar, exportar"
      className="text-ink-1"
    >
      <defs>
        <marker id="seta-fluxo" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" opacity="0.55" />
        </marker>
      </defs>
      {FLUXO_DE_TRABALHO.map((p, i) => {
        const y = 4 + i * PASSO;
        const entradas = ENTRADAS[p.titulo] ?? [];
        return (
          <g key={p.titulo}>
            {i > 0 && (
              <line
                x1={X0 + CAIXA_W / 2}
                y1={y - PASSO + CAIXA_H}
                x2={X0 + CAIXA_W / 2}
                y2={y - 1}
                stroke="currentColor"
                strokeWidth={1.2}
                opacity={0.55}
                markerEnd="url(#seta-fluxo)"
              />
            )}
            <rect
              x={X0}
              y={y}
              width={CAIXA_W}
              height={CAIXA_H}
              rx={7}
              fill="var(--color-surface-1, #fff)"
              stroke="var(--color-accent, #2f8f83)"
              strokeWidth={1.4}
            />
            <text x={X0 + 9} y={y + 12} fontSize={8} fill="currentColor" opacity={0.55} fontFamily="ui-monospace, monospace">
              {i + 1}
            </text>
            <text x={X0 + CAIXA_W / 2 + 4} y={y + 21} fontSize={10.5} fontWeight={700} textAnchor="middle" fill="currentColor">
              {p.titulo.toUpperCase()}
            </text>
            {/* entradas: fio fino da caixa para a nota */}
            <line x1={X0 + CAIXA_W} y1={y + CAIXA_H / 2} x2={X0 + CAIXA_W + 10} y2={y + CAIXA_H / 2} stroke="currentColor" strokeWidth={1} opacity={0.35} />
            {entradas.map((e, k) => (
              <text key={e} x={X0 + CAIXA_W + 13} y={y + 13 + k * 13.5} fontSize={9.6} fill="currentColor" opacity={0.85}>
                {e}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
