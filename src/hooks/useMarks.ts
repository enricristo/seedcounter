import { useState, useCallback, useMemo } from 'react';
import type { Mark, YoloSegmentation } from '../types';
import {
  abrirGesto as abrir,
  desfazer as voltar,
  fecharGesto as fechar,
  iniciar,
  podeDesfazer as haPassado,
  podeRefazer as haFuturo,
  recomecar,
  refazer as avancar,
  registrar,
  type Historico,
  type OpcoesDeRegistro,
} from '../lib/historico';

/**
 * As duas listas que descrevem a anotação de uma imagem.
 *
 * Moram juntas de propósito: uma marca e o contorno dela são a mesma semente,
 * e desfazer tem que devolver os dois no mesmo passo. Quando eram dois
 * `useState`, o Ctrl+Z tirava a última marca e o contorno apagado por engano
 * não voltava nunca — não havia de onde.
 */
export interface Anotacoes {
  marks: Mark[];
  segmentacoes: YoloSegmentation[];
}

type Atualizacao<T> = T | ((antes: T) => T);

const VAZIO: Anotacoes = { marks: [], segmentacoes: [] };

function aplicar<T>(a: Atualizacao<T>, antes: T): T {
  return typeof a === 'function' ? (a as (x: T) => T)(antes) : a;
}

