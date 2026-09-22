import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { Ruler, ChevronDown, ChevronUp, X } from 'lucide-react';

// Components
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { Footer } from './components/layout/Footer';
import { ImageViewport } from './components/canvas/ImageViewport';
import { CalibrationRulerOverlay } from './components/canvas/overlays/CalibrationRulerOverlay';
import { GhostSeedsOverlay } from './components/canvas/overlays/GhostSeedsOverlay';
import { RegionSelectorOverlay } from './components/canvas/overlays/RegionSelectorOverlay';
import { VisualAnnotationsOverlay } from './components/canvas/overlays/VisualAnnotationsOverlay';
import { MarkingCanvas, type DetectionPreview } from './components/canvas/MarkingCanvas';
import { SeedInspector } from './components/canvas/SeedInspector';
import { ListaDeSementes } from './components/canvas/ListaDeSementes';
import { EscalaGrafica } from './components/canvas/EscalaGrafica';
import { carregarExemploReal, type ExemploReal } from './features/demo/exemplos-reais';
import { Toolbar } from './components/canvas/Toolbar';
import { ZoomControls } from './components/canvas/ZoomControls';
import { Bancadas } from './features/bancadas/Bancadas';
import { SeletorDeBancadas } from './features/bancadas/SeletorDeBancadas';
import { PainelDeComparacao } from './features/bancadas/PainelDeComparacao';
import { DropZone } from './components/shared/DropZone';
import { CookieConsentBanner } from './components/shared/CookieConsentBanner';

// Modals
// import { CameraModal } from './components/modals/CameraModal';
import { ExportModal } from './components/modals/ExportModal';
import { ImageExportModal } from './components/modals/ImageExportModal';
import { HistoryModal } from './components/modals/HistoryModal';
import { ConfirmDialog } from './components/modals/ConfirmDialog';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useBancadas } from './hooks/useBancadas';
import { useCronometro } from './hooks/useCronometro';
import { useVisibilidade } from './features/visualizacao/useModoDeVisualizacao';
import {
  sugerirDoArquivo,
  quantasSugestoes,
  type SugestoesDaAmostra,
} from './lib/sugestoes-do-arquivo';
import { useSessions } from './hooks/useSessions';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDragDrop } from './hooks/useDragDrop';
import {
  DialogoDeCarregar,
  decidirAoCarregar,
  haTrabalhoNaoSalvo,
  proporContinuidade,
  aplicarContinuidade,
  type Continuidade,
  type ConfirmacaoDeCarregar,
  type CampoDeContinuidade,
  type PropostaDeContinuidade,
} from './features/carregar';
import { useViewNavigation } from './hooks/useViewNavigation';
import { useTools } from './hooks/useTools';
import {
  useFeatureFlag,
  useFeatureFlags,
  FeatureFlagsDebugPanel,
} from './context/FeatureFlagContext';
import { useExperiments } from './hooks/useExperiments';

// Features
import { LongitudinalView, ExperimentModal, PlateRunModal } from './features/longitudinal';
import { StatsView } from './features/stats';
import { YoloExportModal } from './features/yolo-export';
import { useExportacoes } from './features/exportar';
import { CameraModal } from './features/camera';
import { DetectionPanel } from './features/detection';
import { AiPointerPanel } from './features/ai-pointer';
import { CalibrationPanel } from './features/calibration';
import { FeaturesModal } from './features/settings';
import { IdentificacaoModal } from './features/normas';
import { GaleriaModal } from './features/galeria';
// Sob demanda: os dois carregam o `recharts` (ver `features/analytics/index.ts`).
import { AnalyticsPanel, AnalyticsModal } from './features/analytics';
import { NovidadesModal } from './features/novidades';
import { BotaoDeConta, useConta, aplicarPreferencia } from './features/conta';
import { useEasterEggs, Florescer, PassoDaMontanha, Germinar, tocarMarca } from './features/easter';
import {
  CartaoDeSugestao,
  sugerir,
  lerDispensadas,
  dispensar,
  type EstadoParaSugestao,
  type AcaoDeSugestao,
} from './features/sugestoes';
import { PainelDeMorfometria, resumir } from './features/morfometria';
import { aplicarRegra, simularRegra, REGRAS_PADRAO, type RegraParametrica } from './features/morfometria/regras';
import {
  lerPreferencia,
  gravarPreferencia,
  lerPreferenciaTexto,
  gravarPreferenciaTexto,
  CHAVE_SUGESTOES,
} from './features/settings/preferencias';
import { conferirForma } from './lib/normas/tamanhos-de-semente';
import { AvisoDeAtualizacao } from './features/novidades/AvisoDeAtualizacao';
import { BarraDeAtividade } from './features/atividade/BarraDeAtividade';
import {
  decidirAbertura,
  marcarVersaoComoVista,
  versaoAtual,
  versaoVista,
  type Versao,
} from './lib/novidades';
import { envolver } from './features/galeria/recortes';
import {
  inserirVertice,
  moverVerticeSuave,
  pontoNoPoligono,
  raioDeInfluencia,
} from './lib/edicao-de-contorno';
import { ajustarContorno, type Pincelada } from './lib/borracha';
import { achatarFundo, type ModoDeAchatamento } from './lib/achatar-fundo';
import { atualizarProgresso, iniciarAtividade } from './features/atividade/atividade';
import { CORTE_PARA_SEMENTE_ALONGADA, proporCorte } from './lib/corte-por-concavidade';
import { acharPorNome, TAMANHOS } from './lib/normas/tamanhos-de-semente';
import {
  mostraContornos,
  mostraPontos,
  proxima as proximaMascara,
} from './features/mascara';
import { useLaboratorio } from './hooks/useLaboratorio';
import { carregarExemplo } from './features/demo/exemplos';
import { segmentarNoCanvas } from './features/segmentacao/onda-no-canvas';
import { AVISO_CENA, type PresetDeCena } from './lib/synthetic-scene';
import { ImageAdjustPanel } from './features/image-adjust';
import { SplitModal } from './features/split';
import { RoiModal } from './features/roi';
import {
  RECEITAS_DO_ENSAIO,
  receitaPelaEspecie,
  receitaDeSalva,
  type Receita,
  type ContornoProposto,
} from './features/ensaio/receitas';
import { executarReceita, type ResultadoDoEnsaio } from './features/ensaio/executar';
import { EnsaioPanel } from './features/ensaio/EnsaioPanel';
import { useReceitasSalvas } from './hooks/useReceitasSalvas';
import { usePerfisMedidos } from './hooks/usePerfisMedidos';
import type { ReceitaSalva } from './lib/db';
import { DatasetsPanel } from './features/datasets/DatasetsPanel';
import { LotePanel } from './features/lote/LotePanel';
import type { PastaAberta, ArquivoDoDataset } from './features/datasets/fonte';
import type { AnotacaoCarregada } from './features/datasets/anotacao';
import { detectObjects, type DetectionOptions } from './lib/detect';
import type { OpcoesDaOnda } from './lib/region-growing';
import { ChipDeEspecie } from './components/layout/ChipDeEspecie';
import { especieAtual, type EspecieConhecida } from './lib/normas/especies';
import { EQUIPAMENTOS_DO_LABORATORIO } from './lib/calibration';

// Utils
import { contarObjetos } from './lib/contagem';
import { categoriaImportada, categoriaDoNome, nomeDaCategoria } from './lib/classe-do-modelo';
import { limiaresDaPopulacao } from './lib/aglomerado';
import type { ClasseDeSemente } from './lib/normas/classes-de-semente';
import { calculateSeedDimensions } from './lib/pca-utils';
import { buildMeasurements } from './lib/measurements';
import {
  applyAdjustments,
  exigePixels,
  isNeutral,
  toCssFilter,
} from './lib/image-adjust';
import { registrarEvento, extensaoDe } from './lib/diagnostico/trilha';
import type { ContextoDoRelatorio } from './lib/diagnostico/relatorio';

// Types
import type { Mark, YoloSegmentation, Session, Experiment, PlateRun, Metadata } from './types';

// Linguagem do especime — fonte unica das cores e formas das marcas.
import {
  ESPECIME,
  ESPECIME_FILL,
  corDoEspecime,
  desenharMarca,
  OPACIDADE_MINIMA,
  type EstiloDaMarca,
} from './theme/specimen';
import { AJUSTE_PADRAO, corpoDaFonte, espessuraNaImagem, raioDaMarca } from './lib/escala-da-marca';
import { enumerarObjetos } from './lib/objetos';
import { fontesDasAutomacoes, resumoDaFonte } from './lib/fonte-da-automacao';

/** Centro de massa dos vertices. Suficiente para posicionar uma marca. */
function centroide(pontos: [number, number][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pontos) {
    sx += x;
    sy += y;
  }
  return [sx / pontos.length, sy / pontos.length];
}

import { renderMarksToContext } from './lib/render-marks';

