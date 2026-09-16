// =============================================================================
// SeedCounter — Inspetor de Semente e Colorimetria Interna
//
// Exibe em tempo real as características morfométricas, espectrais (CIELAB)
// e o diagnóstico biométrico do contorno selecionado pelo usuário.
// =============================================================================

import React, { useEffect, useRef, useMemo } from 'react';
import {
  X,
  Activity,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Droplets,
  Layers,
} from 'lucide-react';
import type { YoloSegmentation } from '../../types';
import {
  areaDoPoligono,
  fechoConvexo,
  analisarContorno,
  type LimiaresDeAglomerado,
} from '../../lib/aglomerado';
import { extrairCaracteristicasDeCor, type CaracteristicasDeCor } from '../../lib/color-features';
import { compararComPerfil } from '../../lib/priors-morfometricos';
import { compararComPerfilMedido } from '../../lib/perfil-medido';
import type { PerfilMedido } from '../../lib/perfil-medido';

interface SeedInspectorProps {
  segmentation: YoloSegmentation;
  image: HTMLImageElement;
  umPerPixel?: number;
  medianaDaCena?: number;
  /** Limiares de aglomerado derivados da população desta cena — ver aglomerado.ts. */
  limiares?: LimiaresDeAglomerado;
  especieId?: string;
  /**
   * Perfil medido ("Medir esta pasta", B4) para a classe/conjunto ativos,
   * quando existir. Some acima da referência de literatura — nunca decide,
   * só mostra outra régua para comparar.
   */
  perfilMedido?: PerfilMedido | null;
  onToggleClass?: (id: number) => void;
  onDelete?: (id: number) => void;
  onProposeCut?: (id: number) => void;
  onClose: () => void;
}

