// =============================================================================
// SeedCounter — Toolbar
// Barra de ferramentas flutuante sobre a imagem.
//
// As cores aqui obedecem a separação de linguagens do sistema: as ferramentas
// de CLASSE (viável / inviável) espelham a cor da marca no canvas, porque são
// a legenda dela; as ferramentas de INSTRUMENTO (borracha, mão, réguas) usam
// cromo — a borracha em semântica destrutiva, as outras em acento.
// =============================================================================

import React from 'react';
import { Circle, XCircle, Eraser, Hand, Ruler, Waves, Eye, EyeOff, Grid3x3 } from 'lucide-react';
import { TOOLS, type ToolId } from '../../hooks/useTools';
import { descrever, type Mascara } from '../../features/mascara/mascara';

/** Icone de cada estado da mascara. O disco vazado e "so pontos". */
const ICONE_DA_MASCARA: Record<Mascara, React.ElementType> = {
  tudo: Eye,
  pontos: Circle,
  nada: EyeOff,
};

const ICONS: Record<ToolId, React.ElementType> = {
  viable: Circle,
  inviable: XCircle,
  onda: Waves,
  eraser: Eraser,
  pan: Hand,
};

const ACTIVE_STYLES: Record<ToolId, string> = {
  // Legenda da marca no canvas: mesma cor E mesma forma. Disco cheio para
  // viavel, anel vazado para inviavel — a forma repete o que a cor diz.
  viable: 'bg-[var(--color-ov-viable)] border-[var(--color-ov-viable)] text-[#101719]',
  inviable: 'border-2 border-[var(--color-ov-inviable)] text-[var(--color-ov-inviable)]',
  // A onda é instrumento, não classe: ela mede o contorno da semente que a
  // ferramenta de classe já escolheu. Por isso acento, e não ciano/magenta.
  onda: 'bg-accent border-accent text-accent-on',
  // Instrumento, não espécime.
  eraser: 'bg-danger border-danger text-white',
  pan: 'bg-accent border-accent text-accent-on',
};

interface ToolbarProps {
  activeTool: ToolId;
  onSelect: (tool: ToolId) => void;
  eraserRadius: number;
  onEraserRadiusChange: (radius: number) => void;
  /** true quando a borracha está ativa temporariamente (Alt pressionado). */
  isTemporary?: boolean;
  /** Réguas nas bordas ligadas? */
  showRulers?: boolean;
  onToggleRulers?: () => void;
  /** Estado da mascara de anotacao. Ausente = botao oculto. */
  mascara?: Mascara;
  onCiclarMascara?: () => void;
  /** Abre a galeria de objetos. Ausente = botao oculto. */
  onAbrirGaleria?: () => void;
  /** Quantos objetos ha, para o distintivo da galeria. */
  totalDeObjetos?: number;
}

const INATIVO = 'border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink-1';

export function Toolbar({
  activeTool,
  onSelect,
  eraserRadius,
  onEraserRadiusChange,
  isTemporary,
  showRulers,
  onToggleRulers,
  mascara,
  onCiclarMascara,
  onAbrirGaleria,
  totalDeObjetos = 0,
}: ToolbarProps) {
  const IconeDaMascara = mascara ? ICONE_DA_MASCARA[mascara] : Eye;
  return (
    <div className="border-line bg-surface-1/95 rounded-panel absolute top-1/2 left-3 z-20 flex -translate-y-1/2 flex-col gap-1.5 border p-1.5 shadow-xl backdrop-blur">
      {TOOLS.map((tool) => {
        const Icon = ICONS[tool.id];
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelect(tool.id)}
            title={`${tool.label} (${tool.shortcut.toUpperCase()}) — ${tool.hint}`}
            aria-label={tool.label}
            aria-pressed={isActive}
            className={`rounded-control relative flex h-10 w-10 items-center justify-center border transition-all ${
              isActive ? ACTIVE_STYLES[tool.id] : INATIVO
            }`}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="absolute right-1 bottom-0.5 font-mono text-[8px] font-bold uppercase opacity-60">
              {tool.shortcut}
            </span>
            {isActive && isTemporary && tool.id === 'eraser' && (
              <span className="ring-danger absolute -top-1 -right-1 h-2 w-2 rounded-full bg-white ring-2" />
            )}
          </button>
        );
      })}

      {onToggleRulers && (
        <button
          onClick={onToggleRulers}
          title="Mostrar ou ocultar as réguas nas bordas"
          aria-label="Alternar réguas"
          aria-pressed={!!showRulers}
          className={`rounded-control flex h-10 w-10 items-center justify-center border transition-all ${
            showRulers ? 'bg-accent border-accent text-accent-on' : INATIVO
          }`}
        >
          <Ruler size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}

      {mascara && onCiclarMascara && (
        <button
          onClick={onCiclarMascara}
          title={`${descrever(mascara).explicacao} (M)`}
          aria-label={`Máscara: ${descrever(mascara).rotulo}. Pressione para alternar.`}
          aria-pressed={mascara !== 'tudo'}
          className={`rounded-control relative flex h-10 w-10 items-center justify-center border transition-all ${
            mascara !== 'tudo' ? 'bg-accent border-accent text-accent-on' : INATIVO
          }`}
        >
          <IconeDaMascara size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="absolute right-1 bottom-0.5 font-mono text-[8px] font-bold uppercase opacity-60">
            m
          </span>
        </button>
      )}

      {onAbrirGaleria && (
        <button
          onClick={onAbrirGaleria}
          title="Ver todos os objetos lado a lado (G)"
          aria-label="Abrir galeria de objetos"
          className={`rounded-control relative flex h-10 w-10 items-center justify-center border transition-all ${INATIVO}`}
        >
          <Grid3x3 size={20} strokeWidth={1.75} aria-hidden="true" />
          {totalDeObjetos > 0 && (
            <span className="bg-accent text-accent-on absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-[9px] leading-4 font-bold tabular-nums">
              {totalDeObjetos > 99 ? '99+' : totalDeObjetos}
            </span>
          )}
          <span className="absolute right-1 bottom-0.5 font-mono text-[8px] font-bold uppercase opacity-60">
            g
          </span>
        </button>
      )}

      {activeTool === 'eraser' && (
        <div className="border-line mt-0.5 space-y-1 border-t pt-1.5">
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={eraserRadius}
            onChange={(e) => onEraserRadiusChange(Number(e.target.value))}
            title="Tamanho da borracha ( [ e ] )"
            aria-label="Tamanho da borracha"
            className="accent-danger w-10"
            style={{ writingMode: 'vertical-lr' as React.CSSProperties['writingMode'] }}
          />
          <p className="text-ink-3 text-center font-mono text-[9px] tabular-nums">{eraserRadius}</p>
        </div>
      )}
    </div>
  );
}
