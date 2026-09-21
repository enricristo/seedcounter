// =============================================================================
// SeedCounter — LotePanel (Task C1 + "lote redondo")
//
// "A mesma receita em várias imagens": escolher a fonte (fila já carregada,
// regiões da digitalização atual, ou uma pasta do explorador), escolher a
// receita, rodar, conferir, e só então aceitar — imagem a imagem ou todas de
// uma vez. NADA entra como sessão sem esse aceite explícito: rodar só
// preenche a tabela, exatamente como o ensaio ao carregar só preenche
// cartões até "Usar esta".
//
// "Conferir antes de aceitar" sem nada para olhar é fé, não conferência —
// por isso cada linha tem uma miniatura com os contornos propostos por cima
// (clique abre a prévia grande), e a tabela vem com um resumo do lote inteiro
// acima dela (total, mediana por imagem, dispersão, erros, tempo). Antes de
// gravar, a linha é checada contra sessões já existentes com o mesmo nome de
// arquivo — se houver, a pessoa escolhe substituir, gravar assim mesmo ou
// pular; a ferramenta nunca decide isso sozinha, porque duas contagens da
// mesma placa em dias diferentes podem ser legítimas.
//
// O resultado do lote (números, contornos, miniaturas — nunca as imagens
// originais) vai para o Dexie (`db.lotes`, v10) a cada imagem concluída. Se a
// aba fecha no meio, o próximo "Lote" aberto oferece retomar o que sobrou ou
// descartar — ver `useLotes`.
//
// Aceitar grava UMA SESSÃO POR IMAGEM (Dexie, `db.sessions`), com
// `metadata.receita = { id, parametros }` — é isso que torna o lote
// auditável e repetível (spec C1): outra pessoa, ou você mais tarde, sabe
// exatamente que parâmetros produziram aquela contagem.
//
// CUIDADO DE MEMÓRIA: o `File` de cada imagem só é aberto duas vezes — uma em
// `processarImagemDoLote` (que fecha o bitmap antes de devolver) e, se a
// pessoa aceitar NA MESMA aba em que rodou, de novo aqui, só para AQUELA
// imagem, para montar a miniatura da sessão em melhor qualidade. Nunca há
// mais de uma imagem decodificada por vez. Ao aceitar um lote RETOMADO (após
// reabrir a aba), o `File` original não existe mais — a prévia com contornos
// já desenhada em `processar-imagem.ts` (`imagemGrande`) é reaproveitada como
// a miniatura da sessão, sem reabrir nada.
// =============================================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Layers,
  Play,
  Square,
  Download,
  Check,
  CheckCheck,
  Loader2,
  AlertTriangle,
  X,
  Copy,
  RotateCcw,
  History,
  Info,
} from 'lucide-react';
import { executarLote, type ItemDoLote, type ResultadoDeUmaImagem } from './lote';
import { processarImagemDoLote } from './processar-imagem';
import { resumirLote } from './resumo';
import { ehDuplicata } from './duplicata';
import { decodificarParaCanvas } from './abrir-imagem';
import { RECEITAS, receitaDeSalva, type Receita, type ContornoProposto } from '../ensaio/receitas';
import { useReceitasSalvas } from '../../hooks/useReceitasSalvas';
import { useLotes } from '../../hooks/useLotes';
import { useModalEscape } from '../../hooks/useModalEscape';
import { calcularGrade, gradeParaTotal, recortarRetangulo, nomeDaPeca, type Retangulo } from '../../lib/image-crop';
import { calculateSeedDimensions } from '../../lib/pca-utils';
import { baixarArquivo, nomeDeExportacao } from '../../lib/download';
import { registrarEvento } from '../../lib/diagnostico/trilha';
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
  /** Todas as sessões já gravadas — para a checagem de duplicata (item 3). */
  sessions: Session[];
  /** Grava uma sessão no Dexie (mesma função de `useSessions`). */
  addSession: (session: Session) => Promise<void>;
  /** Apaga uma sessão — usado quando a pessoa escolhe "substituir" numa duplicata. */
  deleteSession: (id: string) => Promise<void>;
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
    const cat = p.categoria || 'viable';
    return {
      id: Date.now() + i,
      category: cat,
      class_name: cat === 'viable' ? 'viavel' : 'inviavel',
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

/** Prévia grande de uma linha, aberta pelo clique na miniatura. Esc fecha. */
function ModalDaPreVia({ resultado, onClose }: { resultado: ResultadoDeUmaImagem | null; onClose: () => void }) {
  useModalEscape(!!resultado, onClose);
  if (!resultado) return null;
  const src = resultado.imagemGrande ?? resultado.miniatura;
  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Prévia de ${resultado.rotulo}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div onClick={(e) => e.stopPropagation()} className="relative max-h-[90vh] max-w-[90vw]">
        <img
          src={src}
          alt={`Contornos propostos para ${resultado.rotulo}`}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute -top-2 -right-2 rounded-full bg-black/80 p-1.5 text-white hover:bg-black"
        >
          <X size={16} />
        </button>
        <p className="mt-2 truncate text-center font-mono text-xs text-white/90">{resultado.rotulo}</p>
      </div>
    </div>
  );
}

