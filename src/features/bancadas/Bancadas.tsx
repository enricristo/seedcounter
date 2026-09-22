// =============================================================================
// Bancadas — layout de 1 a 4 cenas, com uma ativa (C2, Task 3)
// =============================================================================
// Com UMA bancada aberta (o estado padrão de quem abre o app), este
// componente devolve `children` sem nenhum wrapper: o layout fica idêntico ao
// de antes da Task 3, pixel a pixel — é o que o roteiro humano confere
// primeiro.
//
// Com duas ou mais, cada bancada ganha uma célula com cabeçalho (nome do
// arquivo, contagem, fechar) e borda — `--color-accent` na ativa. Só a ativa
// recebe `children`, que é o viewport INTEIRO de hoje (ImageViewport,
// MarkingCanvas, os overlays caros, ZoomControls, EscalaGrafica) — as demais
// recebem `CenaInativa`, que reusa ImageViewport + MarkingCanvas mas deixa de
// fora tudo que é caro ou é ferramenta de interação: sem eixos em todos os
// contornos, sem sementes fantasma, sem Germinar, sem escala gráfica, sem
// réguas, sem cursor de borracha — porque nenhum desses props é passado.
// `MarkingCanvas` já só monta cada um deles quando o prop pede; não é preciso
// reimplementar a condição aqui, só não entregar o motivo para ela ligar.
//
// Ativar por clique: um `onClickCapture` no wrapper de cada célula ativa a
// bancada na fase de CAPTURA, antes do clique alcançar (fase de bolha) o
// botão ou o canvas de dentro — por isso o clique original (marcar uma
// semente, abrir o seletor de arquivo) continua valendo no mesmo gesto, sem
// custar um segundo clique.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ImageViewport } from '../../components/canvas/ImageViewport';
import { MarkingCanvas } from '../../components/canvas/MarkingCanvas';
import { mostraContornos, mostraPontos } from '../mascara';
import type { Bancada } from '../../hooks/useBancada';
import type { Bancadas as BancadasEstado } from '../../hooks/useBancadas';
import type { Mark, YoloSegmentation } from '../../types';

const NAO_FAZ_NADA = () => {};
const CLIQUE_NULO = () => {};
const ID_NULO = (_id: number) => {};

interface CenaInativaProps {
  image: HTMLImageElement | null;
  loadError: string | null;
  onBrowseFiles: () => void;
  marks: Mark[];
  yoloSegmentations: YoloSegmentation[];
  mostrarContornos: boolean;
  mostrarPontos: boolean;
  zoomLevel: number;
  umPerPixel?: number;
}

/**
 * A cena de uma bancada que NÃO é a ativa: imagem, contornos e marcas, sem
 * nenhuma das ferramentas caras. `React.memo` com props primitivas (mais os
 * dois arrays, que só trocam de referência quando a própria bancada muda de
 * verdade) evita re-renderizar as até três inativas a cada render da ativa.
 */
const CenaInativa = React.memo(function CenaInativa({
  image,
  loadError,
  onBrowseFiles,
  marks,
  yoloSegmentations,
  mostrarContornos: exibirContornos,
  mostrarPontos: exibirPontos,
  zoomLevel,
  umPerPixel,
}: CenaInativaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <ImageViewport
      containerRef={containerRef}
      image={image}
      onBrowseFiles={onBrowseFiles}
      loadError={loadError}
      isPanningMode={false}
      isDragging={false}
      startDrag={NAO_FAZ_NADA}
      handleDrag={NAO_FAZ_NADA}
      stopDrag={NAO_FAZ_NADA}
    >
      {image && (
        <MarkingCanvas
          image={image}
          fundoEstatico
          marks={marks}
          yoloSegmentations={yoloSegmentations}
          mostrarContornos={exibirContornos}
          mostrarPontos={exibirPontos}
          visualMode="dots"
          zoomLevel={zoomLevel}
          isPanningMode={false}
          onCanvasClick={CLIQUE_NULO}
          canvasRef={canvasRef}
          onToggleSegmentationClass={ID_NULO}
          onDeleteSegmentation={ID_NULO}
          umPerPixel={umPerPixel}
          // Sem `contornoSelecionado`, sem `mostrarEixosDeTodos`, sem
          // `showRulers`, sem `children` — é por isso que EixosOverlay,
          // GhostSeedsOverlay, Germinar, CanvasRulers e o cursor da borracha
          // (que só desenha quando `activeTool === 'eraser'`, e aqui o padrão
          // é 'viable') nunca montam para uma bancada inativa.
        />
      )}
    </ImageViewport>
  );
});

interface GerenciadorDeMemoriaProps {
  bancada: Bancada;
  ativa: boolean;
}

