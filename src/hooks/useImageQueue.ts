import React, { useState, useCallback } from 'react';

interface UseImageQueueProps {
  onImageLoaded?: (img: HTMLImageElement, file: File) => void;
}

export function useImageQueue({ onImageLoaded }: UseImageQueueProps = {}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [imageQueue, setImageQueue] = useState<File[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const loadImageFromFile = useCallback((file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        if (onImageLoaded) {
          onImageLoaded(img, file);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [onImageLoaded]);

  const loadFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length > 0) {
      setImageQueue(validFiles);
      setCurrentImageIndex(0);
      loadImageFromFile(validFiles[0]);
    }
  }, [loadImageFromFile]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    loadFiles(files);
    e.target.value = ''; // Reset input element
  }, [loadFiles]);

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
    
    // Actions
    loadFiles,
    handleFileUpload,
    handleNextImage,
    handlePrevImage,
    loadImageFromFile,
    resetQueue
  };
}
