import React, { useState, useCallback } from 'react';
import { iniciarAtividade } from '../features/atividade/atividade';
import { ehTiff } from '../lib/image-crop';
import { decodificarTiff } from '../lib/tiff';

interface UseImageQueueProps {
  onImageLoaded?: (img: HTMLImageElement, file: File) => void;
}

export function useImageQueue({ onImageLoaded }: UseImageQueueProps = {}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [imageQueue, setImageQueue] = useState<File[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  /** Última falha de carregamento, para a interface poder dizer o que houve. */
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadImageFromFile = useCallback(
    (file: File) => {
      // TIFF passa no filtro image/* mas nenhum navegador o decodifica.
      // Scanner de laboratório grava TIFF (8/16 bits, com ou sem LZW), então
      // decodificamos aqui com `utif` e entregamos o mesmo <img> do PNG —
      // nada abaixo do carregador precisa saber de onde a imagem veio.
      if (ehTiff(file)) {
        setFilename(file.name);
        setLoadError(null);
        const encerrar = iniciarAtividade('imagem', `Abrindo ${file.name}…`);
        file
          .arrayBuffer()
          .then((buffer) => {
            const dec = decodificarTiff(buffer);
            if (!dec) throw new Error('não é um TIFF que este leitor entenda');
            const canvas = document.createElement('canvas');
            canvas.width = dec.width;
            canvas.height = dec.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('canvas indisponível');
            ctx.putImageData(new ImageData(dec.rgba, dec.width, dec.height), 0, 0);
            // Blob + object URL em vez de data URL: uma digitalização de 6800
            // px viraria uma string de dezenas de MB só para virar imagem.
            return new Promise<HTMLImageElement>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (!blob) { reject(new Error('não foi possível converter')); return; }
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
                img.src = url;
              }, 'image/png');
            }).then((img) => {
              if (dec.paginas > 1) {
                // Aviso, não erro: a primeira página abriu.
                setLoadError(`"${file.name}" tem ${dec.paginas} páginas; foi aberta a primeira.`);
              }
              return img;
            });
          })
          .then((img) => {
            encerrar();
            setImage(img);
            onImageLoaded?.(img, file);
          })
          .catch((e: unknown) => {
            encerrar();
            const motivo = e instanceof Error ? e.message : 'erro desconhecido';
            setLoadError(`Não foi possível abrir "${file.name}" (${motivo}). Converta para PNG e tente de novo.`);
          });
        return;
      }

      setFilename(file.name);
      setLoadError(null);

      // Uma digitalizacao de scanner leva segundos para decodificar, e sem isto
      // a tela fica parada sem sinal — indistinguivel de travada.
      const encerrar = iniciarAtividade('imagem', `Abrindo ${file.name}…`);

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          encerrar();
          setImage(img);
          if (onImageLoaded) {
            onImageLoaded(img, file);
          }
        };
        // Qualquer arquivo corrompido ou em formato não suportado cai aqui.
        img.onerror = () => {
          encerrar();
          setLoadError(`Não foi possível abrir "${file.name}". O arquivo pode estar corrompido.`);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        encerrar();
        setLoadError(`Falha ao ler "${file.name}".`);
      };
      reader.readAsDataURL(file);
    },
    [onImageLoaded]
  );

  const loadFiles = useCallback(
    (files: File[]) => {
      // Windows às vezes entrega TIFF com `type` vazio (o navegador não
      // reconhece a extensão); sem o `ehTiff(f)` o arquivo cairia fora do
      // filtro antes mesmo de chegar na guarda que sabe decodificá-lo.
      const validFiles = files.filter((f) => f.type.startsWith('image/') || ehTiff(f));
      if (validFiles.length > 0) {
        setImageQueue(validFiles);
        setCurrentImageIndex(0);
        loadImageFromFile(validFiles[0]);
      }
    },
    [loadImageFromFile]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      loadFiles(files);
      e.target.value = ''; // Reset input element
    },
    [loadFiles]
  );

  const handleNextImage = useCallback(() => {
    if (currentImageIndex < imageQueue.length - 1) {
      const nextIndex = currentImageIndex + 1;
      setCurrentImageIndex(nextIndex);
      loadImageFromFile(imageQueue[nextIndex]);
      return true;
    }
    return false;
  }, [currentImageIndex, imageQueue, loadImageFromFile]);

  const handlePrevImage = useCallback(() => {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      loadImageFromFile(imageQueue[prevIndex]);
      return true;
    }
    return false;
  }, [currentImageIndex, loadImageFromFile]);

  const resetQueue = useCallback(() => {
    setImage(null);
    setLoadError(null);
    setFilename('');
    setImageQueue([]);
    setCurrentImageIndex(0);
  }, []);

  return {
    image,
    setImage,
    filename,
    setFilename,
    imageQueue,
    setImageQueue,
    currentImageIndex,
    setCurrentImageIndex,
    loadError,
    setLoadError,

    // Actions
    loadFiles,
    handleFileUpload,
    handleNextImage,
    handlePrevImage,
    loadImageFromFile,
    resetQueue,
  };
}
