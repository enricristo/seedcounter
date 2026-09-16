// =============================================================================
// SeedCounter — EnsaioPanel
//
// A parte visível do ensaio ao carregar: um cartão por receita, cada um com
// uma miniatura da imagem com os contornos propostos por cima, e um resumo em
// números. A pessoa escolhe UMA ou NENHUMA — "Usar esta" é o único caminho
// que leva contornos ao estado da aplicação (regra do plano: a ferramenta
// propõe, nunca decide sozinha). Recusar ("Nenhuma") não deixa rastro.
// =============================================================================

import { useEffect, useRef } from 'react';
import { FlaskConical, Check, Ban, Square } from 'lucide-react';
import type { ResultadoDoEnsaio } from './executar';
import { RECEITAS } from './receitas';

interface EnsaioPanelProps {
  imagem: HTMLImageElement | HTMLCanvasElement;
  resultados: ResultadoDoEnsaio[];
  emAndamento: boolean;
  onUsar: (r: ResultadoDoEnsaio) => void;
  onNenhuma: () => void;
  onParar: () => void;
}

/** Largura da miniatura. 160 px cabe três cartões na lateral sem rolagem horizontal. */
const LARGURA_DA_MINIATURA = 160;

function dimensoes(imagem: HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  return imagem instanceof HTMLImageElement
    ? { w: imagem.naturalWidth, h: imagem.naturalHeight }
    : { w: imagem.width, h: imagem.height };
}

/**
 * Uma miniatura: a imagem reduzida, com os contornos propostos por cima em
 * traço fino de `--color-accent`. Suspeitos de aglomerado (limiar da própria
 * população) entram tracejados — a pessoa vê a dúvida antes de aceitar, e
 * decide com calma depois, no inspetor.
 */
function Miniatura({
  imagem,
  resultado,
}: {
  imagem: HTMLImageElement | HTMLCanvasElement;
  resultado: ResultadoDoEnsaio;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = dimensoes(imagem);
    if (w <= 0 || h <= 0) return;
    const escala = LARGURA_DA_MINIATURA / w;
    canvas.width = LARGURA_DA_MINIATURA;
    canvas.height = Math.max(1, Math.round(h * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);

    const corDoAccent =
      getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() ||
      '#00e5ff';
    ctx.lineWidth = 1;
    ctx.strokeStyle = corDoAccent;
    for (const p of resultado.propostos) {
      if (p.contorno.length < 2) continue;
      ctx.setLineDash(p.suspeitoDeAglomerado ? [3, 2] : []);
      ctx.beginPath();
      ctx.moveTo(p.contorno[0][0] * escala, p.contorno[0][1] * escala);
      for (let i = 1; i < p.contorno.length; i++) {
        ctx.lineTo(p.contorno[i][0] * escala, p.contorno[i][1] * escala);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }, [imagem, resultado]);

  return (
    <canvas
      ref={canvasRef}
      className="border-line block w-full rounded-lg border"
      role="img"
      aria-label={`Miniatura da receita ${resultado.receita.nome}: ${resultado.resumo.contagem} contornos propostos`}
    />
  );
}

/** Um cartão de resultado, com a miniatura, o resumo e o botão de aceitar. */
function CartaoDaReceita({
  imagem,
  resultado,
  onUsar,
}: {
  imagem: HTMLImageElement | HTMLCanvasElement;
  resultado: ResultadoDoEnsaio;
  onUsar: () => void;
}) {
  const { receita, resumo, escapes, limitado } = resultado;
  return (
    <li className="border-line bg-surface-1 flex flex-col gap-2 rounded-xl border p-2.5">
      <Miniatura imagem={imagem} resultado={resultado} />
      <div>
        <p className="text-ink-1 text-xs font-bold">{receita.nome}</p>
        <p className="text-ink-3 text-[10px] leading-snug">{receita.quando}</p>
      </div>
      <p className="text-ink-2 font-mono text-[11px] tabular-nums">
        {resumo.contagem} {resumo.contagem === 1 ? 'contorno' : 'contornos'}
        {resumo.medianaDaAreaPx != null && <> · área mediana {Math.round(resumo.medianaDaAreaPx)} px</>}
        {resumo.medianaDoFeretMaxPx != null && (
          <> · Feret {Math.round(resumo.medianaDoFeretMaxPx)} px</>
        )}
        {' · '}
        {resumo.suspeitos} {resumo.suspeitos === 1 ? 'suspeito' : 'suspeitos'}
        {' · '}
        {escapes} {escapes === 1 ? 'escape' : 'escapes'}
      </p>
      {limitado && (
        <p className="text-ink-3 text-[10px] leading-snug">
          Imagem com mais de 400 pontos localizados — esta receita rodou sobre uma amostra dos
          400 primeiros.
        </p>
      )}
      <button
        type="button"
        onClick={onUsar}
        disabled={resumo.contagem === 0}
        className="bg-accent hover:bg-accent-strong text-accent-on flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Check size={14} /> Usar esta
      </button>
    </li>
  );
}

/**
 * Painel do ensaio ao carregar: uma coluna de cartões (um por receita), com
 * "Nenhuma" e, enquanto roda, "Ensaiando… N/M" e "Parar".
 *
 * Fica na aba Inspetor, acima da lista de sementes, quando há ensaio em
 * andamento ou resultados e nenhum contorno está selecionado — selecionar um
 * contorno abre o inspetor daquele contorno, que não compete com este painel.
 */
export function EnsaioPanel({ imagem, resultados, emAndamento, onUsar, onNenhuma, onParar }: EnsaioPanelProps) {
  // Total fixo (o número de receitas configuradas), não deduzido do que já
  // chegou — senão a barra de progresso ficaria sempre "1/1" a caminho do fim.
  const total = RECEITAS.length;

  return (
    <section aria-label="Ensaio ao carregar" className="flex flex-col gap-3">
      <div className="text-ink-2 flex items-center gap-2">
        <FlaskConical size={14} className="text-accent" />
        <span className="text-xs font-bold tracking-wide uppercase">Ensaio ao carregar</span>
      </div>
      <p className="text-ink-3 text-[10px] leading-snug">
        Três conjuntos de parâmetros rodaram sobre esta imagem. Escolha um, ou nenhum — nada entra
        na contagem sem &ldquo;Usar esta&rdquo;.
      </p>

      {emAndamento && (
        <div role="status" aria-live="polite" className="text-ink-3 flex items-center gap-2 text-[11px]">
          <span className="border-accent border-t-transparent h-3 w-3 shrink-0 animate-spin rounded-full border-2" />
          Ensaiando… {resultados.length}/{total}
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {resultados.map((r) => (
          <CartaoDaReceita
            key={r.receita.id}
            imagem={imagem}
            resultado={r}
            onUsar={() => onUsar(r)}
          />
        ))}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNenhuma}
          className="border-line text-ink-2 hover:bg-surface-2 flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
        >
          <Ban size={14} /> Nenhuma
        </button>
        {emAndamento && (
          <button
            type="button"
            onClick={onParar}
            className="border-line text-ink-2 hover:bg-surface-2 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
          >
            <Square size={12} /> Parar
          </button>
        )}
      </div>
    </section>
  );
}
