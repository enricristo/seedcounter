// =============================================================================
// SeedCounter — LotePanel (Task C1)
//
// "A mesma receita em várias imagens": escolher a fonte (fila já carregada,
// regiões da digitalização atual, ou uma pasta do explorador), escolher a
// receita, rodar, conferir a tabela, e só então aceitar — imagem a imagem ou
// todas de uma vez. NADA entra como sessão sem esse aceite explícito: rodar
// só preenche a tabela, exatamente como o ensaio ao carregar só preenche
// cartões até "Usar esta".
//
// Aceitar grava UMA SESSÃO POR IMAGEM (Dexie, `db.sessions`), com
// `metadata.receita = { id, parametros }` — é isso que torna o lote
// auditável e repetível (spec C1): outra pessoa, ou você mais tarde, sabe
// exatamente que parâmetros produziram aquela contagem.
//
// CUIDADO DE MEMÓRIA: o `File` de cada imagem só é aberto duas vezes — uma em
// `processarImagemDoLote` (que fecha o bitmap antes de devolver) e, se a
// pessoa aceitar, de novo aqui, só para AQUELA imagem, para montar a
// miniatura da sessão. Nunca há mais de uma imagem decodificada por vez, e as
// regiões da digitalização atual são recortadas sob demanda (`obterFile`
// preguiçoso) — não de uma vez ao montar a lista.
// =============================================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import { Layers, Play, Square, Download, Check, CheckCheck, Loader2, AlertTriangle } from 'lucide-react';
import { executarLote, type ItemDoLote, type ResultadoDeUmaImagem } from './lote';
import { processarImagemDoLote } from './processar-imagem';
import { RECEITAS, receitaDeSalva, type Receita, type ContornoProposto } from '../ensaio/receitas';
import { useReceitasSalvas } from '../../hooks/useReceitasSalvas';
import { calcularGrade, gradeParaTotal, recortarRetangulo, nomeDaPeca, type Retangulo } from '../../lib/image-crop';
import { calculateSeedDimensions } from '../../lib/pca-utils';
import { baixarArquivo, nomeDeExportacao } from '../../lib/download';
import type { ArquivoDoDataset, PastaAberta } from '../datasets/fonte';
import type { Session, Metadata, YoloSegmentation } from '../../types';

type Fonte = 'fila' | 'regioes' | 'pasta';

interface LotePanelProps {
  /** A fila já carregada (`useImageQueue.imageQueue`). */
  imageQueue: File[];
  /** A imagem aberta agora, para a fonte "regiões da digitalização atual". */
  imagemAtual: HTMLImageElement | null;
  nomeDaImagemAtual: string;
  /** A pasta aberta no explorador de datasets (B2/B3), se houver. */
  pastaAberta: PastaAberta | null;
  /** A receita carregada no painel Encontrar (C5), quando há uma. */
  receitaAtiva: Receita | null;
  /** Espécie/cultura declarada — filtra as receitas salvas, como no ensaio. */
  especie?: string;
  /** Metadados da bancada atual — servem de base para cada sessão gravada (pesquisador, projeto…). */
  metadataBase: Metadata;
  /** Grava uma sessão no Dexie (mesma função de `useSessions`). */
  addSession: (session: Session) => Promise<void>;
}

const EXTENSOES_DE_IMAGEM = /\.(png|jpe?g|tiff?|bmp|webp)$/i;

/** Reconstrói `File[]` a partir da fila já carregada — nada para abrir aqui. */
function itensDaFila(imageQueue: File[]): ItemDoLote[] {
  return imageQueue.map((file, i) => ({
    id: `fila-${i}-${file.name}`,
    rotulo: file.name,
    obterFile: () => Promise.resolve(file),
  }));
}

