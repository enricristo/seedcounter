// =============================================================================
// SeedCounter — useCamera
// GPEOrq / Unoeste · Lab. de Sementes e Tecido Vegetal
// =============================================================================
// Captura de imagem via câmera do dispositivo. Suporta:
//  · Lupa / microscópio USB no computador (seleção de dispositivo)
//  · Câmera traseira de celular / tablet
// Requer contexto seguro (HTTPS ou localhost) — atendido pelo Vercel e pelo dev local.
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export type CameraError =
  | 'unsupported'
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'insecure'
  | 'unknown';

export const CAMERA_ERROR_MESSAGES: Record<CameraError, string> = {
  unsupported: 'Este navegador não suporta acesso à câmera.',
  denied: 'Permissão de câmera negada. Autorize o acesso nas configurações do navegador.',
  'not-found': 'Nenhuma câmera encontrada. Verifique se a lupa/microscópio está conectado.',
  'in-use': 'A câmera está sendo usada por outro programa. Feche-o e tente novamente.',
  insecure: 'A câmera exige conexão segura (HTTPS).',
  unknown: 'Não foi possível acessar a câmera.',
};

function mapError(err: unknown): CameraError {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  if (name === 'NotReadableError' || name === 'AbortError') return 'in-use';
  return 'unknown';
}

/** A API de câmera existe e o contexto é seguro? */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/** Heurística simples de dispositivo móvel (define câmera traseira por padrão). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [error, setError] = useState<CameraError | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Encerra as trilhas de vídeo e libera a câmera.
  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  /** Lista as câmeras disponíveis (rótulos só aparecem após a permissão). */
  const refreshDevices = useCallback(async () => {
    if (!isCameraSupported() || !navigator.mediaDevices.enumerateDevices) return [];
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Câmera ${i + 1}`,
        }));
      setDevices(cams);
      return cams;
    } catch {
      return [];
    }
  }, []);

  /** Inicia a câmera. Sem deviceId, escolhe a traseira em celulares. */
  const start = useCallback(
    async (deviceId?: string) => {
      setError(null);

      if (!isCameraSupported()) {
        setError(typeof window !== 'undefined' && !window.isSecureContext ? 'insecure' : 'unsupported');
        return false;
      }

      setIsStarting(true);
      // Libera a câmera anterior antes de abrir outra (evita "in-use").
      stop();

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 3840 }, height: { ideal: 2160 } }
          : {
              facingMode: isMobileDevice() ? { ideal: 'environment' } : undefined,
              width: { ideal: 3840 },
              height: { ideal: 2160 },
            },
        audio: false,
      };

      try {
        const media = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = media;
        setStream(media);

        const currentId = media.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? '';
        setActiveDeviceId(currentId);

        // Só após a permissão os rótulos reais ficam visíveis.
        await refreshDevices();
        setIsStarting(false);
        return true;
      } catch (err) {
        setError(mapError(err));
        setIsStarting(false);
        return false;
      }
    },
    [refreshDevices, stop]
  );

  /**
   * Captura o quadro atual do vídeo e devolve um File PNG,
   * pronto para entrar no fluxo normal de imagens do app.
   */
  const capture = useCallback(
    async (video: HTMLVideoElement, filename?: string): Promise<File | null> => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return null;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(b => resolve(b), 'image/png')
      );
      if (!blob) return null;

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const name = filename || `captura-${stamp}.png`;
      return new File([blob], name, { type: 'image/png' });
    },
    []
  );

  // Garante que a câmera seja liberada ao desmontar o componente.
  useEffect(() => stop, [stop]);

  return {
    stream,
    devices,
    activeDeviceId,
    error,
    errorMessage: error ? CAMERA_ERROR_MESSAGES[error] : null,
    isStarting,
    isActive: !!stream,
    start,
    stop,
    capture,
    refreshDevices,
  };
}