/** Aviso de duplicata: a pessoa decide, a ferramenta não. Esc equivale a "pular". */
function AvisoDeDuplicata({
  resultado,
  duplicatas,
  onResolver,
}: {
  resultado: ResultadoDeUmaImagem;
  duplicatas: Session[];
  onResolver: (opcao: 'substituir' | 'gravar' | 'pular') => void;
}) {
  const fechar = useCallback(() => onResolver('pular'), [onResolver]);
  useModalEscape(true, fechar);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Nome de arquivo já contado antes"
      onClick={fechar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-1 border-line w-full max-w-sm rounded-lg border p-4 shadow-2xl"
      >
        <div className="text-ink-1 mb-2 flex items-center gap-2">
          <Copy size={14} className="text-amber-500" />
          <span className="text-xs font-bold">Já existe sessão com este nome</span>
        </div>
        <p className="text-ink-2 mb-3 text-[11px] leading-relaxed">
          &ldquo;{resultado.rotulo}&rdquo; já foi gravada antes ({duplicatas.length}{' '}
          {duplicatas.length === 1 ? 'vez' : 'vezes'}, a mais recente em{' '}
          {new Date(duplicatas[0].date).toLocaleString('pt-BR')}). Duas contagens da mesma placa em dias
          diferentes podem ser legítimas — escolha o que fazer.
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onResolver('substituir')}
            className="rounded-control border-line text-ink-1 hover:bg-surface-2 border px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide transition-colors"
          >
            Substituir a sessão existente
          </button>
          <button
            type="button"
            onClick={() => onResolver('gravar')}
            className="rounded-control border-line text-ink-1 hover:bg-surface-2 border px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide transition-colors"
          >
            Gravar assim mesmo (outra sessão)
          </button>
          <button
            type="button"
            onClick={() => onResolver('pular')}
            className="rounded-control text-ink-3 hover:bg-surface-2 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide transition-colors"
          >
            Pular esta imagem
          </button>
        </div>
      </div>
    </div>
  );
}

