// =============================================================================
// SeedCounter — RoiModal
// Delimita o campo circular e recorta a imagem nele.
//
// A foto tirada pela ocular da lupa é retrato (1880×4096 nas amostras reais) e
// cerca de 65% dela é o entorno escuro do campo. Recortar corta mais da metade
// dos pixels que o YOLO teria de percorrer no navegador, e elimina falso
// positivo no fundo e na borda.
//
// O círculo é PROPOSTO automaticamente: o campo é um disco claro sobre entorno
// escuro, o que é detectável. O ajuste manual serve para o outro uso, mais
// importante — cercar o anel que a pesquisadora desenha à mão sobre a lâmina
// para delimitar a área de contagem.
//
// A calibração µm/px não muda: recorte é translação, não escala.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Crosshair, Loader2, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';
import { detectarCampoCircular, recortarCirculo, type Circulo } from '../../lib/image-crop';

interface RoiModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  filename: string;
  /** Recebe a imagem já recortada no círculo. */
  onCrop: (recorte: File) => void;
}

// A prévia cabe numa CAIXA, não só numa largura. Imagem de lupa é retrato
// (1880×4096); limitar só a largura deixava a prévia com 1002 px de altura e
// empurrava o rodapé para fora da janela.
const PREVIA_MAX_LARGURA = 420;
const PREVIA_MAX_ALTURA = 400;
const AMOSTRA_DETECCAO = 320;