/** Todo arquivo de imagem da pasta aberta — o filtro por conjunto fica para uma próxima rodada. */
function itensDaPasta(arquivos: ArquivoDoDataset[]): ItemDoLote[] {
  return arquivos
    .filter((a) => EXTENSOES_DE_IMAGEM.test(a.caminho))
    .map((a) => ({ id: a.caminho, rotulo: a.caminho, obterFile: a.obterFile }));
}

/**
 * Divide a digitalização atual em `pedacos` pela mesma aritmética do
 * divisor (`SplitModal`/`gradeParaTotal`). O recorte em si só acontece
 * quando `obterFile()` é chamado — preguiçoso, como os outros dois.
 */
function itensDasRegioes(image: HTMLImageElement, nomeBase: string, pedacos: number): ItemDoLote[] {
  const regiao: Retangulo = { x: 0, y: 0, w: image.width, h: image.height };
  const grade = gradeParaTotal(regiao, pedacos);
  const pecas = calcularGrade(regiao, grade.colunas, grade.linhas);
  return pecas.map((peca, i) => {
    const rotulo = nomeDaPeca(nomeBase || 'digitalizacao', peca);
    return {
      id: `regiao-${i}`,
      rotulo,
      obterFile: () => recortarRetangulo(image, peca.retangulo, rotulo),
    };
  });
}

/**
 * Igual a `propostosParaSegmentacoes` (App.tsx): todo contorno proposto pela
 * receita vira um contorno 'viable'/'modelo' — a onda não distingue viável de
 * inviável, e não há marcação manual correspondente (é lote, ninguém clicou).
 * Duplicado aqui de propósito: é pequeno e puro, e App.tsx não pode ser
 * importado por uma feature (ciclo).
 */
function propostosParaSegmentacoes(propostos: ContornoProposto[]): YoloSegmentation[] {
  return propostos.map((p, i) => {
    const { width, height } = calculateSeedDimensions(p.contorno);
    return {
      id: Date.now() + i,
      category: 'viable' as const,
      class_name: 'viavel',
      confidence: 1,
      polygon_points: p.contorno,
      visible: true,
      width,
      height,
      origem: 'modelo' as const,
    };
  });
}

function formatoCsv(v: number | string): string {
  if (typeof v === 'number') return String(v).replace('.', ',');
  return v.includes(';') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
}

function gerarCsv(resultados: ResultadoDeUmaImagem[]): string {
  const cabecalho = ['imagem', 'contagem', 'viaveis', 'inviaveis', 'suspeitos', 'escapes', 'duracao_ms', 'erro'];
  const linhas = resultados.map((r) =>
    [r.rotulo, r.contagem, r.viaveis, r.inviaveis, r.suspeitos, r.escapes, Math.round(r.duracaoMs), r.erro ?? '']
      .map(formatoCsv)
      .join(';')
  );
  return [cabecalho.join(';'), ...linhas].join('\r\n');
}

const rotuloDaFonte: Record<Fonte, string> = {
  fila: 'Fila de imagens',
  regioes: 'Regiões da digitalização atual',
  pasta: 'Pasta do explorador',
};

