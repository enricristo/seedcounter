import React from 'react';
import {
  Sun,
  Moon,
  History,
  Undo2,
  Redo2,
  Eraser,
  Save,
  FolderInput,
  Download,
  Calendar,
  BarChart4,
  Target,
  FlaskConical,
  Sprout,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AppView } from '../../types';
import { useVisibilidade } from '../../features/visualizacao/useModoDeVisualizacao';
import { MenuExibir } from '../../features/visualizacao/MenuExibir';

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  sessionsCount: number;
  openHistory: () => void;
  /** O botao da conta. Ausente = nada no lugar dele. */
  contaSlot?: React.ReactNode;
  /** O chip de especie (C7), ao lado das abas. Ausente = nada no lugar dele. */
  especieSlot?: React.ReactNode;
  /** O seletor de bancadas (C2), logo depois do chip de espécie — mesmo
   * motivo: contexto de navegação, não ferramenta. Ausente = nada no lugar
   * dele. */
  bancadasSlot?: React.ReactNode;
  onUndo: () => void;
  undoDisabled: boolean;
  onRedo: () => void;
  redoDisabled: boolean;
  onReset: () => void;
  resetDisabled: boolean;
  hasImageQueue: boolean;
  currentImageIndex: number;
  imageQueueLength: number;
  onProcessarFilaIA?: () => void;
  /** A fila com IA está rodando agora. Troca "Processar" por "Parar". */
  filaIARodando?: boolean;
  onPararFilaIA?: () => void;
  /** Quantas páginas tem o TIFF aberto. 1 (ou 0) esconde o seletor. */
  paginasDoTiff?: number;
  /** Página aberta, base 0. */
  paginaDoTiff?: number;
  onAbrirPaginaDoTiff?: (pagina: number) => void;
  onPrevImage: () => void;
  onNextImage: () => void;
  onSaveSession: () => void;
  /**
   * Importar sessao (JSON). Ausente = botao oculto.
   *
   * Mora aqui, e nao na barra lateral, porque e I/O de sessao — o mesmo grupo
   * de Salvar e Exportar. Na lateral ele ficava ao lado de "carregar amostras",
   * que e carregar IMAGEM, e as duas acoes se confundiam.
   */
  onImportSession?: () => void;
  onExport: () => void;
  hasImage: boolean;

  // Navigation & Feature Flags
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  isLongitudinalEnabled?: boolean;
  isStatsEnabled?: boolean;
  /** Abre o painel visível de funcionalidades (feature flags). */
  onOpenFeatures?: () => void;
}

/**
 * A marca: a semente com o contorno que a onda propõe em volta.
 *
 * Trocou o retículo em 16/09/2026 (proposta 2 de `docs/marca/`). O retículo
 * dizia "isto observa", e é vocabulário de qualquer ferramenta de visão; o
 * tracejado em volta da semente é a assinatura DESTE app — e significa, aqui
 * dentro, a mesma coisa que significa no canvas: proposta ainda não aceita.
 * Uma marca que ensina uma convenção da interface vale mais que uma bonita.
 *
 * Inline para herdar o tema. `public/mark.svg` tem o mesmo desenho com cores
 * fixas, porque favicon não herda tema.
 */
function MarcaSemente({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="SeedCounter"
      className="shrink-0"
    >
      <ellipse cx="32" cy="34" rx="13.5" ry="9.5" transform="rotate(-22 32 34)" fill="var(--color-ink-1)" />
      <ellipse
        cx="32"
        cy="34"
        rx="19"
        ry="14.5"
        transform="rotate(-22 32 34)"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="4.2"
        strokeDasharray="11 7.5"
      />
      <circle cx="32" cy="34" r="2.6" fill="var(--color-accent)" />
    </svg>
  );
}

/** Botão de ícone da barra: 16px com traço 2, o passo padrão de controle. */
const botaoIcone =
  'rounded-control border-line text-ink-2 hover:text-ink-1 hover:bg-surface-2 border p-2 transition-all disabled:pointer-events-none disabled:opacity-30';

/** Botão da fila de imagens: rótulo curto em caixa alta. */
const botaoFila =
  'rounded-control border-line bg-surface-1 text-ink-2 hover:bg-surface-2 hover:text-ink-1 border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all disabled:pointer-events-none disabled:opacity-30';

