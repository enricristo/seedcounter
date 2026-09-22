import React, { useState, useCallback } from 'react';
import { iniciarAtividade } from '../features/atividade/atividade';
import { ehTiff } from '../lib/image-crop';
import { decodificarTiff } from '../lib/tiff';

/**
 * Windows às vezes entrega TIFF com `type` vazio (o navegador não reconhece
 * a extensão); sem o `ehTiff(f)` o arquivo cairia fora do filtro antes mesmo
 * de chegar na guarda que sabe decodificá-lo. Pura e fora do hook: não
 * depende de estado, e assim não entra em lista de dependências nenhuma.
 */
export function filtrarImagens(files: File[]): File[] {
  return files.filter((f) => f.type.startsWith('image/') || ehTiff(f));
}

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

  // -------------------------------------------------------------------------
  // TIFF de várias páginas
  // -------------------------------------------------------------------------
  // Guardamos o FILE, não o ArrayBuffer. Uma digitalização de tetrazólio com
  // dez espécies tem 1,1 GB; manter esse buffer vivo só para poder trocar de
  // página custaria a aba inteira. O File é um ponteiro barato para o disco, e
  // reler custa segundos — que é o preço certo para uma ação que a pessoa faz
  // dez vezes por sessão, não dez vezes por segundo.
  const [arquivoTiff, setArquivoTiff] = useState<File | null>(null);
  const [paginasDoTiff, setPaginasDoTiff] = useState(1);
  const [paginaDoTiff, setPaginaDoTiff] = useState(0);
  /** O DPI que o arquivo DECLARA. Palpite de escala; a régua é quem decide. */
  const [dpiDeclarado, setDpiDeclarado] = useState<number | null>(null);

  const loadImageFromFile = useCallback(
    (file: File, pagina = 0) => {
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
            const dec = decodificarTiff(buffer, pagina);
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
              // Deixou de ser AVISO e virou ESTADO: antes o app dizia "tem dez
              // páginas, abri a primeira" e não havia o que fazer com a
              // informação. Agora a interface oferece as outras.
              setArquivoTiff(file);
              setPaginasDoTiff(dec.paginas);
              setPaginaDoTiff(dec.pagina);
              setDpiDeclarado(dec.dpiDeclarado ?? null);
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
      // Imagem comum não tem página nem DPI declarado: zerar aqui evita que o
      // seletor da digitalização anterior continue na tela mentindo.
      setArquivoTiff(null);
      setPaginasDoTiff(1);
      setPaginaDoTiff(0);
      setDpiDeclarado(null);

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

  /** SUBSTITUI a fila inteira e abre o primeiro arquivo. */
  const loadFiles = useCallback(
    (files: File[]) => {
      const validFiles = filtrarImagens(files);
      if (validFiles.length > 0) {
        setImageQueue(validFiles);
        setCurrentImageIndex(0);
        loadImageFromFile(validFiles[0]);
      }
    },
    [loadImageFromFile]
  );

  /**
   * ACRESCENTA ao fim da fila, sem tirar da tela o que está aberto.
   *
   * É a outra resposta ao gesto de carregar com cena ocupada (ver
   * `features/carregar/decisao.ts`): a pessoa está no meio de uma contagem e
   * quer a próxima placa esperando na fila, não por cima da atual. Com
   * `irParaAPrimeira`, abre o primeiro arquivo novo — as anotações da imagem
   * atual ficam guardadas no cache por imagem de `useBancada`, como em
   * qualquer troca dentro da fila. Sem imagem aberta, acrescentar é o mesmo
   * que abrir: uma fila com a tela vazia não serve para nada.
   */
  const adicionarAFila = useCallback(
    (files: File[], irParaAPrimeira: boolean) => {
      const validFiles = filtrarImagens(files);
      if (validFiles.length === 0) return;
      const indiceDaPrimeiraNova = imageQueue.length;
      setImageQueue((prev) => [...prev, ...validFiles]);
      if (irParaAPrimeira || image === null) {
        setCurrentImageIndex(indiceDaPrimeiraNova);
        loadImageFromFile(validFiles[0]);
      }
    },
    [image, imageQueue.length, loadImageFromFile]
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

  /**
   * Abre outra página do TIFF já carregado.
   *
   * Relê o arquivo do disco de propósito — ver a nota no estado acima. Pedir a
   * página que já está aberta não faz nada: é o clique repetido de quem não
   * viu que já chegou, e reprocessar 1 GB por causa dele seria cruel.
   */
  const abrirPaginaDoTiff = useCallback(
    (pagina: number) => {
      if (!arquivoTiff) return;
      if (pagina === paginaDoTiff) return;
      if (!Number.isInteger(pagina) || pagina < 0 || pagina >= paginasDoTiff) return;
      loadImageFromFile(arquivoTiff, pagina);
    },
    [arquivoTiff, paginaDoTiff, paginasDoTiff, loadImageFromFile]
  );

  const resetQueue = useCallback(() => {
    setImage(null);
    setLoadError(null);
    setFilename('');
    setImageQueue([]);
    setCurrentImageIndex(0);
    setArquivoTiff(null);
    setPaginasDoTiff(1);
    setPaginaDoTiff(0);
    setDpiDeclarado(null);
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

    // TIFF de várias páginas
    paginasDoTiff,
    paginaDoTiff,
    dpiDeclarado,
    abrirPaginaDoTiff,

    // Actions
    loadFiles,
    adicionarAFila,
    handleFileUpload,
    handleNextImage,
    handlePrevImage,
    loadImageFromFile,
    resetQueue,
  };
}
