import React, { useState, useCallback } from 'react';
import { ehTiff } from '../lib/image-crop';

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
      // TIFF passa no filtro image/* mas nenhum navegador o decodifica: sem
      // esta guarda, o img.onload nunca dispara e a tela fica em silêncio,
      // sem imagem e sem erro.
      if (ehTiff(file)) {
        setLoadError(
          `"${file.name}" está em TIFF, que o navegador não abre. Converta para JPG ou PNG antes de carregar.`
        );
        return;
      }

      setFilename(file.name);
      setLoadError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          if (onImageLoaded) {
            onImageLoaded(img, file);
          }
        };
        // Qualquer arquivo corrompido ou em formato não suportado cai aqui.
        img.onerror = () => {
          setLoadError(`Não foi possível abrir "${file.name}". O arquivo pode estar corrompido.`);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        setLoadError(`Falha ao ler "${file.name}".`);
      };
      reader.readAsDataURL(file);
    },
    [onImageLoaded]
  );

  const loadFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter((f) => f.type.startsWith('image/'));
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
