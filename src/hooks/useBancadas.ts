import { useState } from 'react';
import { useBancada, type Bancada } from './useBancada';
import { NEUTRAL_ADJUSTMENTS } from '../lib/image-adjust';
import { ESTADO_INICIAL as MASCARA_INICIAL } from '../features/mascara';

/** Hooks não podem ser chamados em laço condicional — por isso são sempre quatro. */
export const MAXIMO_DE_BANCADAS = 4;

export interface Bancadas {
  /** Sempre quatro — na ordem de exibição (ver `ordem` mais abaixo). */
  todas: Bancada[];
  /** Quantas aparecem na tela: 1 a 4. */
  abertas: number;
  /** Índice da ativa em `todas`. */
  indiceAtivo: number;
  ativa: Bancada;
  ativar(indice: number): void;
  /** Abre mais uma (até 4) e a torna ativa. Devolve o índice, ou null se já há quatro. */
  abrirNova(): number | null;
  /** Fecha uma bancada: zera o estado dela e reordena; nunca fecha a última. */
  fechar(indice: number): void;
}

/**
 * Zera uma bancada inteira antes de ela sair de vista: anotações, imagem e
 * metadados (e, por extensão, o resto da cena — máscara, contorno
 * selecionado, ajustes — que é lixo da imagem que acabou de sair). Reabrir
 * essa mesma bancada mais tarde (`abrirNova` reaproveita o slot fechado, ver
 * comentário em `fechar`) precisa encontrá-la limpa, não com a sessão
 * anterior por baixo.
 */
function zerarBancada(b: Bancada): void {
  b.anotacoes.resetAllAnnotations();

  b.fila.setImage(null);
  b.fila.setFilename('');
  b.fila.setImageQueue([]);
  b.fila.setCurrentImageIndex(0);
  b.fila.setLoadError(null);

  // `useMetadata` grava num registro único do Dexie (ver nota no relatório
  // da Task 2 sobre esse acoplamento) — `resetMetadata` é a forma que o
  // próprio hook já expõe para voltar ao valor padrão.
  void b.meta.resetMetadata();

  b.zoom.resetZoom();

  b.cena.setFundoAchatado(null);
  b.cena.setAdjustments(NEUTRAL_ADJUSTMENTS);
  b.cena.setAdjustEnabled(true);
  b.cena.setMascara(MASCARA_INICIAL);
  b.cena.setContornoSelecionado(null);
  b.cena.setRegiaoDeDeteccao(null);
  b.cena.setUltimaGravacao(null);
  b.cena.setForcarOriginalNasAutomacoes(false);
  b.cena.setAnotacaoAtual(null);
  b.cena.setDatasetContexto(null);
  b.cena.setReferenciaJaCarregada(false);
  b.cena.chaveAtual.current = null;
}

/**
 * Quatro cenas, sempre — `useBancada()` chamado quatro vezes custa quatro
 * conjuntos de `useState` vazios (barato); o que pesa é a imagem, e `image`
 * é `null` até alguém carregar uma. `abertas` decide quantas aparecem;
 * `indiceAtivo` decide com quem a barra de ferramentas, os atalhos e o
 * painel direito conversam (ver Global Constraints do plano de bancadas).
 *
 * `ordem` é a permutação dos quatro slots físicos (`b1`..`b4`) que decide
 * QUAL bancada física aparece em cada posição de `todas`. Fechar uma
 * bancada no meio (`abertas` = 3, fecha a posição 1) não pode deixar um
 * buraco na posição 1 — quem renderiza (Task 3) espera `todas[0..abertas-1]`
 * contíguo. Por isso fechar manda o slot fechado para o FIM de `ordem` e
 * reduz `abertas`; abrir uma nova bancada só revela o próximo slot de
 * `ordem` — que, se já foi fechado antes, já está zerado por `zerarBancada`.
 */
export function useBancadas(opcoes?: {
  onImageLoaded?: (indice: number, img: HTMLImageElement, file: File) => void;
}): Bancadas {
  const [ordem, setOrdem] = useState<number[]>([0, 1, 2, 3]);
  const [abertas, setAbertas] = useState(1);
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  // Cada bancada informa sua PRÓPRIA posição de exibição no momento em que a
  // imagem termina de carregar — não o slot físico (0..3 fixo), que Task 3
  // não usa para nada; quem consome `onImageLoaded` (o App) indexa em
  // `bancadas.todas`, que já está na ordem de exibição.
  const b1 = useBancada('b1', {
    onImageLoaded: (img, file) => opcoes?.onImageLoaded?.(ordem.indexOf(0), img, file),
  });
  const b2 = useBancada('b2', {
    onImageLoaded: (img, file) => opcoes?.onImageLoaded?.(ordem.indexOf(1), img, file),
  });
  const b3 = useBancada('b3', {
    onImageLoaded: (img, file) => opcoes?.onImageLoaded?.(ordem.indexOf(2), img, file),
  });
  const b4 = useBancada('b4', {
    onImageLoaded: (img, file) => opcoes?.onImageLoaded?.(ordem.indexOf(3), img, file),
  });
  const fisicas = [b1, b2, b3, b4];

  const todas = ordem.map((i) => fisicas[i]);
  // `strict` não sabe que `indiceAtivo` está sempre em [0, 4) — cai para a
  // posição 0 em vez de um `!` sem motivo (a posição 0 sempre existe: as
  // quatro chamadas de `useBancada` acima nunca deixam de rodar).
  const ativa = todas[indiceAtivo] ?? todas[0];

  const ativar = (indice: number) => {
    if (indice < 0 || indice >= abertas) return;
    setIndiceAtivo(indice);
  };

  const abrirNova = (): number | null => {
    if (abertas >= MAXIMO_DE_BANCADAS) return null;
    const novoIndice = abertas;
    setAbertas(novoIndice + 1);
    setIndiceAtivo(novoIndice);
    return novoIndice;
  };

  const fechar = (indice: number) => {
    // Nunca fecha a última — sempre sobra uma bancada para trabalhar.
    if (abertas <= 1) return;
    if (indice < 0 || indice >= abertas) return;

    zerarBancada(todas[indice]);

    const novaOrdem = [...ordem];
    const [saiu] = novaOrdem.splice(indice, 1);
    novaOrdem.push(saiu);
    const novoAbertas = abertas - 1;

    setOrdem(novaOrdem);
    setAbertas(novoAbertas);
    setIndiceAtivo((atual) => {
      if (indice < atual) return atual - 1;
      return Math.min(atual, novoAbertas - 1);
    });
  };

  return { todas, abertas, indiceAtivo, ativa, ativar, abrirNova, fechar };
}