export function SeedInspector({
  segmentation,
  image,
  umPerPixel,
  medianaDaCena,
  limiares,
  especieId,
  perfilMedido,
  onToggleClass,
  onDelete,
  onProposeCut,
  onClose,
}: SeedInspectorProps) {

  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Cálculo Morfométrico
  const morfometria = useMemo(() => {
    const pts = segmentation.polygon_points;
    if (!pts || pts.length < 3) {
      return { areaPx: 0, solidez: 1, circularidade: 0, perimetroPx: 0 };
    }

    const areaPx = areaDoPoligono(pts);
    const fecho = fechoConvexo(pts);
    const areaFecho = areaDoPoligono(fecho);
    const solidez = areaFecho > 0 ? areaPx / areaFecho : 1;

    // Perímetro
    let perimetroPx = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      perimetroPx += Math.hypot(dx, dy);
    }

    const circularidade =
      perimetroPx > 0 ? Math.min(1, Math.max(0, (4 * Math.PI * areaPx) / (perimetroPx * perimetroPx))) : 0;

    let areaMm2: number | undefined;
    let comprimentoMm: number | undefined;
    let larguraMm: number | undefined;

    if (umPerPixel && umPerPixel > 0) {
      areaMm2 = (areaPx * (umPerPixel * umPerPixel)) / 1_000_000;
      if (segmentation.width && segmentation.height) {
        comprimentoMm = (Math.max(segmentation.width, segmentation.height) * umPerPixel) / 1000;
        larguraMm = (Math.min(segmentation.width, segmentation.height) * umPerPixel) / 1000;
      }
    }

    const razaoDeArea =
      typeof medianaDaCena === 'number' && medianaDaCena > 0 ? areaPx / medianaDaCena : undefined;

    // Razão de aspecto — só para comparar com o perfil MEDIDO (B4), que a
    // guarda por vir do Feret (feret.ts), não da PCA.
    const razaoDeAspecto =
      segmentation.width && segmentation.height && Math.min(segmentation.width, segmentation.height) > 0
        ? Math.max(segmentation.width, segmentation.height) / Math.min(segmentation.width, segmentation.height)
        : undefined;

    return {
      areaPx,
      areaMm2,
      perimetroPx,
      solidez,
      circularidade,
      comprimentoMm,
      larguraMm,
      razaoDeArea,
      razaoDeAspecto,
    };
  }, [segmentation, umPerPixel, medianaDaCena]);

  // 2. Extração e Renderização da Miniatura e Colorimetria
  const cor = useMemo<CaracteristicasDeCor | null>(() => {
    const pts = segmentation.polygon_points;
    if (!pts || pts.length < 3 || !image) return null;

    // Caixa envolvente com padding
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const pad = Math.max(8, Math.round(Math.max(maxX - minX, maxY - minY) * 0.15));
    const imgWidth = image.naturalWidth || image.width;
    const imgHeight = image.naturalHeight || image.height;
    const cropX = Math.max(0, Math.floor(minX - pad));
    const cropY = Math.max(0, Math.floor(minY - pad));
    const cropW = Math.min(imgWidth - cropX, Math.ceil(maxX - minX + 2 * pad));
    const cropH = Math.min(imgHeight - cropY, Math.ceil(maxY - minY + 2 * pad));

    if (cropW <= 0 || cropH <= 0) return null;

    // Canvas temporário para amostragem
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = cropW;
    sampleCanvas.height = cropH;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const imgData = ctx.getImageData(0, 0, cropW, cropH);

    // Polígono transladado para coordenadas locais
    const localPts: [number, number][] = pts.map(([x, y]) => [x - cropX, y - cropY]);
    return extrairCaracteristicasDeCor(
      { data: imgData.data, width: cropW, height: cropH },
      localPts,
      1
    );
  }, [segmentation, image]);

  // 3. Renderiza o thumbnail com contorno destacado
  useEffect(() => {
    const canvas = thumbnailRef.current;
    if (!canvas || !image) return;

    const pts = segmentation.polygon_points;
    if (!pts || pts.length < 3) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const pad = Math.max(6, Math.round(Math.max(maxX - minX, maxY - minY) * 0.15));
    const cropX = Math.max(0, Math.floor(minX - pad));
    const cropY = Math.max(0, Math.floor(minY - pad));
    const imgWidth = image.naturalWidth || image.width;
    const imgHeight = image.naturalHeight || image.height;
    const cropW = Math.min(imgWidth - cropX, Math.ceil(maxX - minX + 2 * pad));
    const cropH = Math.min(imgHeight - cropY, Math.ceil(maxY - minY + 2 * pad));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 160;
    canvas.height = 120;
    ctx.clearRect(0, 0, 160, 120);

    const scale = Math.min(160 / cropW, 120 / cropH);
    const destW = cropW * scale;
    const destH = cropH * scale;
    const offsetX = (160 - destW) / 2;
    const offsetY = (120 - destH) / 2;

    ctx.drawImage(image, cropX, cropY, cropW, cropH, offsetX, offsetY, destW, destH);

    // Desenha o polígono sobreposto
    ctx.beginPath();
    pts.forEach(([x, y], idx) => {
      const lx = (x - cropX) * scale + offsetX;
      const ly = (y - cropY) * scale + offsetY;
      if (idx === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    });
    ctx.closePath();

    ctx.fillStyle =
      segmentation.category === 'viable' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    ctx.fill();

    ctx.strokeStyle =
      segmentation.category === 'viable' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [segmentation, image]);

  // 4. Veredito de aglomerado — relativo à população da cena, quem decide é aglomerado.ts
  //    `limiares` vem derivado desta imagem (limiaresDaPopulacao, calculado no App); sem
  //    população suficiente (menos de 8 contornos) o App passa undefined e analisarContorno
  //    cai no padrão calibrado para contorno liso.
  const sinais = useMemo(
    () => analisarContorno(segmentation.polygon_points, medianaDaCena ?? NaN, limiares),
    [segmentation.polygon_points, medianaDaCena, limiares]
  );

  // 5. Comparação com a literatura — referência para orientar o olho, nunca veredito
  const comparacao = useMemo(
    () =>
      compararComPerfil(
        { solidez: morfometria.solidez, circularidade: morfometria.circularidade },
        especieId
      ),
    [morfometria.solidez, morfometria.circularidade, especieId]
  );

  // 5b. Comparação com o perfil MEDIDO ("Medir esta pasta", B4) — mostrada
  // ACIMA da literatura quando existir. Mesma regra: nunca decide.
  const comparacaoMedida = useMemo(
    () =>
      perfilMedido
        ? compararComPerfilMedido(
            { solidez: morfometria.solidez, razaoDeAspecto: morfometria.razaoDeAspecto },
            perfilMedido
          )
        : null,
    [morfometria.solidez, morfometria.razaoDeAspecto, perfilMedido]
  );

  const isViable = segmentation.category === 'viable';
  const aColor = cor?.aMean ?? 0;
  // Tetrazólio: formazan forte geralmente tem a* > 15
  const tetrazolioIntensidade = Math.min(100, Math.max(0, ((aColor - 0) / 45) * 100));

  return (
    <div className="flex flex-col h-full w-full bg-surface-1">
      {/* Cabeçalho */}
      <div className="border-line flex items-center justify-between border-b pb-2 select-none mb-2">
        <div className="flex items-center gap-2">
          <Activity className="text-accent h-4 w-4" />
          <span className="text-xs font-bold tracking-tight">
            Inspetor #{segmentation.id}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
              isViable
                ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
                : 'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400'
            }`}
          >
            {isViable ? 'Viável' : 'Inviável'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-ink-muted hover:bg-surface-2 hover:text-ink-1 rounded-control cursor-pointer p-1 transition-colors"
          title="Fechar painel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto text-xs pb-4">
        {/* Visualizador de Miniatura */}
        <div className="border-line bg-surface-2/40 rounded-control flex flex-col items-center justify-center overflow-hidden border p-1.5">
          <canvas
            ref={thumbnailRef}
            className="h-28 w-auto rounded-sm object-contain shadow-inner"
          />
          <div className="text-ink-muted mt-1 text-[10px]">
            Confiança do modelo:{' '}
            <span className="font-semibold">
              {(segmentation.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Aglomerado? — veredito de aglomerado.ts, relativo à população da cena */}
        <div
          className={`rounded-control border p-2.5 transition-all ${
            sinais.veredito === 'aglomerado'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold">
            {sinais.veredito === 'aglomerado' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>Aglomerado?</span>
          </div>
          <p className="text-ink-2 mt-1 text-[11px] leading-relaxed">
            {sinais.veredito === 'aglomerado' ? sinais.motivo : 'Não'}
          </p>
          {/* Referência (medida) — perfil de "Medir esta pasta" (B4), quando existe para a
              classe/conjunto ativos. Fica ACIMA da literatura: é a régua nas nossas condições. */}
          {comparacaoMedida && (
            <p className="text-ink-3 mt-1.5 text-[11px] leading-relaxed">
              <span className="font-bold text-ink-2">
                Referência (medida, n={comparacaoMedida.perfil?.n ?? 0}):{' '}
              </span>
              {comparacaoMedida.nota || 'Dentro da faixa medida'}
            </p>
          )}
          {/* Referência (literatura) — orienta o olho, nunca decide: quem decide é o veredito acima */}
          <p className="text-ink-3 mt-1.5 text-[11px] leading-relaxed">
            <span className="font-bold text-ink-2">Referência (literatura): </span>
            {comparacao.nota || 'Dentro da faixa típica'}
          </p>
        </div>

        {/* Grade de Morfometria */}
        <div className="space-y-1.5">
          <div className="text-ink-muted flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase">
            <Layers className="h-3 w-3" />
            <span>Morfometria</span>
          </div>
          <div className="bg-surface-1/60 border-line rounded-control grid grid-cols-2 gap-2 border p-2 text-[11px]">
            <div>
              <span className="text-ink-muted block text-[10px]">Área</span>
              <span className="font-semibold">
                {morfometria.areaMm2 !== undefined
                  ? `${morfometria.areaMm2.toFixed(2)} mm²`
                  : `${morfometria.areaPx} px`}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px]">Solidez</span>
              <span className="font-semibold">
                {(morfometria.solidez * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px]">Circularidade</span>
              <span className="font-semibold">
                {morfometria.circularidade.toFixed(3)}
              </span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px]">Dimensões</span>
              <span className="font-semibold">
                {morfometria.comprimentoMm !== undefined && morfometria.larguraMm !== undefined
                  ? `${morfometria.comprimentoMm.toFixed(1)} × ${morfometria.larguraMm.toFixed(1)} mm`
                  : `${segmentation.width?.toFixed(0) ?? '—'} × ${segmentation.height?.toFixed(0) ?? '—'} px`}
              </span>
            </div>
          </div>
        </div>

        {/* Colorimetria Interna e Tetrazólio */}
        {cor && (
          <div className="space-y-1.5">
            <div className="text-ink-muted flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase">
              <Droplets className="h-3 w-3" />
              <span>Colorimetria & Tetrazólio</span>
            </div>
            <div className="bg-surface-1/60 border-line rounded-control space-y-2 border p-2 text-[11px]">
              {/* Barra do a* (Tetrazólio) */}
              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-ink-muted">Sinal Tetrazólio (a* CIELAB):</span>
                  <span className="font-bold text-rose-500">
                    {cor.aMean.toFixed(1)} {cor.aMean > 15 ? '🔴 Forte' : cor.aMean > 5 ? '🟠 Médio' : '⚪ Fraco'}
                  </span>
                </div>
                <div className="bg-surface-2 mt-1 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-rose-700 transition-all"
                    style={{ width: `${tetrazolioIntensidade}%` }}
                  />
                </div>
              </div>

              {/* Valores numéricos */}
              <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[10px]">
                <div className="bg-surface-2/60 rounded p-1">
                  <span className="text-ink-muted block">L* (Luz)</span>
                  <span className="font-semibold">{cor.lMean.toFixed(1)}</span>
                </div>
                <div className="bg-surface-2/60 rounded p-1">
                  <span className="text-ink-muted block">b* (Tom)</span>
                  <span className="font-semibold">{cor.labBMean.toFixed(1)}</span>
                </div>
                <div className="bg-surface-2/60 rounded p-1">
                  <span className="text-ink-muted block">Uniform.</span>
                  <span className="font-semibold">
                    {(Math.max(0, 100 - cor.rStd)).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ações Rápidas */}
        <div className="space-y-1.5 pt-1">
          <div className="flex gap-2">
            {onToggleClass && (
              <button
                onClick={() => onToggleClass(segmentation.id)}
                className="bg-surface-1 hover:bg-surface-2 border-line rounded-control text-ink-1 flex flex-1 cursor-pointer items-center justify-center gap-1.5 border py-2 text-[11px] font-bold transition-all shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 text-accent" />
                <span>{isViable ? 'Tornar Inviável' : 'Tornar Viável'}</span>
              </button>
            )}

            {onProposeCut && (
              <button
                onClick={() => onProposeCut(segmentation.id)}
                className={`rounded-control flex flex-1 cursor-pointer items-center justify-center gap-1.5 border py-2 text-[11px] font-bold transition-all shadow-xs ${
                  sinais.veredito === 'aglomerado'
                    ? 'bg-accent border-accent text-accent-on'
                    : 'bg-surface-1 hover:bg-surface-2 border-line text-ink-1'
                }`}
                title="Propor divisão de duas sementes encostadas"
              >
                <Scissors className="h-3.5 w-3.5" />
                <span>Dividir</span>
              </button>
            )}
          </div>

          {onDelete && (
            <button
              onClick={() => {
                onDelete(segmentation.id);
                onClose();
              }}
              className="text-rose-600 hover:bg-rose-500/10 border-rose-500/20 rounded-control flex w-full cursor-pointer items-center justify-center gap-1.5 border py-1.5 text-[11px] font-semibold transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Excluir Contorno</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