/** Lê a imagem numa resolução baixa e devolve o círculo em coordenadas reais. */
function proporCirculo(image: HTMLImageElement): Circulo | null {
  const escala = Math.min(1, AMOSTRA_DETECCAO / Math.max(image.width, image.height));
  const w = Math.max(8, Math.round(image.width * escala));
  const h = Math.max(8, Math.round(image.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, w, h);
  const encontrado = detectarCampoCircular(ctx.getImageData(0, 0, w, h), 2);
  if (!encontrado) return null;

  return {
    cx: encontrado.cx / escala,
    cy: encontrado.cy / escala,
    r: encontrado.r / escala,
  };
}

export function RoiModal({ isOpen, onClose, image, filename, onCrop }: RoiModalProps) {
  const [circulo, setCirculo] = useState<Circulo | null>(null);
  const [automatico, setAutomatico] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const arrasto = useRef<{ tipo: 'mover' | 'raio'; x: number; y: number } | null>(null);

  const propor = useCallback(() => {
    if (!image) return;
    const detectado = proporCirculo(image);
    if (detectado) {
      setCirculo(detectado);
      setAutomatico(true);
    } else {
      // Sem campo detectável (digitalização, por exemplo): círculo central que
      // cabe na imagem, para o usuário ajustar.
      setCirculo({
        cx: image.width / 2,
        cy: image.height / 2,
        r: Math.min(image.width, image.height) / 2.4,
      });
      setAutomatico(false);
    }
  }, [image]);

  useEffect(() => {
    if (isOpen && image) propor();
  }, [isOpen, image, propor]);

  const escala = image
    ? Math.min(PREVIA_MAX_LARGURA / image.width, PREVIA_MAX_ALTURA / image.height)
    : 1;

  const aoMover = useCallback(
    (e: React.PointerEvent) => {
      if (!arrasto.current || !image) return;
      const dx = (e.clientX - arrasto.current.x) / escala;
      const dy = (e.clientY - arrasto.current.y) / escala;
      arrasto.current.x = e.clientX;
      arrasto.current.y = e.clientY;
      setAutomatico(false);

      setCirculo((c) => {
        if (!c) return c;
        if (arrasto.current?.tipo === 'mover') {
          return { ...c, cx: c.cx + dx, cy: c.cy + dy };
        }
        return { ...c, r: Math.max(16, c.r + (dx + dy) / 2) };
      });
    },
    [image, escala]
  );

  const iniciar = (tipo: 'mover' | 'raio') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { tipo, x: e.clientX, y: e.clientY };
  };

  const confirmar = async () => {
    if (!image || !circulo) return;
    setOcupado(true);
    try {
      const base = filename.replace(/\.[^.]+$/, '') || 'amostra';
      onCrop(await recortarCirculo(image, circulo, `${base}_roi.png`));
      onClose();
    } finally {
      setOcupado(false);
    }
  };

  if (!isOpen || !image || !circulo) return null;

  const lado = Math.round(circulo.r * 2);
  const pixelsAntes = image.width * image.height;
  const pixelsDepois = lado * lado;
  const reducao = Math.max(0, Math.round((1 - pixelsDepois / pixelsAntes) * 100));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Delimitar região de interesse"
        className="bg-surface-1 border-line rounded-panel flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden border shadow-2xl"
      >
        <header className="border-line flex shrink-0 items-start gap-3 border-b p-5">
          <span className="text-accent mt-0.5 shrink-0">
            <Crosshair size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-ink-1 text-base leading-tight font-bold">Delimitar o campo</h2>
            <p className="text-ink-2 mt-1 text-xs leading-relaxed">
              {automatico
                ? 'Campo detectado automaticamente. Arraste para ajustar ao anel desenhado na lâmina.'
                : 'Arraste o círculo para cercar a área de contagem.'}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Fechar sem recortar"
            aria-label="Fechar sem recortar"
            className="text-ink-3 hover:text-ink-1 hover:bg-surface-2 -mt-1 -mr-1 shrink-0 rounded-sm p-1.5 transition-colors"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        {/* Só o corpo rola. O rodapé com a ação fica sempre visível. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          <div
            className="bg-stage rounded-panel relative mx-auto overflow-hidden select-none"
            style={{ width: image.width * escala, height: image.height * escala }}
            onPointerMove={aoMover}
            onPointerUp={() => (arrasto.current = null)}
            onPointerLeave={() => (arrasto.current = null)}
          >
            <img
              src={image.src}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full"
            />

            <div
              onPointerDown={iniciar('mover')}
              className="border-accent absolute cursor-move rounded-full border-2"
              style={{
                left: (circulo.cx - circulo.r) * escala,
                top: (circulo.cy - circulo.r) * escala,
                width: circulo.r * 2 * escala,
                height: circulo.r * 2 * escala,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              }}
            >
              <div
                onPointerDown={iniciar('raio')}
                className="bg-accent absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-full"
                title="Arrastar para mudar o raio"
              />
            </div>
          </div>

          <div className="bg-surface-2 border-line rounded-panel grid grid-cols-3 gap-3 border p-4 text-center">
            <div>
              <div className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
                Antes
              </div>
              <div className="text-ink-2 font-mono text-xs tabular-nums">
                {image.width}×{image.height}
              </div>
            </div>
            <div>
              <div className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
                Depois
              </div>
              <div className="text-ink-1 font-mono text-xs font-semibold tabular-nums">
                {lado}×{lado}
              </div>
            </div>
            <div>
              <div className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
                Menos pixel
              </div>
              <div className="text-accent font-mono text-xs font-semibold tabular-nums">
                {reducao}%
              </div>
            </div>
          </div>

          <p className="text-ink-3 text-[11px] leading-relaxed">
            O que fica fora do círculo é descartado — inclusive marcações já feitas ali. A
            calibração em µm/px não muda: recortar é deslocar, não redimensionar.
          </p>
        </div>

        <footer className="border-line bg-surface-2 flex shrink-0 items-center justify-between gap-2 border-t p-4">
          <button
            onClick={propor}
            className="rounded-control border-line text-ink-2 hover:bg-surface-1 hover:text-ink-1 flex items-center gap-2 border px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all"
          >
            <Wand2 size={14} strokeWidth={2} aria-hidden="true" />
            Detectar de novo
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-control border-line text-ink-2 hover:text-ink-1 hover:bg-surface-1 border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={ocupado}
              className="bg-accent hover:bg-accent-strong text-accent-on rounded-control flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all disabled:pointer-events-none disabled:opacity-40"
            >
              {ocupado && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {ocupado ? 'Recortando…' : 'Recortar no círculo'}
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}