export default function App() {
  // Theme & Darkmode State
  const { isDarkMode, toggleTheme } = useTheme();

  // View navigation
  const { currentView, navigate } = useViewNavigation('counter');

  // Experiments CRUD
  const { experiments } = useExperiments();

  // Feature Flags
  const isLongitudinalEnabled = useFeatureFlag('longitudinalView');
  const isStatsEnabled = useFeatureFlag('statsView');
  const isYoloExportEnabled = useFeatureFlag('yoloExport');
  const isCameraEnabled = useFeatureFlag('cameraCapture');
  const isDetectionEnabled = useFeatureFlag('assistedDetection');
  const isAiPointerEnabled = useFeatureFlag('aiPointer');
  const isModoLaudoEnabled = useFeatureFlag('modoLaudo');
  const isSplitEnabled = useFeatureFlag('splitScan');
  const isRoiEnabled = useFeatureFlag('circularRoi');
  // Spike (Tarefa 8, Degrau 1): desligada por padrao. So muda o botao direito
  // no canvas quando ligada — ver `MarkingCanvas` e `flags.ts`.
  const isMenuRadialEnabled = useFeatureFlag('menuRadial');
  // Fase I — o ensaio ao carregar. Desligado por padrão: a ferramenta propõe,
  // nunca decide sozinha, e fica atrás de flag até a medição dizer que a taxa
  // de "Nenhuma" é baixa o bastante para ligar por padrão.
  const isEnsaioAoCarregarEnabled = useFeatureFlag('ensaioAoCarregar');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [detectionPreview, setDetectionPreview] = useState<DetectionPreview | null>(null);

  // Calibração — modo régua e última distância medida
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [isIdentificacaoOpen, setIsIdentificacaoOpen] = useState(false);
  /** A galeria grande (janela) continua existindo, aberta pelo Expandir da aba. */
  const [galeriaGrande, setGaleriaGrande] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  /** Escala gráfica e eixos: preferências de quem mede, lembradas. */
  const [mostrarEscala, setMostrarEscala] = useState(() => lerPreferencia('sc:escalaGrafica', true));
  const [mostrarEixos, setMostrarEixos] = useState(() => lerPreferencia('sc:eixosDasMedidas', false));
  /** Proposta do ensaio sob o mouse, mostrada tracejada no canvas para comparar receitas. */
  const [propostaDestacada, setPropostaDestacada] = useState<[number, number][][]>([]);
  const { laboratorio } = useLaboratorio();
  const [ajusteDaMarca, setAjusteDaMarca] = useState(AJUSTE_PADRAO);
  // Estilo e opacidade ficam em PREFERÊNCIA, não em estado da sessão: é gosto
  // de quem trabalha e tipo de amostra, não propriedade do dado. Quem analisa
  // orquídea densa escolhe uma vez e não escolhe de novo a cada imagem.
  /** A conferência da última calibração, para virar coluna do CSV. */
  const [calibracaoConferida, setCalibracaoConferida] = useState<{
    dpiMedido: number;
    leituras: number;
    cvPercent?: number;
  } | null>(null);
  const [estiloDaMarca, setEstiloDaMarca] = useState<EstiloDaMarca>(
    () => lerPreferenciaTexto('sc:estiloDaMarca', 'disco') as EstiloDaMarca
  );
  const [opacidadeDaMarca, setOpacidadeDaMarca] = useState<number>(() => {
    const bruto = Number(lerPreferenciaTexto('sc:opacidadeDaMarca', '1'));
    return Number.isFinite(bruto) && bruto >= OPACIDADE_MINIMA && bruto <= 1 ? bruto : 1;
  });
  const [raioDaRaspagem, setRaioDaRaspagem] = useState(14);
  // mascara, contornoSelecionado, fundoAchatado e forcarOriginalNasAutomacoes
  // sao estado de CENA — moram no hook de bancada (Task 1) e chegam via
  // `bancada.cena`, desestruturados mais abaixo, no mesmo lugar onde a fila
  // de imagens entrava.
  const [fundoIncerto, setFundoIncerto] = useState(false);
  const [achatando, setAchatando] = useState(false);


  // Easter eggs: `semente` liga o tic ao marcar, `orquidea` floresce. O gancho
  // tem o proprio ouvinte de teclado e nao passa por useKeyboardShortcuts —
  // easter egg nao se anuncia na ajuda.
  const {
    florescendo,
    encerrarFlorescer,
    recado: recadoDoEaster,
    passoDaMontanha,
    encerrarPassoDaMontanha,
    pedidoDeGerminar,
    temaDaFlor,
  } = useEasterEggs();
  /** Germinar em curso: o pedido que está sendo mostrado (0 = nenhum). */
  const [germinandoPedido, setGerminandoPedido] = useState(0);
  const [recadoDeGerminar, setRecadoDeGerminar] = useState<string | null>(null);
  useEffect(() => {
    if (pedidoDeGerminar === 0) return;
    // Sem semente marcada não há de onde brotar — e é a dica de como achar o resto.
    if (bancada.cena.marcasRef.current.length === 0) {
      setRecadoDeGerminar('Marque algumas sementes primeiro (V) — é delas que a flor brota.');
      const t = setTimeout(() => setRecadoDeGerminar(null), 2500);
      return () => clearTimeout(t);
    }
    setGerminandoPedido(pedidoDeGerminar);
  }, [pedidoDeGerminar]);
  const encerrarGerminar = useCallback(() => setGerminandoPedido(0), []);


  // Notas de versao: abre sozinha so quando a versao avancou desde a ultima
  // visita. Na primeira visita registra em silencio — quem abre o aplicativo
  // pela primeira vez quer contar sementes, nao ler o historico.
  const [novidades, setNovidades] = useState<{ aberto: boolean; versoes: Versao[] }>({
    aberto: false,
    versoes: [],
  });

  useEffect(() => {
    const atual = versaoAtual()?.numero ?? __APP_VERSION__;
    const { abrir, versoes } = decidirAbertura(atual, versaoVista());
    if (abrir) setNovidades({ aberto: true, versoes });
    marcarVersaoComoVista(atual);
  }, []);
  const ciclarMascara = useCallback(() => setMascara((m) => proximaMascara(m)), []);
  const [showRulers, setShowRulers] = useState(true);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measuredPixels, setMeasuredPixels] = useState<number | undefined>(undefined);

  // Região de detecção: onde os motores (clássico e YOLO) vão rodar. Sem ela,
  // os dois varrem a imagem inteira — dezenas de janelas de inferência numa
  // digitalização de scanner. `regiaoDeDeteccao` é estado de cena, em
  // `bancada.cena`; só o "estou selecionando agora" fica aqui.
  const [selecionandoRegiao, setSelecionandoRegiao] = useState(false);

  // Modal Open states
  const [isYoloExportModalOpen, setIsYoloExportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImageExportModalOpen, setIsImageExportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [isRoiOpen, setIsRoiOpen] = useState(false);
  const [isExperimentModalOpen, setIsExperimentModalOpen] = useState(false);
  const [selectedExperimentForEdit, setSelectedExperimentForEdit] = useState<
    Experiment | undefined
  >(undefined);
  const [isPlateRunModalOpen, setIsPlateRunModalOpen] = useState(false);
  const [selectedExperimentForRun, setSelectedExperimentForRun] = useState<Experiment | undefined>(
    undefined
  );
  const [selectedTreatmentIdForRun, setSelectedTreatmentIdForRun] = useState<string | undefined>(
    undefined
  );
  const [selectedPlateRunForEdit, setSelectedPlateRunForEdit] = useState<PlateRun | undefined>(
    undefined
  );
  const [versaoDispensadas, setVersaoDispensadas] = useState(0);

  // Fase 4: Regra Simulada State (Lifting State para evitar useEffect)
  /**
   * Nenhuma regra escolhida por padrão.
   *
   * Antes começava na primeira da lista, e como a simulação roda a cada
   * mudança de medida, os quadrinhos tracejados piscavam sobre a cena sem
   * ninguém ter aberto o painel de regras — uma proposta de curadoria em
   * lote aparecendo sozinha. O fantasma é resposta a um pedido; sem pedido,
   * não há fantasma.
   */
  const [regraSelecionadaId, setRegraSelecionadaId] = useState<string | null>(null);
  const [limiaresCustomizados, setLimiaresCustomizados] = useState<Record<string, number>>({
    'regra-detritos': 5.0,
    'regra-aglomerados': 0.90,
    'regra-chocha': 0.65,
  });

  const isAnyModalOpen =
    isExportModalOpen ||
    isImageExportModalOpen ||
    isHistoryModalOpen ||
    isYoloExportModalOpen ||
    isExperimentModalOpen ||
    isPlateRunModalOpen ||
    isCameraOpen ||
    isSplitOpen ||
    isRoiOpen ||
    isResetConfirmOpen ||
    isFeaturesOpen ||
    novidades.aberto ||
    galeriaGrande ||
    analyticsModalOpen ||
    isIdentificacaoOpen;

  // Fase F — ferramentas de edição (marcar / borracha / mover)
  const {
    activeTool,
    setActiveTool,
    eraserRadius,
    setEraserRadius,
    isTemporary: isToolTemporary,
  } = useTools({ disabled: isAnyModalOpen });

  // Ctrl+Shift+D shortcut for Feature Flags Debug Panel
  const { toggle: toggleFlag } = useFeatureFlags();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleFlag('debugPanel');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFlag]);

  // Manual marking class toggle
  const [activeClassification, setActiveClassification] = useState<'viable' | 'inviable'>('viable');

  /**
   * Escolher a classe nos cartões de resultado também troca a ferramenta.
   *
   * Clicar em "viável" ali é dizer "agora eu vou marcar viáveis" — e ter de
   * ir até a barra de ferramentas depois disso é um passo que a pessoa não
   * pediu. Só muda quando a ferramenta atual é de marcação ou nenhuma: quem
   * está no meio de um ajuste de contorno ou com a borracha na mão não quer
   * ser arrancado dali por um clique no painel.
   */
  const escolherClasse = useCallback(
    (tipo: 'viable' | 'inviable') => {
      setActiveClassification(tipo);
      setActiveTool((atual) => (atual === 'viable' || atual === 'inviable' ? tipo : atual));
    },
    [setActiveTool]
  );
  const [visualMode, setVisualMode] = useState<'dots' | 'numbers'>('dots');

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // `chaveDaImagem`, `anotacoesPorImagem`, `chaveAtual`, `marcasRef` e
  // `segmentacoesRef` migraram para dentro de `useBancada` nesta Task 2: são
  // estado de CENA, e com quatro bancadas ficar soltas aqui as tornaria
  // estado COMPARTILHADO (a anotação em cache da bancada 1 serviria a imagem
  // da bancada 3). O que resta aqui — `datasetPendente` — não é por-imagem
  // dentro de uma bancada; é o vínculo anunciado pelo explorador de datasets
  // para a PRÓXIMA imagem que qualquer bancada carregar, consumido uma única
  // vez por `onImageLoaded` (mais abaixo) e por isso continua como espelho
  // único, não por-bancada.
  /** Vínculo com dataset anunciado pelo explorador para a próxima imagem que carregar. */
  const datasetPendente = useRef<Metadata['dataset'] | null>(null);
  /** O chip de classe do dataset foi fechado para este arquivo. */
  const [chipDeClasseDispensado, setChipDeClasseDispensado] = useState<string | null>(null);
  /**
   * O que o nome do arquivo e a pasta já contam sobre a amostra.
   *
   * Fica em estado separado do metadado de propósito: sugestão NÃO é dado.
   * Ela só vira metadado quando alguém clica em "Usar" — a mesma regra do
   * resto do produto, e a única que impede um palpite de espécie de entrar
   * calado num laudo.
   */
  const [sugestoes, setSugestoes] = useState<SugestoesDaAmostra | null>(null);

  /**
   * Carregar com cena ocupada (ver `features/carregar`): os arquivos ficam
   * aqui, SEGURADOS, enquanto o diálogo pergunta o que fazer. Cancelar zera
   * isto e nada abre. Vários arquivos de uma vez = uma pergunta só, sobre o
   * primeiro; os outros seguem o mesmo destino.
   */
  const [carregamentoPendente, setCarregamentoPendente] = useState<{
    arquivos: File[];
    continuidade: Continuidade;
  } | null>(null);
  /**
   * A continuidade que a pessoa confirmou, à espera da imagem que ela
   * descreve. É aplicada em `onImageLoaded`, quando ESSA imagem abre — e não
   * no clique — porque "adicionar à fila" deixa a cena atual na tela, e
   * escrever "T8" no metadado da placa que ainda está sendo contada seria
   * errado. A chave é nome+tamanho, a mesma de `useBancada`.
   */
  const continuidadePendente = useRef<{
    chave: string;
    proposta: PropostaDeContinuidade;
    marcados: Set<CampoDeContinuidade>;
  } | null>(null);

  /**
   * Ensaio ao carregar (Fase I, atrás da flag `ensaioAoCarregar`).
   *
   * `resultados` acumula um `ResultadoDoEnsaio` por receita conforme cada uma
   * termina — a pessoa vê os cartões aparecerem, não espera as três de uma
   * vez. `ensaioCancelado` é lido dentro de `executarReceita`, que cede a tela
   * em lotes; é ref, não estado, porque o loop já está rodando quando "Parar"
   * é clicado e precisa ler o valor mais recente sem re-render.
   */
  const [ensaio, setEnsaio] = useState<{
    resultados: ResultadoDoEnsaio[];
    emAndamento: boolean;
    /** Quantas receitas rodam nesta rodada — fixas + espécie + salvas (C5). */
    total: number;
  } | null>(
    null
  );
  const ensaioCancelado = useRef(false);

  /**
   * C5 — "uma receita, três momentos": a receita que "Usar esta" (ensaio) ou
   * uma receita salva carregou nos controles do painel Encontrar. O painel
   * lê isto para inicializar os controles; editar os controles depois NÃO
   * escreve de volta aqui — só uma nova receita escolhida troca este estado.
   */
  const [receitaAtiva, setReceitaAtiva] = useState<Receita | null>(null);

  // Sessions CRUD history
  const { sessions, addSession, deleteSession, clearSessions, importSessions } = useSessions();

  // Dispara ao terminar de carregar imagem nova, em QUALQUER bancada — recebe
  // o índice de qual. Continua no App (mexe em dataset pendente e ensaio,
  // coisas globais) e referencia `bancadas` e `especieOuCulturaDeclarada`
  // antes deles serem declarados — válido porque só roda depois deste render
  // terminar, como já valia para `abrirAbaDireita`.
  //
  // O cache de anotações por imagem (guardar a que sai, carregar a que
  // entra) NÃO mora mais aqui: é `useBancada` quem cuida disso agora, porque
  // é estado da CENA que carregou a imagem, não deste callback global (ver
  // `useBancada.ts`).
  // O modo de visualização decide se o ensaio roda (ver `modo.ts`, "o que o
  // modo esconde também não custa"). Lido aqui, e não no `useVisibilidade` do
  // rodapé mais abaixo, porque este fecho é declarado antes dele — e um
  // segundo `useContext` custa nada.
  const { visibilidade: visibilidadeDoModo } = useVisibilidade();

  const onImageLoaded = (indice: number, img: HTMLImageElement, file: File) => {
    // A bancada que carregou a imagem — não necessariamente a ativa (Task 3
    // ainda não liga `ativar` a nenhuma interação, então hoje é sempre a
    // mesma, mas o índice já vem certo para quando ligar). `?? todas[0]`
    // pelo mesmo motivo do `ativa` em `useBancadas`: o compilador não sabe
    // que os quatro slots sempre existem.
    const alvo = bancadas.todas[indice] ?? bancadas.todas[0];

    // Trilha: o defeito mais comum de abertura é de FORMATO e de TAMANHO — um
    // TIFF de 16 bits, uma digitalização de 7992×3672. Extensão e bytes
    // explicam isso; o nome do arquivo não explicaria nada a mais e é dado de
    // quem usa (ver `lib/diagnostico/trilha.ts`).
    registrarEvento('imagem:abrir', {
      largura: img.width,
      altura: img.height,
      extensao: extensaoDe(file.name),
      bytes: file.size,
      bancada: indice,
    });

    // O que o arquivo já conta. Proposta, não preenchimento — ver
    // `lib/sugestoes-do-arquivo.ts`. `webkitRelativePath` existe quando a
    // pessoa abriu uma PASTA; com arquivo solto não há pasta a considerar, e
    // inventar uma a partir do caminho do disco não é possível no navegador.
    const caminho = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const pasta = caminho ? caminho.split('/').slice(-2, -1)[0] : undefined;
    setSugestoes(sugerirDoArquivo({ nomeDoArquivo: file.name, pasta }));

    // Vínculo com dataset: só o que o explorador anunciou para ESTA imagem.
    const vinculo = datasetPendente.current;
    datasetPendente.current = null;
    alvo.meta.setMetadata((prev) =>
      prev.dataset || vinculo ? { ...prev, dataset: vinculo ?? undefined } : prev
    );
    setChipDeClasseDispensado(null);

    // Continuidade confirmada no diálogo de carregar, se for ESTA imagem:
    // só os campos marcados entram (ver `aplicarContinuidade`). Outra imagem
    // abrindo antes — a pessoa navegou na fila — não consome a pendência.
    const continuidade = continuidadePendente.current;
    if (continuidade && continuidade.chave === `${file.name}:${file.size}`) {
      continuidadePendente.current = null;
      alvo.meta.setMetadata((prev) =>
        aplicarContinuidade(prev, continuidade.proposta, continuidade.marcados)
      );
    }

    if (containerRef.current) {
      const container = containerRef.current;
      alvo.zoom.fitToScreen(container.clientWidth, container.clientHeight, img.width, img.height);
    }

    // Ensaio ao carregar: roda as receitas sobre a imagem RECÉM-CHEGADA
    // (o parâmetro `img`, não `imagemDeTrabalho` — que neste fecho ainda é o
    // valor do render anterior, da imagem que acabou de sair da fila).
    //
    // Só para a bancada ATIVA (Task 3, desempenho): carregar uma imagem numa
    // bancada que não está em tela não pode disparar um ensaio caro que
    // ninguém vai ver — com quatro bancadas isso multiplicaria o trabalho por
    // até quatro sem nenhum ganho.
    //
    // E só nos modos que MOSTRAM o ensaio: "contagem" o desliga
    // (`visibilidadePadrao('contagem').ensaioAoCarregar === false`), e o
    // menu Exibir permite ligar ou desligar por cima do modo. É o primeiro
    // caso de "o que o modo esconde também não custa": rodar três receitas
    // sobre uma digitalização grande são segundos que quem só conta não
    // pediu. A flag continua mandando — o modo só desliga, nunca liga.
    if (isEnsaioAoCarregarEnabled && visibilidadeDoModo.ensaioAoCarregar && indice === bancadas.indiceAtivo) {
      ensaioCancelado.current = false;
      abrirAbaDireita('inspetor');

      // C5, item 2: a receita "pela espécie" (quando a espécie ou o dataset
      // é conhecido) e as receitas salvas da espécie entram como 4ª+
      // opções, ao lado das três fixas — a pessoa escolhe qualquer uma
      // exatamente do mesmo jeito.
      const areaDaImagemPx = img.width * img.height;
      const receitaDaEspecie = receitaPelaEspecie(especieOuCulturaDeclarada, {
        umPerPixel: alvo.meta.metadata.umPerPixel,
        areaDaImagemPx,
      });
      const receitasSalvasConvertidas = receitasSalvas
        .filter((r): r is ReceitaSalva & { id: number } => r.id != null)
        .map(receitaDeSalva);
      const receitasParaRodar: Receita[] = [
        // Só as que cabem na premissa do ensaio (barato, sem worker). Ver
        // `RECEITAS_DO_ENSAIO` para o porquê de a IA ficar de fora daqui.
        ...RECEITAS_DO_ENSAIO,
        ...(receitaDaEspecie ? [receitaDaEspecie] : []),
        ...receitasSalvasConvertidas,
      ];
      setEnsaio({ resultados: [], emAndamento: true, total: receitasParaRodar.length });

      (async () => {
        for (const receita of receitasParaRodar) {
          if (ensaioCancelado.current) break;

          const deteccao = detectObjects(img, receita.localizacao);
          // Ferramenta cara em imagem grande: 400 pontos por receita é o
          // teto — acima disso o ensaio ao carregar deixaria de ser barato,
          // que é a premissa dele existir sem worker.
          const limitado = deteccao.objects.length > 400;
          const pontos = (limitado ? deteccao.objects.slice(0, 400) : deteccao.objects).map((o) => ({
            x: o.x,
            y: o.y,
          }));

          const resultado = await executarReceita(
            receita,
            pontos,
            (p, opcoesDaOnda) => {
              const r = segmentarNoCanvas(img, p, opcoesDaOnda);
              return r ? { contorno: r.contorno, tocouBorda: r.tocouBorda } : null;
            },
            { cancelado: () => ensaioCancelado.current }
          );
          if (!resultado || ensaioCancelado.current) break;

          console.info(`[ensaio] ${resultado.receita.id} ${resultado.duracaoMs.toFixed(0)}ms`);
          setEnsaio((prev) => ({
            resultados: [...(prev?.resultados ?? []), { ...resultado, limitado }],
            emAndamento: true,
            total: prev?.total ?? receitasParaRodar.length,
          }));
        }
        setEnsaio((prev) => (prev ? { ...prev, emAndamento: false } : prev));
      })();
    }
  };

  // Quatro cenas, uma ativa (ver `useBancadas.ts`). `bancada` continua sendo
  // a cena que o resto deste componente lê e escreve — só que agora é a
  // ATIVA entre quatro, em vez da única que existia. A desestruturação
  // abaixo usa os MESMOS nomes de antes — nenhuma outra linha do App muda.
  const bancadas = useBancadas({ onImageLoaded });
  const bancada = bancadas.ativa;
  const {
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
    loadFiles,
    adicionarAFila,
    handleNextImage,
    handlePrevImage,
    loadImageFromFile,
    paginasDoTiff,
    paginaDoTiff,
    dpiDeclarado,
    abrirPaginaDoTiff,
  } = bancada.fila;
  const {
    marks,
    setMarks,
    yoloSegmentations,
    anotacoesVisuais,
    setYoloSegmentations,
    segmentsVisible,
    addMark,
    removeMark,
    removerMarcas,
    setSubclasse,
    addYoloSegmentations,
    appendYoloSegmentation,
    toggleSegmentationClass,
    deleteSegmentation,
    resetAllAnnotations,
    desfazer,
    refazer,
    podeDesfazer,
    podeRefazer,
    mutar,
    abrirGesto,
    fecharGesto,
    carregar,
  } = bancada.anotacoes;
  const { metadata, setMetadata, updateMetadata } = bancada.meta;
  const { zoomLevel, setZoomLevel, zoomIn, zoomOut, resetZoom, fitToScreen } = bancada.zoom;
  const {
    isPanningMode,
    setIsPanningMode,
    isDragging: isPanningDrag,
    startDrag,
    handleDrag,
    stopDrag,
    togglePanningMode,
  } = bancada.pan;
  const {
    fundoAchatado,
    setFundoAchatado,
    adjustments,
    setAdjustments,
    adjustEnabled,
    setAdjustEnabled,
    mascara,
    setMascara,
    contornoSelecionado,
    setContornoSelecionado,
    regiaoDeDeteccao,
    setRegiaoDeDeteccao,
    ultimaGravacao,
    setUltimaGravacao,
    forcarOriginalNasAutomacoes,
    setForcarOriginalNasAutomacoes,
    anotacaoAtual,
    setAnotacaoAtual,
    datasetContexto,
    setDatasetContexto,
    referenciaJaCarregada,
    setReferenciaJaCarregada,
  } = bancada.cena;

  // --- Carregar imagem com cena aberta (ver `features/carregar`) -------------
  //
  // A porta de entrada de quem ESCOLHE um arquivo: o botão da barra lateral e
  // o arrastar-e-soltar. Com a cena vazia (ou sem marcação) abre direto, como
  // sempre abriu; com cena ocupada segura os arquivos e pergunta. Os outros
  // caminhos que chamam `loadFiles` — exemplo, dataset, câmera, dividir,
  // recorte — NÃO passam por aqui: cada um deles já escreve metadado ou troca
  // a própria imagem no mesmo gesto, e um diálogo no meio quebraria isso.
  const carregarArquivos = useCallback(
    (files: File[]) => {
      const decisao = decidirAoCarregar({
        temImagem: image !== null,
        totalDeMarcas: marks.length,
        totalDeContornos: yoloSegmentations.length,
        ultimaGravacao,
      });
      if (decisao === 'abrir' || files.length === 0) {
        loadFiles(files);
        return;
      }
      const primeiro = files[0];
      const caminho = (primeiro as File & { webkitRelativePath?: string }).webkitRelativePath;
      const pasta = caminho ? caminho.split('/').slice(-2, -1)[0] : undefined;
      const continuidade = proporContinuidade(
        {
          researcher: metadata.researcher,
          project: metadata.project,
          treatment: metadata.treatment,
          plate: metadata.plate,
          especie: metadata.amostra?.especieNomeCientifico,
        },
        sugerirDoArquivo({ nomeDoArquivo: primeiro.name, pasta }),
        primeiro.name
      );
      setCarregamentoPendente({ arquivos: files, continuidade });
    },
    [image, marks.length, yoloSegmentations.length, ultimaGravacao, metadata, loadFiles]
  );

  /** Mesma assinatura do `handleFileUpload` da fila — a barra lateral não muda. */
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      carregarArquivos(Array.from(e.target.files || []));
      e.target.value = '';
    },
    [carregarArquivos]
  );

  const cancelarCarregamento = useCallback(() => {
    registrarEvento('carregar:decisao', { escolha: 'cancelar' });
    setCarregamentoPendente(null);
  }, []);

  const confirmarCarregamento = useCallback(
    ({ escolha, tipo, marcados }: ConfirmacaoDeCarregar) => {
      if (!carregamentoPendente) return;
      const { arquivos, continuidade } = carregamentoPendente;
      setCarregamentoPendente(null);
      // Só a escolha e o tipo — nunca o nome do arquivo (ver `trilha.ts`).
      registrarEvento('carregar:decisao', { escolha, continuidade: tipo, campos: marcados.size });

      const proposta = continuidade.propostas.find((p) => p.tipo === tipo);
      const primeiro = arquivos[0];
      if (proposta && marcados.size > 0) {
        continuidadePendente.current = {
          chave: `${primeiro.name}:${primeiro.size}`,
          proposta,
          marcados,
        };
      } else {
        continuidadePendente.current = null;
      }

      if (escolha === 'substituir') loadFiles(arquivos);
      else adicionarAFila(arquivos, escolha === 'adicionar-e-ir');
    },
    [carregamentoPendente, loadFiles, adicionarAFila]
  );

  // O comprimento tipico de um objeto DESTA imagem, em pixels: a mediana do
  // maior lado dos contornos ja segmentados. E o que permite conferir se a
  // escala informada faz sentido para a especie declarada.
  const comprimentoTipicoEmPixels = useMemo(() => {
    const lados = yoloSegmentations
      .filter((s) => s.visible !== false)
      .map((s) => {
        const caixa = envolver(s.polygon_points);
        return caixa ? Math.max(caixa.largura, caixa.altura) : 0;
      })
      .filter((l) => l > 0)
      .sort((a, b) => a - b);
    if (lados.length < 3) return undefined;
    const meio = Math.floor(lados.length / 2);
    return lados.length % 2 === 0 ? (lados[meio - 1] + lados[meio]) / 2 : lados[meio];
  }, [yoloSegmentations]);

  // A conta e opcional e so lembra a bancada. Sem VITE_GOOGLE_CLIENT_ID o botao
  // nem aparece; o resto do aplicativo nao sabe que ela existe.
  const conta = useConta(metadata, setMetadata);

  /**
   * Espécie ou cultura já conhecida sobre esta imagem, por qualquer via:
   * declarada no boletim (`metadata.amostra`), ou o conjunto do explorador
   * de datasets (B3) quando o nome bate com a tabela de tamanhos típicos.
   * Alimenta a 4ª receita do ensaio (`receitaPelaEspecie`) e o filtro de
   * receitas salvas por espécie — é REFERÊNCIA, não veredito: só entra no
   * ensaio como mais uma opção que a pessoa escolhe como qualquer outra.
   */
  const especieOuCulturaDeclarada = useMemo(() => {
    const declarada = metadata.amostra?.especieNomeCientifico || metadata.amostra?.especieNomeComum;
    if (declarada) return declarada;
    const conjunto = metadata.dataset?.conjunto?.toLowerCase();
    if (!conjunto) return undefined;
    const achado = TAMANHOS.find(
      (t) => conjunto.includes(t.nomeComum.toLowerCase()) || conjunto.includes(t.chave)
    );
    return achado?.nomeComum;
  }, [metadata.amostra?.especieNomeCientifico, metadata.amostra?.especieNomeComum, metadata.dataset?.conjunto]);

  const { receitas: receitasSalvas, salvar: salvarReceitaEncontrada } =
    useReceitasSalvas(especieOuCulturaDeclarada);

  // O painel "Modelo (IA)" só serve para orquídea (tetrazólio) — recolhido
  // por padrão quando a espécie declarada não contém "orqu". Reage a mudança
  // de espécie: declarar orquídea depois de carregar reabre o painel sozinho.
  const especieEhOrquidea = /orqu/i.test(especieOuCulturaDeclarada ?? '');
  const [iaAberto, setIaAberto] = useState(especieEhOrquidea);
  useEffect(() => {
    setIaAberto(especieEhOrquidea);
  }, [especieEhOrquidea]);

  /**
   * A imagem que a SEGMENTACAO le.
   *
   * Fundo achatado quando existe; original caso contrario. A onda e a borracha
   * decidem fronteira por diferenca de cor, e sao exatamente elas que ganham
   * com o gradiente removido.
   */
  const imagemDeTrabalho = fundoAchatado ?? image;
  /** O que as automações de segmentação leem — o gatilho acima manda nisto. */
  const imagemParaAutomacoes = forcarOriginalNasAutomacoes ? image : imagemDeTrabalho;

  /**
   * O painel de medidas flutua sobre a area morta ao lado da imagem.
   *
   * Flutuar, e nao ocupar coluna: numa digitalizacao panoramica nao sobra
   * area morta nenhuma, e uma coluna fixa empurraria a imagem para caber.
   * Por isso ele e recolhivel, e o recolhimento e lembrado.
   */
  const [painelDeMedidasAberto, setPainelDeMedidasAberto] = useState<boolean>(() =>
    lerPreferencia('sc:painelDeMedidas', true)
  );
  useEffect(() => {
    setUltimaGravacao(null);
  }, [filename]);

  // A regra vive em `lib/contagem.ts`, com teste: é o número que o aplicativo
  // existe para produzir, e já quebrou uma vez estando solto aqui.
  const contagem = contarObjetos(marks, yoloSegmentations);
  const viableCount = contagem.viaveis;

  // Cálculo diferencial: quem conhece o total semeado marca só as viáveis, e
  // as inviáveis saem por subtração.
  const usaDiferencial =
    !!metadata.useDifferential && !!metadata.baselineCount && metadata.baselineCount > 0;

  const inviableCount = usaDiferencial
    ? Math.max(0, (metadata.baselineCount ?? 0) - viableCount)
    : contagem.inviaveis;

  const totalCount =
    metadata.useDifferential && metadata.baselineCount && metadata.baselineCount > 0
      ? metadata.baselineCount
      : viableCount + inviableCount;

  const viablePercent = totalCount > 0 ? ((viableCount / totalCount) * 100).toFixed(1) : '0';
  const inviablePercent = totalCount > 0 ? ((inviableCount / totalCount) * 100).toFixed(1) : '0';

  // `PainelDeComparacao` (aba Resultados) só existe com DUAS OU MAIS bancadas
  // COM IMAGEM — com uma só, a aba não pode mudar nada (Global Constraints do
  // plano de bancadas). A contagem mora AQUI, e não só dentro do painel,
  // porque `RightSidebar` decide o separador (`<hr>`) pela PRESENÇA do prop
  // `comparacaoContent`, e um elemento React é "presente" mesmo quando o
  // componente que ele instancia devolve `null` — passar o elemento sempre e
  // deixar só o componente se recusar deixaria o separador sobrando com uma
  // bancada só.
  const bancadasComImagemParaComparar = bancadas.todas
    .slice(0, bancadas.abertas)
    .filter((b) => !!b.fila.image).length;
  const comparacaoContent =
    bancadasComImagemParaComparar >= 2 ? <PainelDeComparacao bancadas={bancadas} /> : undefined;

  // Imagem com os ajustes aplicados.
  //
  // Vai para o detector CLÁSSICO e não para o modelo, e a diferença não é
  // detalhe. No clássico o ajuste é controle: a pessoa regula o limiar e vê o
  // efeito na hora. No modelo é sabotagem silenciosa — a rede foi treinada em
  // digitalização crua, e brilho, contraste ou saturação empurram a entrada
  // para fora da distribuição de treino sem que nada na tela diga que foi isso
  // que degradou o resultado.
  //
  // Escala de cinza é o caso extremo: colapsa a entrada no plano R=G=B, onde
  // todo filtro que codifica diferença entre canais produz exatamente zero.
  // Não é deslocamento recuperável, é informação destruída.
  const adjustedSource = useMemo(() => {
    const base = imagemDeTrabalho;
    if (!base || !adjustEnabled || isNeutral(adjustments)) return base;
    return applyAdjustments(base, adjustments) ?? base;
  }, [imagemDeTrabalho, adjustments, adjustEnabled]);

  // Filtro CSS para a prévia instantânea no canvas — só quando o ajuste cabe
  // em CSS. Canal, gama e deslocamento por cor exigem pixels: aí o canvas
  // recebe `adjustedSource` e o filtro fica em 'none' (senão aplicaria duas vezes).
  const ajusteExigePixels = adjustEnabled && exigePixels(adjustments);
  /** O retrato que o indicador do rodapé lê — nada de decidir em dois lugares. */
  const estadoDaImagem = useMemo(
    () => ({
      fundoAchatado: !!fundoAchatado,
      ajusteEmPixels: ajusteExigePixels,
      ajusteEmTela: adjustEnabled && !ajusteExigePixels && !isNeutral(adjustments),
      forcarOriginal: forcarOriginalNasAutomacoes,
    }),
    [fundoAchatado, ajusteExigePixels, adjustEnabled, adjustments, forcarOriginalNasAutomacoes]
  );
  const canvasFilter = useMemo(
    () => (adjustEnabled && !ajusteExigePixels ? toCssFilter(adjustments) : 'none'),
    [adjustments, adjustEnabled, ajusteExigePixels]
  );
  /** O que o canvas pinta: pixels ajustados quando o CSS não dá conta; a imagem de trabalho no resto. */
  const fonteDoCanvas = ajusteExigePixels ? adjustedSource : imagemDeTrabalho;

  // Re-draw Canvas markings
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const base = fonteDoCanvas;
    if (!canvas || !base) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // A imagem de TRABALHO, nao a original. Foi o defeito relatado como "ta
    // igual": o achatamento chegava a onda e a borracha, mas o canvas
    // continuava pintando a original — a pessoa nao tinha como ver o que a
    // onda estava vendo.
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    // Draw manual marks
    if (mostraPontos(mascara)) {
      renderMarksToContext(
        ctx,
        marks,
        visualMode,
        base.width,
        ajusteDaMarca,
        yoloSegmentations,
        estiloDaMarca,
        opacidadeDaMarca
      );
    }
  }, [
    fonteDoCanvas,
    marks,
    visualMode,
    ajusteDaMarca,
    mascara,
    yoloSegmentations,
    estiloDaMarca,
    opacidadeDaMarca,
  ]);

  useEffect(() => {
    if (imagemDeTrabalho && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = imagemDeTrabalho.width;
      canvas.height = imagemDeTrabalho.height;
      drawCanvas();
    }
  }, [imagemDeTrabalho, drawCanvas, marks, visualMode, mascara, yoloSegmentations]);

  // Handle canvas click to place a manual mark
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningMode) return;
    // Ferramentas que não criam marcações.
    if (activeTool === 'eraser' || activeTool === 'pan' || activeTool === 'cota' || activeTool === 'caixa') return;
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Scale coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // A ferramenta ativa define a classe; Shift/Ctrl/botão direito invertem.
    const baseType = activeTool === 'inviable' ? 'inviable' : 'viable';
    const shouldInvert = e.shiftKey || e.ctrlKey || e.button !== 0;
    const type = shouldInvert ? (baseType === 'viable' ? 'inviable' : 'viable') : baseType;

    if (activeTool === 'chamada') {
      const texto = prompt('Digite a anotação:');
      if (texto) {
        mutar((antes) => ({
          ...antes,
          anotacoesVisuais: [
            ...(antes.anotacoesVisuais || []),
            {
              id: Date.now().toString(),
              tipo: 'chamada',
              p: [x, y],
              texto,
            },
          ],
        }));
      }
      return;
    }

    if (activeTool === 'onda') {
      segmentarComOnda(x, y, type);
      return;
    }

    marcarComSom(x, y, type);
  };

  /**
   * Segmentação por clique.
   *
   * A marcação é criada SEMPRE, mesmo quando o contorno não sai confiável: o
   * ponto clicado é a identidade e a localização da semente, e a contagem não
   * pode depender de o algoritmo ter acertado a borda. Quem contou foi a
   * pessoa.
   *
   * O contorno, esse sim, só entra quando dá para confiar. Contorno errado não
   * é um detalhe estético — ele vira área, comprimento e largura no CSV, e um
   * número errado é pior que número nenhum.
   */
  /**
   * Marca E toca — quando o som esta ligado.
   *
   * `tocarMarca` ja confere a preferencia por dentro e cria o AudioContext so
   * neste gesto (politica de autoplay), entao chamar sempre e seguro: sem
   * preferencia ligada, silencio.
   */
  const classeExternaDaImagem = metadata.dataset?.classesDaImagem && metadata.dataset.classesDaImagem.length > 0
    ? metadata.dataset.classesDaImagem.join(' + ')
    : undefined;

  const marcarComSom = useCallback(
    (x: number, y: number, tipo: 'viable' | 'inviable') => {
      const id = addMark(x, y, tipo, classeExternaDaImagem);
      tocarMarca(tipo);
      return id;
    },
    [addMark, classeExternaDaImagem]
  );

  const segmentarComOnda = useCallback(
    (x: number, y: number, tipo: 'viable' | 'inviable') => {
      // `imagemParaAutomacoes` some quando forcarOriginalNasAutomacoes está
      // ligado mas a imagem original ainda não carregou — guarda de tipo, não
      // caso novo: sem ela, segmentarNoCanvas nem tem o que ler.
      if (!imagemDeTrabalho || !imagemParaAutomacoes) return;
      const marcaId = marcarComSom(x, y, tipo);

      const inicio = performance.now();
      // A imagem de TRABALHO, nao a original: se a pessoa achatou o fundo, foi
      // exatamente para a onda parar na borda certa. Passar a original aqui
      // tornava o achatamento decorativo.
      const r = segmentarNoCanvas(imagemParaAutomacoes, { x, y });
      const ms = Math.round(performance.now() - inicio);

      if (!r) {
        setRecadoDaOnda({ tom: 'aviso', texto: 'Não foi possível ler os pixels desta imagem.' });
        return;
      }

      if (r.tocouBorda) {
        setRecadoDaOnda({
          tom: 'aviso',
          texto: 'Contagem registrada, sem contorno: a onda escapou. Clique mais para dentro da semente.', // prettier-ignore
        });
        return;
      }

      const area = metadata.umPerPixel
        ? `${((r.areaPx * metadata.umPerPixel ** 2) / 1e6).toFixed(3)} mm²`
        : `${r.areaPx} px`;

      // Comprimento e largura pelos EIXOS PRINCIPAIS do contorno, e nao pela
      // caixa alinhada aos eixos da imagem: uma semente deitada na diagonal tem
      // caixa quase quadrada, e a caixa mediria a diagonal em vez da semente.
      // A PCA gira o objeto ate ele deitar, e ai mede.
      const { width, height } = calculateSeedDimensions(r.contorno);

      appendYoloSegmentation({
        id: Date.now() + Math.floor(Math.random() * 1000),
        category: tipo,
        class_name: tipo === 'viable' ? 'viavel' : 'inviavel',
        classeExterna: classeExternaDaImagem,
        // Não é probabilidade de modelo: foi a pessoa que apontou a semente.
        confidence: 1,
        polygon_points: r.contorno,
        visible: true,
        width,
        height,
        // A marcação criada por este mesmo clique é quem conta a semente.
        origem: 'clique',
        marcaId,
      // Marca e contorno sairam do MESMO clique: um Ctrl+Z tira os dois.
      }, { fundir: true });

      setRecadoDaOnda({ tom: 'ok', texto: `Contorno medido — ${area} · ${ms} ms` });
    },
    [imagemDeTrabalho, marcarComSom, appendYoloSegmentation, metadata.umPerPixel, classeExternaDaImagem]
  );

  // Limpa a placa atual: contagem, calibração e identificação da placa.
  // Preserva o histórico, os experimentos e a identificação do trabalho
  // (pesquisador, projeto, tratamento), que o usuário não deve redigitar a
  // cada placa. A confirmação vive no ConfirmDialog, que lista o alcance.
  const handleResetCurrentPlate = () => {
    resetAllAnnotations();
    setMetadata((prev) => ({
      ...prev,
      plate: '',
      quadrant: '',
      notes: '',
      baselineCount: 0,
      useDifferential: false,
      umPerPixel: undefined,
    }));
  };

  // Save local history session
  const saveCurrentSession = (silent = false) => {
    if (!filename) return;

    let imageDataStr: string | undefined = undefined;
    if (image) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        imageDataStr = canvas.toDataURL('image/jpeg', 0.85); // High quality but compressed
      }
    }

    const newSession: Session = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      filename,
      viableCount,
      inviableCount,
      metadata: { ...metadata },
      marks,
      yoloSegmentations,
      imageData: imageDataStr,
    };
    addSession(newSession);
    setUltimaGravacao(Date.now());
    if (!silent) {
      alert('Sessão salva com sucesso no histórico local!');
    }
  };

  const handleLoadSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    // A sessão restaurada é um contexto próprio: não faz parte da fila de
    // imagens carregada antes. Limpar a fila esconde "Anterior/Próxima", que
    // até aqui continuava apontando para os arquivos antigos e trocava a
    // imagem por baixo da sessão recém-aberta.
    setImageQueue([]);
    setCurrentImageIndex(0);
    bancada.cena.chaveAtual.current = null;

    setMetadata(session.metadata);
    setFilename(session.filename);
    carregar({ marks: session.marks, segmentacoes: session.yoloSegmentations });

    // Restore image if available
    if (session.imageData) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setZoomLevel(1);
        setIsHistoryModalOpen(false);
        navigate('counter');
      };
      img.onerror = () => {
        alert('Erro ao carregar a imagem salva da sessão.');
      };
      img.src = session.imageData;
    } else {
      setIsHistoryModalOpen(false);
      navigate('counter');
      alert(
        `Sessão carregada, mas esta sessão antiga não possui a imagem salva no banco.\nPor favor, carregue o arquivo de imagem "${session.filename}" manualmente.`
      );
    }
  };

  const saveAndNext = () => {
    saveCurrentSession(true);
    handleNextImage();
  };

  // JSON Import Parser supporting backups, YOLO segmentations and single session files
  const processJSONFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);

          // 1. Check if it is a YOLO segmentation JSON file
          if (parsed && (Array.isArray(parsed.segmentations) || parsed.segmentations)) {
            const rawSegs = Array.isArray(parsed.segmentations) ? parsed.segmentations : [];

            // Map and calculate PCA dimensions
            const mappedSegs: YoloSegmentation[] = rawSegs.map((seg: any, idx: number) => {
              const polygon_points = seg.polygon_points || seg.points || [];
              const { width, height } = calculateSeedDimensions(polygon_points);

              // `category` → `class_name` (com ou sem acento) → índice pela tabela
              // do treino. Antes `class === 1` virava inviável aqui, mas 1 é
              // VIÁVEL em `YOLO_CLASSES` — o mesmo engano que a fila com IA teve.
              const category = categoriaImportada(seg);

              return {
                id: seg.id ?? idx,
                category,
                class_name: nomeDaCategoria(category),
                confidence: seg.confidence ?? 1.0,
                polygon_points,
                visible: seg.visible !== false,
                edited: seg.edited ?? false,
                width,
                height,
              };
            });

            addYoloSegmentations(mappedSegs);
            alert(`YOLO segmentações importadas! Encontradas ${mappedSegs.length} segmentações.`);
            return;
          }

          // 2. Check if it is a SeedCounter backup history array
          if (Array.isArray(parsed)) {
            // `importSessions` é assíncrona (grava no IndexedDB): sem o await
            // aqui `success` era a Promise em si, sempre truthy — o alerta de
            // "formato inválido" nunca disparava, mesmo quando a gravação
            // falhava. `strictNullChecks` (TS2801) pegou isso.
            const success = await importSessions(parsed);
            if (success) {
              alert(
                `Histórico importado com sucesso! ${parsed.length} sessões adicionadas/mescladas.`
              );
            } else {
              alert('Formato de histórico inválido.');
            }
            return;
          }

          // 3. Check if it is a single SeedCounter session JSON
          if (parsed && parsed.metadata && (parsed.marks || parsed.yoloSegmentations)) {
            if (parsed.metadata) setMetadata(parsed.metadata);
            const mapped = (parsed.yoloSegmentations ?? []).map((seg: any) => {
              const { width, height } = calculateSeedDimensions(seg.polygon_points || []);
              return {
                ...seg,
                width: seg.width ?? width,
                height: seg.height ?? height,
              };
            });
            carregar({ marks: parsed.marks ?? [], segmentacoes: mapped });
            if (parsed.filename) setFilename(parsed.filename);
            alert('Sessão importada com sucesso!');
            return;
          }

          alert('Arquivo JSON com formato não reconhecido (não é YOLO, Backup ou Sessão).');
        } catch (error) {
          console.error('Erro ao importar o arquivo JSON', error);
          alert('Erro ao ler o arquivo JSON. Certifique-se de que é um formato válido.');
        }
      };
      reader.readAsText(file);
    },
    [addYoloSegmentations, carregar, importSessions, setMetadata, setFilename]
  );

  // Drag & drop hook
  const onFilesDropped = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      const jsons = files.filter((f) => f.name.endsWith('.json') || f.type === 'application/json');

      if (images.length > 0) {
        // Mesmo caminho do botão: com cena ocupada, pergunta antes de abrir.
        carregarArquivos(images);
      }
      if (jsons.length > 0) {
        processJSONFile(jsons[0]);
      }
    },
    [carregarArquivos, processJSONFile]
  );

  const { isDragActive } = useDragDrop({ onFilesDropped });

  // O cronômetro é POR CENA: a chave junta bancada, arquivo e página, então
  // trocar de página do TIFF zera — é outra espécie, é outra amostra, é outro
  // tempo. Ver `useCronometro`, decisão 3.
  const cronometro = useCronometro(`${bancada.id}|${filename}|${paginaDoTiff}`);

  // Só o rodapé precisa disto aqui: Header e laterais leem o contexto sozinhos.
  const { visibilidade } = useVisibilidade();

  // As exportações moram em `features/exportar` (ver o cabeçalho de
  // `useExportacoes.ts`). O hook recebe a cena e devolve os mesmos handlers
  // que os modais sempre receberam; a procedência continua montada na hora
  // de exportar, a partir de `cronometro.ler`.
  const {
    buildMeasurementContext,
    handleExportTextReport,
    handleExportJSON,
    handleExportCSV,
    handleExportMeasurementsCSV,
    handleExportSQL,
    handleImageExportWithOptions,
    handleExportPDF,
    handleExportHistoryBatchPDF,
    handleExportHistoryCSV,
    handleExportHistoryJSON,
  } = useExportacoes({
    marks,
    segmentacoes: yoloSegmentations,
    metadata,
    filename,
    image,
    sessions,
    contagem: { viableCount, inviableCount, totalCount, viablePercent, inviablePercent },
    aparencia: { visualMode, ajusteDaMarca, estiloDaMarca, opacidadeDaMarca },
    laboratorio,
    lerTempo: cronometro.ler,
    pagina: { paginasDoTiff, paginaDoTiff, dpiDeclarado },
    calibracaoConferida,
  });

  const handleImportHistoryJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processJSONFile(file);
    }
    e.target.value = '';
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  // Fase E — foto capturada entra no fluxo normal de imagens.
  const handleCameraCapture = useCallback(
    (file: File) => {
      loadFiles([file]);
      // Câmera exige calibração manual de escala (não há DPI de scanner).
      updateMetadata('imageSource', 'manual_camera');
    },
    [loadFiles, updateMetadata]
  );

  /** Última resposta da onda, mostrada junto ao canvas. */
  const [recadoDaOnda, setRecadoDaOnda] = useState<{
    tom: 'ok' | 'aviso';
    texto: string;
  } | null>(null);

  // O recado some sozinho. Aviso que fica para sempre deixa de ser lido, e o
  // seguinte perde a chance de ser notado.
  useEffect(() => {
    if (!recadoDaOnda) return;
    const t = setTimeout(() => setRecadoDaOnda(null), recadoDaOnda.tom === 'ok' ? 2500 : 5000);
    return () => clearTimeout(t);
  }, [recadoDaOnda]);

  // Cena de exemplo: entra pela mesma porta que qualquer imagem, para exercitar
  // o fluxo real — fila, contagem, medida, exportação — e não um caminho
  // paralelo que só funciona na demonstração.
  const [exemploCarregando, setExemploCarregando] = useState<PresetDeCena | null>(null);

  const handleCarregarExemplo = useCallback(
    async (preset: PresetDeCena) => {
      setExemploCarregando(preset);
      try {
        const { arquivo, cena, projeto } = await carregarExemplo(preset);
        loadFiles([arquivo]);
        // A escala vem declarada pela cena: sem ela a morfometria sairia em
        // pixels, e o exemplo não mostraria milímetros — que é metade do ponto.
        setMetadata((prev) => ({
          ...prev,
          project: projeto,
          treatment: '',
          plate: '',
          quadrant: '',
          notes: AVISO_CENA,
          umPerPixel: cena.umPorPixel,
          dataset: undefined,
        }));
      } catch (e) {
        console.error('Falha ao gerar a cena de exemplo', e);
      } finally {
      setFilaIARodando(false);
        setExemploCarregando(null);
      }
    },
    [loadFiles, setMetadata]
  );

  const [exemploRealCarregando, setExemploRealCarregando] = useState<string | null>(null);
  /**
   * Exemplo REAL: a imagem vem de public/exemplos e os metadados que se
   * conhecem (espécie, origem, classe, escala quando medida) já entram — o
   * que não se conhece fica vazio e o app pede, em vez de inventar.
   */
  const handleCarregarExemploReal = useCallback(
    async (e: ExemploReal) => {
      setExemploRealCarregando(e.slug);
      try {
        const { arquivo, metadados } = await carregarExemploReal(e);
        loadFiles([arquivo]);
        setMetadata((prev) => ({
          ...prev,
          ...metadados,
          plate: '',
          quadrant: '',
          // A imagem anterior pode ter vindo do explorador; a classe dela não é desta.
          dataset: undefined,
          amostra: { ...prev.amostra, ...metadados.amostra },
        }));
      } catch (err) {
        console.error('Falha ao abrir o exemplo real', err);
        setLoadError(`Não foi possível abrir o exemplo "${e.rotulo}".`);
      } finally {
        setExemploRealCarregando(null);
      }
    },
    [loadFiles, setMetadata, setLoadError]
  );

  // --- Explorador de datasets (Lote B) ---------------------------------------
  //
  // A pasta aberta mora aqui (não dentro do painel) porque é estado da sessão:
  // recolher a aba Datasets e voltar não a fecha. `anotacaoAtual`,
  // `datasetContexto` e `referenciaJaCarregada` são estado de CENA — vêm de
  // `bancada.cena`, desestruturados lá em cima; `anotacaoAtual` é a anotação
  // da ÚLTIMA imagem carregada pelo explorador, e só vira marca/contorno
  // quando "Carregar referência" é clicado.
  const [pastaDeDatasets, setPastaDeDatasets] = useState<PastaAberta | null>(null);

  const handleCarregarDoDataset = useCallback(
    async (arquivo: ArquivoDoDataset, anotacao: AnotacaoCarregada | null, conjunto: string, caminho: string) => {
      const file = await arquivo.obterFile();
      // O vínculo com o dataset é entregue a `onImageLoaded`, que zera o
      // vínculo de TODA imagem nova e só mantém o que foi anunciado aqui —
      // senão a classe da imagem anterior ficava colada na seguinte.
      datasetPendente.current = { conjunto, caminho, classesDaImagem: anotacao?.classesDaImagem };
      loadFiles([file]);
      setAnotacaoAtual(anotacao);
      setDatasetContexto({ conjunto, caminho });
      setReferenciaJaCarregada(false);
    },
    [loadFiles]
  );

  /**
   * "Carregar referência" — o SEGUNDO gesto. Clicar na miniatura já carregou a
   * imagem; só agora a anotação do dataset vira marca/contorno de verdade.
   *
   * Polígono vira contorno com `origem: 'referencia'` (conta como semente,
   * mesma regra de um contorno de modelo — ver `objetos.ts`). Caixa vira
   * marca no centro. Nome de classe que bate com viável/inviável usa a
   * taxonomia do app; qualquer outro nome (amendoim com mofo, trigo duro…)
   * fica em `classeExterna`, cru — inventar uma correspondência que ninguém
   * validou seria pior que não ter classe nenhuma.
   */
  const normalizarClasseExterna = useCallback(
    (classe: string): { category: 'viable' | 'inviable'; class_name: string; classeExterna?: string } => {
      const category = categoriaDoNome(classe);
      if (category) return { category, class_name: nomeDaCategoria(category) };
      return { category: 'viable', class_name: 'viavel', classeExterna: classe };
    },
    []
  );

  const podeCarregarReferencia =
    !!image &&
    !referenciaJaCarregada &&
    !!anotacaoAtual &&
    ((anotacaoAtual.contornos?.length ?? 0) > 0 || (anotacaoAtual.marcas?.length ?? 0) > 0);

  const handleCarregarReferencia = useCallback(() => {
    if (!anotacaoAtual) return;

    if (anotacaoAtual.contornos && anotacaoAtual.contornos.length > 0) {
      const novasSegmentacoes: YoloSegmentation[] = anotacaoAtual.contornos.map((c, i) => {
        const { width, height } = calculateSeedDimensions(c.poligono);
        const { category, class_name, classeExterna } = normalizarClasseExterna(c.classe);
        return {
          id: Date.now() + i,
          category,
          class_name,
          confidence: 1,
          polygon_points: c.poligono,
          visible: true,
          width,
          height,
          origem: 'referencia',
          ...(classeExterna ? { classeExterna } : {}),
        };
      });
      addYoloSegmentations(novasSegmentacoes);
    }

    if (anotacaoAtual.marcas && anotacaoAtual.marcas.length > 0) {
      const novasMarcas: Mark[] = anotacaoAtual.marcas.map((m, i) => {
        const { category } = normalizarClasseExterna(m.classe);
        return {
          id: Date.now() + i + 1,
          x: m.x,
          y: m.y,
          type: category,
          origem: 'referencia' as const,
        };
      });
      setMarks((prev) => [...prev, ...novasMarcas]);
    }

    setReferenciaJaCarregada(true);
    setRecadoDaOnda({ tom: 'ok', texto: 'Referência do dataset carregada.' });
  }, [anotacaoAtual, addYoloSegmentations, setMarks, normalizarClasseExterna]);

  // A ferramenta ativa é a fonte única de verdade do modo de interação:
  // manter isPanningMode em sincronia evita que a "mãozinha" continue ligada
  // depois de trocar de ferramenta (o que bloqueava os cliques de marcação).
  useEffect(() => {
    setIsPanningMode(activeTool === 'pan');
  }, [activeTool, setIsPanningMode]);

  // Zoom com a roda do mouse, ancorado na posição do cursor.
  // Usa listener nativo com passive:false — o React registra 'wheel' como
  // passivo, o que impediria o preventDefault (a página rolaria junto).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !image) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && e.shiftKey) return; // deixa o scroll lateral livre
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      // Ponto sob o cursor, em coordenadas do conteúdo.
      const contentX = container.scrollLeft + offsetX;
      const contentY = container.scrollTop + offsetY;

      setZoomLevel((prev) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const next = Math.min(5, Math.max(0.1, prev * factor));
        const ratio = next / prev;
        // Reposiciona o scroll para manter o ponto sob o cursor.
        requestAnimationFrame(() => {
          container.scrollLeft = contentX * ratio - offsetX;
          container.scrollTop = contentY * ratio - offsetY;
        });
        return next;
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [image, setZoomLevel]);


  // Calibração — recebe a distância medida pela régua e encerra o modo.
  const handleMeasured = useCallback((pixels: number) => {
    setMeasuredPixels(pixels);
    setIsMeasuring(false);
  }, []);

  // Fase F — clicar numa marcação inverte a classe (viável ↔ inviável).
  // --- Ajuste de contorno -------------------------------------------------

  /**
   * O arraste de vertice em curso: o poligono COMO ESTAVA quando o gesto
   * comecou, e o raio de influencia calculado nele.
   *
   * Cada movimento do mouse e recalculado a partir do original, nao do
   * resultado do movimento anterior. Aplicar sobre o deformado derivava: o
   * raio vem do perimetro, o perimetro cresce com o puxao, e dez passos de
   * 4 px nao chegavam onde um passo de 40 chega.
   */
  const arrasteDeVertice = useRef<{
    id: number;
    indice: number;
    original: [number, number][];
    raio: number;
  } | null>(null);

  /**
   * Move um vertice, levando os vizinhos junto (arraste suave), e remede.
   *
   * Contínuo: o canvas abre um gesto no mousedown e fecha no mouseup, e cada
   * movimento entre os dois substitui o anterior no historico. Ctrl+Z volta
   * para ANTES do arraste, nao para o penultimo pixel.
   *
   * `rigido` (Shift) move so o vertice — para o ajuste fino de um ponto que
   * ficou fora depois de um puxao suave.
   */
  const handleMoverVertice = useCallback(
    (id: number, indice: number, x: number, y: number, rigido = false) => {
      let a = arrasteDeVertice.current;
      if (!a || a.id !== id || a.indice !== indice) {
        const seg = bancada.cena.segmentacoesRef.current.find((s) => s.id === id);
        if (!seg) return;
        a = { id, indice, original: seg.polygon_points, raio: raioDeInfluencia(seg.polygon_points) };
        arrasteDeVertice.current = a;
      }
      const original = a.original;
      const raio = rigido ? 0 : a.raio;
      setYoloSegmentations(
        (antes) =>
          antes.map((seg) => {
            if (seg.id !== id) return seg;
            const pontos = moverVerticeSuave(original, indice, [x, y], raio);
            const { width, height } = calculateSeedDimensions(pontos);
            return { ...seg, polygon_points: pontos, edited: true, width, height };
          }),
        { continuo: true }
      );
    },
    [setYoloSegmentations]
  );

  /** Fecha o gesto no historico e esquece o original do arraste. */
  const handleFimDeGesto = useCallback(() => {
    arrasteDeVertice.current = null;
    fecharGesto();
  }, [fecharGesto]);

  /**
   * Insere um vertice numa aresta — e o gesto de "clicar na borda para
   * puxar dali". Continuo porque o canvas ja arrasta o vertice novo no mesmo
   * gesto: insercao e arraste sao um passo so no historico.
   */
  const handleInserirVertice = useCallback(
    (id: number, aresta: number, x: number, y: number) => {
      setYoloSegmentations(
        (antes) =>
          antes.map((seg) => {
            if (seg.id !== id) return seg;
            const pontos = inserirVertice(seg.polygon_points, aresta, [x, y]);
            const { width, height } = calculateSeedDimensions(pontos);
            return { ...seg, polygon_points: pontos, edited: true, width, height };
          }),
        { continuo: true }
      );
    },
    [setYoloSegmentations]
  );

  const handleRemoverVertice = useCallback(
    (id: number, indice: number) => {
      setYoloSegmentations((antes) =>
        antes.map((seg) => {
          if (seg.id !== id || seg.polygon_points.length <= 3) return seg;
          const pontos = seg.polygon_points.filter((_, i) => i !== indice);
          const { width, height } = calculateSeedDimensions(pontos);
          return { ...seg, polygon_points: pontos, edited: true, width, height };
        })
      );
    },
    [setYoloSegmentations]
  );

  /**
   * O traco da borracha, resolvido pelo caminho de menor esforco no gradiente.
   *
   * A imagem lida e a ORIGINAL, nao a ajustada: o gradiente que interessa e o
   * da evidencia, e um realce de contraste move a borda aparente sem mover a
   * semente.
   */
  const handleAchatarFundo = useCallback(
    async (modo: ModoDeAchatamento) => {
      if (!image) return;
      setAchatando(true);
      const encerrar = iniciarAtividade('fundo', 'Modelando o fundo…');
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0);
        const dados = ctx.getImageData(0, 0, image.width, image.height);

        const r = achatarFundo(
          { data: dados.data, width: image.width, height: image.height },
          { modo }
        );

        if (!r) {
          setRecadoDaOnda({
            tom: 'aviso',
            texto: 'Não foi possível modelar o fundo desta imagem.',
          });
          return;
        }

        // Devolve os pixels ao canvas e cria a imagem de trabalho.
        ctx.putImageData(new ImageData(r.imagem.data, r.imagem.width, r.imagem.height), 0, 0);
        const nova = new Image();
        await new Promise<void>((resolve) => {
          nova.onload = () => resolve();
          nova.onerror = () => resolve();
          nova.src = canvas.toDataURL('image/png');
        });

        setFundoAchatado(nova);
        setFundoIncerto(r.incerto);
        setRecadoDaOnda({
          tom: r.incerto ? 'aviso' : 'ok',
          texto: r.incerto
            ? 'Fundo achatado, mas o modelo ficou incerto — confira antes de confiar.'
            : 'Fundo achatado. A detecção automática continua usando a imagem original.',
        });
      } finally {
        encerrar();
        setAchatando(false);
      }
    },
    [image]
  );

  const handleDesfazerFundo = useCallback(() => {
    setFundoAchatado(null);
    setFundoIncerto(false);
  }, []);

  /**
   * O corte proposto para o contorno selecionado, ou nulo quando nao ha cintura.
   *
   * A OPCAO DEPENDE DA ESPECIE, e isso veio de medicao. Dois discos que mal se
   * tocam produzem cintura de apenas 0,248 do raio equivalente; duas sementes
   * alongadas produzem 0,852. Usar o limiar de semente redonda numa orquideia
   * cortaria a semente sadia ao meio — a profundidade mediana dela ja e 0,199.
   */
  const corteProposto = useMemo(() => {
    if (activeTool !== 'contorno' || contornoSelecionado == null) return null;
    const alvo = yoloSegmentations.find((s) => s.id === contornoSelecionado);
    if (!alvo || alvo.visible === false) return null;

    const especie =
      metadata.amostra?.especieNomeCientifico || metadata.amostra?.especieNomeComum;
    const referencia = acharPorNome(especie);
    const ehAlongada = (referencia?.razaoMinima ?? 0) >= 2;

    return proporCorte(alvo.polygon_points, ehAlongada ? CORTE_PARA_SEMENTE_ALONGADA : {});
  }, [activeTool, contornoSelecionado, yoloSegmentations, metadata.amostra]);

  /**
   * Aplica o corte: um contorno vira dois.
   *
   * As duas metades herdam a classe do original e sao remedidas por PCA — uma
   * metade com as dimensoes do todo descreveria um contorno que nao existe.
   * A marca de `edited` fica nas duas: elas nao vieram do modelo.
   */
  const handleAplicarCorte = useCallback(() => {
    if (!corteProposto || contornoSelecionado == null) return;
    const alvo = bancada.cena.segmentacoesRef.current.find((s) => s.id === contornoSelecionado);
    if (!alvo) return;

    const [a, b] = corteProposto.partes;
    const base = Date.now();

    // A CONTAGEM PRECISA SUBIR EM UM. Um contorno de clique nao conta — quem
    // conta e a marca. Cortar em dois sem criar a segunda marca deixaria duas
    // sementes com uma contagem so, e o numero do laudo ficaria ERRADO para
    // baixo. Entao: a marca original fica com a metade que a contem, e a outra
    // metade ganha uma marca nova no proprio centroide.
    const marcaOriginal = alvo.marcaId != null ? bancada.cena.marcasRef.current.find((m) => m.id === alvo.marcaId) : undefined;
    const contemOriginal = (pontos: [number, number][]) =>
      !!marcaOriginal && pontoNoPoligono(marcaOriginal.x, marcaOriginal.y, pontos);

    let criouMarca = false;
    const filhas = [a, b].map((pontos, i) => {
      const { width, height } = calculateSeedDimensions(pontos);
      let marcaId = alvo.marcaId;
      if (alvo.origem === 'clique') {
        if (contemOriginal(pontos)) {
          marcaId = marcaOriginal!.id;
        } else {
          const [cx, cy] = centroide(pontos);
          marcaId = addMark(cx, cy, alvo.category, alvo.classeExterna);
          criouMarca = true;
        }
      }
      return {
        ...alvo,
        id: base + i,
        polygon_points: pontos,
        width,
        height,
        edited: true,
        marcaId,
      };
    });

    // O corte e UM gesto: a marca nova e as duas metades voltam juntas.
    setYoloSegmentations(
      (antes) => [...antes.filter((s) => s.id !== contornoSelecionado), ...filhas],
      { fundir: criouMarca }
    );
    setContornoSelecionado(null);
    setRecadoDaOnda({ tom: 'ok', texto: 'Contorno separado em dois.' });
  }, [corteProposto, contornoSelecionado, setYoloSegmentations, addMark]);

  /**
   * "Processar Fila (IA)": o YOLO em cada imagem da fila, uma sessão por
   * imagem na Galeria. O laço, o cancelamento, a duplicata e o isolamento de
   * erro moram em `features/lote/fila-ia.ts` (testado em node); aqui só se
   * liga o que é do navegador — worker, Dexie, barra de atividade, alerta.
   *
   * A cena aberta NÃO é tocada: nada aqui escreve em marcas, contornos ou
   * imagem da bancada. Trocar de bancada no meio é seguro — as sessões vão
   * para a Galeria (global) com os metadados da bancada de onde a fila foi
   * disparada, que é a procedência certa. O que o botão captura no clique
   * (fila e metadados) é o que se promete processar; o que mudar depois não
   * entra. Parar: `cancelarFilaIA()` do mesmo módulo, ligável a um botão.
   */
  const [filaIARodando, setFilaIARodando] = useState(false);
  const handlePararFilaIA = useCallback(async () => {
    const { cancelarFilaIA } = await import('./features/lote/fila-ia');
    cancelarFilaIA();
  }, []);

  const handleProcessarFilaIA = useCallback(async () => {
    if (imageQueue.length === 0) return;
    const { processarFilaComIA, analisarComModelo, filaIAEmAndamento, descreverRelato } = await import(
      './features/lote/fila-ia'
    );
    // Um worker só: uma segunda fila cancelaria as detecções da primeira.
    if (filaIAEmAndamento()) {
      alert('Já há uma fila com IA em andamento. Espere terminar ou cancele antes de começar outra.');
      return;
    }
    const { detectarNoWorker } = await import('./lib/yolo-worker-client');

    const total = imageQueue.length;
    const encerrar = iniciarAtividade('fila-ia', `IA na fila: imagem 1 de ${total}…`);
    // `filaIAEmAndamento()` é um sinalizador de módulo, e o React não
    // re-renderiza por ele. Este estado espelha o sinalizador só para o
    // cabeçalho trocar "Processar" por "Parar" e voltar.
    setFilaIARodando(true);
    try {
      const relato = await processarFilaComIA(imageQueue, {
        metadataBase: metadata,
        sessoesExistentes: sessions,
        analisar: (file) => analisarComModelo(file, detectarNoWorker),
        gravar: addSession,
        progresso: (feito, n) =>
          atualizarProgresso('fila-ia', feito / n, `IA na fila: imagem ${feito + 1} de ${n}…`),
        versaoDoApp: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : undefined,
        commit: typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : undefined,
      });
      alert(descreverRelato(relato));
    } catch (e) {
      // Só o que o laço não isola chega aqui (uma segunda fila, ou o módulo
      // que não carregou) — a falha por imagem já foi para o relato.
      console.error(e);
      alert(`Não foi possível processar a fila com IA: ${e instanceof Error ? e.message : 'erro desconhecido'}.`);
    } finally {
      encerrar();
    }
  }, [imageQueue, metadata, sessions, addSession]);



  /**
   * As marcacoes que ainda NAO tem contorno.
   *
   * Sao regioes ja identificadas por uma pessoa: ela disse "aqui tem uma
   * semente" e falta so o contorno. E a mesma lista que a galeria mostra como
   * "falta contornar".
   */
  const marcasSemContorno = useMemo(() => {
    const visiveis = yoloSegmentations.filter((s) => s.visible !== false);
    return marks.filter((m) => !visiveis.some((s) => pontoNoPoligono(m.x, m.y, s.polygon_points)));
  }, [marks, yoloSegmentations]);

  // --- Sugestoes contextuais e morfometria ao vivo --------------------------

  const especieDeclarada =
    metadata.amostra?.especieNomeCientifico || metadata.amostra?.especieNomeComum;

  /**
   * Perfil MEDIDO ("Medir esta pasta", B4) da classe da imagem ABERTA, dentro
   * do conjunto de onde ela veio — quando existir. `classesDaImagem` só existe
   * em imagem carregada do explorador de datasets; sem dataset, sem perfil, e
   * o inspetor mostra só a literatura (como sempre mostrou).
   *
   * A junção com ' + ' repete exatamente a regra de `DatasetsPanel.handleMedirPasta`
   * ao nomear a classe — é a mesma chave dos dois lados.
   */
  const { perfilDaClasse } = usePerfisMedidos(metadata.dataset?.conjunto);
  const classeDoDatasetAtivo = useMemo(() => {
    const cs = metadata.dataset?.classesDaImagem;
    if (!cs || cs.length === 0) return undefined;
    return cs.join(' + ');
  }, [metadata.dataset?.classesDaImagem]);
  const perfilMedidoAtivo = perfilDaClasse(classeDoDatasetAtivo)?.perfil ?? null;

  /**
   * A espécie é o que mais configura a bancada: priors, receita do ensaio,
   * protocolo, jeito de digitalizar. Por isso ela mora no cabeçalho, e
   * escolhê-la PREENCHE o que dela decorre — sem decidir nada sozinha: o
   * protocolo só é sugerido quando ainda não há um, e a calibração vira
   * recado, nunca escala aplicada.
   */
  const especieDaBancada = useMemo(() => especieAtual(metadata), [metadata]);
  /** Nomes que não estão nas tabelas: os já usados em sessões e as classes do dataset aberto. */
  const especiesExtras = useMemo(() => {
    const nomes = new Set<string>();
    for (const sessao of sessions) {
      const n = sessao.metadata?.amostra?.especieNomeComum || sessao.metadata?.amostra?.especieNomeCientifico;
      if (n) nomes.add(n);
    }
    for (const c of metadata.dataset?.classesDaImagem ?? []) nomes.add(c);
    return [...nomes];
  }, [sessions, metadata.dataset]);

  const handleEscolherEspecie = useCallback(
    (especie: EspecieConhecida | { nomeComum: string }) => {
      const conhecida = 'id' in especie ? especie : null;
      setMetadata((prev) => ({
        ...prev,
        protocolo:
          conhecida?.protocoloSugerido && (!prev.protocolo || prev.protocolo === 'simples')
            ? conhecida.protocoloSugerido
            : prev.protocolo,
        amostra: {
          ...prev.amostra,
          especieNomeComum: especie.nomeComum,
          especieNomeCientifico: conhecida?.nomeCientifico ?? prev.amostra?.especieNomeCientifico,
        },
      }));
      // Jeito típico de digitalizar: só um recado. Calibrar por conta própria
      // seria inventar escala — e escala inventada vira medida errada em mm.
      const aq = conhecida?.aquisicaoTipica;
      if (aq && !(metadata.umPerPixel && metadata.umPerPixel > 0)) {
        const eq = EQUIPAMENTOS_DO_LABORATORIO.find((e) => e.id === aq.equipamentoId);
        if (eq) {
          setRecadoDaOnda({
            tom: 'aviso',
            texto: `${especie.nomeComum} costuma ser digitalizada em ${eq.nome}${aq.dpi ? ` a ${aq.dpi} DPI` : ''}. Calibre na Etapa 1 — o DPI do driver é declaração; a régua na imagem é a conferência.`,
          });
        }
      }
    },
    [setMetadata, metadata.umPerPixel]
  );

  const handleLimparEspecie = useCallback(() => {
    setMetadata((prev) => ({
      ...prev,
      amostra: { ...prev.amostra, especieNomeComum: undefined, especieNomeCientifico: undefined },
    }));
  }, [setMetadata]);

  /**
   * As medidas completas de cada semente da imagem.
   */
  const medicoesDeMorfometria = useMemo(() => {
    if (!image) return [];
    return buildMeasurements({ marks, segmentations: yoloSegmentations, metadata, filename });
  }, [image, marks, yoloSegmentations, metadata, filename]);

  const regraAjustada = useMemo(() => {
    const base = REGRAS_PADRAO.find((r) => r.id === regraSelecionadaId);
    if (!base) return null;
    const limiar = limiaresCustomizados[base.id] ?? base.limiar;
    let ativa = { ...base, limiar };
    
    // Se a regra usa mm² mas não está calibrado, usamos px² adaptado temporariamente
    const calibrado = !!metadata.umPerPixel && metadata.umPerPixel > 0;
    if (!calibrado && ativa.campo === 'areaMm2') {
      ativa = {
        ...ativa,
        campo: 'areaPx' as const,
        limiar: ativa.limiar * 100,
      };
    }
    return ativa;
  }, [regraSelecionadaId, limiaresCustomizados, metadata.umPerPixel]);

  const sementesSimuladas = useMemo(() => {
    if (!regraAjustada || medicoesDeMorfometria.length === 0) return [];
    return simularRegra(medicoesDeMorfometria, regraAjustada);
  }, [medicoesDeMorfometria, regraAjustada]);

  /**
   * O resumo de morfometria, derivado a cada mudanca.
   */
  const resumoDeMorfometria = useMemo(() => {
    if (!image || medicoesDeMorfometria.length === 0) return null;
    return resumir(medicoesDeMorfometria, metadata.umPerPixel);
  }, [image, medicoesDeMorfometria, metadata.umPerPixel]);

  /**
   * O painel direito tem três abas: resultados, inspetor e galeria. Inspetor e
   * galeria eram janelas flutuantes que cobriam o canvas e "não fechavam" — a
   * pessoa perdia o X atrás do zoom. Como aba, o lugar delas é fixo, o fechar é
   * trocar de aba, e o canvas nunca fica coberto.
   */
  const [rightSidebarTab, setRightSidebarTab] = useState<
    'resultados' | 'inspetor' | 'galeria' | 'datasets' | 'lote' | 'analytics'
  >('resultados');
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(() =>
    lerPreferencia('sc:painelDireitoRecolhido', false)
  );
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(() =>
    lerPreferencia('sc:painelEsquerdoRecolhido', false)
  );
  const handleToggleLeftSidebar = useCallback(() => {
    setIsLeftSidebarCollapsed((prev) => {
      gravarPreferencia('sc:painelEsquerdoRecolhido', !prev);
      return !prev;
    });
  }, []);
  const abrirAbaDireita = useCallback((aba: 'resultados' | 'inspetor' | 'galeria' | 'datasets' | 'lote' | 'analytics') => {
    setRightSidebarTab(aba);
    setIsRightSidebarCollapsed(false);
  }, []);
  const galeriaAberta = rightSidebarTab === 'galeria' && !isRightSidebarCollapsed;

  // Selecionar um contorno leva ao inspetor; desselecionar não muda de aba
  // (a pessoa pode estar lendo os resultados e só clicou fora).
  useEffect(() => {
    if (contornoSelecionado != null) abrirAbaDireita('inspetor');
  }, [contornoSelecionado, abrirAbaDireita]);

  const handleToggleRightSidebar = useCallback(() => {
    setIsRightSidebarCollapsed((prev) => {
      const next = !prev;
      gravarPreferencia('sc:painelDireitoRecolhido', next);
      return next;
    });
  }, []);

  const handleDestacarSementes = useCallback(
    (ids: number[]) => {
      if (ids.length > 0) {
        setRecadoDaOnda({
          tom: 'ok',
          texto: `${ids.length} ${ids.length === 1 ? 'semente atendida' : 'sementes atendidas'}.`,
        });
        const primeiraMarca = marks[ids[0] - 1];
        if (primeiraMarca) {
          const seg = yoloSegmentations.find((s) => s.marcaId === primeiraMarca.id);
          if (seg) setContornoSelecionado(seg.id);
        }
      }
    },
    [marks, yoloSegmentations]
  );

  const handleAplicarRegra = useCallback(
    (regra: RegraParametrica) => {
      mutar((antes) => {
        const res = aplicarRegra(antes.marks, antes.segmentacoes, medicoesDeMorfometria, regra);
        return {
          ...antes,
          marks: res.marks,
          segmentacoes: res.segmentacoes,
        };
      });
      setRecadoDaOnda({
        tom: 'ok',
        texto: `Regra "${regra.nome}" aplicada. Ctrl+Z para desfazer.`,
      });
    },
    [mutar, medicoesDeMorfometria]
  );

  /**
   * Contorno selecionado atualmente ativo para inspeção biométrica e espectral.
   */
  const segmentacaoAtiva = useMemo(() => {
    if (contornoSelecionado == null) return null;
    return (
      yoloSegmentations.find((s) => s.id === contornoSelecionado && s.visible !== false) ?? null
    );
  }, [contornoSelecionado, yoloSegmentations]);

  /**
   * Limiares de aglomerado derivados DESTA imagem.
   *
   * Substitui os presets por espécie: o que a maioria dos contornos da cena
   * tem é a referência, e o par é o outlier. Com menos de 8 contornos não há
   * população — cai no padrão.
   */
  const limiaresDaCena = useMemo(() => {
    const contornos = yoloSegmentations
      .filter((s) => s.visible !== false)
      .map((s) => s.polygon_points);
    return limiaresDaPopulacao(contornos) ?? undefined;
  }, [yoloSegmentations]);

  /**
   * O inspetor pede para ver o corte: seleciona e mostra a linha. NUNCA aplica.
   *
   * A regra do corte e mostrar a proposta e esperar a pessoa decidir — cortar
   * por engano vira duas sementes onde havia uma, e o numero do laudo sobe.
   * Aplicar continua sendo so o botao Separar.
   */
  const handleProposeCut = useCallback(
    (id: number) => {
      setActiveTool('contorno');
      setContornoSelecionado(id);
    },
    [setActiveTool]
  );

  /**
   * O spike do menu radial (Tarefa 8, Degrau 1): classifica pela DIRECAO do
   * arraste do botao direito sobre um contorno, sem sair do canvas.
   *
   * As opcoes sao as seis raizes de TAXONOMIA — a classe fina do teste de
   * germinacao (`ClasseDeSemente`). A classificacao cai na MARCA vinculada ao
   * contorno, pelo mesmo `setSubclasse` que a galeria ja usa: nao existe um
   * segundo lugar para gravar classe so porque o gesto e outro.
   *
   * Um contorno de MODELO sem marca vinculada (`marcaId` nulo) nao tem onde
   * gravar — o gesto termina em silencio, como um clique que nao achou alvo.
   */
  const handleClassificarRadial = useCallback(
    (segId: number, chave: string) => {
      const seg = bancada.cena.segmentacoesRef.current.find((s) => s.id === segId);
      if (!seg || seg.marcaId == null) return;
      setSubclasse(seg.marcaId, chave as ClasseDeSemente);
    },
    [setSubclasse]
  );

  /** Quantos contornos tem forma incompativel com a especie declarada. */
  const contornosComFormaSuspeita = useMemo(() => {
    if (!especieDeclarada) return 0;
    let n = 0;
    for (const seg of yoloSegmentations) {
      if (seg.visible === false || !seg.width || !seg.height) continue;
      const v = conferirForma(seg.width, seg.height, especieDeclarada).veredicto;
      if (v === 'alongado-demais' || v === 'redondo-demais') n++;
    }
    return n;
  }, [yoloSegmentations, especieDeclarada]);

  /**
   * A sugestao da vez — no maximo uma.
   *
   * A preferencia e lida a cada calculo, e nao guardada em estado: desligar nas
   * configuracoes tem de calar o cartao no proximo render, sem recarregar.
   */
  const sugestaoAtual = useMemo(() => {
    if (!lerPreferencia(CHAVE_SUGESTOES, true)) return null;
    const estado: EstadoParaSugestao = {
      temImagem: !!image,
      chaveDaImagem: image ? filename || 'imagem' : null,
      totalDeMarcas: marks.length,
      marcasSemContorno: marcasSemContorno.length,
      totalDeContornos: yoloSegmentations.filter((s) => s.visible !== false).length,
      umPerPixel: metadata.umPerPixel,
      especie: especieDeclarada,
      comprimentoTipicoEmPixels,
      contornosComFormaSuspeita,
      minutosDesdeUltimaGravacao:
        ultimaGravacao === null ? null : (Date.now() - ultimaGravacao) / 60000,
      protocoloExigeTetrazolio: false,
    };
    return sugerir(estado, lerDispensadas(estado.chaveDaImagem));
  }, [
    image,
    filename,
    marks.length,
    marcasSemContorno.length,
    yoloSegmentations,
    metadata.umPerPixel,
    especieDeclarada,
    comprimentoTipicoEmPixels,
    contornosComFormaSuspeita,
    ultimaGravacao,
    versaoDispensadas,
  ]);

  /** Cada acao de sugestao dispara a MESMA coisa que o botao ou a tecla ja disparam. */
  const handleAcaoDeSugestao = useCallback(
    (acao: AcaoDeSugestao) => {
      setVersaoDispensadas((v) => v + 1);
      switch (acao) {
        case 'abrir-galeria':
          abrirAbaDireita('galeria');
          break;
        case 'abrir-calibracao':
          setActiveTool('viable');
          document.getElementById('etapa-calibracao')?.scrollIntoView({ behavior: 'smooth' });
          break;
        case 'ferramenta-contorno':
          setActiveTool('contorno');
          break;
        case 'salvar-sessao':
          saveCurrentSession(false);
          break;
        case 'abrir-identificacao':
          setIsIdentificacaoOpen(true);
          break;
      }
    },
    // saveCurrentSession e funcao comum (nao memoizada) e le refs por dentro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [segmentandoLote, setSegmentandoLote] = useState<{ feitas: number; total: number } | null>(
    null
  );

  /**
   * Roda a onda a partir de cada marcacao sem contorno.
   *
   * O trabalho ja foi feito pela pessoa quando ela marcou: o clique diz ONDE ha
   * semente, e a onda so precisa medir a borda. E por isso que isto e barato e
   * confiavel de um jeito que "detectar tudo do zero" nunca e.
   *
   * TRES REGRAS QUE NAO PODEM CAIR:
   *
   * 1. A CONTAGEM NAO MUDA. Nenhuma marcacao e criada nem apagada aqui — so
   *    contornos sao acrescentados. Se o lote errasse e criasse marcacao, o
   *    numero do laudo mudaria por causa de um botao de conveniencia.
   * 2. CONTORNO DUVIDOSO NAO ENTRA. A mesma regra do clique avulso: o contorno
   *    vira area e medida no CSV, e um numero errado e pior que numero nenhum.
   * 3. CEDE A TELA. Duzentas ondas seguidas travariam o navegador sem dizer
   *    nada; o laco solta o fio a cada poucas sementes e mostra o progresso.
   */
  /**
   * Contorna UMA marcacao, escolhida na galeria.
   *
   * Existe ao lado do lote porque sao gestos diferentes: o lote e "confio,
   * resolve tudo"; este e "quero ver o que a onda faz NESTA aqui". Serve para
   * conferir uma semente duvidosa antes de mandar o lote, e para o caso em que
   * so uma ficou de fora.
   */
  const handleSegmentarUma = useCallback(
    (marcaId: number) => {
      if (!imagemDeTrabalho || !imagemParaAutomacoes) return;
      const marca = marks.find((m) => m.id === marcaId);
      if (!marca) return;

      const r = segmentarNoCanvas(imagemParaAutomacoes, { x: marca.x, y: marca.y });
      if (!r || r.tocouBorda) {
        setRecadoDaOnda({
          tom: 'aviso',
          texto: 'A onda escapou nesta marcação — sem contorno. Tente ajustar o fundo ou o ponto.',
        });
        return;
      }

      const { width, height } = calculateSeedDimensions(r.contorno);
      appendYoloSegmentation({
        id: Date.now(),
        category: marca.type,
        class_name: marca.type === 'viable' ? 'viavel' : 'inviavel',
        classeExterna: marca.classeExterna,
        confidence: 1,
        polygon_points: r.contorno,
        visible: true,
        width,
        height,
        origem: 'clique',
        marcaId: marca.id,
      });
      setRecadoDaOnda({ tom: 'ok', texto: 'Contorno medido.' });
    },
    [imagemDeTrabalho, marks, appendYoloSegmentation]
  );

  const handleSegmentarPendentes = useCallback(async () => {
    if (!imagemDeTrabalho || !imagemParaAutomacoes || marcasSemContorno.length === 0) return;

    const pendentes = [...marcasSemContorno];
    setSegmentandoLote({ feitas: 0, total: pendentes.length });
    const encerrar = iniciarAtividade('lote', `Contornando ${pendentes.length} marcações…`);

    let medidas = 0;
    let escaparam = 0;

    for (let i = 0; i < pendentes.length; i++) {
      const marca = pendentes[i];
      const r = segmentarNoCanvas(imagemParaAutomacoes, { x: marca.x, y: marca.y });

      if (r && !r.tocouBorda) {
        const { width, height } = calculateSeedDimensions(r.contorno);
        appendYoloSegmentation(
          {
            id: Date.now() + i,
            category: marca.type,
            class_name: marca.type === 'viable' ? 'viavel' : 'inviavel',
            classeExterna: marca.classeExterna,
            confidence: 1,
            polygon_points: r.contorno,
            visible: true,
            width,
            height,
            origem: 'clique',
            marcaId: marca.id,
          },
          // O lote e um pedido so; Ctrl+Z desfaz o lote, nao um contorno.
          { fundir: medidas > 0 }
        );
        medidas++;
      } else {
        escaparam++;
      }

      if (i % 4 === 3) {
        setSegmentandoLote({ feitas: i + 1, total: pendentes.length });
        atualizarProgresso('lote', (i + 1) / pendentes.length);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    encerrar();
    setSegmentandoLote(null);
    setRecadoDaOnda({
      tom: escaparam > 0 ? 'aviso' : 'ok',
      texto:
        `${medidas} de ${pendentes.length} contornos medidos.` +
        (escaparam > 0
          ? ` ${escaparam} ${escaparam === 1 ? 'ficou' : 'ficaram'} sem contorno — a onda escapou. A contagem não mudou.`
          : ' A contagem não mudou.'),
    });
  }, [imagemDeTrabalho, marcasSemContorno, appendYoloSegmentation]);

  /**
   * Contornos propostos (ensaio, ou o painel Encontrar) → segmentações.
   *
   * Origem 'modelo' porque é proposta aceita sem marcação manual
   * correspondente (mesma semântica do AI Pointer — conta como semente).
   * Suspeitos de aglomerado entram também: a pessoa já vê o tracejado na
   * miniatura/fantasma, e o inspetor os sinaliza de novo depois; filtrar
   * aqui seria a ferramenta decidindo por ela.
   */
  const propostosParaSegmentacoes = useCallback(
    (propostos: ContornoProposto[]): YoloSegmentation[] => {
      const classesDaImagem = metadata.dataset?.classesDaImagem;
      const classeExterna =
        classesDaImagem && classesDaImagem.length > 0 ? classesDaImagem.join(' + ') : undefined;

      return propostos.map((p, i) => {
        const { width, height } = calculateSeedDimensions(p.contorno);
        return {
          id: Date.now() + i,
          category: 'viable' as const,
          class_name: 'viavel',
          classeExterna,
          confidence: 1,
          polygon_points: p.contorno,
          visible: true,
          width,
          height,
          origem: 'modelo' as const,
        };
      });
    },
    [metadata.dataset?.classesDaImagem]
  );

  /**
   * "Usar esta": o único caminho que leva os contornos de uma receita do
   * ensaio ao estado da aplicação. `addYoloSegmentations` SUBSTITUI a lista
   * inteira — correto aqui porque o ensaio dispara ao carregar a imagem,
   * quando ainda não há contorno manual para perder.
   *
   * Também carrega a receita usada nos controles do painel Encontrar
   * (`receitaAtiva`, C5) — "uma receita, três momentos": o que o ensaio
   * escolheu é o ponto de partida do que a pessoa ajusta a seguir.
   */
  const handleUsarEnsaio = useCallback(
    (r: ResultadoDoEnsaio) => {
      // Trilha: a receita e o número de objetos são o par que explica
      // "contou 3 quando eram 300". Sem os dois juntos, nenhum dos dois
      // sozinho aponta para nada.
      registrarEvento('receita:aplicar', {
        origem: 'ensaio',
        receita: r.receita.id,
        objetos: r.propostos.length,
      });
      addYoloSegmentations(propostosParaSegmentacoes(r.propostos));
      setReceitaAtiva(r.receita);
      setEnsaio(null);
    },
    [addYoloSegmentations, propostosParaSegmentacoes]
  );

  /**
   * "Aplicar", no painel Encontrar: faz exatamente o que "Usar esta" faz —
   * os contornos só entram no estado da aplicação por este botão, nunca
   * sozinhos a cada re-execução da localização.
   */
  const handleAplicarEncontrado = useCallback(
    (propostos: ContornoProposto[]) => {
      registrarEvento('receita:aplicar', {
        origem: 'encontrar',
        receita: receitaAtiva?.id ?? 'ajustada-a-mao',
        objetos: propostos.length,
      });
      addYoloSegmentations(propostosParaSegmentacoes(propostos));
    },
    [addYoloSegmentations, propostosParaSegmentacoes, receitaAtiva]
  );

  /** Salva a receita ajustada no painel Encontrar — 4ª opção do ensaio depois. */
  const handleSalvarReceitaEncontrada = useCallback(
    (nome: string, localizacao: DetectionOptions, onda: OpcoesDaOnda) => {
      void salvarReceitaEncontrada({
        nome,
        quando: 'Ajustada manualmente no painel Encontrar.',
        localizacao,
        onda,
      });
    },
    [salvarReceitaEncontrada]
  );

  /** A onda, fechada sobre a imagem de trabalho — para o painel Encontrar (C5). */
  const ondaParaEncontrar = useCallback(
    (p: { x: number; y: number }, opcoesDaOnda: OpcoesDaOnda) => {
      const alvo = imagemParaAutomacoes ?? image;
      if (!alvo) return null;
      const r = segmentarNoCanvas(alvo, p, opcoesDaOnda);
      return r ? { contorno: r.contorno, tocouBorda: r.tocouBorda } : null;
    },
    [imagemDeTrabalho, image]
  );

  /**
   * Foca o canvas numa semente vinda da Galeria (zoom + pan centralizado + seleção de contorno).
   */
  const handleFocarNoCanvas = useCallback(
    (coords: { x: number; y: number }, segmentacaoId?: number) => {
      if (segmentacaoId != null) {
        setContornoSelecionado(segmentacaoId);
        setActiveTool('contorno');
      } else {
        setActiveTool('onda');
      }
      const targetZoom = Math.max(zoomLevel, 2.8);
      setZoomLevel(targetZoom);

      setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;
        const targetScrollX = coords.x * targetZoom - container.clientWidth / 2;
        const targetScrollY = coords.y * targetZoom - container.clientHeight / 2;
        container.scrollTo({
          left: Math.max(0, targetScrollX),
          top: Math.max(0, targetScrollY),
          behavior: 'smooth',
        });
      }, 80);
    },
    [zoomLevel, setZoomLevel, setActiveTool]
  );

  /**
   * Poligono desenhado a mao.
   *
   * Se ha uma marca sem contorno DENTRO do que foi desenhado, o poligono e
   * dela — a pessoa marcou primeiro e desenhou depois, que e o fluxo natural.
   * Se nao ha, cria a marca no centroide: desenhar um contorno E dizer que ali
   * tem uma semente.
   */
  const handleDesenhoConcluido = useCallback(
    (pontos: [number, number][]) => {
      const visiveis = bancada.cena.segmentacoesRef.current.filter((s) => s.visible !== false);
      const orfa = bancada.cena.marcasRef.current.find(
        (m) =>
          pontoNoPoligono(m.x, m.y, pontos) &&
          !visiveis.some((s) => s.marcaId === m.id || pontoNoPoligono(m.x, m.y, s.polygon_points))
      );

      const tipo = orfa?.type ?? activeClassification;
      let marcaId = orfa?.id;
      if (marcaId == null) {
        const [cx, cy] = centroide(pontos);
        marcaId = addMark(cx, cy, tipo, classeExternaDaImagem);
      }

      const { width, height } = calculateSeedDimensions(pontos);
      appendYoloSegmentation({
        id: Date.now(),
        category: tipo,
        class_name: tipo === 'viable' ? 'viavel' : 'inviavel',
        classeExterna: orfa?.classeExterna ?? classeExternaDaImagem,
        confidence: 1,
        polygon_points: pontos,
        visible: true,
        width,
        height,
        edited: true,
        origem: 'clique',
        marcaId,
      // Se a marca nasceu neste desenho, cai junto com ele no Ctrl+Z.
      }, { fundir: orfa == null });
      setRecadoDaOnda({
        tom: 'ok',
        texto: orfa ? 'Contorno desenhado e vinculado à marcação.' : 'Contorno desenhado.',
      });
    },
    [activeClassification, addMark, appendYoloSegmentation, classeExternaDaImagem, bancada.cena.marcasRef, bancada.cena.segmentacoesRef]
  );

  const handleRaspar = useCallback(
    (id: number, pinceladas: Pincelada[], acrescentar: boolean) => {
      const fonte = imagemDeTrabalho;
      if (!fonte) return;
      const alvo = bancada.cena.segmentacoesRef.current.find((s) => s.id === id);
      if (!alvo) return;

      const canvas = document.createElement('canvas');
      canvas.width = fonte.width;
      canvas.height = fonte.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(fonte, 0, 0);
      const dados = ctx.getImageData(0, 0, fonte.width, fonte.height);

      const r = ajustarContorno(
        { data: dados.data, width: fonte.width, height: fonte.height },
        alvo.polygon_points,
        pinceladas,
        acrescentar ? 'acrescentar' : 'remover'
      );

      if (!r) {
        // Devolver o contorno igual em silencio faria a pessoa achar que a
        // ferramenta nao funciona. Dizer o motivo e o minimo.
        setRecadoDaOnda({
          tom: 'aviso',
          texto: 'O traço não encostou na borda deste contorno — nada foi alterado.',
        });
        return;
      }

      const { width, height } = calculateSeedDimensions(r.contorno);
      setYoloSegmentations((antes) =>
        antes.map((seg) =>
          seg.id === id
            ? { ...seg, polygon_points: r.contorno, edited: true, width, height }
            : seg
        )
      );
      setRecadoDaOnda({
        tom: 'ok',
        texto: `Contorno reassentado — ${r.verticesRefeitos} ${r.verticesRefeitos === 1 ? 'ponto refeito' : 'pontos refeitos'}`,
      });
    },
    [imagemDeTrabalho, setYoloSegmentations]
  );

  const handleToggleMarkClass = useCallback(
    (id: number) => {
      setMarks((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, type: m.type === 'viable' ? 'inviable' : 'viable' } : m
        )
      );
    },
    [setMarks]
  );

  // Fase F — arrastar reposiciona a marcação (correção fina da detecção).
  // Contínuo: o arraste inteiro é um passo do histórico.
  const handleMoveMark = useCallback(
    (id: number, x: number, y: number) => {
      setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, x, y } : m)), { continuo: true });
    },
    [setMarks]
  );

  // Fase F — borracha: remove todas as marcações dentro do raio.
  const handleEraseArea = useCallback(
    (x: number, y: number, radius: number) => {
      // A borracha de area apaga marcas — e os contornos vinculados a elas,
      // pela mesma regra de `removeMark`: contorno de semente que nao existe
      // seria medida de nada.
      // Continuo: uma passada da borracha e um passo, por mais marcas que
      // ela leve. Cada uma delas volta com o contorno no Ctrl+Z.
      const apagadas = bancada.cena.marcasRef.current
        .filter((m) => Math.hypot(m.x - x, m.y - y) <= radius)
        .map((m) => m.id);
      removerMarcas(apagadas, { continuo: true });

      // Também apaga anotações visuais (prancheta) que estiverem sob o cursor
      mutar((antes) => {
        if (!antes.anotacoesVisuais?.length) return antes;
        const sobrou = antes.anotacoesVisuais.filter((av) => {
          let cx, cy;
          if (av.tipo === 'cota' || av.tipo === 'seta') {
            cx = (av.p1[0] + av.p2[0]) / 2;
            cy = (av.p1[1] + av.p2[1]) / 2;
          } else if (av.tipo === 'caixa') {
            cx = av.x + av.w / 2;
            cy = av.y + av.h / 2;
          } else if (av.tipo === 'chamada') {
            cx = av.p[0];
            cy = av.p[1];
          } else {
            return true;
          }
          return Math.hypot(cx - x, cy - y) > radius;
        });
        if (sobrou.length === antes.anotacoesVisuais.length) return antes;
        return { ...antes, anotacoesVisuais: sobrou };
      }, { continuo: true });
    },
    [removerMarcas, mutar]
  );

  // Fase E — insere os pontos confirmados da detecção assistida.
  const handleAddDetectedMarks = useCallback(
    (detected: Mark[]) => {
      setMarks((prev) => [...prev, ...detected]);
    },
    [setMarks]
  );

  const handleFitToScreen = () => {
    if (image && containerRef.current) {
      fitToScreen(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight,
        image.width,
        image.height
      );
    }
  };

  // Keyboard shortcuts binding
  useKeyboardShortcuts({
    onUndo: desfazer,
    onRedo: refazer,
    onSetVisualMode: setVisualMode,
    onNextImage: handleNextImage,
    onPrevImage: handlePrevImage,
    onTogglePanning: togglePanningMode,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetZoom: handleFitToScreen,
    onSaveSession: () => saveCurrentSession(false),
    onOpenExport: () => setIsExportModalOpen(true),
    onToggleTheme: toggleTheme,
    onCiclarMascara: ciclarMascara,
    onAbrirGaleria: () => abrirAbaDireita('galeria'),
    onAtivarBancada: bancadas.ativar,
    onAbrirNovaBancada: () => bancadas.abrirNova(),
    hasImage: !!image,
    hasNextImage: currentImageIndex < imageQueue.length - 1,
    hasPrevImage: currentImageIndex > 0,
    disabled: isAnyModalOpen,
  });

  /**
   * As condições da medição em curso, para o relatório de problema.
   *
   * É FUNÇÃO porque o painel que a consome fica montado com o modal fechado —
   * um objeto congelaria o estado de quando o modal abriu, e o que interessa é
   * o de quando a pessoa clicou em relatar.
   *
   * O que entra aqui é o mínimo que explica um defeito: escala, espécie,
   * tamanho da imagem, contagem, receita, bancadas. Nada de pixel, nada do
   * nome do arquivo — só a extensão (ver `lib/diagnostico/trilha.ts`).
   */
  const contextoDeDiagnostico = useCallback(
    (): ContextoDoRelatorio => ({
      umPerPixel: metadata.umPerPixel,
      especie: metadata.amostra?.especieNomeCientifico,
      imagem: image ? { largura: image.width, altura: image.height } : undefined,
      extensaoDaImagem: image ? extensaoDe(filename) : undefined,
      contagem: { viaveis: viableCount, inviaveis: inviableCount, total: totalCount },
      receita: receitaAtiva?.id,
      bancadas: { abertas: bancadas.abertas, ativa: bancadas.indiceAtivo },
    }),
    [
      metadata.umPerPixel,
      metadata.amostra?.especieNomeCientifico,
      image,
      filename,
      viableCount,
      inviableCount,
      totalCount,
      receitaAtiva,
      bancadas.abertas,
      bancadas.indiceAtivo,
    ]
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-0 text-ink-1 transition-colors duration-300 font-sans">
      {/* 1. Header Toolbar */}
      <Header
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        sessionsCount={sessions.length}
        openHistory={() => setIsHistoryModalOpen(true)}
        especieSlot={
          <ChipDeEspecie
            atual={especieDaBancada}
            cultivar={metadata.amostra?.cultivar}
            extras={especiesExtras}
            onEscolher={handleEscolherEspecie}
            onLimpar={handleLimparEspecie}
          />
        }
        bancadasSlot={<SeletorDeBancadas bancadas={bancadas} />}
        contaSlot={
          conta.disponivel ? (
            <BotaoDeConta
              conta={conta}
              metadata={metadata}
              onAplicarBancada={() => {
                if (conta.preferenciaSincronizada) {
                  setMetadata((prev) => aplicarPreferencia(prev, conta.preferenciaSincronizada!));
                }
              }}
              onAbrirConfiguracoes={() => setIsFeaturesOpen(true)}
              onAbrirNovidades={() => setNovidades({ aberto: true, versoes: [] })}
            />
          ) : undefined
        }
        onImportSession={() => importInputRef.current?.click()}
        onUndo={desfazer}
        undoDisabled={!podeDesfazer}
        onRedo={refazer}
        redoDisabled={!podeRefazer}
        onReset={() => setIsResetConfirmOpen(true)}
        resetDisabled={
          marks.length === 0 &&
          yoloSegmentations.length === 0 &&
          !metadata.umPerPixel &&
          !metadata.plate &&
          !metadata.quadrant &&
          !metadata.notes &&
          !metadata.baselineCount
        }
        hasImageQueue={imageQueue.length > 0}
        currentImageIndex={currentImageIndex}
        imageQueueLength={imageQueue.length}
        paginasDoTiff={paginasDoTiff}
        paginaDoTiff={paginaDoTiff}
        onAbrirPaginaDoTiff={abrirPaginaDoTiff}
        onPrevImage={handlePrevImage}
        onNextImage={handleNextImage}
        onSaveSession={() => saveCurrentSession(false)}
        onExport={() => setIsExportModalOpen(true)}
        hasImage={!!image}
        onProcessarFilaIA={handleProcessarFilaIA}
        filaIARodando={filaIARodando}
        onPararFilaIA={handlePararFilaIA}

        currentView={currentView}
        onViewChange={navigate}
        isLongitudinalEnabled={isLongitudinalEnabled}
        isStatsEnabled={isStatsEnabled}
        onOpenFeatures={() => setIsFeaturesOpen(true)}
      />

      {currentView === 'counter' && (
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* 2. Sidebar panel */}
          <Sidebar
            fileInputRef={fileInputRef}
            importInputRef={importInputRef}
            handleFileUpload={handleFileUpload}
            handleImportJSON={(e) => {
              // ImageActions liga esta prop ao onChange de um <input type="file">,
              // entao ela recebe o evento — nao o File. Passar processJSONFile
              // direto fazia reader.readAsText(evento) lancar TypeError, e o
              // botao "Importar" da barra lateral nunca funcionou.
              const file = e.target.files?.[0];
              if (file) processJSONFile(file);
              // Zera o valor para permitir reimportar o mesmo arquivo: sem isto
              // o onChange nao dispara na segunda vez.
              e.target.value = '';
            }}
            viableCount={viableCount}
            inviableCount={inviableCount}
            viablePercent={viablePercent}
            inviablePercent={inviablePercent}
            totalCount={totalCount}
            visualMode={visualMode}
            setVisualMode={setVisualMode}
            activeClassification={activeClassification}
            setActiveClassification={escolherClasse}
            metadata={metadata}
            updateMetadata={updateMetadata}
            sessions={sessions}
            onOpenCamera={isCameraEnabled ? () => setIsCameraOpen(true) : undefined}
            onOpenSplit={isSplitEnabled && image ? () => setIsSplitOpen(true) : undefined}
            onOpenRoi={isRoiEnabled && image ? () => setIsRoiOpen(true) : undefined}
            onCarregarExemplo={handleCarregarExemplo}
            exemploCarregando={exemploCarregando}
            onCarregarExemploReal={handleCarregarExemploReal}
            exemploRealCarregando={exemploRealCarregando}
            isCollapsed={isLeftSidebarCollapsed}
            onToggleCollapse={handleToggleLeftSidebar}
            onAbrirDatasets={() => abrirAbaDireita('datasets')}
            onAbrirIdentificacao={
              isModoLaudoEnabled ? () => setIsIdentificacaoOpen(true) : undefined
            }
            calibrationSummary={
              metadata.umPerPixel && metadata.umPerPixel > 0
                ? `${metadata.umPerPixel.toFixed(2)} µm/px`
                : 'medidas em pixels'
            }
            needsCalibration={!metadata.umPerPixel || metadata.umPerPixel <= 0}
            hasImage={!!image}
            hideCounters={true}
            adjustSlot={
              <ImageAdjustPanel
                image={image}
                adjustments={adjustments}
                onChange={setAdjustments}
                enabled={adjustEnabled}
                onToggleEnabled={() => setAdjustEnabled((v) => !v)}
                onAchatarFundo={handleAchatarFundo}
                onDesfazerFundo={handleDesfazerFundo}
                fundoAchatado={!!fundoAchatado}
                achatando={achatando}
                fundoIncerto={fundoIncerto}
              />
            }
            calibrationSlot={
              <CalibrationPanel
                umPerPixel={metadata.umPerPixel}
                onChange={(value) => updateMetadata('umPerPixel', value)}
                onStartMeasure={() => {
                  setMeasuredPixels(undefined);
                  setIsMeasuring(true);
                }}
                measuredPixels={measuredPixels}
                isMeasuring={isMeasuring}
                onCalibracaoConferida={setCalibracaoConferida}
                especie={
                  metadata.amostra?.especieNomeCientifico || metadata.amostra?.especieNomeComum
                }
                comprimentoTipicoEmPixels={comprimentoTipicoEmPixels}
                onEspecieChange={(nome) =>
                  updateMetadata('amostra', {
                    ...(metadata.amostra ?? {}),
                    especieNomeCientifico: nome,
                    // O nome comum acompanha, para o boletim nao ficar com um
                    // e sem o outro.
                    especieNomeComum: nome ? acharPorNome(nome)?.nomeComum : undefined,
                  })
                }
              />
            }
            detectionSlot={
              isAiPointerEnabled || isDetectionEnabled ? (
                <div className="space-y-5">
                  {/* C5: "Encontrar" primeiro — funciona em qualquer cultura,
                      sem modelo. "Modelo (IA)" depois, porque só serve para
                      orquídea (tetrazólio); os dois são o mesmo pipeline do
                      ensaio ao carregar em outro momento, não coisas
                      separadas. */}
                  {isDetectionEnabled && (
                    <DetectionPanel
                      image={forcarOriginalNasAutomacoes ? image : adjustedSource}
                      receitaAtiva={receitaAtiva}
                      umPerPixel={metadata.umPerPixel}
                      onda={ondaParaEncontrar}
                      onContornosPropostos={setPropostaDestacada}
                      onAplicar={handleAplicarEncontrado}
                      onSalvarReceita={handleSalvarReceitaEncontrada}
                      regiao={regiaoDeDeteccao}
                      onSelecionarRegiao={() => setSelecionandoRegiao(true)}
                      onLimparRegiao={() => setRegiaoDeDeteccao(null)}
                    />
                  )}
                  {isAiPointerEnabled && (
                    <div className={isDetectionEnabled ? 'border-t border-line-soft pt-4' : undefined}>
                      <button
                        type="button"
                        onClick={() => setIaAberto((v) => !v)}
                        aria-expanded={iaAberto}
                        className="w-full flex items-center justify-between gap-2 text-left"
                      >
                        <span>
                          <span className="block text-[10px] font-bold text-ink-3 uppercase tracking-widest">
                            Modelo (IA)
                          </span>
                          <span className="block text-[10px] text-ink-3 leading-snug mt-0.5">
                            Treinado em orquídea: viável/inviável por tetrazólio.
                          </span>
                        </span>
                        {iaAberto ? (
                          <ChevronUp size={14} className="text-ink-3 shrink-0" />
                        ) : (
                          <ChevronDown size={14} className="text-ink-3 shrink-0" />
                        )}
                      </button>
                      {iaAberto && (
                        <div className="mt-3">
                          <AiPointerPanel
                            // A ORIGINAL, sempre: é nela que o modelo foi treinado.
                            image={image}
                            bancadaId={bancada.id}
                            marks={marks}
                            onAddMarks={handleAddDetectedMarks}
                            onPreviewChange={setDetectionPreview}
                            onAddSegmentations={addYoloSegmentations}
                            umPerPixel={metadata.umPerPixel}
                            regiao={regiaoDeDeteccao}
                            onSelecionarRegiao={() => setSelecionandoRegiao(true)}
                            onLimparRegiao={() => setRegiaoDeDeteccao(null)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : undefined
            }
          />

          {/* 3. Image viewport scroll and Zoom area with persistent floating overlays */}
          {/* Bancadas (C2): com uma aberta, `Bancadas` devolve exatamente o
              que está entre as chaves abaixo, sem wrapper — o layout de hoje
              não muda. Com duas ou mais, cada bancada ganha célula, cabeçalho
              e borda; só a ATIVA recebe este bloco (as outras recebem uma
              versão sem os overlays caros — ver `Bancadas.tsx`). */}
          {/* 4. Barra de ferramentas — UMA, na borda do espaço de trabalho.
              A ferramenta é da PESSOA, não da cena: quem escolhe a onda quer
              a onda em qualquer bancada em que clicar. Dentro do viewport da
              bancada ativa ela roubava espaço da imagem em 2×2 e dava a
              impressão de que cada cena tinha a sua. Age sempre sobre a
              bancada ativa; zoom e escala continuam por cena, porque esses
              são da cena. */}
            {image && (
              <Toolbar
                activeTool={activeTool}
                onSelect={setActiveTool}
                eraserRadius={eraserRadius}
                onEraserRadiusChange={setEraserRadius}
                isTemporary={isToolTemporary}
                showRulers={showRulers}
                onToggleRulers={() => setShowRulers((v) => !v)}
                mascara={mascara}
                onCiclarMascara={ciclarMascara}
                onAbrirGaleria={() => abrirAbaDireita('galeria')}
                totalDeObjetos={contagem.total}
                ajusteDaMarca={ajusteDaMarca}
                onAjusteDaMarcaChange={setAjusteDaMarca}
                estiloDaMarca={estiloDaMarca}
                onEstiloDaMarcaChange={(v) => {
                  setEstiloDaMarca(v);
                  gravarPreferenciaTexto('sc:estiloDaMarca', v);
                }}
                opacidadeDaMarca={opacidadeDaMarca}
                onOpacidadeDaMarcaChange={(v) => {
                  setOpacidadeDaMarca(v);
                  gravarPreferenciaTexto('sc:opacidadeDaMarca', String(v));
                }}
                raioDaRaspagem={raioDaRaspagem}
                onRaioDaRaspagemChange={setRaioDaRaspagem}
              />
            )}

          <Bancadas bancadas={bancadas} onBrowseFiles={handleBrowseFiles}>
          <div className="relative flex-1 h-full overflow-hidden flex flex-col">
            <ImageViewport
              containerRef={containerRef}
              image={image}
              onBrowseFiles={handleBrowseFiles}
              loadError={loadError}
              isPanningMode={isPanningMode}
              isDragging={isPanningDrag}
              startDrag={startDrag}
              handleDrag={handleDrag}
              stopDrag={stopDrag}
            >
              {/* "Carregar referência" — o segundo gesto do explorador de datasets.
                  Clicar na miniatura já carregou a imagem; a anotação (contorno
                  ou marca) só entra quando a pessoa pedir aqui. */}
              {podeCarregarReferencia && (
                <div className="border-accent bg-surface-1/95 rounded-panel absolute top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border px-4 py-2.5 shadow-xl backdrop-blur">
                  <div className="min-w-0">
                    <p className="text-ink-1 text-xs font-bold">Anotação do dataset disponível</p>
                    <p className="text-ink-3 text-[10px] leading-snug truncate max-w-[280px]">
                      {datasetContexto?.conjunto} — {anotacaoAtual?.contornos?.length
                        ? `${anotacaoAtual.contornos.length} contorno(s)`
                        : `${anotacaoAtual?.marcas?.length ?? 0} marca(s)`}
                    </p>
                  </div>
                  <button
                    onClick={handleCarregarReferencia}
                    className="bg-accent text-accent-on hover:bg-accent-strong shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
                  >
                    Carregar referência
                  </button>
                </div>
              )}
              {/* Classe da imagem (multiclasse / pasta-por-classe) — só metadado + chip, nunca cria marca sozinho. */}
              {!podeCarregarReferencia &&
                image &&
                metadata.dataset?.classesDaImagem &&
                metadata.dataset.classesDaImagem.length > 0 &&
                chipDeClasseDispensado !== filename && (
                  <div className="bg-surface-1/95 rounded-panel border-line absolute top-4 left-1/2 z-30 flex max-w-[60%] -translate-x-1/2 items-center gap-2 border px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-lg backdrop-blur">
                    <span className="truncate" title={metadata.dataset.classesDaImagem.join(', ')}>
                      {metadata.dataset.classesDaImagem.length === 1 ? 'Classe do dataset: ' : 'Classes do dataset: '}
                      {metadata.dataset.classesDaImagem.slice(0, 3).join(', ')}
                      {metadata.dataset.classesDaImagem.length > 3 && ` +${metadata.dataset.classesDaImagem.length - 3}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChipDeClasseDispensado(filename)}
                      className="text-ink-3 hover:text-ink-1 shrink-0 rounded p-0.5"
                      aria-label="Fechar"
                      title="Fechar (a classe continua nos metadados)"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

              {/* O que o arquivo já contou.
                  Aparece sobre a imagem, some ao aceitar ou ao dispensar, e
                  NUNCA preenche sozinho. Mostra o trecho que originou cada
                  proposta — "li isto aqui" — porque é o que permite julgar em
                  um segundo se faz sentido, sem abrir o painel de metadados. */}
              {image && sugestoes && quantasSugestoes(sugestoes) > 0 && (
                <div className="bg-surface-1/95 rounded-panel border-accent/40 absolute top-4 left-1/2 z-30 flex max-w-[70%] -translate-x-1/2 items-center gap-3 border px-3 py-2 shadow-lg backdrop-blur">
                  <div className="min-w-0">
                    <p className="text-ink-3 text-[10px] font-bold tracking-wide uppercase">
                      O nome do arquivo sugere
                    </p>
                    <p className="text-ink-1 truncate text-[11px] font-semibold">
                      {sugestoes.especieNomeCientifico && (
                        <span className="mr-2">
                          <em>{sugestoes.especieNomeCientifico.valor}</em>
                          {sugestoes.especieNomeCientifico.confianca === 'deduzido' && (
                            <span
                              className="text-warn ml-1"
                              title="A grafia foge da convenção do nome científico — confira antes de aceitar."
                            >
                              ?
                            </span>
                          )}
                        </span>
                      )}
                      {sugestoes.repeticao && (
                        <span className="text-ink-2 mr-2">rep. {sugestoes.repeticao.valor}</span>
                      )}
                      {sugestoes.pagina && (
                        <span className="text-ink-2 mr-2">{sugestoes.pagina.origem}</span>
                      )}
                    </p>
                    <p className="text-ink-3 truncate text-[10px]">
                      lido em: {[sugestoes.especieNomeCientifico?.origem, sugestoes.repeticao?.origem]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Só o que foi proposto entra. Campo já preenchido pela
                      // pessoa não é sobrescrito: ela sabe mais que o nome do
                      // arquivo.
                      const esp = sugestoes.especieNomeCientifico?.valor;
                      if (esp && !metadata.amostra?.especieNomeCientifico) {
                        updateMetadata('amostra', {
                          ...(metadata.amostra ?? {}),
                          especieNomeCientifico: esp,
                        });
                      }
                      const rep = sugestoes.repeticao?.valor;
                      if (rep !== undefined && !metadata.plate) {
                        updateMetadata('plate', String(rep));
                      }
                      setSugestoes(null);
                    }}
                    className="bg-accent text-accent-on hover:bg-accent-strong rounded-control shrink-0 px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase transition-colors"
                  >
                    Usar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSugestoes(null)}
                    className="text-ink-3 hover:text-ink-1 shrink-0 rounded p-0.5"
                    aria-label="Dispensar sugestões"
                    title="Dispensar — nada é preenchido"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* O corte proposto. Fica sobre a imagem, ao lado da linha tracejada */}
              {corteProposto && (
                <div className="border-accent bg-surface-1/95 rounded-panel absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border px-4 py-2.5 shadow-xl backdrop-blur">
                  <div className="min-w-0">
                    <p className="text-ink-1 text-xs font-bold">Cintura encontrada</p>
                    <p className="text-ink-3 text-[10px] leading-snug">
                      O contorno parece conter duas sementes. A linha tracejada mostra onde
                      separar.
                    </p>
                  </div>
                  <button
                    onClick={handleAplicarCorte}
                    className="bg-accent text-accent-on hover:bg-accent-strong shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
                  >
                    Separar
                  </button>
                  <button
                    onClick={() => setContornoSelecionado(null)}
                    aria-label="Manter como está"
                    className="border-line text-ink-2 hover:bg-surface-2 shrink-0 rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wide uppercase transition-colors"
                  >
                    Manter
                  </button>
                </div>
              )}

              {/* Resposta da onda: fica sobre a imagem, perto de onde a pessoa acabou de clicar */}
              {!corteProposto && recadoDaOnda && (
                <div
                  className={`pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-panel border px-4 py-2 text-xs font-bold shadow-lg ${
                    recadoDaOnda.tom === 'ok'
                      ? 'border-accent bg-accent-tint text-accent'
                      : 'border-warn bg-warn/15 text-ink-1'
                  }`}
                  role="status"
                >
                  {recadoDaOnda.texto}
                </div>
              )}

              {image && (
                <MarkingCanvas
                  image={imagemDeTrabalho ?? image}
                  marks={marks}
                  yoloSegmentations={yoloSegmentations}
                  anotacoesVisuais={anotacoesVisuais}
                  mostrarContornos={mostraContornos(mascara)}
                  mostrarEixosDeTodos={mostrarEixos}
                  mostrarPontos={mostraPontos(mascara)}
                  contornoSelecionado={contornoSelecionado}
                  onSelecionarContorno={setContornoSelecionado}
                  onMoverVertice={handleMoverVertice}
                  onInserirVertice={handleInserirVertice}
                  onRemoverVertice={handleRemoverVertice}
                  onRaspar={handleRaspar}
                  onInicioDeGesto={abrirGesto}
                  onFimDeGesto={handleFimDeGesto}
                  linhaDeCorte={corteProposto?.linha ?? null}
                  onDesenhoConcluido={handleDesenhoConcluido}
                  raioDaRaspagem={raioDaRaspagem}
                  ajusteDaMarca={ajusteDaMarca}
                  visualMode={visualMode}
                  zoomLevel={zoomLevel}
                  isPanningMode={isPanningMode}
                  onCanvasClick={handleCanvasClick}
                  canvasRef={canvasRef}
                  onToggleSegmentationClass={toggleSegmentationClass}
                  onDeleteSegmentation={deleteSegmentation}
                  umPerPixel={metadata.umPerPixel}
                  detectionPreview={detectionPreview}
                  canvasFilter={canvasFilter}
                  activeTool={activeTool}
                  eraserRadius={eraserRadius}
                  onRemoveMark={removeMark}
                  onToggleMarkClass={handleToggleMarkClass}
                  onMoveMark={handleMoveMark}
                  onEraseArea={handleEraseArea}
                  showRulers={showRulers}
                  menuRadialAtivo={isMenuRadialEnabled}
                  onClassificarRadial={handleClassificarRadial}
                  sementesSimuladas={sementesSimuladas}
                >
                  {isMeasuring && <CalibrationRulerOverlay onMeasured={handleMeasured} />}
                  
                  {selecionandoRegiao && (
                    <RegionSelectorOverlay
                      selectedRegion={regiaoDeDeteccao}
                      onRegionSelected={(r) => {
                        setRegiaoDeDeteccao(r);
                        setSelecionandoRegiao(false);
                      }}
                    />
                  )}

                  <VisualAnnotationsOverlay
                    onAddAnotacaoVisual={(a) => {
                      mutar((antes) => ({
                        ...antes,
                        anotacoesVisuais: [...(antes.anotacoesVisuais || []), a],
                      }));
                      setRecadoDaOnda({
                        tom: 'ok',
                        texto: 'Anotação adicionada à prancheta.',
                      });
                    }}
                  />

                  <GhostSeedsOverlay
                    sementesSimuladas={sementesSimuladas}
                    marks={marks}
                    yoloSegmentations={yoloSegmentations}
                    contornosPropostos={propostaDestacada}
                  />
                  <Germinar
                    ativo={germinandoPedido > 0}
                    tema={temaDaFlor}
                    sementes={marks}
                    onFim={encerrarGerminar}
                  />
                </MarkingCanvas>
              )}
            </ImageViewport>


            {/* Medidas ao vivo — FIXO SOBRE O VIEWPORT */}
            {image && (
              <div className="absolute top-3 right-3 z-20 w-[280px] max-w-[42vw]">
                {painelDeMedidasAberto ? (
                  <PainelDeMorfometria
                    resumo={resumoDeMorfometria}
                    especie={especieDeclarada}
                    onFechar={() => {
                      setPainelDeMedidasAberto(false);
                      gravarPreferencia('sc:painelDeMedidas', false);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setPainelDeMedidasAberto(true);
                      gravarPreferencia('sc:painelDeMedidas', true);
                    }}
                    title="Mostrar as medidas desta imagem"
                    className="border-line bg-surface-1/95 text-ink-2 hover:border-accent hover:text-accent focus-visible:ring-accent/40 rounded-panel ml-auto flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold tracking-wide uppercase shadow-lg backdrop-blur transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Ruler size={12} /> Medidas
                  </button>
                )}
              </div>
            )}

            {/* Floating Zoom and Panning controls — FIXO SOBRE O VIEWPORT */}
            {image && (
              <ZoomControls
                isPanningMode={isPanningMode}
                togglePanningMode={togglePanningMode}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                zoomLevel={zoomLevel}
                onFitToScreen={handleFitToScreen}
                mostrarEscala={mostrarEscala}
                onToggleEscala={() => {
                  setMostrarEscala((v) => {
                    gravarPreferencia('sc:escalaGrafica', !v);
                    return !v;
                  });
                }}
                mostrarEixos={mostrarEixos}
                onToggleEixos={() => {
                  setMostrarEixos((v) => {
                    gravarPreferencia('sc:eixosDasMedidas', !v);
                    return !v;
                  });
                }}
              />
            )}
            {image && mostrarEscala && <EscalaGrafica umPerPixel={metadata.umPerPixel} zoomLevel={zoomLevel} />}
          </div>
          </Bancadas>

          {/* 3. Painel Lateral Direito — RESULTADOS E ANÁLISE BIOMÉTRICA */}
          <RightSidebar
            viableCount={viableCount}
            inviableCount={inviableCount}
            viablePercent={viablePercent}
            inviablePercent={inviablePercent}
            totalCount={totalCount}
            visualMode={visualMode}
            setVisualMode={setVisualMode}
            activeClassification={activeClassification}
            setActiveClassification={escolherClasse}
            plateId={metadata.plate}
            sessions={sessions}
            resumo={resumoDeMorfometria}
            medicoes={medicoesDeMorfometria}
            especie={especieDeclarada}
            calibrado={!!metadata.umPerPixel && metadata.umPerPixel > 0}
            comparacaoContent={comparacaoContent}
            onExport={() => setIsExportModalOpen(true)}
            onDestacarSementes={handleDestacarSementes}
            onAplicarRegra={handleAplicarRegra}
            regraSelecionadaId={regraSelecionadaId}
            limiaresCustomizados={limiaresCustomizados}
            onRegraChange={setRegraSelecionadaId}
            onLimiarChange={setLimiaresCustomizados}
            isCollapsed={isRightSidebarCollapsed}
            onToggleCollapse={handleToggleRightSidebar}
            hasImage={!!image}
            activeTab={rightSidebarTab}
            onTabChange={setRightSidebarTab}
            inspectorContent={
              segmentacaoAtiva && image ? (
                <SeedInspector
                  segmentation={segmentacaoAtiva}
                  image={imagemDeTrabalho ?? image}
                  umPerPixel={metadata.umPerPixel}
                  medianaDaCena={resumoDeMorfometria?.areaPx?.mediana}
                  limiares={limiaresDaCena}
                  especieId={especieDeclarada}
                  perfilMedido={perfilMedidoAtivo}
                  onToggleClass={toggleSegmentationClass}
                  onDelete={deleteSegmentation}
                  onProposeCut={handleProposeCut}
                  onClose={() => {
                    setContornoSelecionado(null);
                    setRightSidebarTab('resultados');
                  }}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Ensaio ao carregar: enquanto roda, ou com resultados ainda não
                      decididos, fica acima da lista — some assim que "Usar esta" ou
                      "Nenhuma" resolve. Não compete com o inspetor de um contorno
                      selecionado (ramo acima). */}
                  {ensaio && (ensaio.emAndamento || ensaio.resultados.length > 0) && (imagemDeTrabalho ?? image) && (
                    <EnsaioPanel
                      imagem={(imagemDeTrabalho ?? image)!}
                      resultados={ensaio.resultados}
                      emAndamento={ensaio.emAndamento}
                      total={ensaio.total}
                      onUsar={handleUsarEnsaio}
                      onDestacar={(r) => setPropostaDestacada(r ? r.propostos.map((p) => p.contorno) : [])}
                      onNenhuma={() => {
                        setPropostaDestacada([]);
                        setEnsaio(null);
                      }}
                      onParar={() => {
                        ensaioCancelado.current = true;
                      }}
                    />
                  )}
                  <ListaDeSementes
                    marks={marks}
                    segmentations={yoloSegmentations}
                    umPerPixel={metadata.umPerPixel}
                    medianaDaCena={resumoDeMorfometria?.areaPx?.mediana}
                    limiares={limiaresDaCena}
                    onSelecionar={(id) => {
                      setContornoSelecionado(id);
                      setActiveTool('contorno');
                    }}
                  />
                </div>
              )
            }
            galeriaContent={
              <GaleriaModal
                modo="painel"
                isOpen={galeriaAberta}
                onClose={() => setRightSidebarTab('resultados')}
                onExpandir={() => setGaleriaGrande(true)}
                image={image}
                marks={marks}
                yoloSegmentations={yoloSegmentations}
                onToggleSegmentationClass={toggleSegmentationClass}
                onDeleteSegmentation={deleteSegmentation}
                onToggleMarkClass={handleToggleMarkClass}
                onRemoveMark={removeMark}
                onSegmentarPendentes={handleSegmentarPendentes}
                onSegmentarUma={handleSegmentarUma}
                progresso={segmentandoLote}
                protocolo={metadata.protocolo}
                onSubclasse={setSubclasse}
                onFocarNoCanvas={handleFocarNoCanvas}
                umPerPixel={metadata.umPerPixel}
                medianaDaCena={resumoDeMorfometria?.areaPx?.mediana}
                limiares={limiaresDaCena}
              />
            }
            datasetsContent={
              <DatasetsPanel
                pastaAberta={pastaDeDatasets}
                onPastaAberta={setPastaDeDatasets}
                onCarregar={handleCarregarDoDataset}
                onAdicionarAFila={async (arquivos) => {
                  const files = await Promise.all(arquivos.map(a => a.obterFile()));
                  setImageQueue(prev => [...prev, ...files]);
                  if (!image && files.length > 0) {
                    loadFiles(files);
                  }
                }}
              />
            }
            loteContent={
              <LotePanel
                imageQueue={imageQueue}
                imagemAtual={image}
                nomeDaImagemAtual={filename}
                pastaAberta={pastaDeDatasets}
                receitaAtiva={receitaAtiva}
                especie={especieOuCulturaDeclarada}
                metadataBase={metadata}
                sessions={sessions}
                addSession={addSession}
                deleteSession={deleteSession}
              />
            }
            analyticsContent={
              <AnalyticsPanel 
                medicoes={medicoesDeMorfometria}
                totalCount={totalCount}
                viableCount={viableCount}
                inviableCount={inviableCount}
                onExpand={() => setAnalyticsModalOpen(true)}
              />
            }
          />
        </div>
      )}

      {currentView === 'longitudinal' && isLongitudinalEnabled && (
        <LongitudinalView
          onViewSession={handleLoadSession}
          onCreateExperiment={() => {
            setSelectedExperimentForEdit(undefined);
            setIsExperimentModalOpen(true);
          }}
          onEditExperiment={(experiment) => {
            setSelectedExperimentForEdit(experiment);
            setIsExperimentModalOpen(true);
          }}
          onAddPlateRun={(experimentId, treatmentId, existingRun) => {
            const exp = experiments.find((e) => e.id === experimentId);
            if (exp) {
              setSelectedExperimentForRun(exp);
              setSelectedTreatmentIdForRun(treatmentId);
              setSelectedPlateRunForEdit(existingRun);
              setIsPlateRunModalOpen(true);
            }
          }}
        />
      )}

      {currentView === 'stats' && isStatsEnabled && (
        <StatsView
          sessions={sessions}
          experiments={experiments}
          onViewSession={handleLoadSession}
        />
      )}

      {/* 5. Footer Status Bar */}
      {currentView === 'counter' && visibilidade.rodape && (
        <Footer
          tempoAtivoMs={image ? cronometro.tempo.ativoMs : undefined}
          modoDeAnalise={cronometro.tempo.modo}
          onTrocarModo={cronometro.definirModo}
          filename={filename}
          imageWidth={image?.width}
          imageHeight={image?.height}
          zoomLevel={image ? zoomLevel : undefined}
          fonteDaAutomacao={
            image
              ? {
                  resumo: resumoDaFonte(estadoDaImagem),
                  detalhes: fontesDasAutomacoes(estadoDaImagem),
                  forcarOriginal: forcarOriginalNasAutomacoes,
                  onAlternar: () => setForcarOriginalNasAutomacoes((v) => !v),
                }
              : undefined
          }
          totalDeObjetos={image ? totalCount : undefined}
          onAbrirNovidades={() => setNovidades({ aberto: true, versoes: [] })}
          onRelatarProblema={() => setIsFeaturesOpen(true)}
          bancada={{
            especie: metadata.amostra?.especieNomeCientifico,
            umPerPixel: metadata.umPerPixel,
            protocolo: metadata.protocolo,
          }}
        />
      )}

      {/* 6. Drag Drop file upload overlay */}
      {currentView === 'counter' && <DropZone isVisible={isDragActive} />}

      {/* 7. Action Modals */}
      <AnimatePresence>
        {isExportModalOpen && (
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            filename={filename}
            hasImageQueue={imageQueue.length > 0}
            currentImageIndex={currentImageIndex}
            imageQueueLength={imageQueue.length}
            onSaveCurrentSession={() => saveCurrentSession(true)}
            onSaveAndNext={saveAndNext}
            exportTextReport={handleExportTextReport}
            exportCSV={handleExportCSV}
            exportMeasurementsCSV={handleExportMeasurementsCSV}
            exportSQL={handleExportSQL}
            measurementCount={contagem.total}
            hasMorphometry={yoloSegmentations.some(
              (s) => s.visible !== false && s.polygon_points?.length >= 3
            )}
            exportJSON={handleExportJSON}
            onOpenImageExport={() => {
              setIsExportModalOpen(false);
              setIsImageExportModalOpen(true);
            }}
            exportPDF={handleExportPDF}
            isYoloExportEnabled={isYoloExportEnabled}
            onOpenYoloExport={() => {
              setIsExportModalOpen(false);
              setIsYoloExportModalOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImageExportModalOpen && (
          <ImageExportModal
            isOpen={isImageExportModalOpen}
            onClose={() => setIsImageExportModalOpen(false)}
            hasImageQueue={sessions.length > 0}
            onExport={(opcoes, escopo) => {
              // Fecha antes de desenhar, como sempre: o estado do modal é do
              // App (alimenta `isAnyModalOpen`), não da exportação.
              setIsImageExportModalOpen(false);
              void handleImageExportWithOptions(opcoes, escopo);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHistoryModalOpen && (
          <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            sessions={sessions}
            onLoadSession={handleLoadSession}
            onDeleteSession={deleteSession}
            onClearHistory={clearSessions}
            onExportHistoryJSON={handleExportHistoryJSON}
            onExportHistoryCSV={handleExportHistoryCSV}
            onExportHistoryBatchPDF={handleExportHistoryBatchPDF}
            onImportHistoryJSON={handleImportHistoryJSON}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isYoloExportModalOpen && isYoloExportEnabled && (
          <YoloExportModal
            isOpen={isYoloExportModalOpen}
            onClose={() => setIsYoloExportModalOpen(false)}
            sessions={sessions}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExperimentModalOpen && (
          <ExperimentModal
            isOpen={isExperimentModalOpen}
            onClose={() => setIsExperimentModalOpen(false)}
            experiment={selectedExperimentForEdit}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlateRunModalOpen && selectedExperimentForRun && (
          <PlateRunModal
            isOpen={isPlateRunModalOpen}
            onClose={() => setIsPlateRunModalOpen(false)}
            experiment={selectedExperimentForRun}
            treatmentId={selectedTreatmentIdForRun}
            plateRun={selectedPlateRunForEdit}
            sessions={sessions}
          />
        )}
      </AnimatePresence>

      {/* Fase E — Captura por câmera (lupa/microscópio e celular) */}
      {isCameraEnabled && (
        <CameraModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}

      {/* Preparo da imagem (Fase G) */}
      <AnimatePresence>
        {isSplitOpen && isSplitEnabled && (
          <SplitModal
            isOpen={isSplitOpen}
            onClose={() => setIsSplitOpen(false)}
            image={image}
            filename={filename}
            // Os pedaços substituem a fila: é o fluxo do scanner, em que a
            // folha inteira deixa de interessar depois de fatiada.
            onSplit={(pecas) => loadFiles(pecas)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRoiOpen && isRoiEnabled && (
          <RoiModal
            isOpen={isRoiOpen}
            onClose={() => setIsRoiOpen(false)}
            image={image}
            filename={filename}
            // Troca só a imagem em exibição, sem mexer na fila: quem tem uma
            // fila de pedaços continua podendo navegar entre eles.
            onCrop={(recorte) => loadImageFromFile(recorte)}
          />
        )}
      </AnimatePresence>

      {/* Confirmação de limpeza — ação destrutiva, foco inicial em Cancelar */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <ConfirmDialog
            isOpen={isResetConfirmOpen}
            onClose={() => setIsResetConfirmOpen(false)}
            onConfirm={handleResetCurrentPlate}
            title="Limpar a placa atual?"
            message="Esta ação não pode ser desfeita. O histórico de sessões salvas não é afetado."
            confirmLabel="Limpar placa"
            clears={[
              'Marcações manuais',
              'Segmentações do YOLO',
              'Calibração (µm/px)',
              'Base do cálculo diferencial',
              'Placa, quadrante e notas',
            ]}
            keeps={[
              'Histórico de sessões',
              'Experimentos e placas',
              'Pesquisador e projeto',
              'Tratamento',
              'Imagem carregada',
            ]}
          />
        )}
      </AnimatePresence>

      {/* Carregar com cena ocupada — substituir ou enfileirar, e o que a
          imagem nova é. Esc cancela e nada abre (ver `features/carregar`). */}
      <AnimatePresence>
        {carregamentoPendente && (
          <DialogoDeCarregar
            key={`${carregamentoPendente.arquivos[0].name}:${carregamentoPendente.arquivos[0].size}`}
            nomeDoArquivo={carregamentoPendente.arquivos[0].name}
            quantosArquivos={carregamentoPendente.arquivos.length}
            avisoDeNaoSalvo={haTrabalhoNaoSalvo({
              temImagem: image !== null,
              totalDeMarcas: marks.length,
              totalDeContornos: yoloSegmentations.length,
              ultimaGravacao,
            })}
            continuidade={carregamentoPendente.continuidade}
            metadata={metadata}
            onCancelar={cancelarCarregamento}
            onConfirmar={confirmarCarregamento}
          />
        )}
      </AnimatePresence>

      {/* Painel visível de funcionalidades */}
      <FeaturesModal
        isOpen={isFeaturesOpen}
        onClose={() => setIsFeaturesOpen(false)}
        onAbrirNovidades={() => {
          setIsFeaturesOpen(false);
          setNovidades({ aberto: true, versoes: [] });
        }}
        contextoDeDiagnostico={contextoDeDiagnostico}
      />

      <BarraDeAtividade />
      <AvisoDeAtualizacao />

      <CartaoDeSugestao
        sugestao={sugestaoAtual}
        onAcao={handleAcaoDeSugestao}
        onDispensar={(sug) => {
          dispensar(sug.id, sug.escopoDaDispensa, image ? filename || 'imagem' : null);
          setVersaoDispensadas((v) => v + 1);
        }}
      />

      <Florescer ativo={florescendo} onFim={encerrarFlorescer} />
      <PassoDaMontanha ativo={passoDaMontanha} onFim={encerrarPassoDaMontanha} />

      {(recadoDoEaster || recadoDeGerminar) && (
        <div
          role="status"
          className="border-line bg-surface-1 text-ink-1 rounded-panel fixed bottom-16 left-1/2 z-40 -translate-x-1/2 border px-4 py-2 text-xs font-semibold shadow-xl"
        >
          {recadoDoEaster ?? recadoDeGerminar}
        </div>
      )}

      <NovidadesModal
        isOpen={novidades.aberto}
        onClose={() => setNovidades((n) => ({ ...n, aberto: false }))}
        versoes={novidades.versoes}
      />

      <GaleriaModal
        isOpen={galeriaGrande}
        onClose={() => setGaleriaGrande(false)}
        image={image}
        marks={marks}
        yoloSegmentations={yoloSegmentations}
        onToggleSegmentationClass={toggleSegmentationClass}
        onDeleteSegmentation={deleteSegmentation}
        onToggleMarkClass={handleToggleMarkClass}
        onRemoveMark={removeMark}
        onSegmentarPendentes={handleSegmentarPendentes}
        onSegmentarUma={handleSegmentarUma}
        progresso={segmentandoLote}
        protocolo={metadata.protocolo}
        onSubclasse={setSubclasse}
        onFocarNoCanvas={(c, id) => {
          setGaleriaGrande(false);
          handleFocarNoCanvas(c, id);
        }}
        umPerPixel={metadata.umPerPixel}
        medianaDaCena={resumoDeMorfometria?.areaPx?.mediana}
        limiares={limiaresDaCena}
      />

      {analyticsModalOpen && (
        <AnalyticsModal
          onClose={() => setAnalyticsModalOpen(false)}
          sessions={sessions}
          getMedicoesCompletas={() => buildMeasurements(buildMeasurementContext())}
        />
      )}

      <IdentificacaoModal
        isOpen={isIdentificacaoOpen}
        onClose={() => setIsIdentificacaoOpen(false)}
        metadata={metadata}
        updateMetadata={updateMetadata}
      />

      {/* 8. Feature Flags Debug Panel */}
      <FeatureFlagsDebugPanel />

      {/* 9. Cookie & Privacy Consent Banner */}
      <CookieConsentBanner />
    </div>
  );
}
