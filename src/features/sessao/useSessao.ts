// =============================================================================
// SeedCounter — gravar e restaurar sessão, fora do App
//
// POR QUE EXISTE. Mesmo molde de `features/exportar`: o App entrega a cena e
// o que restaurar precisa escrever, e recebe de volta os três handlers que os
// componentes sempre receberam — `saveCurrentSession` (Ctrl+S, o cabeçalho,
// o diálogo de exportar e a sugestão), `handleLoadSession` (o histórico) e
// `saveAndNext` (o lote). O hook não cria estado: `ultimaGravacao` continua
// na cena (`useBancada`), e o modal do histórico continua no App, porque
// alimenta `isAnyModalOpen`.
//
// A FOTO VAI EM JPEG 0,85 NO TAMANHO REAL. É o que faz uma sessão de 2024
// abrir hoje com a imagem: sem ela o histórico só teria os números, e a
// pessoa teria de achar o arquivo original para conferir uma marcação. A
// compressão é o preço de guardar uma digitalização inteira no IndexedDB.
//
// RESTAURAR ZERA A FILA E A CHAVE DO CACHE. A sessão restaurada é um
// contexto próprio: "Anterior/Próxima" apontando para os arquivos da fila
// antiga trocava a imagem por baixo da sessão recém-aberta; e a chave do
// cache de anotações (`chaveAtual`) precisa ir a `null` para a próxima imagem
// da fila não ser guardada sob o nome da sessão. O `useBancada` também conta
// com isso para não liberar a foto cheia de uma sessão restaurada (regra 4).
// =============================================================================

import { useCallback, type MutableRefObject } from 'react';
import type { Mark, Metadata, Session, YoloSegmentation } from '../../types';
import { registrarEvento } from '../../lib/diagnostico/trilha';
import {
  MENSAGEM_IMAGEM_DA_SESSAO_FALHOU,
  MENSAGEM_SESSAO_SALVA,
  mensagemDeSessaoSemImagem,
  montarSessao,
  sessaoEstaVazia,
} from './sessao';

export interface EntradaDaSessao {
  // --- A cena que se grava ------------------------------------------------
  filename: string;
  image: HTMLImageElement | null;
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
  metadata: Metadata;
  /** Como o App já a calculou — o mesmo objeto que vai para `useExportacoes`. */
  contagem: { viableCount: number; inviableCount: number };
  /** O histórico local (`useSessions`). */
  sessions: Session[];
  addSession: (s: Session) => void | Promise<void>;
  /** Da cena: quando esta imagem foi gravada pela última vez. */
  setUltimaGravacao: (instante: number) => void;

  // --- O que restaurar escreve --------------------------------------------
  setImageQueue: (fila: File[]) => void;
  setCurrentImageIndex: (indice: number) => void;
  /** A chave do cache de anotações da bancada — zerada ao restaurar. */
  chaveAtual: MutableRefObject<string | null>;
  setMetadata: (m: Metadata) => void;
  setFilename: (nome: string) => void;
  /** Troca marcas e contornos e esquece o histórico de desfazer (`useMarks`). */
  carregar: (a: { marks?: Mark[]; segmentacoes?: YoloSegmentation[] }) => void;
  setImage: (img: HTMLImageElement) => void;
  setZoomLevel: (zoom: number) => void;
  /** O modal do histórico é do App; aqui só se pede para fechá-lo. */
  fecharHistorico: () => void;
  navigate: (view: 'counter') => void;
  /** Da fila: o "salvar e próxima" do lote. */
  handleNextImage: () => void;
}

/**
 * A foto da cena como JPEG 0,85 em tamanho real. Sem contexto 2D (raro, mas
 * acontece em aba de fundo com memória escassa) a sessão vai sem foto — como
 * sempre foi — em vez de não ir.
 */
function imagemComoJpeg(image: HTMLImageElement): string | undefined {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85); // Alta qualidade, mas comprimida
}

export function useSessao(e: EntradaDaSessao) {
  const {
    filename,
    image,
    marks,
    segmentacoes,
    metadata,
    contagem,
    sessions,
    addSession,
    setUltimaGravacao,
    setImageQueue,
    setCurrentImageIndex,
    chaveAtual,
    setMetadata,
    setFilename,
    carregar,
    setImage,
    setZoomLevel,
    fecharHistorico,
    navigate,
    handleNextImage,
  } = e;

  const saveCurrentSession = useCallback(
    (silent = false) => {
      if (!filename) return;

      const imagem = image ? imagemComoJpeg(image) : undefined;
      const nova = montarSessao({ filename, metadata, marks, segmentacoes, contagem, imagem });
      addSession(nova);
      setUltimaGravacao(Date.now());
      // Trilha: "salvei e o histórico mostra zero" e "salvei e não tem foto"
      // são dois relatos que chegam com a mesma frase.
      registrarEvento('sessao:salvar', {
        vazia: sessaoEstaVazia(nova),
        comImagem: imagem !== undefined,
        silenciosa: silent,
      });
      if (!silent) {
        alert(MENSAGEM_SESSAO_SALVA);
      }
    },
    [filename, image, metadata, marks, segmentacoes, contagem, addSession, setUltimaGravacao]
  );

  const handleLoadSession = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      // Ver o cabeçalho: a sessão restaurada não faz parte da fila carregada
      // antes, e a chave do cache não pode continuar apontando para ela.
      setImageQueue([]);
      setCurrentImageIndex(0);
      chaveAtual.current = null;

      setMetadata(session.metadata);
      setFilename(session.filename);
      carregar({ marks: session.marks, segmentacoes: session.yoloSegmentations });
      registrarEvento('sessao:abrir', { comImagem: !!session.imageData });

      // Restaura a foto quando há uma guardada
      if (session.imageData) {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setZoomLevel(1);
          fecharHistorico();
          navigate('counter');
        };
        img.onerror = () => {
          alert(MENSAGEM_IMAGEM_DA_SESSAO_FALHOU);
        };
        img.src = session.imageData;
      } else {
        fecharHistorico();
        navigate('counter');
        alert(mensagemDeSessaoSemImagem(session));
      }
    },
    [
      sessions,
      setImageQueue,
      setCurrentImageIndex,
      chaveAtual,
      setMetadata,
      setFilename,
      carregar,
      setImage,
      setZoomLevel,
      fecharHistorico,
      navigate,
    ]
  );

  const saveAndNext = useCallback(() => {
    saveCurrentSession(true);
    handleNextImage();
  }, [saveCurrentSession, handleNextImage]);

  return { saveCurrentSession, handleLoadSession, saveAndNext };
}