/**
 * Não desenha nada — só observa se ESTA bancada é a ativa e aciona a troca
 * de pixels da Task 4 (memória): ao sair de ativa, libera a cheia (gera a
 * reduzida); ao voltar, recarrega a cheia do `File` de origem.
 *
 * Fica FORA do galho `ativa ? children : <CenaInativa .../>` de propósito:
 * aquele galho desmonta um lado e monta o outro exatamente na troca — um
 * efeito que desmontasse nesse instante nunca chegaria a disparar a limpeza.
 * Este componente nunca desmonta enquanto a bancada estiver na tela, então o
 * efeito abaixo vê toda transição ativa→inativa e inativa→ativa.
 *
 * `bancada` muda de identidade a cada render (é um objeto novo devolvido por
 * `useBancada` a cada render de `App`), e `liberarImagemCheia`/
 * `recarregarImagemCheia` não são memoizadas com `useCallback` — por isso
 * este componente NÃO usa `React.memo` (seria só um custo extra de
 * comparação, sem nada estável para aproveitar) e o efeito roda mais vezes
 * do que só nas transições reais de `ativa`. Isso é intencional: as duas
 * funções são IDEMPOTENTES (guardas internas por `ref` em `useBancada.ts`
 * fazem qualquer chamada redundante virar um retorno antecipado barato), e
 * depender só de `[ativa]` arriscaria capturar uma versão velha das funções
 * pelo fecho do efeito.
 */
function GerenciadorDeMemoria({ bancada, ativa }: GerenciadorDeMemoriaProps) {
  const { liberarImagemCheia, recarregarImagemCheia } = bancada.cena;
  useEffect(() => {
    if (ativa) {
      recarregarImagemCheia();
    } else {
      liberarImagemCheia();
    }
  }, [ativa, liberarImagemCheia, recarregarImagemCheia]);
  return null;
}

interface BancadasProps {
  bancadas: BancadasEstado;
  /** Abre o seletor de arquivo — o mesmo `handleBrowseFiles` do App; o input
   * escondido lê a bancada ATIVA no momento em que o arquivo é escolhido, e
   * ativar por clique já aconteceu antes desse momento (ver cabeçalho do
   * arquivo). */
  onBrowseFiles: () => void;
  /** O viewport completo de hoje — só a bancada ATIVA o recebe. */
  children: React.ReactNode;
}

function tituloDaBancada(b: Bancada): string {
  return b.fila.filename || 'Sem imagem';
}

function contagemDaBancada(b: Bancada): number {
  return b.anotacoes.marks.length + b.anotacoes.yoloSegmentations.length;
}

function classeDaGrade(abertas: number): string {
  if (abertas === 2) return 'grid grid-cols-2';
  // 3 e 4: grade 2×2. Com três, a quarta célula fica vazia — não é um caso
  // especial: é só o fluxo natural de um `grid` com três filhos.
  return 'grid grid-cols-2 grid-rows-2';
}

export function Bancadas({ bancadas, onBrowseFiles, children }: BancadasProps) {
  const { todas, abertas, indiceAtivo, ativar, fechar } = bancadas;

  // Layout 1: idêntico a hoje — nenhum wrapper, nenhuma borda, nenhum
  // cabeçalho. É o estado padrão de quem abre o app.
  if (abertas <= 1) return <>{children}</>;

  const visiveis = todas.slice(0, abertas);

  return (
    <div className={`relative flex-1 h-full min-h-0 gap-2 p-2 ${classeDaGrade(abertas)}`}>
      {visiveis.map((b, indice) => {
        const ativa = indice === indiceAtivo;
        return (
          <div
            key={b.id}
            onClickCapture={() => ativar(indice)}
            className={`relative flex min-h-0 flex-col overflow-hidden rounded-panel border-2 ${
              ativa ? 'border-accent' : 'border-line'
            }`}
          >
            {/* Cabeçalho de 24px: nome truncado, contagem, fechar (só com
                mais de uma bancada aberta — é sempre o caso aqui dentro). */}
            <div className="flex h-6 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-1 px-2 text-[10px] font-bold text-ink-2">
              <span className="min-w-0 flex-1 truncate" title={tituloDaBancada(b)}>
                {tituloDaBancada(b)}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span>{contagemDaBancada(b)}</span>
                <button
                  type="button"
                  onClick={() => fechar(indice)}
                  aria-label={`Fechar bancada ${indice + 1}`}
                  title="Fechar esta bancada"
                  className="text-ink-3 hover:text-ink-1"
                >
                  <X size={12} />
                </button>
              </span>
            </div>
            <GerenciadorDeMemoria bancada={b} ativa={ativa} />
            <div className="relative min-h-0 flex-1">
              {ativa ? (
                children
              ) : (
                // Task 4 (memória): `image` aqui é `b.fila.image`, que
                // `GerenciadorDeMemoria` (acima) já trocou pela reduzida
                // assim que esta bancada saiu de ativa — liberando o bitmap
                // cheio. Só o `image` muda; `marks`/`yoloSegmentations`/
                // mascara não são afetados, porque memória é sobre PIXELS,
                // não sobre anotação.
                <CenaInativa
                  image={b.fila.image}
                  loadError={b.fila.loadError}
                  onBrowseFiles={onBrowseFiles}
                  marks={b.anotacoes.marks}
                  yoloSegmentations={b.anotacoes.yoloSegmentations}
                  mostrarContornos={mostraContornos(b.cena.mascara)}
                  mostrarPontos={mostraPontos(b.cena.mascara)}
                  zoomLevel={b.zoom.zoomLevel}
                  umPerPixel={b.meta.metadata.umPerPixel}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
