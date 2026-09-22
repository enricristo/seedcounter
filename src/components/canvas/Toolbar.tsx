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
import {
  Circle,
  XCircle,
  Eraser,
  Hand,
  Ruler,
  Waves,
  Eye,
  EyeOff,
  Grid3x3,
  Spline,
  PenTool,
  Square,
  MessageSquare,
  ArrowUpRight,
  Triangle,
  Diamond,
  Moon,
  X as XIcone,
  CircleOff,
} from 'lucide-react';
import { TOOLS, type ToolId } from '../../hooks/useTools';
import type {
  FerramentaDeClasse,
  IconeDeClasse,
} from '../../features/classes/ferramentas-de-classe';
import type { ClasseDeSemente } from '../../lib/normas/classes-de-semente';
import { descrever, type Mascara } from '../../features/mascara/mascara';
import { AJUSTE_MAXIMO, AJUSTE_MINIMO } from '../../lib/escala-da-marca';
import { ESTILOS_DA_MARCA, OPACIDADE_MINIMA, type EstiloDaMarca } from '../../theme/specimen';

/** Icone de cada estado da mascara. O disco vazado e "so pontos". */
const ICONE_DA_MASCARA: Record<Mascara, React.ElementType> = {
  tudo: Eye,
  pontos: Circle,
  nada: EyeOff,
};

/**
 * A forma de cada classe fina. É mnemônica e é redundância (Lei 4): losango
 * para `dura` porque diamante é duro; lua para `dormente`, que está viva e
 * dormindo; × para morta; círculo cortado para o que nem semente é. Na fatia
 * 3b este mesmo vocabulário vai para a marca desenhada no canvas.
 */
const ICONE_DE_CLASSE: Record<IconeDeClasse, React.ElementType> = {
  circulo: Circle,
  triangulo: Triangle,
  losango: Diamond,
  lua: Moon,
  x: XIcone,
  cortado: CircleOff,
};

const ICONS: Record<ToolId, React.ElementType> = {
  viable: Circle,
  inviable: XCircle,
  onda: Waves,
  contorno: Spline,
  desenho: PenTool,
  cota: Ruler,
  seta: ArrowUpRight,
  caixa: Square,
  chamada: MessageSquare,
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
  // Ajuste de contorno tambem e instrumento: ele nao classifica, corrige a
  // medida que a onda ja fez.
  contorno: 'bg-accent border-accent text-accent-on',
  desenho: 'bg-accent border-accent text-accent-on',
  cota: 'bg-accent border-accent text-accent-on',
  seta: 'bg-accent border-accent text-accent-on',
  caixa: 'bg-accent border-accent text-accent-on',
  chamada: 'bg-accent border-accent text-accent-on',
  // Instrumento, não espécime.
  eraser: 'bg-danger border-danger text-white',
  pan: 'bg-accent border-accent text-accent-on',
};

interface ToolbarProps {
  activeTool: ToolId;
  onSelect: (tool: ToolId) => void;
  /**
   * As classes do protocolo declarado. Lista vazia — orquídea, ou protocolo
   * nenhum — não desenha botão algum: ali as classes SÃO viável e inviável.
   */
  ferramentasDeClasse?: FerramentaDeClasse[];
  /** A classe fina armada para o próximo clique. `null` = marcar grosso. */
  classeAtiva?: ClasseDeSemente | null;
  onEscolherClasse?: (classe: ClasseDeSemente) => void;
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
  /** Multiplicador do tamanho da marca. Ausente = controle oculto. */
  ajusteDaMarca?: number;
  onAjusteDaMarcaChange?: (v: number) => void;
  /** Estilo do desenho da marca e quanto ela deixa ver da semente. */
  estiloDaMarca?: EstiloDaMarca;
  onEstiloDaMarcaChange?: (v: EstiloDaMarca) => void;
  opacidadeDaMarca?: number;
  onOpacidadeDaMarcaChange?: (v: number) => void;
  /** Raio do traço da borracha de contorno. */
  raioDaRaspagem?: number;
  onRaioDaRaspagemChange?: (v: number) => void;
}

const INATIVO = 'border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink-1';

/**
 * O bloco do controle deslizante vertical (tamanho do ponto, espessura da
 * raspagem, raio da borracha). Sem largura e altura PRÓPRIAS — herdando só
 * o `w-10` dos botões de 40px — o polegar do `<input type=range>` rotacionado
 * transbordava por baixo da barra e o rótulo ficava desalinhado (achado do
 * Enrico). `writingMode: vertical-lr` gira o eixo do controle; largura e
 * altura em `style` fixam a espessura e o comprimento do traço
 * independentemente da rotação, e `items-center` no bloco centraliza tudo.
 */