export function Header({
  isDarkMode,
  toggleTheme,
  sessionsCount,
  openHistory,
  contaSlot,
  especieSlot,
  bancadasSlot,
  onUndo,
  undoDisabled,
  onRedo,
  redoDisabled,
  onReset,
  resetDisabled,
  hasImageQueue,
  currentImageIndex,
  imageQueueLength,
  onProcessarFilaIA,
  filaIARodando = false,
  onPararFilaIA,
  paginasDoTiff = 1,
  paginaDoTiff = 0,
  onAbrirPaginaDoTiff,
  onPrevImage,
  onNextImage,
  onSaveSession,
  onImportSession,
  onExport,
  hasImage,

  currentView,
  onViewChange,
  isLongitudinalEnabled = true,
  isStatsEnabled = true,
  onOpenFeatures,
}: HeaderProps) {
  // O que este cabeçalho mostra é decidido pelo modo de visualização
  // (`features/visualizacao`), não por um parâmetro de URL lido aqui. O antigo
  // `?mode=enterprise` continua valendo: vira o modo 'apresentacao' lá.
  const { visibilidade } = useVisibilidade();

  const aba = (ativa: boolean) =>
    `rounded-control flex cursor-pointer items-center gap-1.5 px-3 py-1.5 transition-all ${
      ativa
        ? 'bg-surface-1 text-ink-1 shadow-[inset_0_-2px_0_var(--color-accent)]'
        : 'text-ink-3 hover:text-ink-1'
    }`;

  return (
    // Separação por fio de 1px, não por sombra: sombra fica reservada ao que
    // de fato flutua (modais e o controle de zoom).
    // DUAS LINHAS, e nao uma.
    //
    // A versao de uma linha tinha `h-16` e `overflow-hidden`, e o botao do
    // Google — que o script deles renderiza com largura propria — atropelou as
    // abas de navegacao. Mas o problema era anterior ao botao: identidade,
    // navegacao, conta, tema, historico, desfazer, borracha, fila, salvar e
    // exportar disputavam a mesma linha, e cada coisa nova empurrava a anterior.
    //
    // A divisao segue o que cada linha responde:
    //   linha 1 — "onde estou e quem sou": marca, abas, conta, tema, recursos
    //   linha 2 — "o que posso fazer aqui": as acoes da vista atual
    //
    // A segunda linha e da VISTA: muda com ela, e some quando a vista nao tem
    // acao. E tambem onde cabe o que ainda vai chegar sem quebrar a primeira.
    <header className="border-line bg-surface-1 z-10 flex shrink-0 flex-col border-b">
      {/* ---- Linha 1: identidade, navegacao, conta ---- */}
      <div className="flex h-12 items-center justify-between gap-4 px-4 xl:px-6">
        <div className="flex min-w-0 items-center gap-4 xl:gap-5">
          {/* Identidade do produto primeiro, credenciais institucionais depois. */}
          <div className="flex shrink-0 items-center gap-2.5">
            <MarcaSemente size={30} />
            <div>
              <h1 className="text-ink-1 text-base leading-tight font-bold tracking-tight whitespace-nowrap">
                SeedCounter {visibilidade.seloDoModo && <span className="text-accent text-[10px] ml-1 uppercase">Analytics</span>}
              </h1>
              {/* "Edição Acadêmica" saiu: não dizia nada a quem usa. No lugar,
                  o que o app faz — e os grupos continuam no rodapé, com as
                  logos, que é onde filiação pertence. */}
              <p className="text-ink-3 hidden text-[9px] font-bold tracking-widest whitespace-nowrap uppercase lg:block">
                Contar · medir · laudar
              </p>
            </div>
          </div>

          {/* Navegação entre vistas. A aba ativa é marcada por um fio de acento
            embaixo, não por cor de texto: cor sozinha não carrega estado. */}
          {visibilidade.abasDeNavegacao && (
          <nav className="bg-surface-2 rounded-panel hidden items-center p-0.5 text-xs font-bold tracking-wider uppercase md:flex">
            <button
              onClick={() => onViewChange('counter')}
              className={aba(currentView === 'counter')}
            >
              <Target size={14} strokeWidth={2.25} aria-hidden="true" />
              <span>Contagem</span>
            </button>

            {isLongitudinalEnabled && (
              <button
                onClick={() => onViewChange('longitudinal')}
                className={aba(currentView === 'longitudinal')}
              >
                <Calendar size={14} strokeWidth={2.25} aria-hidden="true" />
                <span>Longitudinal</span>
              </button>
            )}

            {isStatsEnabled && (
              <button
                onClick={() => onViewChange('stats')}
                className={aba(currentView === 'stats')}
              >
                <BarChart4 size={14} strokeWidth={2.25} aria-hidden="true" />
                <span>Estatísticas</span>
              </button>
            )}

            {/* Germinação (Germinator): parte `germinacao` do modo de
                visualização, não flag — ciência de laboratório que o modo
                de contagem e o de apresentação não mostram. */}
            {visibilidade.germinacao && (
              <button
                onClick={() => onViewChange('germinacao')}
                className={aba(currentView === 'germinacao')}
              >
                <Sprout size={14} strokeWidth={2.25} aria-hidden="true" />
                <span>Germinação</span>
              </button>
            )}
          </nav>
          )}

          {/* Espécie da bancada (C7): logo depois das abas — é contexto de
            navegação, não ferramenta, por isso mora na linha 1. */}
          {visibilidade.chipDeEspecie && especieSlot}

          {/* Seletor de bancadas (C2): mesmo motivo do chip de espécie, e é
            o ÚNICO jeito de abrir/trocar/fechar bancadas com o mouse — antes
            só existiam atalhos que o navegador toma. Com uma bancada aberta
            (o caso comum) ele próprio decide mostrar só um "+" discreto. */}
          {visibilidade.seletorDeBancadas && bancadasSlot}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* A conta, quando existe. Fica ANTES dos botoes de instrumento e
            separada deles: e identidade, nao ferramenta. */}
          {contaSlot && <div className="border-line mr-1 border-r pr-3">{contaSlot}</div>}
          <button
            onClick={toggleTheme}
            className={botaoIcone}
            title="Alternar tema (D)"
            aria-label="Alternar tema"
          >
            {isDarkMode ? (
              <Sun size={16} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Moon size={16} strokeWidth={2} aria-hidden="true" />
            )}
          </button>

          {/* "Exibir": modos de visualização e partes da interface. Sempre
            visível, inclusive em apresentação — é por onde se sai dela. */}
          <MenuExibir />

          {visibilidade.botaoDeRecursos && onOpenFeatures && (
            <button
              onClick={onOpenFeatures}
              className={`${botaoIcone} hover:border-accent hover:text-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`}
              title="Funcionalidades e recursos experimentais"
              aria-label="Funcionalidades e recursos experimentais"
            >
              {/* FlaskConical no lugar de Sparkles: o painel é de laboratório,
                não de IA — e Sparkles virou taquigrafia de IA na indústria. */}
              <FlaskConical size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ---- Linha 2: as acoes da vista. So existe quando ha acao. ---- */}
      {currentView === 'counter' && visibilidade.barraDeAcoes && (
        <div className="border-line bg-surface-1 flex h-11 items-center justify-between gap-2 border-t px-4 xl:px-6">
          {/* Histórico e o trio desfazer/refazer/limpar formam UM grupo — as
              checagens `currentView === 'counter'` repetidas em cada botão
              (já redundantes: o bloco inteiro só existe dentro desse `if`)
              deixavam cada botão como um item solto para o React, e o trio
              de instrumento (desfazer/refazer/limpar) ficava com o mesmo
              respiro do divisor, sem nada que dissesse "isto aqui é um
              conjunto". O trio agora tem o próprio `gap-1`, mais apertado
              que o `gap-2` entre grupos — é o que fecha o buraco que o
              Enrico circulou. */}
          <div className="flex items-center gap-2">
            <button
              onClick={openHistory}
              className="rounded-control border-line text-ink-2 hover:text-ink-1 hover:bg-surface-2 flex items-center gap-2 border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-all"
            >
              <History size={16} strokeWidth={2} aria-hidden="true" />
              <span>Histórico</span>
              <span className="bg-surface-2 text-ink-2 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
                {sessionsCount}
              </span>
            </button>

            <div className="bg-line h-6 w-px" />

            <div className="flex items-center gap-1">
              <button
                onClick={onUndo}
                disabled={undoDisabled}
                className={botaoIcone}
                title="Desfazer (Ctrl+Z)"
                aria-label="Desfazer"
              >
                <Undo2 size={16} strokeWidth={2} aria-hidden="true" />
              </button>

              <button
                onClick={onRedo}
                disabled={redoDisabled}
                className={botaoIcone}
                title="Refazer (Ctrl+Shift+Z ou Ctrl+Y)"
                aria-label="Refazer"
              >
                <Redo2 size={16} strokeWidth={2} aria-hidden="true" />
              </button>

              <button
                onClick={onReset}
                disabled={resetDisabled}
                className={`${botaoIcone} hover:text-danger hover:border-danger`}
                title="Limpar a placa atual — pede confirmação"
                aria-label="Limpar a placa atual"
              >
                <Eraser size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
              {hasImageQueue && (
                <div className="flex items-center bg-surface-2 rounded-control border border-line p-0.5">
                  <button
                    onClick={onPrevImage}
                    disabled={currentImageIndex === 0}
                    className={botaoFila}
                    title="Voltar imagem (Backspace)"
                  >
                    Anterior
                  </button>
                  <div className="text-ink-2 px-2 font-mono text-[11px] font-semibold tabular-nums">
                    {currentImageIndex + 1}/{imageQueueLength}
                  </div>
                  <button
                    onClick={onNextImage}
                    disabled={currentImageIndex === imageQueueLength - 1}
                    className={botaoFila}
                    title="Próxima imagem (Espaço)"
                  >
                    Próxima
                  </button>
                  {/* Um botão só, que muda de papel: enquanto a fila roda ele é
                      "Parar" — o único gesto que faz sentido nesse momento, e
                      o lugar onde a pessoa vai procurar. A fila para na
                      próxima imagem; a que está em andamento não vira sessão. */}
                  {onProcessarFilaIA && !filaIARodando && (
                    <button
                      type="button"
                      onClick={onProcessarFilaIA}
                      className="bg-accent text-accent-on hover:bg-accent-strong rounded-control ml-1 px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors"
                      title="Rodar a IA em toda a fila e gravar cada imagem como sessão na Galeria"
                    >
                      Processar Fila
                    </button>
                  )}
                  {onPararFilaIA && filaIARodando && (
                    <button
                      type="button"
                      onClick={onPararFilaIA}
                      className="border-danger text-danger hover:bg-danger hover:text-accent-on rounded-control ml-1 border px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors"
                      title="Para na próxima imagem. A imagem em andamento não é gravada."
                    >
                      Parar fila
                    </button>
                  )}
                </div>
              )}

            {/* Páginas do TIFF.
                Fica ao lado da fila de imagens, e não dentro dela, porque são
                duas navegações diferentes: a fila anda entre ARQUIVOS, esta
                anda DENTRO de um. A digitalização de tetrazólio com dez
                espécies é um arquivo só com dez páginas, uma por espécie —
                sem isto, nove espécies exigiam Photoshop.
                O <select> existe além das setas porque com dez páginas
                ninguém quer clicar sete vezes para chegar na oitava. */}
            {paginasDoTiff > 1 && onAbrirPaginaDoTiff && (
              <div
                className="border-accent/40 bg-accent-tint rounded-control mr-1 flex items-center gap-1 border p-1"
                title={`Este arquivo tem ${paginasDoTiff} páginas. Cada página é uma imagem independente.`}
              >
                <span className="text-accent px-1 text-[10px] font-bold tracking-wide uppercase">
                  Página
                </span>
                <button
                  onClick={() => onAbrirPaginaDoTiff(paginaDoTiff - 1)}
                  disabled={paginaDoTiff === 0}
                  className={botaoFila}
                  title="Página anterior do arquivo"
                  aria-label="Página anterior do arquivo"
                >
                  <ChevronLeft size={13} aria-hidden="true" />
                </button>
                <select
                  value={paginaDoTiff}
                  onChange={(e) => onAbrirPaginaDoTiff(Number(e.target.value))}
                  className="border-line bg-surface-1 text-ink-1 rounded-control cursor-pointer border px-1 py-0.5 font-mono text-[11px] tabular-nums"
                  aria-label="Escolher a página do arquivo"
                >
                  {Array.from({ length: paginasDoTiff }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1}/{paginasDoTiff}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onAbrirPaginaDoTiff(paginaDoTiff + 1)}
                  disabled={paginaDoTiff === paginasDoTiff - 1}
                  className={botaoFila}
                  title="Próxima página do arquivo"
                  aria-label="Próxima página do arquivo"
                >
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
            )}

            {visibilidade.botoesDeExportacao && onImportSession && (
              <button
                onClick={onImportSession}
                title="Abre uma sessão salva em JSON — imagem, marcações e contornos"
                className="rounded-control border-line bg-surface-2 text-ink-2 hover:text-ink-1 hover:bg-surface-1 focus-visible:ring-accent/40 flex items-center gap-2 border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-all focus-visible:ring-2 focus-visible:outline-none"
              >
                <FolderInput size={16} strokeWidth={2} aria-hidden="true" />
                <span>Importar</span>
              </button>
            )}

            {visibilidade.botoesDeExportacao && (
              <button
                onClick={onSaveSession}
                disabled={!hasImage}
                title="Salvar a sessão no histórico (Ctrl+S)"
                className="rounded-control border-line bg-surface-2 text-ink-2 hover:text-ink-1 hover:bg-surface-1 flex items-center gap-2 border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-all disabled:pointer-events-none disabled:opacity-30"
              >
                <Save size={16} strokeWidth={2} aria-hidden="true" />
                <span>Salvar local</span>
              </button>
            )}

            {/* Única ação primária da barra, e o único uso de fundo de acento. */}
            {visibilidade.botoesDeExportacao && (
              <button
                onClick={onExport}
                disabled={!hasImage}
                title="Exportar (Ctrl+E)"
                className="rounded-control bg-accent text-accent-on hover:bg-accent-strong flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all disabled:pointer-events-none disabled:opacity-30"
              >
                <Download size={16} strokeWidth={2} aria-hidden="true" />
                <span>Exportar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
