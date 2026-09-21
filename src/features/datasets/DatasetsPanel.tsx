// =============================================================================
// SeedCounter — Painel do explorador de datasets
//
// Abre uma pasta local (handle lembrado ou input, conforme o navegador),
// reconhece o formato de cada subpasta (B1) e mostra uma grade de miniaturas
// paginada. Clicar numa miniatura CARREGA A IMAGEM — a anotação é um segundo
// gesto ("Carregar referência", no App, perto do canvas), para a pessoa ver o
// app trabalhar antes de ver a resposta pronta.
//
// A pasta nunca é copiada nem alterada: só leitura, via `features/datasets/
// fonte.ts`. Miniatura é `createImageBitmap(file, { resizeWidth: 160 })`,
// decodificada só para o que está na página atual — a pasta real tem dezenas
// de milhares de imagens, e decodificar tudo de uma vez trava a aba.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, ChevronLeft, ChevronRight, RotateCcw, ImageOff, Ruler, Square, Download } from 'lucide-react';
import {
  suportaHandles,
  abrirPastaComHandle,
  abrirPastaComInput,
  reabrirUltimaPasta,
  type PastaAberta,
  type ArquivoDoDataset,
  type ConjuntoDeArquivos,
} from './fonte';
import { reconhecerFormato, type DatasetReconhecido, type FormatoDeDataset } from '../../lib/datasets/formato';
import { lerClassesCsv } from '../../lib/datasets/roboflow-multiclass';
import { lerAnotacaoDe, type AnotacaoCarregada } from './anotacao';
import { medirPasta, type ImagemParaMedir } from './medir-pasta';
import { ehTiff } from '../../lib/image-crop';
import { decodificarTiff } from '../../lib/tiff';
import { agregarPorClasse } from '../../lib/perfil-medido';
import { usePerfisMedidos } from '../../hooks/usePerfisMedidos';
import { baixarArquivo, nomeDeExportacao } from '../../lib/download';

/** Formatos em que se conhece a classe de CADA IMAGEM sem abrir o contorno — é o que "Medir esta pasta" precisa. */
const FORMATOS_COM_CLASSE_POR_IMAGEM: FormatoDeDataset[] = ['roboflow-multiclass', 'pasta-por-classe'];

/** Mesmo rótulo usado por `agruparPorConjunto` para imagens soltas na raiz da pasta. */
const NOME_DA_RAIZ = '(raiz)';

const POR_PAGINA = 48;
/** Acima disso, o cache de miniaturas descarta a mais antiga — 300 bitmaps de 160px cabem sem pesar a aba. */
const CACHE_MAXIMO = 300;

const DESCRICAO_DO_FORMATO: Record<FormatoDeDataset, string> = {
  yolo: 'YOLO — caixa ou polígono',
  'roboflow-multiclass': 'Multiclasse (CSV)',
  'mascara-de-instancia': 'Máscara de instância',
  'mascara-binaria': 'Máscara binária',
  'pasta-por-classe': 'Pasta por classe',
  solto: 'Solto (sem anotação)',
};

/** Um conjunto já reconhecido, pronto para listar e navegar. */
interface ConjuntoReconhecido {
  nome: string;
  reconhecido: DatasetReconhecido;
}

function caminhoCompleto(nomeDoConjunto: string, relativo: string): string {
  return nomeDoConjunto === NOME_DA_RAIZ ? relativo : `${nomeDoConjunto}/${relativo}`;
}

/** Tira o prefixo do conjunto dos caminhos, para `reconhecerFormato` (B1) receber caminhos relativos à raiz DO CONJUNTO. */
function relativizar(conjunto: ConjuntoDeArquivos): string[] {
  if (conjunto.nome === NOME_DA_RAIZ) return conjunto.caminhos;
  const prefixo = `${conjunto.nome}/`;
  return conjunto.caminhos.map((c) => (c.startsWith(prefixo) ? c.slice(prefixo.length) : c));
}