const blocoDoDeslizante = 'border-line mt-0.5 flex flex-col items-center gap-1 border-t pt-1.5';
const estiloDoDeslizante: React.CSSProperties = {
  writingMode: 'vertical-lr' as React.CSSProperties['writingMode'],
  width: '6px',
  height: '72px',
};

export function Toolbar({
  activeTool,
  onSelect,
  ferramentasDeClasse = [],
  classeAtiva = null,
  onEscolherClasse,
  eraserRadius,
  onEraserRadiusChange,
  isTemporary,
  showRulers,
  onToggleRulers,
  mascara,
  onCiclarMascara,
  onAbrirGaleria,
  totalDeObjetos = 0,
  ajusteDaMarca,
  onAjusteDaMarcaChange,
  estiloDaMarca,
  onEstiloDaMarcaChange,
  opacidadeDaMarca,
  onOpacidadeDaMarcaChange,
  raioDaRaspagem,
  onRaioDaRaspagemChange,
}: ToolbarProps) {
  const IconeDaMascara = mascara ? ICONE_DA_MASCARA[mascara] : Eye;
  return (
    // `max-h` + `overflow-y-auto`: numa tela baixa, os grupos de ferramentas
    // mais o bloco do deslizante podem passar da altura da janela — sem
    // rolagem o último item (galeria ou o próprio deslizante) ficava cortado
    // embaixo, fora de vista, sem aviso.
    // Coluna própria na borda do espaço de trabalho, não mais flutuando
    // sobre a imagem: com quatro bancadas, flutuar sobre a ativa roubava
    // espaço da cena e parecia que cada bancada tinha a sua barra.
    <div className="border-line bg-surface-1 z-20 flex max-h-full shrink-0 flex-col gap-1.5 self-stretch overflow-x-hidden overflow-y-auto border-r p-1.5">
      {TOOLS.map((tool, i) => {
        const Icon = ICONS[tool.id];
        const isActive = activeTool === tool.id;
        // Um fio entre grupos. E a separacao de linguagens do sistema tornada
        // visivel: classe pinta com a cor da marca; instrumento, nunca.
        const mudouDeGrupo = i > 0 && TOOLS[i - 1].grupo !== tool.grupo;
        return (
          <React.Fragment key={tool.id}>
            {/* As classes do protocolo ficam DENTRO do grupo de classe, logo
                depois de viável/inviável e antes do fio dos instrumentos:
                elas dizem o que a marca significa, não o que o instrumento
                faz. Sem protocolo declarado, a lista é vazia e a barra é
                exatamente a de sempre. */}
            {mudouDeGrupo && ferramentasDeClasse.length > 0 && (
              <>
                <div className="bg-line mx-auto my-0.5 h-px w-4 opacity-60" aria-hidden="true" />
                {ferramentasDeClasse.map((f) => {
                  const IconeClasse = ICONE_DE_CLASSE[f.icone];
                  const ativa = classeAtiva === f.classe;
                  return (
                    <button
                      key={f.classe}
                      onClick={() => onEscolherClasse?.(f.classe)}
                      title={`${f.rotulo} (${f.atalho}) — ${f.explicacao}${f.ehSemente ? '' : ' NÃO entra no denominador.'}`}
                      aria-label={f.rotulo}
                      aria-pressed={ativa}
                      className={`rounded-control relative flex h-10 w-10 items-center justify-center border transition-all ${
                        // A mesma aparência do botão de viável/inviável: a
                        // legenda da marca no canvas é uma só.
                        ativa ? ACTIVE_STYLES[f.categoria] : INATIVO
                      }`}
                    >
                      <IconeClasse size={18} strokeWidth={1.75} aria-hidden="true" />
                      <span className="absolute right-1 bottom-0.5 font-mono text-[8px] font-bold opacity-60">
                        {f.atalho}
                      </span>
                      {/* O inerte não conta: um traço diz isso sem legenda. */}
                      {!f.ehSemente && (
                        <span
                          className="bg-ink-3 absolute top-1 left-1 h-px w-2.5 rotate-45"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </>
            )}
            {mudouDeGrupo && <div className="bg-line mx-auto my-0.5 h-px w-6" aria-hidden="true" />}
            <button
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
          </React.Fragment>
        );
      })}

      {/* Fio antes do grupo de visao (reguas, mascara, galeria): nao e
          ferramenta de marcar nem de mover — e de VER. */}
      <div className="bg-line mx-auto my-0.5 h-px w-6" aria-hidden="true" />

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

      {ajusteDaMarca !== undefined &&
        onAjusteDaMarcaChange &&
        (activeTool === 'viable' || activeTool === 'inviable') && (
          <div className={blocoDoDeslizante}>
            <input
              type="range"
              min={AJUSTE_MINIMO}
              max={AJUSTE_MAXIMO}
              step={0.1}
              value={ajusteDaMarca}
              onChange={(e) => onAjusteDaMarcaChange(Number(e.target.value))}
              title="Tamanho do ponto na imagem"
              aria-label="Tamanho do ponto"
              className="accent-accent shrink-0"
              style={estiloDoDeslizante}
            />
            <p className="text-ink-3 text-center font-mono text-[9px] tabular-nums">
              {ajusteDaMarca.toFixed(1)}x
            </p>
          </div>
        )}

      {/* Estilo e opacidade da marca.
          Ficam ao lado do tamanho porque respondem à mesma queixa — "não
          consigo ver a semente embaixo da marca" — e porque numa amostra densa
          o ajuste certo costuma ser os três juntos: menor, vazado e mais
          translúcido. Aparecem só com a ferramenta de marcar ativa, como o
          tamanho. */}
      {estiloDaMarca &&
        onEstiloDaMarcaChange &&
        (activeTool === 'viable' || activeTool === 'inviable') && (
          <div className="flex w-full flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const i = ESTILOS_DA_MARCA.findIndex((e) => e.valor === estiloDaMarca);
                const proximo = ESTILOS_DA_MARCA[(i + 1) % ESTILOS_DA_MARCA.length];
                onEstiloDaMarcaChange(proximo.valor);
              }}
              className="border-line text-ink-2 hover:border-accent hover:text-accent rounded-control w-full border px-1 py-1 text-[9px] font-bold tracking-wide uppercase transition-colors"
              title={ESTILOS_DA_MARCA.find((e) => e.valor === estiloDaMarca)?.ajuda}
              aria-label="Trocar o estilo da marca"
            >
              {ESTILOS_DA_MARCA.find((e) => e.valor === estiloDaMarca)?.rotulo}
            </button>
            {opacidadeDaMarca !== undefined && onOpacidadeDaMarcaChange && (
              <div className={blocoDoDeslizante}>
                <input
                  type="range"
                  min={OPACIDADE_MINIMA}
                  max={1}
                  step={0.05}
                  value={opacidadeDaMarca}
                  onChange={(e) => onOpacidadeDaMarcaChange(Number(e.target.value))}
                  title="Opacidade da marca — abaixe para ver a semente por baixo"
                  aria-label="Opacidade da marca"
                  className="accent-accent shrink-0"
                  style={estiloDoDeslizante}
                />
                <p className="text-ink-3 text-center font-mono text-[9px] tabular-nums">
                  {Math.round(opacidadeDaMarca * 100)}%
                </p>
              </div>
            )}
          </div>
        )}

      {activeTool === 'contorno' && raioDaRaspagem !== undefined && onRaioDaRaspagemChange && (
        <div className={blocoDoDeslizante}>
          <input
            type="range"
            min={4}
            max={60}
            step={2}
            value={raioDaRaspagem}
            onChange={(e) => onRaioDaRaspagemChange(Number(e.target.value))}
            title="Espessura do traço que raspa a borda"
            aria-label="Espessura do traço"
            className="accent-accent shrink-0"
            style={estiloDoDeslizante}
          />
          <p className="text-ink-3 text-center font-mono text-[9px] tabular-nums">
            {raioDaRaspagem}
          </p>
        </div>
      )}

      {activeTool === 'eraser' && (
        <div className={blocoDoDeslizante}>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={eraserRadius}
            onChange={(e) => onEraserRadiusChange(Number(e.target.value))}
            title="Tamanho da borracha ( [ e ] )"
            aria-label="Tamanho da borracha"
            className="accent-danger shrink-0"
            style={estiloDoDeslizante}
          />
          <p className="text-ink-3 text-center font-mono text-[9px] tabular-nums">{eraserRadius}</p>
        </div>
      )}
    </div>
  );
}
