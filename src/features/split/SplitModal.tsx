// =============================================================================
// SeedCounter — SplitModal
// Divide uma digitalização em pedaços e joga todos na fila de imagens.
//
// O scanner entrega a folha inteira (6754×2339 numa amostra real, 7992×3672 no
// acervo do doutorado) com várias sub-amostras. Antes disso existir, o recorte
// era feito fora do app, arquivo por arquivo.
//
// O retângulo é ajustável porque a folha quase nunca é útil de ponta a ponta:
// sobra borda do vidro, etiqueta, área vazia.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Grid3x3, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import {
  calcularGrade,
  gradeParaTotal,
  gradePorLado,
  recortarRetangulo,
  nomeDaPeca,
  type Retangulo,
} from '../../lib/image-crop';

interface SplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  filename: string;
  /** Recebe os pedaços já recortados, na ordem de leitura. */
  onSplit: (pecas: File[]) => void;
}

type Modo = 'total' | 'grade' | 'lado';

const LARGURA_PREVIA = 640;
const MIN_REGIAO = 32;

export function SplitModal({ isOpen, onClose, image, filename, onSplit }: SplitModalProps) {
  const [modo, setModo] = useState<Modo>('total');
  const [total, setTotal] = useState(12);
  const [colunas, setColunas] = useState(6);
  const [linhas, setLinhas] = useState(2);
  const [lado, setLado] = useState(946);
  const [regiao, setRegiao] = useState<Retangulo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const arrasto = useRef<{ tipo: 'mover' | 'redimensionar'; x: number; y: number } | null>(null);

  // A região começa cobrindo a folha inteira; ajustar é opcional.
  useEffect(() => {
    if (isOpen && image) {
      setRegiao({ x: 0, y: 0, w: image.width, h: image.height });
    }
  }, [isOpen, image]);

  const escala = image ? LARGURA_PREVIA / image.width : 1;

  const grade = useMemo(() => {
    if (!regiao) return { colunas: 1, linhas: 1 };
    if (modo === 'total') return gradeParaTotal(regiao, total);
    if (modo === 'lado') return gradePorLado(regiao, lado);
    return { colunas, linhas };
  }, [modo, total, colunas, linhas, lado, regiao]);

  const pecas = useMemo(
    () => (regiao ? calcularGrade(regiao, grade.colunas, grade.linhas) : []),
    [regiao, grade]
  );

  const aoMover = useCallback(
    (e: React.PointerEvent) => {
      if (!arrasto.current || !regiao || !image) return;
      const dx = (e.clientX - arrasto.current.x) / escala;
      const dy = (e.clientY - arrasto.current.y) / escala;
      arrasto.current.x = e.clientX;
      arrasto.current.y = e.clientY;

      setRegiao((r) => {
        if (!r) return r;
        if (arrasto.current?.tipo === 'mover') {
          return {
            ...r,
            x: Math.min(Math.max(0, r.x + dx), image.width - r.w),
            y: Math.min(Math.max(0, r.y + dy), image.height - r.h),
          };
        }
        return {
          ...r,
          w: Math.min(Math.max(MIN_REGIAO, r.w + dx), image.width - r.x),
          h: Math.min(Math.max(MIN_REGIAO, r.h + dy), image.height - r.y),
        };
      });
    },
    [regiao, image, escala]
  );

  const iniciar = (tipo: 'mover' | 'redimensionar') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { tipo, x: e.clientX, y: e.clientY };
  };

  const encerrar = () => {
    arrasto.current = null;
  };

  const confirmar = async () => {
    if (!image || pecas.length === 0) return;
    setOcupado(true);
    try {
      const arquivos: File[] = [];
      for (const peca of pecas) {
        arquivos.push(await recortarRetangulo(image, peca.retangulo, nomeDaPeca(filename, peca)));
      }
      onSplit(arquivos);
      onClose();
    } finally {
      setOcupado(false);
    }
  };

  if (!isOpen || !image || !regiao) return null;

  const tamanhoPeca = pecas[0]?.retangulo;
  const campo =
    'rounded-control border-line bg-surface-1 text-ink-1 w-20 border px-2 py-1 text-center font-mono text-sm tabular-nums';
  const aba = (ativo: boolean) =>
    `rounded-control px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${
      ativo ? 'bg-accent text-accent-on' : 'text-ink-2 hover:bg-surface-2'
    }`;

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
        aria-label="Dividir digitalização"
        className="bg-surface-1 border-line rounded-panel max-h-[92vh] w-full max-w-3xl overflow-auto border shadow-2xl"
      >
        <header className="border-line flex items-start gap-3 border-b p-5">
          <span className="text-accent mt-0.5 shrink-0">
            <Grid3x3 size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-ink-1 text-base leading-tight font-bold">Dividir digitalização</h2>
            <p className="text-ink-2 mt-1 font-mono text-xs tabular-nums">
              {image.width}×{image.height} px · {filename || 'sem título'}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Fechar sem dividir"
            aria-label="Fechar sem dividir"
            className="text-ink-3 hover:text-ink-1 hover:bg-surface-2 -mt-1 -mr-1 shrink-0 rounded-sm p-1.5 transition-colors"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {/* Prévia com a região ajustável e a grade sobreposta. */}
          <div
            className="bg-stage rounded-panel relative mx-auto overflow-hidden select-none"
            style={{ width: LARGURA_PREVIA, height: image.height * escala }}
            onPointerMove={aoMover}
            onPointerUp={encerrar}
            onPointerLeave={encerrar}
          >
            <img
              src={image.src}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
            />

            <div
              onPointerDown={iniciar('mover')}
              className="border-accent absolute cursor-move border-2"
              style={{
                left: regiao.x * escala,
                top: regiao.y * escala,
                width: regiao.w * escala,
                height: regiao.h * escala,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              }}
            >
              {/* Fios da grade — mostram exatamente onde vai cortar. */}
              {Array.from({ length: grade.colunas - 1 }, (_, i) => (
                <div
                  key={`c${i}`}
                  className="bg-accent/70 absolute top-0 bottom-0 w-px"
                  style={{ left: `${((i + 1) / grade.colunas) * 100}%` }}
                />
              ))}
              {Array.from({ length: grade.linhas - 1 }, (_, i) => (
                <div
                  key={`l${i}`}
                  className="bg-accent/70 absolute right-0 left-0 h-px"
                  style={{ top: `${((i + 1) / grade.linhas) * 100}%` }}
                />
              ))}

              <div
                onPointerDown={iniciar('redimensionar')}
                className="bg-accent absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-full"
                title="Arrastar para redimensionar a região"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="bg-surface-2 rounded-panel flex gap-0.5 p-0.5">
              <button onClick={() => setModo('total')} className={aba(modo === 'total')}>
                Quantidade
              </button>
              <button onClick={() => setModo('grade')} className={aba(modo === 'grade')}>
                Colunas × linhas
              </button>
              <button onClick={() => setModo('lado')} className={aba(modo === 'lado')}>
                Lado fixo
              </button>
            </div>

            <button
              onClick={() => setRegiao({ x: 0, y: 0, w: image.width, h: image.height })}
              className="rounded-control border-line text-ink-2 hover:bg-surface-2 hover:text-ink-1 border px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all"
            >
              Usar folha inteira
            </button>
          </div>

          <div className="bg-surface-2 border-line rounded-panel flex flex-wrap items-end gap-4 border p-4">
            {modo === 'total' && (
              <label className="flex flex-col gap-1">
                <span className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
                  Pedaços
                </span>
                <input
                  type="number"
                  min={1}
                  max={144}
                  value={total}
                  onChange={(e) => setTotal(Math.max(1, Number(e.target.value) || 1))}
                  className={campo}
                />
              </label>
            )}

            {modo === 'grade' && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
                    Colunas
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={colunas}
                    onChange={(e) => setColunas(Math.max(1, Number(e.target.value) || 1))}
                    className={campo}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
                    Linhas
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={linhas}
                    onChange={(e) => setLinhas(Math.max(1, Number(e.target.value) || 1))}
                    className={campo}
                  />
                </label>
              </>
            )}

            {modo === 'lado' && (
              <label className="flex flex-col gap-1">
                <span className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
                  Lado do pedaço (px)
                </span>
                <input
                  type="number"
                  min={32}
                  step={2}
                  value={lado}
                  onChange={(e) => setLado(Math.max(32, Number(e.target.value) || 32))}
                  className={`${campo} w-24`}
                />
              </label>
            )}

            <div className="text-ink-2 ml-auto text-right font-mono text-xs tabular-nums">
              <div className="text-ink-1 text-sm font-semibold">
                {pecas.length} pedaço{pecas.length === 1 ? '' : 's'}
              </div>
              {tamanhoPeca && (
                <div className="text-ink-3">
                  {grade.colunas}×{grade.linhas} · {Math.round(tamanhoPeca.w)}×
                  {Math.round(tamanhoPeca.h)} px
                </div>
              )}
            </div>
          </div>

          {modo === 'lado' && (
            <p className="text-ink-3 text-[11px] leading-relaxed">
              Lado fixo mantém os recortes comparáveis entre digitalizações — o que importa quando
              as imagens vão alimentar o treino do modelo. 946 px é o lado usado no acervo
              existente.
            </p>
          )}
        </div>

        <footer className="border-line bg-surface-2 flex justify-end gap-2 border-t p-4">
          <button
            onClick={onClose}
            className="rounded-control border-line text-ink-2 hover:text-ink-1 hover:bg-surface-1 border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={ocupado || pecas.length === 0}
            className="bg-accent hover:bg-accent-strong text-accent-on rounded-control flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all disabled:pointer-events-none disabled:opacity-40"
          >
            {ocupado && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {ocupado ? 'Recortando…' : `Dividir em ${pecas.length}`}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