export interface DatasetsPanelProps {
  pastaAberta: PastaAberta | null;
  onPastaAberta: (pasta: PastaAberta | null) => void;
  /**
   * Carregar a IMAGEM (primeiro gesto). `anotacao` já vem lida - o painel é
   * quem sabe montar o mapa de arquivos do conjunto e decodificar a imagem
   * para saber largura/altura, que o parser YOLO precisa para desnormalizar.
   * `conjunto`/`caminho` alimentam `Metadata.dataset` no App.
   */
  onCarregar: (
    arquivo: ArquivoDoDataset,
    anotacao: AnotacaoCarregada | null,
    conjunto: string,
    caminho: string
  ) => void;
  onAdicionarAFila?: (arquivos: ArquivoDoDataset[]) => void;
}

export function DatasetsPanel({ pastaAberta, onPastaAberta, onCarregar, onAdicionarAFila }: DatasetsPanelProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [conjuntoSelecionado, setConjuntoSelecionado] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [classeFiltro, setClasseFiltro] = useState<string>('');
  const [carregandoImagem, setCarregandoImagem] = useState<string | null>(null);

  // --- Medir esta pasta (B4) --------------------------------------------------
  const { perfis: perfisMedidos, gravar: gravarPerfis } = usePerfisMedidos(conjuntoSelecionado ?? undefined);
  const [medindo, setMedindo] = useState(false);
  const [progressoMedicao, setProgressoMedicao] = useState<{ feito: number; total: number } | null>(null);
  /**
   * O que a última medição produziu. Existe porque o painel ficava MUDO
   * quando nenhuma foto podia ser medida: a pessoa clicava, a barra corria,
   * e não aparecia tabela nem explicação — parecia que o botão não fez nada.
   */
  const [resultadoDaMedicao, setResultadoDaMedicao] = useState<{ medidas: number; descartadas: number } | null>(null);
  const canceladoRef = useRef(false);

  const handleAbrirPasta = useCallback(async () => {
    setErro(null);
    if (suportaHandles()) {
      setAbrindo(true);
      try {
        const pasta = await abrirPastaComHandle();
        if (pasta) onPastaAberta(pasta);
      } catch {
        setErro('Não foi possível abrir a pasta.');
      } finally {
        setAbrindo(false);
      }
    } else {
      inputRef.current?.click();
    }
  }, [onPastaAberta]);

  const handleReabrirUltima = useCallback(async () => {
    setErro(null);
    setAbrindo(true);
    try {
      const pasta = await reabrirUltimaPasta();
      if (pasta) {
        onPastaAberta(pasta);
      } else {
        setErro('Nenhuma pasta lembrada, ou a permissão não foi concedida de novo.');
      }
    } finally {
      setAbrindo(false);
    }
  }, [onPastaAberta]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onPastaAberta(abrirPastaComInput(files));
      }
      e.target.value = '';
    },
    [onPastaAberta]
  );

  // --- Conjuntos reconhecidos ------------------------------------------------

  const conjuntosReconhecidos = useMemo<ConjuntoReconhecido[]>(() => {
    if (!pastaAberta) return [];
    return pastaAberta.conjuntos.map((c) => ({
      nome: c.nome,
      reconhecido: reconhecerFormato(relativizar(c)),
    }));
  }, [pastaAberta]);

  const arquivosPorCaminho = useMemo(() => {
    const mapa = new Map<string, ArquivoDoDataset>();
    if (pastaAberta) for (const a of pastaAberta.arquivos) mapa.set(a.caminho, a);
    return mapa;
  }, [pastaAberta]);

  const conjuntoAtual = conjuntosReconhecidos.find((c) => c.nome === conjuntoSelecionado) ?? null;

  /** Arquivos do conjunto atual, indexados pelo caminho relativo AO CONJUNTO — o vocabulário de `lerAnotacaoDe`. */
  const arquivosDoConjunto = useMemo(() => {
    const mapa = new Map<string, ArquivoDoDataset>();
    if (!conjuntoAtual) return mapa;
    const todos = [...conjuntoAtual.reconhecido.imagens, ...conjuntoAtual.reconhecido.anotacao];
    for (const relativo of todos) {
      const arquivo = arquivosPorCaminho.get(caminhoCompleto(conjuntoAtual.nome, relativo));
      if (arquivo) mapa.set(relativo, arquivo);
    }
    return mapa;
  }, [conjuntoAtual, arquivosPorCaminho]);

  // --- Classes por imagem, quando é barato saber sem abrir cada arquivo -----
  // yolo fica de fora: a classe é POR POLÍGONO, não por imagem, e só se sabe
  // lendo o .txt de cada uma — não vale a pena para filtrar uma lista antes
  // de a pessoa escolher o que abrir. Multiclasse e pasta-por-classe já
  // declaram a classe por imagem sem esse custo.
  const [classesPorImagem, setClassesPorImagem] = useState<Map<string, string[]> | null>(null);

  useEffect(() => {
    setPagina(0);
    setClasseFiltro('');
    setClassesPorImagem(null);
    if (!conjuntoAtual) return;

    const { formato, imagens, anotacao, classes } = conjuntoAtual.reconhecido;
    if (formato === 'pasta-por-classe') {
      const mapa = new Map<string, string[]>();
      for (const img of imagens) {
        const barra = img.indexOf('/');
        if (barra !== -1) mapa.set(img, [img.slice(0, barra)]);
      }
      setClassesPorImagem(mapa);
      return;
    }

    if (formato === 'roboflow-multiclass') {
      let cancelado = false;
      (async () => {
        const mapa = new Map<string, string[]>();
        for (const caminhoCsv of anotacao) {
          const arquivo = arquivosDoConjunto.get(caminhoCsv);
          if (!arquivo) continue;
          try {
            const texto = await (await arquivo.obterFile()).text();
            const { porImagem } = lerClassesCsv(texto);
            const dir = caminhoCsv.includes('/') ? caminhoCsv.slice(0, caminhoCsv.lastIndexOf('/') + 1) : '';
            for (const [nomeArquivo, cs] of porImagem) mapa.set(`${dir}${nomeArquivo}`, cs);
          } catch {
            // CSV ilegível: essa parte do conjunto fica sem filtro, sem travar o resto.
          }
        }
        if (!cancelado) setClassesPorImagem(mapa);
      })();
      return () => {
        cancelado = true;
      };
    }

    if (classes.length > 0) {
      // Formato futuro que já declara `classes` mas ainda não `classesPorImagem` aqui — sem filtro, só listagem.
      setClassesPorImagem(null);
    }
  }, [conjuntoAtual, arquivosDoConjunto]);

  const classesDisponiveis = useMemo(() => {
    if (!classesPorImagem) return [];
    const s = new Set<string>();
    for (const cs of classesPorImagem.values()) for (const c of cs) s.add(c);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [classesPorImagem]);

  const imagensFiltradas = useMemo(() => {
    if (!conjuntoAtual) return [];
    const { imagens } = conjuntoAtual.reconhecido;
    if (!classeFiltro || !classesPorImagem) return imagens;
    return imagens.filter((img) => classesPorImagem.get(img)?.includes(classeFiltro));
  }, [conjuntoAtual, classeFiltro, classesPorImagem]);

  const totalPaginas = Math.max(1, Math.ceil(imagensFiltradas.length / POR_PAGINA));
  const imagensDaPagina = imagensFiltradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const podeMedir =
    !!conjuntoAtual && FORMATOS_COM_CLASSE_POR_IMAGEM.includes(conjuntoAtual.reconhecido.formato);

  /**
   * "Medir esta pasta": roda a onda em TODAS as imagens do conjunto (não só a
   * página atual) e agrega por classe. `classesPorImagem` já resolve a classe
   * sem reabrir cada CSV — o mesmo mapa que alimenta o filtro acima.
   */
  const handleMedirPasta = useCallback(async () => {
    if (!conjuntoAtual || !classesPorImagem) return;
    const { imagens } = conjuntoAtual.reconhecido;

    const paraMedir: ImagemParaMedir[] = [];
    for (const relativo of imagens) {
      const arquivo = arquivosDoConjunto.get(relativo);
      if (!arquivo) continue;
      const cs = classesPorImagem.get(relativo) ?? [];
      const classe = cs.length === 0 ? '(sem classe)' : cs.join(' + ');
      paraMedir.push({ caminho: relativo, classe, arquivo });
    }
    if (paraMedir.length === 0) return;

    canceladoRef.current = false;
    setMedindo(true);
    setProgressoMedicao({ feito: 0, total: paraMedir.length });
    setErro(null);
    try {
      const resultado = await medirPasta(paraMedir, {
        cancelado: () => canceladoRef.current,
        progresso: (feito, total) => setProgressoMedicao({ feito, total }),
      });
      setResultadoDaMedicao({ medidas: resultado.medidas.length, descartadas: resultado.descartadas });
      const porClasse = agregarPorClasse(resultado.medidas);
      const paraGravar = new Map(
        [...porClasse].map(([classe, perfil]) => [classe, { perfil, descartadas: resultado.descartadas }])
      );
      await gravarPerfis(conjuntoAtual.nome, paraGravar);
    } catch {
      setErro('Não foi possível medir a pasta.');
    } finally {
      setMedindo(false);
      setProgressoMedicao(null);
    }
  }, [conjuntoAtual, classesPorImagem, arquivosDoConjunto, gravarPerfis]);

  const handleExportarCsv = useCallback(() => {
    if (!conjuntoAtual || perfisMedidos.length === 0) return;
    const sep = ';';
    const linhas = [...perfisMedidos]
      .sort((a, b) => a.classe.localeCompare(b.classe))
      .map((p) => {
        const perfil = p.perfil;
        return [
          p.classe,
          perfil.n,
          perfil.insuficiente ? 'sim' : 'nao',
          p.descartadas,
          perfil.areaPx.mediana.toFixed(1),
          perfil.areaPx.p5.toFixed(1),
          perfil.areaPx.p95.toFixed(1),
          perfil.feretMaxPx.mediana.toFixed(2),
          perfil.feretMinPx.mediana.toFixed(2),
          perfil.solidez.mediana.toFixed(3),
          perfil.razaoDeAspecto.mediana.toFixed(3),
          new Date(p.medidoEm).toISOString(),
        ].join(sep);
      });
    const cabecalho = [
      'classe',
      'n',
      'insuficiente',
      'descartadas',
      'area_px2_mediana',
      'area_px2_p5',
      'area_px2_p95',
      'feret_max_px_mediana',
      'feret_min_px_mediana',
      'solidez_mediana',
      'razao_aspecto_mediana',
      'medido_em',
    ].join(sep);
    // BOM para o Excel reconhecer acentuação — mesmo padrão de measurements.ts.
    const csv = '﻿' + [cabecalho, ...linhas].join('\r\n');
    baixarArquivo(csv, nomeDeExportacao({ arquivo: conjuntoAtual.nome, tipo: 'perfil-medido' }, 'csv'), 'text/csv');
  }, [conjuntoAtual, perfisMedidos]);

  // --- Miniaturas -------------------------------------------------------------

  const [, forcarRender] = useState(0);
  const cacheRef = useRef<Map<string, ImageBitmap>>(new Map());

  useEffect(() => {
    let cancelado = false;
    (async () => {
      for (const relativo of imagensDaPagina) {
        if (cancelado) return;
        if (cacheRef.current.has(relativo)) continue;
        const arquivo = arquivosDoConjunto.get(relativo);
        if (!arquivo) continue;
        try {
          const file = await arquivo.obterFile();
          let bitmap: ImageBitmap;
          if (ehTiff(file)) {
            const buffer = await file.arrayBuffer();
            const dec = decodificarTiff(buffer, 0);
            if (!dec) throw new Error('TIFF incompatível');
            const canvas = document.createElement('canvas');
            canvas.width = dec.width;
            canvas.height = dec.height;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.putImageData(new ImageData(dec.rgba, dec.width, dec.height), 0, 0);
            const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(), 'image/png'));
            bitmap = await createImageBitmap(blob, { resizeWidth: 160 });
          } else {
            bitmap = await createImageBitmap(file, { resizeWidth: 160 });
          }
          if (cancelado) {
            bitmap.close();
            return;
          }
          const cache = cacheRef.current;
          cache.set(relativo, bitmap);
          if (cache.size > CACHE_MAXIMO) {
            const maisAntiga = cache.keys().next().value;
            if (maisAntiga !== undefined) {
              cache.get(maisAntiga)?.close();
              cache.delete(maisAntiga);
            }
          }
          forcarRender((n) => n + 1);
        } catch {
          // Uma miniatura que falha (arquivo corrompido, TIFF que o navegador não decodifica) não trava a página.
        }
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagensDaPagina.join('|'), arquivosDoConjunto]);

  // --- Carregar imagem + anotação ---------------------------------------------

  // Múltipla seleção com Ctrl/Shift+Click
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Limpa selecionados ao trocar de conjunto
  useEffect(() => {
    setSelecionados(new Set());
  }, [conjuntoSelecionado]);

  const handleClicarMiniatura = useCallback(
    async (relativo: string, event?: React.MouseEvent) => {
      if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
        setSelecionados(prev => {
          const next = new Set(prev);
          if (next.has(relativo)) next.delete(relativo);
          else next.add(relativo);
          return next;
        });
        return;
      }
      
      if (!conjuntoAtual) return;
      const arquivo = arquivosDoConjunto.get(relativo);
      if (!arquivo) return;
      setCarregandoImagem(relativo);
      try {
        const file = await arquivo.obterFile();
        let bitmapCompleto: ImageBitmap;
        
        if (ehTiff(file)) {
          const buffer = await file.arrayBuffer();
          const dec = decodificarTiff(buffer, 0);
          if (!dec) throw new Error('TIFF incompatível');
          const canvas = document.createElement('canvas');
          canvas.width = dec.width;
          canvas.height = dec.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Sem ctx');
          ctx.putImageData(new ImageData(dec.rgba, dec.width, dec.height), 0, 0);
          const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(), 'image/png'));
          bitmapCompleto = await createImageBitmap(blob);
        } else {
          // Dimensões REAIS (não as da miniatura reduzida) — o parser YOLO
          // desnormaliza coordenadas 0..1 com base no tamanho de verdade.
          bitmapCompleto = await createImageBitmap(file);
        }

        const { width, height } = bitmapCompleto;
        bitmapCompleto.close();
        const anotacao = await lerAnotacaoDe(arquivosDoConjunto, conjuntoAtual.reconhecido, relativo, width, height);
        onCarregar(arquivo, anotacao, conjuntoAtual.nome, relativo);
      } catch {
        setErro(`Não foi possível abrir "${relativo}".`);
      } finally {
        setCarregandoImagem(null);
      }
    },
    [conjuntoAtual, arquivosDoConjunto, onCarregar]
  );

  // --- Render -------------------------------------------------------------

  if (!pastaAberta) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-xs text-ink-3 leading-snug">
          Abra uma pasta de datasets (local, no seu disco) para navegar pelos conjuntos e carregar uma imagem com a
          anotação como referência.
        </p>
        <button
          onClick={handleAbrirPasta}
          disabled={abrindo}
          className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-surface-3 rounded-xl border border-line hover:border-accent transition-all text-ink-2 hover:text-ink-1 font-bold group disabled:opacity-50"
        >
          <FolderOpen size={17} className="text-ink-3 group-hover:text-accent transition-colors" />
          <span className="text-xs uppercase tracking-wide">
            {abrindo ? 'Abrindo…' : suportaHandles() ? 'Abrir pasta de datasets…' : 'Escolher pasta (arquivos)…'}
          </span>
        </button>
        {suportaHandles() && (
          <button
            onClick={handleReabrirUltima}
            disabled={abrindo}
            className="w-full flex items-center gap-2 px-3 py-2 text-ink-3 hover:text-ink-1 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} />
            Reabrir última pasta
          </button>
        )}
        {/* Fallback sem File System Access API (Firefox, Safari): não lembra a pasta entre sessões. */}
        <input
          ref={inputRef}
          type="file"
          // @ts-expect-error -- webkitdirectory não está no lib.dom.d.ts, mas todo navegador com fallback o suporta.
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        {erro && <p className="text-[11px] text-red-500 dark:text-red-400">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink-2 truncate" title={pastaAberta.nome}>
          {pastaAberta.nome}
        </span>
        <button
          onClick={() => {
            onPastaAberta(null);
            setConjuntoSelecionado(null);
          }}
          className="text-[10px] font-bold uppercase tracking-wide text-ink-3 hover:text-ink-1 transition-colors shrink-0"
        >
          Trocar pasta
        </button>
      </div>
      {pastaAberta.origem === 'input' && (
        <p className="text-[10px] text-ink-3 leading-snug">
          Aberta por seleção de arquivos — este navegador não lembra a pasta; da próxima vez será preciso escolher de
          novo.
        </p>
      )}
      {erro && <p className="text-[11px] text-red-500 dark:text-red-400">{erro}</p>}

      {!conjuntoAtual ? (
        <ul className="flex flex-col gap-1.5">
          {conjuntosReconhecidos.map((c) => (
            <li key={c.nome}>
              <button
                onClick={() => setConjuntoSelecionado(c.nome)}
                className="w-full text-left px-3 py-2.5 rounded-control border border-line bg-surface-2 hover:border-accent hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink-1 truncate">{c.nome}</span>
                  <span className="text-[10px] text-ink-3 shrink-0">{c.reconhecido.imagens.length} imgs</span>
                </div>
                <div className="text-[10px] text-ink-3 mt-0.5">{DESCRICAO_DO_FORMATO[c.reconhecido.formato]}</div>
              </button>
            </li>
          ))}
          {conjuntosReconhecidos.length === 0 && (
            <li className="text-xs text-ink-3 text-center py-4">Pasta vazia, ou sem imagem reconhecível.</li>
          )}
        </ul>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConjuntoSelecionado(null)}
              className="p-1 rounded text-ink-3 hover:text-ink-1 hover:bg-surface-2 transition-colors shrink-0"
              title="Voltar aos conjuntos"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="text-xs font-bold text-ink-1 truncate">{conjuntoAtual.nome}</div>
              <div className="text-[10px] text-ink-3">{DESCRICAO_DO_FORMATO[conjuntoAtual.reconhecido.formato]}</div>
            </div>
          </div>

          {classesDisponiveis.length > 0 && (
            <select
              value={classeFiltro}
              onChange={(e) => {
                setClasseFiltro(e.target.value);
                setPagina(0);
              }}
              className="w-full text-[11px] rounded-control border border-line bg-surface-2 text-ink-2 px-2 py-1.5"
            >
              <option value="">Todas as classes ({conjuntoAtual.reconhecido.imagens.length})</option>
              {classesDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {podeMedir && (
            <div className="flex flex-col gap-1.5 rounded-control border border-line bg-surface-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-ink-2 flex items-center gap-1.5">
                  <Ruler size={13} className="text-accent" />
                  Perfil morfométrico medido
                </span>
                {medindo ? (
                  <button
                    onClick={() => {
                      canceladoRef.current = true;
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-500 hover:text-red-600 transition-colors"
                  >
                    <Square size={11} />
                    Parar
                  </button>
                ) : (
                  <button
                    onClick={handleMedirPasta}
                    disabled={!classesPorImagem}
                    className="text-[10px] font-bold uppercase tracking-wide text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
                  >
                    Medir esta pasta
                  </button>
                )}
              </div>

              {/* O que o botão faz — e o que ele NÃO faz. A confusão registrada
                  em 16/09: a pessoa clicou esperando ver marcações no canvas. */}
              {!medindo && (
                <p className="text-[10px] leading-snug text-ink-3">
                  Mede cada foto da pasta com a nossa segmentação e monta o perfil por classe. Não marca
                  nada no canvas nem altera a imagem aberta — o perfil aparece aqui e, ao inspecionar uma
                  semente dessa classe, como “Referência (medida)”.
                </p>
              )}

              {/* O desfecho, sempre — inclusive quando nada pôde ser medido. */}
              {!medindo && resultadoDaMedicao && (
                <p
                  className={`text-[10px] font-semibold ${
                    resultadoDaMedicao.medidas === 0 ? 'text-amber-700 dark:text-amber-400' : 'text-ink-2'
                  }`}
                >
                  {resultadoDaMedicao.medidas === 0
                    ? `Nenhuma das ${resultadoDaMedicao.descartadas} fotos pôde ser medida — a segmentação não fechou um contorno utilizável nelas. Confira se a pasta é de fotos de UMA semente por imagem.`
                    : `${resultadoDaMedicao.medidas} fotos medidas${
                        resultadoDaMedicao.descartadas > 0 ? ` · ${resultadoDaMedicao.descartadas} descartadas` : ''
                      }.`}
                </p>
              )}

              {medindo && progressoMedicao && (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-1">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{
                        width: `${Math.round((progressoMedicao.feito / Math.max(1, progressoMedicao.total)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-ink-3">
                    {progressoMedicao.feito} / {progressoMedicao.total} fotos
                  </span>
                </div>
              )}

              {!medindo && perfisMedidos.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="text-ink-3 text-left">
                          <th className="pr-2 py-1 font-bold">Classe</th>
                          <th className="pr-2 py-1 font-bold text-right">n</th>
                          <th className="pr-2 py-1 font-bold text-right">Área (mediana)</th>
                          <th className="pr-2 py-1 font-bold text-right">Feret máx.</th>
                          <th className="pr-2 py-1 font-bold text-right">Solidez</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...perfisMedidos]
                          .sort((a, b) => a.classe.localeCompare(b.classe))
                          .map((p) => (
                            <tr key={p.classe} className="border-t border-line">
                              <td className="pr-2 py-1 text-ink-1 truncate max-w-[7rem]" title={p.classe}>
                                {p.classe}
                                {p.perfil.insuficiente && (
                                  <span className="text-ink-3" title="Amostra pequena (n < 20)">
                                    {' '}
                                    *
                                  </span>
                                )}
                              </td>
                              <td className="pr-2 py-1 text-ink-2 text-right">{p.perfil.n}</td>
                              <td className="pr-2 py-1 text-ink-2 text-right">
                                {p.perfil.areaPx.mediana.toFixed(0)} px²
                              </td>
                              <td className="pr-2 py-1 text-ink-2 text-right">
                                {p.perfil.feretMaxPx.mediana.toFixed(1)} px
                              </td>
                              <td className="pr-2 py-1 text-ink-2 text-right">
                                {(p.perfil.solidez.mediana * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-ink-3">
                    * amostra pequena (n &lt; 20) — faixa como referência, não decide nada sozinha.
                  </p>
                  <button
                    onClick={handleExportarCsv}
                    className="self-start flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-2 hover:text-ink-1 transition-colors"
                  >
                    <Download size={12} />
                    Exportar CSV
                  </button>
                </>
              )}
            </div>
          )}

          {imagensFiltradas.length === 0 ? (
            <div className="text-xs text-ink-3 text-center py-6 flex flex-col items-center gap-2">
              <ImageOff size={20} />
              Nenhuma imagem reconhecida como &ldquo;de trabalho&rdquo; neste conjunto.
            </div>
          ) : (
            <>
              {selecionados.size > 0 && onAdicionarAFila && (
                <div className="flex items-center justify-between bg-surface-2 p-2 rounded border border-accent">
                  <span className="text-[10px] font-bold text-accent">{selecionados.size} selecionadas</span>
                  <button
                    onClick={async () => {
                      const arquivos = Array.from(selecionados).map(rel => arquivosDoConjunto.get(rel)).filter(Boolean) as any[];
                      onAdicionarAFila(arquivos);
                      setSelecionados(new Set());
                    }}
                    className="text-[10px] font-bold uppercase tracking-wide bg-accent text-accent-on px-2 py-1 rounded hover:bg-accent/90 transition-colors"
                  >
                    Adicionar à Fila
                  </button>
                </div>
              )}
              
              <div className="grid grid-cols-4 gap-1.5">
                {imagensDaPagina.map((relativo) => {
                  const bitmap = cacheRef.current.get(relativo);
                  const isSelecionado = selecionados.has(relativo);
                  return (
                    <button
                      key={relativo}
                      onClick={(e) => handleClicarMiniatura(relativo, e)}
                      disabled={carregandoImagem === relativo}
                      title={relativo}
                      aria-label={`Carregar ${relativo}`}
                      className={`aspect-square rounded-control overflow-hidden border ${isSelecionado ? 'border-accent ring-2 ring-accent/30' : 'border-line'} bg-surface-2 hover:border-accent transition-colors disabled:opacity-50 flex items-center justify-center`}
                    >
                      {bitmap ? (
                        <MiniaturaBitmap bitmap={bitmap} />
                      ) : (
                        <span className="text-ink-3 text-[9px]">
                          {carregandoImagem === relativo ? '…' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-ink-3">
                <button
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  disabled={pagina === 0}
                  className="p-1 rounded hover:bg-surface-2 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>
                  Página {pagina + 1} de {totalPaginas} — {imagensFiltradas.length} imagens
                </span>
                <button
                  onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                  disabled={pagina >= totalPaginas - 1}
                  className="p-1 rounded hover:bg-surface-2 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Desenha um `ImageBitmap` já decodificado num canvas — é a forma de exibir um ImageBitmap sem re-decodificar como <img>. */
function MiniaturaBitmap({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(bitmap, 0, 0);
  }, [bitmap]);
  return <canvas ref={ref} className="w-full h-full object-cover" />;
}