export function LotePanel({
  imageQueue,
  imagemAtual,
  nomeDaImagemAtual,
  pastaAberta,
  receitaAtiva,
  especie,
  metadataBase,
  sessions,
  addSession,
  deleteSession,
}: LotePanelProps) {
  const { receitas: receitasSalvas } = useReceitasSalvas(especie);
  const { pendente: lotePendente, criar: criarLote, salvarResultados, marcarAceito, descartar: descartarLote } =
    useLotes();

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
  const [repetindo, setRepetindo] = useState<Set<string>>(new Set());
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [previaAberta, setPreviaAberta] = useState<ResultadoDeUmaImagem | null>(null);
  const [duplicataPendente, setDuplicataPendente] = useState<{
    resultado: ResultadoDeUmaImagem;
    duplicatas: Session[];
  } | null>(null);

  const pararRef = useRef(false);
  /** Item e propostos de cada imagem rodada nesta rodada — para o aceite ler depois. Vazio num lote RETOMADO: o `File` original não sobreviveu a fechar a aba. */
  const itensRef = useRef<Map<string, ItemDoLote>>(new Map());
  const propostosRef = useRef<Map<string, ContornoProposto[]>>(new Map());
  const receitaDaRodadaRef = useRef<Receita | null>(null);
  /** Id do registro em `db.lotes` desta rodada — `null` até `criarLote`/`handleRetomar`. */
  const loteIdRef = useRef<number | null>(null);
  const criadoEmRef = useRef<number>(0);
  /** Espelha `resultados`, mas em ordem de conclusão — é o que grava no Dexie a cada imagem. */
  const resultadosAcumuladosRef = useRef<ResultadoDeUmaImagem[]>([]);

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

  /** Grava no Dexie o estado atual de `resultadosAcumuladosRef` (com os contornos) — chamado a cada imagem concluída e a cada repetição. */
  const persistir = useCallback(async () => {
    if (loteIdRef.current == null) return;
    await salvarResultados(
      loteIdRef.current,
      resultadosAcumuladosRef.current.map((r) => ({ ...r, propostos: propostosRef.current.get(r.id) }))
    );
  }, [salvarResultados]);

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
    resultadosAcumuladosRef.current = [];
    receitaDaRodadaRef.current = receitaEscolhida;
    pararRef.current = false;
    setEmAndamento(true);
    setProgresso({ feito: 0, total: itens.length });

    criadoEmRef.current = Date.now();
    loteIdRef.current = await criarLote({
      criadoEm: criadoEmRef.current,
      fonte,
      receita: {
        id: receitaEscolhida.id,
        nome: receitaEscolhida.nome,
        quando: receitaEscolhida.quando,
        localizacao: receitaEscolhida.localizacao,
        onda: receitaEscolhida.onda,
      },
      metadataBase,
    });

    const processar = async (item: ItemDoLote, receita: Receita): Promise<ResultadoDeUmaImagem> => {
      const { resultado, propostos } = await processarImagemDoLote(item, receita, {
        cancelado: () => pararRef.current,
      });
      if (propostos) propostosRef.current.set(item.id, propostos);
      resultadosAcumuladosRef.current = [...resultadosAcumuladosRef.current, resultado];
      await persistir();
      return resultado;
    };

    const { resultados: obtidos } = await executarLote(itens, receitaEscolhida, processar, {
      cancelado: () => pararRef.current,
      progresso: (feito, total) => setProgresso({ feito, total }),
    });

    // Trilha: quantas imagens entraram e quantas falharam. O lote é a operação
    // longa do aplicativo, e o relato dele chega sempre como "parou no meio".
    registrarEvento('lote:rodar', {
      imagens: itens.length,
      fonte,
      receita: receitaEscolhida.id,
      comErro: obtidos.filter((r) => r.erro).length,
    });

    setResultados(obtidos);
    setEmAndamento(false);
  }, [receitaEscolhida, itensDaFonteEscolhida, fonte, metadataBase, criarLote, persistir]);

  const handleParar = useCallback(() => {
    pararRef.current = true;
  }, []);

  /**
   * Carrega o lote pendente (Dexie) de volta para o painel: resultados,
   * miniaturas, contornos, receita, fonte e o que já foi aceito. `itensRef`
   * fica vazio de propósito — o `File` original não sobrevive a fechar a
   * aba, então "repetir" fica indisponível nestas linhas, e aceitar usa a
   * prévia já desenhada (`imagemGrande`) em vez de reabrir o arquivo.
   */
  const handleRetomar = useCallback(() => {
    if (!lotePendente || lotePendente.id == null) return;
    const guardado = lotePendente;
    setFonte(guardado.fonte);
    setReceitaId(guardado.receita.id);
    receitaDaRodadaRef.current = { ...guardado.receita };
    // `guardado.id` já foi conferido não-nulo na guarda acima (`lotePendente.id
    // == null`), mas o tipo de `guardado.id` continua `number | undefined`
    // depois do alias — o `??` só converte undefined em null para o ref.
    loteIdRef.current = guardado.id ?? null;
    criadoEmRef.current = guardado.criadoEm;
    itensRef.current = new Map();
    propostosRef.current = new Map(
      guardado.resultados.filter((r) => r.propostos).map((r) => [r.id, r.propostos!])
    );
    resultadosAcumuladosRef.current = guardado.resultados.map(({ propostos: _propostos, ...resto }) => resto);
    setResultados(resultadosAcumuladosRef.current);
    setAceitos(new Set(guardado.aceitos));
    setErroGeral(null);
  }, [lotePendente]);

  const handleDescartarPendente = useCallback(async () => {
    if (!lotePendente || lotePendente.id == null) return;
    await descartarLote(lotePendente.id);
  }, [lotePendente, descartarLote]);

  /** Reabre o `File` desta imagem (só esta) e monta a sessão a partir dos contornos já propostos. */
  const construirSessao = useCallback(
    async (resultado: ResultadoDeUmaImagem): Promise<Session | null> => {
      const receita = receitaDaRodadaRef.current;
      const propostos = propostosRef.current.get(resultado.id);
      if (!receita || !propostos) return null;

      const item = itensRef.current.get(resultado.id);
      let imageData: string | undefined;
      if (item) {
        // Pelo mesmo decodificador de `processar-imagem.ts`: `createImageBitmap`
        // direto falhava em TIFF, e a digitalização de tetrazólio é TIFF.
        const file = await item.obterFile();
        const canvas = await decodificarParaCanvas(file);
        imageData = canvas.toDataURL('image/jpeg', 0.85);
      } else {
        // Lote retomado: sem `File` original, a prévia com contornos já
        // desenhada em `processar-imagem.ts` é o que sobrou.
        imageData = resultado.imagemGrande ?? resultado.miniatura;
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
          // A pessoa conferiu a miniatura e aceitou a linha, não cada objeto:
          // para a procedência isso é contagem AUTOMÁTICA, e o laudo/CSV
          // precisam saber que nenhuma semente foi conferida uma a uma.
          procedencia: { ...metadataBase.procedencia, modo: 'automatica' },
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
          if (loteIdRef.current != null) await marcarAceito(loteIdRef.current, resultado.id);
        }
      } catch {
        setErroGeral(`Não foi possível gravar a sessão de "${resultado.rotulo}".`);
      } finally {
        setAceitando(null);
      }
    },
    [aceitos, construirSessao, addSession, marcarAceito]
  );

  /** Ponto de entrada do botão "Aceitar" da linha: checa duplicata antes de gravar — nunca decide sozinho. */
  const handleAceitarClique = useCallback(
    (resultado: ResultadoDeUmaImagem) => {
      if (resultado.erro || aceitos.has(resultado.id)) return;
      const duplicatas = ehDuplicata(resultado.rotulo, sessions);
      if (duplicatas.length > 0) {
        setDuplicataPendente({ resultado, duplicatas });
        return;
      }
      handleAceitar(resultado);
    },
    [aceitos, sessions, handleAceitar]
  );

  const handleResolverDuplicata = useCallback(
    async (opcao: 'substituir' | 'gravar' | 'pular') => {
      if (!duplicataPendente) return;
      const { resultado, duplicatas } = duplicataPendente;
      setDuplicataPendente(null);
      if (opcao === 'pular') return;
      if (opcao === 'substituir') {
        for (const antiga of duplicatas) {
          // eslint-disable-next-line no-await-in-loop -- poucas sessões por nome, sequencial é claro
          await deleteSession(antiga.id);
        }
      }
      await handleAceitar(resultado);
    },
    [duplicataPendente, deleteSession, handleAceitar]
  );

  const handleAceitarTodas = useCallback(async () => {
    for (const r of resultados) {
      if (r.erro || aceitos.has(r.id)) continue;
      // Duplicata é sempre decisão individual — "aceitar todas" pula essas
      // linhas, a pessoa resolve cada uma pelo botão da linha.
      if (ehDuplicata(r.rotulo, sessions).length > 0) continue;
      // eslint-disable-next-line no-await-in-loop -- sequencial de propósito: uma sessão por vez, mesmo espírito do laço do lote.
      await handleAceitar(r);
    }
  }, [resultados, aceitos, sessions, handleAceitar]);

  /** Reprocessa só esta linha, preservando a posição dela e o resto da tabela. Indisponível num lote retomado (sem `File` original). */
  const handleRepetirUma = useCallback(
    async (alvo: ResultadoDeUmaImagem) => {
      const item = itensRef.current.get(alvo.id);
      const receita = receitaDaRodadaRef.current;
      if (!item || !receita || aceitos.has(alvo.id)) return;
      setRepetindo((prev) => new Set(prev).add(alvo.id));
      try {
        const { resultado, propostos } = await processarImagemDoLote(item, receita, {});
        if (propostos) propostosRef.current.set(item.id, propostos);
        else propostosRef.current.delete(item.id);
        resultadosAcumuladosRef.current = resultadosAcumuladosRef.current.map((r) =>
          r.id === alvo.id ? resultado : r
        );
        setResultados((prev) => prev.map((r) => (r.id === alvo.id ? resultado : r)));
        await persistir();
      } catch (e) {
        setErroGeral(`Não foi possível repetir "${alvo.rotulo}": ${e instanceof Error ? e.message : 'erro desconhecido'}.`);
      } finally {
        setRepetindo((prev) => {
          const n = new Set(prev);
          n.delete(alvo.id);
          return n;
        });
      }
    },
    [aceitos, persistir]
  );

  const handleRepetirFalhas = useCallback(async () => {
    for (const r of resultados) {
      if (!r.erro) continue;
      // eslint-disable-next-line no-await-in-loop -- uma imagem decodificada por vez, mesmo espírito do laço do lote.
      await handleRepetirUma(r);
    }
  }, [resultados, handleRepetirUma]);

  const handleExportarCsv = useCallback(() => {
    if (resultados.length === 0) return;
    const csv = gerarCsv(resultados);
    baixarArquivo(csv, nomeDeExportacao({ tipo: 'lote' }, 'csv'), 'text/csv;charset=utf-8;');
  }, [resultados]);

  const pendentesParaAceitar = resultados.some((r) => !r.erro && !aceitos.has(r.id));
  const haFalhas = resultados.some((r) => r.erro);
  const fonteIndisponivel = (f: Fonte) => {
    if (f === 'fila') return imageQueue.length === 0;
    if (f === 'regioes') return !imagemAtual;
    return !pastaAberta || pastaAberta.arquivos.length === 0;
  };

  const resumo = useMemo(() => resumirLote(resultados), [resultados]);

  // O banner de retomar só faz sentido ANTES de qualquer rodada nesta
  // instância do painel: assim que `handleRodar`/`handleRetomar` roda,
  // `loteIdRef` deixa de ser `null` e a condição abaixo já não bate — mesmo
  // que o registro pendente continue existindo até ser aceito por completo.
  const mostrarBannerDeRetomar = !!lotePendente && resultados.length === 0 && loteIdRef.current == null;

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

      {mostrarBannerDeRetomar && lotePendente && (
        <div className="border-line bg-surface-2 flex flex-col gap-2 rounded-lg border p-2.5">
          <p className="text-ink-2 flex items-start gap-1.5 text-[11px] leading-snug">
            <History size={13} className="text-accent mt-0.5 shrink-0" />
            Retomar o resultado de {new Date(lotePendente.criadoEm).toLocaleString('pt-BR')} (
            {lotePendente.aceitos.length} de {lotePendente.resultados.length} aceitos)?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetomar}
              className="bg-accent hover:bg-accent-strong text-accent-on flex-1 rounded-lg px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide transition-colors"
            >
              Retomar
            </button>
            <button
              type="button"
              onClick={handleDescartarPendente}
              className="border-line text-ink-2 hover:bg-surface-3 flex-1 rounded-lg border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

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

      {/* Resumo do lote — a receita é estável? */}
      {resultados.length > 0 && (
        <div className="border-line bg-surface-2 rounded-lg border p-2.5">
          <div className="text-ink-3 mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
            <Info size={12} className="text-accent" />
            Resumo do lote
          </div>
          <p className="text-ink-2 font-mono text-[11px] tabular-nums leading-relaxed">
            {resumo.totalDeObjetos} {resumo.totalDeObjetos === 1 ? 'objeto' : 'objetos'} em {resumo.imagens}{' '}
            {resumo.imagens === 1 ? 'imagem' : 'imagens'}
            {resumo.medianaPorImagem != null && <> · mediana {resumo.medianaPorImagem}/imagem</>}
            {resumo.dispersao && (
              <>
                {' '}
                · dispersão {resumo.dispersao.min}–{resumo.dispersao.max}
              </>
            )}
            {resumo.imagensComErro > 0 && (
              <span className="text-amber-600">
                {' '}
                · {resumo.imagensComErro} com erro
              </span>
            )}
            {resumo.duracaoMediaPorImagemMs != null && (
              <>
                {' '}
                · {(resumo.duracaoTotalMs / 1000).toFixed(1)}s total (
                {Math.round(resumo.duracaoMediaPorImagemMs)}ms/imagem)
              </>
            )}
          </p>
        </div>
      )}

      {/* Tabela de resultados */}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="border-line overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-[10.5px]">
              <thead className="bg-surface-2 text-ink-3 uppercase tracking-wide">
                <tr>
                  <th className="px-2 py-1.5 font-bold">Prévia</th>
                  <th className="px-2 py-1.5 font-bold">Imagem</th>
                  <th className="px-2 py-1.5 text-right font-bold">Contagem</th>
                  <th className="px-2 py-1.5 text-right font-bold">Viáveis</th>
                  <th className="px-2 py-1.5 text-right font-bold">Inviáveis</th>
                  <th className="px-2 py-1.5 text-right font-bold">Suspeitos</th>
                  <th className="px-2 py-1.5 text-right font-bold">Duração</th>
                  <th className="px-2 py-1.5 font-bold">Aceite</th>
                  <th className="px-2 py-1.5 font-bold">Repetir</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {resultados.map((r) => {
                  const aceito = aceitos.has(r.id);
                  const duplicata = !r.erro && !aceito ? ehDuplicata(r.rotulo, sessions).length > 0 : false;
                  const podeRepetir = itensRef.current.has(r.id) && !aceito;
                  return (
                    <tr key={r.id} className={r.erro ? 'text-ink-3' : 'text-ink-1'}>
                      <td className="px-2 py-1.5">
                        {r.miniatura ? (
                          <button
                            type="button"
                            onClick={() => setPreviaAberta(r)}
                            title="Ver a prévia com os contornos propostos"
                            className="border-line hover:border-accent block overflow-hidden rounded border"
                          >
                            <img
                              src={r.miniatura}
                              alt={`Miniatura de ${r.rotulo} com os contornos propostos`}
                              className="block max-h-10 max-w-12 object-contain"
                            />
                          </button>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="max-w-32 truncate px-2 py-1.5 font-mono" title={r.rotulo}>
                        <span className="flex items-center gap-1">
                          {r.rotulo}
                          {duplicata && (
                            <Copy
                              size={11}
                              className="shrink-0 text-amber-500"
                              aria-label="Já existe sessão com este nome"
                            />
                          )}
                        </span>
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
                            onClick={() => handleAceitarClique(r)}
                            disabled={aceitando === r.id}
                            className="border-line text-ink-2 hover:bg-surface-2 rounded px-2 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors disabled:opacity-50"
                          >
                            {aceitando === r.id ? '…' : 'Aceitar'}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => handleRepetirUma(r)}
                          disabled={!podeRepetir || repetindo.has(r.id) || emAndamento}
                          title={
                            podeRepetir
                              ? 'Reprocessar só esta imagem'
                              : aceito
                                ? 'Já aceita — não é possível repetir'
                                : 'Sem o arquivo original (lote retomado) — não é possível repetir'
                          }
                          className="border-line text-ink-2 hover:bg-surface-2 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCcw size={11} className={repetindo.has(r.id) ? 'animate-spin' : ''} />
                        </button>
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
          {haFalhas && (
            <button
              type="button"
              onClick={handleRepetirFalhas}
              disabled={emAndamento}
              className="border-line text-ink-2 hover:bg-surface-2 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={13} /> Repetir as que falharam
            </button>
          )}
        </div>
      )}

      <ModalDaPreVia resultado={previaAberta} onClose={() => setPreviaAberta(null)} />
      {duplicataPendente && (
        <AvisoDeDuplicata
          resultado={duplicataPendente.resultado}
          duplicatas={duplicataPendente.duplicatas}
          onResolver={handleResolverDuplicata}
        />
      )}
    </section>
  );
}
