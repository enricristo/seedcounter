// =============================================================================
// SeedCounter — CameraModal
// Captura de imagem por câmera: lupa/microscópio (desktop) e celular/tablet.
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { useCamera, isCameraSupported, isMobileDevice } from '../../hooks/useCamera';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Recebe a foto capturada como File (entra no fluxo normal de imagens). */
  onCapture: (file: File) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);

  const {
    stream,
    devices,
    activeDeviceId,
    errorMessage,
    isStarting,
    isActive,
    start,
    stop,
    capture,
  } = useCamera();

  const supported = isCameraSupported();
  const mobile = isMobileDevice();

  // Abre a câmera ao montar; libera ao fechar.
  useEffect(() => {
    if (isOpen && supported) start();
    if (!isOpen) {
      stop();
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    }
  }, [isOpen, supported, start, stop]);

  // Conecta o stream ao elemento de vídeo.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current) return;
    const file = await capture(videoRef.current);
    if (file) {
      setPreview({ url: URL.createObjectURL(file), file });
    }
  }, [capture]);

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    onCapture(preview.file);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    stop();
    onClose();
  }, [preview, onCapture, stop, onClose]);

  const handleRetake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }, [preview]);

  // Fallback: input nativo (útil se getUserMedia falhar no celular).
  const handleFallbackFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onCapture(file);
        onClose();
      }
      e.target.value = '';
    },
    [onCapture, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-line bg-surface-1 shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <Camera size={18} className="text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-1">
              Capturar da Câmera
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink-2 hover:bg-surface-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 space-y-4">
          {/* Erro / não suportado */}
          {(!supported || errorMessage) && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
              <AlertCircle
                size={18}
                className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5"
              />
              <div className="space-y-2">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {errorMessage ?? 'Este navegador não suporta acesso direto à câmera.'}
                </p>
                <button
                  onClick={() => fallbackInputRef.current?.click()}
                  className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200 underline"
                >
                  Usar a câmera do sistema
                </button>
              </div>
            </div>
          )}

          {/* Seleção de dispositivo (lupa/microscópio no desktop) */}
          {isActive && devices.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
                Dispositivo (lupa / microscópio / webcam)
              </label>
              <select
                value={activeDeviceId}
                onChange={(e) => start(e.target.value)}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Área de vídeo / prévia */}
          <div className="relative rounded-xl overflow-hidden bg-graphite-900 aspect-video flex items-center justify-center">
            {preview ? (
              <img
                src={preview.url}
                alt="Prévia da captura"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                />
                {isStarting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <RefreshCw size={22} className="animate-spin text-accent" />
                  </div>
                )}
              </>
            )}
          </div>

          <p className="text-[11px] text-ink-3">
            {mobile
              ? 'Aproxime a câmera da placa, estabilize e capture. Use boa iluminação e evite sombras.'
              : 'Selecione a câmera da lupa ou do microscópio na lista acima. Ajuste o foco antes de capturar.'}
          </p>

          {/* Ações */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {preview ? (
              <>
                <button
                  onClick={handleRetake}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line text-ink-2 hover:bg-surface-2 text-xs font-bold uppercase tracking-wide transition-colors"
                >
                  <RotateCcw size={15} /> Repetir
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-strong text-accent-on text-xs font-bold uppercase tracking-wide transition-colors"
                >
                  <Check size={15} /> Usar esta imagem
                </button>
              </>
            ) : (
              <button
                onClick={handleCapture}
                disabled={!isActive}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-strong disabled:opacity-40 disabled:cursor-not-allowed text-accent-on text-xs font-bold uppercase tracking-wide transition-colors"
              >
                <Camera size={15} /> Capturar
              </button>
            )}
          </div>

          {/* Input nativo de fallback (celular abre a câmera direto) */}
          <input
            ref={fallbackInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFallbackFile}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