export function LotePanel({
  imageQueue,
  imagemAtual,
  nomeDaImagemAtual,
  pastaAberta,
  receitaAtiva,
  especie,
  metadataBase,
  addSession,
}: LotePanelProps) {
  const { receitas: receitasSalvas } = useReceitasSalvas(especie);

  const opcoesDeReceita = useMemo(() => {
    const salvas = receitasSalvas
      .filter((r): r is typeof r & { id: number } => r.id != null)
      .map(receitaDeSalva);
    const lista = [...RECEITAS, ...salvas];
    // "a que está no Encontrar" — só entra se ainda não está na lista (uma
    // fixa reaproveitada, ou uma salva já escolhida como ativa).
    if (receitaAtiva && !lista.some((r) => r.id === receitaAtiva.id)) {
      lista.push(receitaAtiva);
    }
    return lista;
  }, [receitasSalvas, receitaAtiva]);

  const [fonte, setFonte] = useState<Fonte>('fila');
  const [pedacosRegiao, setPedacosRegiao] = useState(12);
  const [receitaId, setReceitaId] = useState<string>(opcoesDeReceita[0]?.id ?? '');
  const receitaEscolhida = opcoesDeReceita.find((r) => r.id === receitaId) ?? opcoesDeReceita[0] ?? null;

  const [emAndamento, setEmAndamento] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoDeUmaImagem[]>([]);
  const [aceitos, setAceitos] = useState<Set<string>>(new Set());
  const [aceitando, setAceitando] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const pararRef = useRef(false);
  /** Item e propostos de cada imagem rodada nesta rodada — para o aceite ler depois. */
  const itensRef = useRef<Map<string, ItemDoLote>>(new Map());
  const propostosRef = useRef<Map<string, ContornoProposto[]>>(new Map());
  const receitaDaRodadaRef = useRef<Receita | null>(null);

  const itensDaFonteEscolhida = useCallback((): ItemDoLote[] | string => {
    if (fonte === 'fila') {
      if (imageQueue.length === 0) return 'A fila de imagens está vazia.';
      return itensDaFila(imageQueue);
    }
    if (fonte === 'regioes') {
      if (!imagemAtual) return 'Nenhuma imagem aberta para dividir em regiões.';
      return itensDasRegioes(imagemAtual, nomeDaImagemAtual, pedacosRegiao);
    }
    if (!pastaAberta || pastaAberta.arquivos.length === 0) return 'Nenhuma pasta aberta no explorador de datasets.';
    const itens = itensDaPasta(pastaAberta.arquivos);
    if (itens.length === 0) return 'A pasta aberta não tem imagens reconhecidas.';
    return itens;
  }, [fonte, imageQueue, imagemAtual, nomeDaImagemAtual, pedacosRegiao, pastaAberta]);

  const handleRodar = useCallback(async () => {
    if (!receitaEscolhida) {
      setErroGeral('Nenhuma receita disponível.');
      return;
    }
    const itens = itensDaFonteEscolhida();
    if (typeof itens === 'string') {
      setErroGeral(itens);
      return;
    }

    setErroGeral(null);
    setResultados([]);
    setAceitos(new Set());
    itensRef.current = new Map(itens.map((it) => [it.id, it]));
    propostosRef.current = new Map();
    receitaDaRodadaRef.current = receitaEscolhida;
    pararRef.current = false;
    setEmAndamento(true);
    setProgresso({ feito: 0, total: itens.length });

    const processar = async (item: ItemDoLote, receita: Receita): Promise<ResultadoDeUmaImagem> => {
      const { resultado, propostos } = await processarImagemDoLote(item, receita, {
        cancelado: () => pararRef.current,
      });
      if (propostos) propostosRef.current.set(item.id, propostos);
      return resultado;
    };

    const { resultados: obtidos } = await executarLote(itens, receitaEscolhida, processar, {
      cancelado: () => pararRef.current,
      progresso: (feito, total) => setProgresso({ feito, total }),
    });

    setResultados(obtidos);
    setEmAndamento(false);
  }, [receitaEscolhida, itensDaFonteEscolhida]);

  const handleParar = useCallback(() => {
    pararRef.current = true;
  }, []);

  /** Reabre o `File` desta imagem (só esta) e monta a sessão a partir dos contornos já propostos. */
  const construirSessao = useCallback(
    async (resultado: ResultadoDeUmaImagem): Promise<Session | null> => {
      const item = itensRef.current.get(resultado.id);
      const propostos = propostosRef.current.get(resultado.id);
      const receita = receitaDaRodadaRef.current;
      if (!item || !propostos || !receita) return null;

      const file = await item.obterFile();
      const bitmap = await createImageBitmap(file);
      let imageData: string | undefined;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          imageData = canvas.toDataURL('image/jpeg', 0.85);
        }
      } finally {
        bitmap.close();
      }

      const yoloSegmentations = propostosParaSegmentacoes(propostos);
      return {
        id: `${Date.now()}-${resultado.id}`,
        date: new Date().toISOString(),
        filename: resultado.rotulo,
        viableCount: resultado.viaveis,
        inviableCount: resultado.inviaveis,
        metadata: {
          ...metadataBase,
          receita: { id: receita.id, parametros: { localizacao: receita.localizacao, onda: receita.onda } },
        },
        marks: [],
        yoloSegmentations,
        imageData,
      };
    },
    [metadataBase]
  );

  const handleAceitar = useCallback(
    async (resultado: ResultadoDeUmaImagem) => {
      if (resultado.erro || aceitos.has(resultado.id)) return;
      setAceitando(resultado.id);
      try {
        const sessao = await construirSessao(resultado);
        if (sessao) {
          await addSession(sessao);
          setAceitos((prev) => new Set(prev).add(resultado.id));
        }
      } catch {
        setErroGeral(`Não foi possível gravar a sessão de "${resultado.rotulo}".`);
      } finally {
        setAceitando(null);
      }
    },
    [aceitos, construirSessao, addSession]
  );

  const handleAceitarTodas = useCallback(async () => {
    for (const r of resultados) {
      if (r.erro || aceitos.has(r.id)) continue;
      // eslint-disable-next-line no-await-in-loop -- sequencial de propósito: uma sessão por vez, mesmo espírito do laço do lote.
      await handleAceitar(r);
    }
  }, [resultados, aceitos, handleAceitar]);

  const handleExportarCsv = useCallback(() => {
    if (resultados.length === 0) return;
    const csv = gerarCsv(resultados);
    baixarArquivo(csv, nomeDeExportacao({ tipo: 'lote' }, 'csv'), 'text/csv;charset=utf-8;');
  }, [resultados]);

  const pendentesParaAceitar = resultados.some((r) => !r.erro && !aceitos.has(r.id));
  const fonteIndisponivel = (f: Fonte) => {
    if (f === 'fila') return imageQueue.length === 0;
    if (f === 'regioes') return !imagemAtual;
    return !pastaAberta || pastaAberta.arquivos.length === 0;
  };

  return (
    <section aria-label="Lote" className="flex flex-col gap-3">
      <div className="text-ink-2 flex items-center gap-2">
        <Layers size={14} className="text-accent" />
        <span className="text-xs font-bold tracking-wide uppercase">Lote</span>
      </div>
      <p className="text-ink-3 text-[10px] leading-snug">
        Uma receita, várias imagens. Rodar só preenche a tabela — nada vira sessão sem você aceitar,
        imagem a imagem ou todas de uma vez. O lote não marca a imagem que está aberta no canvas: cada
        resultado aceito vira uma sessão própria, que você abre pelo histórico.
      </p>

      {/* Fonte */}
      <div className="flex flex-col gap-1.5">
        <span className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">Fonte</span>
        <div className="bg-surface-2 rounded-panel flex flex-col gap-0.5 p-0.5">
          {(['fila', 'regioes', 'pasta'] as Fonte[]).map((f) => (
            <button
              key={f}
              type="button"
              disabled={emAndamento}
              onClick={() => setFonte(f)}
              aria-pressed={fonte === f}
              className={`rounded-control flex items-center justify-between px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                fonte === f ? 'bg-accent text-accent-on' : 'text-ink-2 hover:bg-surface-3'
              }`}
            >
              <span>{rotuloDaFonte[f]}</span>
              {fonteIndisponivel(f) && <span className="text-[9px] opacity-70">indisponível</span>}
            </button>
          ))}
        </div>
        {fonte === 'regioes' && (
          <label className="flex items-center gap-2 text-[11px]">
            <span className="text-ink-3">Pedaços</span>
            <input
              type="number"
              min={2}
              max={144}
              value={pedacosRegiao}
              disabled={emAndamento}
              onChange={(e) => setPedacosRegiao(Math.max(2, Number(e.target.value) || 2))}
              className="rounded-control border-line bg-surface-1 text-ink-1 w-16 border px-2 py-1 text-center font-mono text-xs tabular-nums"
            />
          </label>
        )}
      </div>

      {/* Receita */}
      <div className="flex flex-col gap-1.5">
        <span className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">Receita</span>
        <select
          value={receitaId}
          disabled={emAndamento || opcoesDeReceita.length === 0}
          onChange={(e) => setReceitaId(e.target.value)}
          className="rounded-control border-line bg-surface-1 text-ink-1 border px-2 py-1.5 text-xs"
        >
          {opcoesDeReceita.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
        {receitaEscolhida && <p className="text-ink-3 text-[10px] leading-snug">{receitaEscolhida.quando}</p>}
      </div>

      {erroGeral && (
        <p className="border-line bg-surface-2 text-ink-2 flex items-start gap-1.5 rounded-lg border p-2 text-[11px]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
          {erroGeral}
        </p>
      )}

      {/* Rodar / Parar / progresso */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRodar}
          disabled={emAndamento || !receitaEscolhida}
          className="bg-accent hover:bg-accent-strong text-accent-on flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          {emAndamento ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Rodar
        </button>
        {emAndamento && (
          <button
            type="button"
            onClick={handleParar}
            className="border-line text-ink-2 hover:bg-surface-2 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
          >
            <Square size={12} /> Parar
          </button>
        )}
      </div>
      {progresso && (
        <div role="status" aria-live="polite" className="text-ink-3 text-[11px]">
          {emAndamento ? 'Processando' : 'Processado'} {progresso.feito}/{progresso.total}
        </div>
      )}

      {/* Tabela de resultados */}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="border-line overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-[10.5px]">
              <thead className="bg-surface-2 text-ink-3 uppercase tracking-wide">
                <tr>
                  <th className="px-2 py-1.5 font-bold">Imagem</th>
                  <th className="px-2 py-1.5 text-right font-bold">Contagem</th>
                  <th className="px-2 py-1.5 text-right font-bold">Viáveis</th>
                  <th className="px-2 py-1.5 text-right font-bold">Inviáveis</th>
                  <th className="px-2 py-1.5 text-right font-bold">Suspeitos</th>
                  <th className="px-2 py-1.5 text-right font-bold">Duração</th>
                  <th className="px-2 py-1.5 font-bold">Aceite</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {resultados.map((r) => {
                  const aceito = aceitos.has(r.id);
                  return (
                    <tr key={r.id} className={r.erro ? 'text-ink-3' : 'text-ink-1'}>
                      <td className="max-w-32 truncate px-2 py-1.5 font-mono" title={r.rotulo}>
                        {r.rotulo}
                      </td>
                      {r.erro ? (
                        <td colSpan={5} className="px-2 py-1.5 text-[10px] text-amber-600">
                          {r.erro}
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.contagem}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.viaveis}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.inviaveis}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.suspeitos}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                            {Math.round(r.duracaoMs)}ms
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5">
                        {r.erro ? (
                          <span className="text-ink-3">—</span>
                        ) : aceito ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Check size={12} /> aceita
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAceitar(r)}
                            disabled={aceitando === r.id}
                            className="border-line text-ink-2 hover:bg-surface-2 rounded px-2 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors disabled:opacity-50"
                          >
                            {aceitando === r.id ? '…' : 'Aceitar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportarCsv}
              className="border-line text-ink-2 hover:bg-surface-2 flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
            >
              <Download size={14} /> Exportar CSV
            </button>
            <button
              type="button"
              onClick={handleAceitarTodas}
              disabled={!pendentesParaAceitar}
              className="bg-accent hover:bg-accent-strong text-accent-on flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck size={14} /> Aceitar todas
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