export function useMarks() {
  const [historico, setHistorico] = useState<Historico<Anotacoes>>(() => iniciar(VAZIO));
  const [segmentsVisible, setSegmentsVisible] = useState(true);

  const { marks, segmentacoes: yoloSegmentations } = historico.presente;

  /**
   * A única porta de mudança. Tudo que altera marca ou contorno passa aqui, e
   * é aqui que o histórico registra. Devolver a MESMA referência de `antes`
   * significa "nada mudou" e não cria entrada — sem isso, filtrar uma lista
   * que já não tinha o alvo empurraria um passo vazio no Ctrl+Z.
   */
  const mutar = useCallback((fn: (antes: Anotacoes) => Anotacoes, op?: OpcoesDeRegistro) => {
    setHistorico((h) => registrar(h, fn(h.presente), op));
  }, []);

  // As duas assinaturas antigas continuam valendo — cada chamada é um passo
  // do histórico. Quem precisa de dois ajustes num gesto só usa `mutar`.
  const setMarks = useCallback(
    (a: Atualizacao<Mark[]>, op?: OpcoesDeRegistro) =>
      mutar((antes) => {
        const marks = aplicar(a, antes.marks);
        return marks === antes.marks ? antes : { ...antes, marks };
      }, op),
    [mutar]
  );

  const setYoloSegmentations = useCallback(
    (a: Atualizacao<YoloSegmentation[]>, op?: OpcoesDeRegistro) =>
      mutar((antes) => {
        const segmentacoes = aplicar(a, antes.segmentacoes);
        return segmentacoes === antes.segmentacoes ? antes : { ...antes, segmentacoes };
      }, op),
    [mutar]
  );

  // --- Histórico ------------------------------------------------------------

  const desfazer = useCallback(() => setHistorico(voltar), []);
  const refazer = useCallback(() => setHistorico(avancar), []);
  /** Um arraste começa aqui e termina em `fecharGesto`: vira um passo só. */
  const abrirGesto = useCallback(() => setHistorico(abrir), []);
  const fecharGesto = useCallback(() => setHistorico(fechar), []);

  /**
   * Troca a anotação inteira e esquece o histórico. É o que carregar uma
   * sessão ou trocar de imagem faz: o passado de outra imagem não é passado
   * desta, e Ctrl+Z logo depois de abrir uma sessão não pode "desabrir".
   */
  const carregar = useCallback((a: Partial<Anotacoes>) => {
    setHistorico(
      recomecar({
        marks: a.marks ?? [],
        segmentacoes: a.segmentacoes ?? [],
      })
    );
  }, []);

  // --- Marcas -----------------------------------------------------------------

  // Devolve o id: quem cria um contorno no mesmo gesto precisa dele para
  // VINCULAR os dois. Sem o id, o vinculo ficava implicito (ponto dentro do
  // poligono), e implicito quebra quando o poligono e cortado ao meio.
  const addMark = useCallback(
    (x: number, y: number, type: 'viable' | 'inviable', op?: OpcoesDeRegistro): number => {
      const id = Date.now() + Math.random();
      setMarks((prev) => [...prev, { x, y, type, id }], op);
      return id;
    },
    [setMarks]
  );

  /**
   * Apagar a marca apaga o contorno DELA, no mesmo passo.
   *
   * A marca e a identidade da semente; o contorno e a medida dessa semente.
   * Quem apaga a marca esta dizendo "isto nao e uma semente" — e um contorno
   * medindo uma semente que nao existe seria area e comprimento de nada no
   * CSV. So o contorno VINCULADO cai: contorno de modelo, sem marca, fica.
   * E como cai junto, volta junto: um Ctrl+Z devolve marca e contorno.
   */
  const removerMarcas = useCallback(
    (ids: number[], op?: OpcoesDeRegistro) => {
      if (ids.length === 0) return;
      const alvo = new Set(ids);
      mutar((antes) => {
        const marks = antes.marks.filter((m) => !alvo.has(m.id));
        if (marks.length === antes.marks.length) return antes;
        const segmentacoes = antes.segmentacoes.filter(
          (s) => s.marcaId == null || !alvo.has(s.marcaId)
        );
        return { marks, segmentacoes };
      }, op);
    },
    [mutar]
  );

  const removeMark = useCallback((id: number) => removerMarcas([id]), [removerMarcas]);

  /** Atribui (ou limpa, com undefined) a classe fina de uma marca. */
  const setSubclasse = useCallback(
    (id: number, subclasse: Mark['subclasse']) => {
      setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, subclasse } : m)));
    },
    [setMarks]
  );

  // --- Contornos --------------------------------------------------------------

  const addYoloSegmentations = useCallback(
    (segs: YoloSegmentation[]) => setYoloSegmentations(segs),
    [setYoloSegmentations]
  );

  /**
   * Acrescenta UMA segmentação, preservando as demais.
   *
   * `addYoloSegmentations` substitui a lista inteira — é o que a detecção em
   * lote precisa. A segmentação por clique é o oposto: uma semente de cada
   * vez, e cada clique tem que somar ao que já foi curado.
   */
  const appendYoloSegmentation = useCallback(
    (seg: YoloSegmentation, op?: OpcoesDeRegistro) => {
      setYoloSegmentations((prev) => [...prev, seg], op);
    },
    [setYoloSegmentations]
  );

  const toggleSegmentationClass = useCallback(
    (id: number) => {
      setYoloSegmentations((prev) =>
        prev.map((seg) => {
          if (seg.id === id) {
            const newCategory = seg.category === 'viable' ? 'inviable' : 'viable';
            return {
              ...seg,
              category: newCategory,
              class_name: newCategory === 'viable' ? 'viavel' : 'inviavel',
              edited: true,
            };
          }
          return seg;
        })
      );
    },
    [setYoloSegmentations]
  );

  const deleteSegmentation = useCallback(
    (id: number) => {
      setYoloSegmentations((prev) => {
        if (!prev.some((seg) => seg.id === id && seg.visible !== false)) return prev;
        return prev.map((seg) => (seg.id === id ? { ...seg, visible: false, edited: true } : seg));
      });
    },
    [setYoloSegmentations]
  );

  const toggleSegmentsVisibility = useCallback(() => {
    setSegmentsVisible((prev) => !prev);
  }, []);

  /** Limpa tudo num passo só — e um passo que o Ctrl+Z devolve. */
  const resetAllAnnotations = useCallback(() => {
    mutar((antes) =>
      antes.marks.length === 0 && antes.segmentacoes.length === 0 ? antes : VAZIO
    );
    setSegmentsVisible(true);
  }, [mutar]);

  const podeDesfazer = useMemo(() => haPassado(historico), [historico]);
  const podeRefazer = useMemo(() => haFuturo(historico), [historico]);

  return {
    marks,
    setMarks,
    yoloSegmentations,
    setYoloSegmentations,
    segmentsVisible,
    setSegmentsVisible,

    // Histórico
    mutar,
    desfazer,
    refazer,
    podeDesfazer,
    podeRefazer,
    abrirGesto,
    fecharGesto,
    carregar,

    // Manual
    addMark,
    removeMark,
    removerMarcas,
    setSubclasse,

    // YOLO
    addYoloSegmentations,
    appendYoloSegmentation,
    toggleSegmentationClass,
    deleteSegmentation,
    toggleSegmentsVisibility,

    // Combined
    resetAllAnnotations,
  };
}
