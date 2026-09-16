// =============================================================================
// SeedCounter — DetectionPanel ("Encontrar")
//
// C5: "Encontrar" (localizar por contraste; qualquer cultura) e "Modelo (IA)"
// (só orquídea) são o mesmo pipeline do ensaio ao carregar em outro momento —
// não duas coisas separadas. Este painel roda a MESMA localização + onda que
// o ensaio (`features/ensaio/executar.ts`), de novo a cada ajuste de
// controle, e mostra o resultado como fantasma tracejado (`GhostSeedsOverlay`,
// via `onContornosPropostos`) até a pessoa clicar "Aplicar" — que faz
// exatamente o que "Usar esta" faz no ensaio: os contornos só entram no
// estado da aplicação por aquele botão.
//
// Os limites de tamanho não são mais px absolutos: `lib/limites-adaptaveis.ts`
// dá três formas equivalentes (mm², fração da mediana, px²) e a pessoa escolhe
// a que edita — por baixo, tudo vira px² antes de chegar em `detectObjects`,
// que não muda de assinatura.
// =============================================================================

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Wand2,
  Check,
  X,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  SquareDashedMousePointer,
  RotateCcw,
  Save,
  Eye,
} from 'lucide-react';
import { detectObjects, type ThresholdMode, type GrayChannel, type DetectionOptions } from '../../lib/detect';
import {
  paraPx2,
  descreverLimite,
  raioDeFundoSugerido,
  type LimiteDeTamanho,
  type ModoDeLimite,
  type ContextoDeLimite,
} from '../../lib/limites-adaptaveis';
import type { Receita, ContornoProposto } from '../../features/ensaio/receitas';
import { executarReceita, type OndaResumida } from '../../features/ensaio/executar';
import type { OpcoesDaOnda } from '../../lib/region-growing';
import type { Ponto } from '../../lib/aglomerado';
import type { Regiao } from '../../lib/region';

interface DetectionPanelProps {
  image: HTMLImageElement | HTMLCanvasElement | null;
  /** A receita ativa (do ensaio, ou salva) — carrega os controles quando muda. */
  receitaAtiva: Receita | null;
  /** Calibração da imagem, para o modo mm² dos limites. */
  umPerPixel?: number;
  /** A onda, já fechada sobre a imagem (`segmentarNoCanvas`). */
  onda: (ponto: { x: number; y: number }, opcoes: OpcoesDaOnda) => OndaResumida | null;
  /** Fantasma tracejado no canvas — mesmo overlay do hover do ensaio. */
  onContornosPropostos: (contornos: Ponto[][]) => void;
  /** "Aplicar": os contornos entram no estado da aplicação (como "Usar esta"). */
  onAplicar: (propostos: ContornoProposto[]) => void;
  /** Salva a receita ajustada com um nome — vira opção do ensaio nas próximas imagens. */
  onSalvarReceita: (nome: string, localizacao: DetectionOptions, onda: OpcoesDaOnda) => void;
  regiao?: Regiao | null;
  onSelecionarRegiao?: () => void;
  onLimparRegiao?: () => void;
}

/** Teto de pontos por rodada — a mesma régua do ensaio ao carregar. */
const LIMITE_DE_PONTOS = 400;
/** Tempo parado num controle antes de rodar de novo — evita rodar a cada pixel do arraste. */
const ATRASO_MS = 300;

function dimensoesDe(img: HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  return img instanceof HTMLImageElement
    ? { w: img.naturalWidth, h: img.naturalHeight }
    : { w: img.width, h: img.height };
}

/** Converte um limite para outra forma, mantendo o mesmo px² equivalente quando possível. */
function converterModo(
  limite: LimiteDeTamanho,
  novoModo: ModoDeLimite,
  ctx: ContextoDeLimite
): LimiteDeTamanho {
  if (limite.modo === novoModo) return limite;
  const px2 = paraPx2(limite, ctx);
  if (px2 == null) return { modo: novoModo, valor: limite.valor };
  switch (novoModo) {
    case 'px2':
      return { modo: novoModo, valor: Math.round(px2) };
    case 'mm2': {
      if (!ctx.umPerPixel || ctx.umPerPixel <= 0) return { modo: novoModo, valor: limite.valor };
      const mm2 = px2 / (1e6 / (ctx.umPerPixel * ctx.umPerPixel));
      return { modo: novoModo, valor: Math.round(mm2 * 1000) / 1000 };
    }
    case 'fracaoDaMediana': {
      if (!ctx.medianaAreaPx || ctx.medianaAreaPx <= 0) return { modo: novoModo, valor: limite.valor };
      return { modo: novoModo, valor: Math.round((px2 / ctx.medianaAreaPx) * 100) / 100 };
    }
  }
}

const FORMAS: { modo: ModoDeLimite; rotulo: string }[] = [
  { modo: 'fracaoDaMediana', rotulo: '× mediana' },
  { modo: 'mm2', rotulo: 'mm²' },
  { modo: 'px2', rotulo: 'px²' },
];

/** Um limite de tamanho (mínimo ou máximo): três abas de unidade + um campo. */
function SeletorDeLimite({
  titulo,
  limite,
  ctx,
  semLimiteEhZero,
  onChange,
}: {
  titulo: string;
  limite: LimiteDeTamanho;
  ctx: ContextoDeLimite;
  /** Quando true, valor 0 significa "sem limite" (usado só pelo máximo). */
  semLimiteEhZero?: boolean;
  onChange: (novo: LimiteDeTamanho) => void;
}) {
  const desabilitada = (modo: ModoDeLimite) => modo === 'mm2' && !(ctx.umPerPixel && ctx.umPerPixel > 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">{titulo}</label>
        {semLimiteEhZero && limite.valor === 0 && (
          <span className="text-[10px] text-ink-3">sem limite</span>
        )}
      </div>
      <div className="flex gap-1">
        {FORMAS.map((f) => (
          <button
            key={f.modo}
            type="button"
            disabled={desabilitada(f.modo)}
            onClick={() => onChange(converterModo(limite, f.modo, ctx))}
            title={desabilitada(f.modo) ? 'Exige calibração (µm/px) para converter' : undefined}
            className={`flex-1 px-1.5 py-1 rounded-md text-[10px] font-bold border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              limite.modo === f.modo
                ? 'bg-accent border-accent text-accent-on'
                : 'border-line text-ink-2 hover:bg-surface-2'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
        <input
          type="number"
          min={0}
          step={limite.modo === 'px2' ? 1 : 0.01}
          value={limite.valor}
          onChange={(e) => onChange({ modo: limite.modo, valor: Math.max(0, Number(e.target.value)) })}
          className="w-20 border-line bg-surface-1 text-ink-1 text-right font-mono text-[11px] rounded-md border px-1.5 py-1"
        />
      </div>
      <p className="text-[10px] text-ink-3 leading-snug">{descreverLimite(limite, ctx)}</p>
    </div>
  );
}

export function DetectionPanel({
  image,
  receitaAtiva,
  umPerPixel,
  onda,
  onContornosPropostos,
  onAplicar,
  onSalvarReceita,
  regiao,
  onSelecionarRegiao,
  onLimparRegiao,
}: DetectionPanelProps) {
  const [sensitivity, setSensitivity] = useState(50);
  const [minLimite, setMinLimite] = useState<LimiteDeTamanho>({ modo: 'px2', valor: 60 });
  const [maxLimite, setMaxLimite] = useState<LimiteDeTamanho>({ modo: 'px2', valor: 0 });
  const [polarity, setPolarity] = useState<'auto' | 'dark' | 'light'>('auto');
  const [backgroundManual, setBackgroundManual] = useState<number | null>(null);
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>('otsu');
  const [channel, setChannel] = useState<GrayChannel>('luminance');
  const [denoise, setDenoise] = useState(1);
  const [splitTouching, setSplitTouching] = useState(false);
  const [separation, setSeparation] = useState(8);
  const [maxElongation, setMaxElongation] = useState(0);
  const [ondaOpcoes, setOndaOpcoes] = useState<OpcoesDaOnda>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [nomeDaReceita, setNomeDaReceita] = useState('');

  const [medianaAreaPx, setMedianaAreaPx] = useState<number | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const [darkOnLightDecidido, setDarkOnLightDecidido] = useState<boolean | null>(null);
  const [diagnostico, setDiagnostico] = useState<{
    totalBlobs: number;
    rejected?: { area: number; elongation: number; background: number };
    warnings?: string[];
  } | null>(null);
  const [resultado, setResultado] = useState<{
    propostos: ContornoProposto[];
    contagem: number;
    suspeitos: number;
    escapes: number;
    limitado: boolean;
  } | null>(null);
  const localizacaoAtualRef = useRef<DetectionOptions>({});

  // Carrega a receita nos controles quando ELA muda (ensaio "Usar esta",
  // receita salva escolhida, ou a 4ª opção "pela espécie"). Edições da pessoa
  // depois disso não são "empurradas de volta" para a receita — ela é só o
  // ponto de partida.
  const ultimaReceitaId = useRef<string | null>(null);
  useEffect(() => {
    if (!receitaAtiva || receitaAtiva.id === ultimaReceitaId.current) return;
    ultimaReceitaId.current = receitaAtiva.id;
    const loc = receitaAtiva.localizacao;
    if (loc.sensitivity != null) setSensitivity(loc.sensitivity);
    if (loc.minArea != null) setMinLimite({ modo: 'px2', valor: loc.minArea });
    setMaxLimite({ modo: 'px2', valor: loc.maxArea ?? 0 });
    setBackgroundManual(loc.backgroundRadius ? loc.backgroundRadius : null);
    if (loc.thresholdMode) setThresholdMode(loc.thresholdMode);
    if (loc.channel) setChannel(loc.channel);
    if (loc.denoise != null) setDenoise(loc.denoise);
    setSplitTouching(!!loc.splitTouching);
    if (loc.separation != null) setSeparation(loc.separation);
    setMaxElongation(loc.maxElongation ?? 0);
    setPolarity(loc.darkOnLight === true ? 'dark' : loc.darkOnLight === false ? 'light' : 'auto');
    setOndaOpcoes(receitaAtiva.onda ?? {});
  }, [receitaAtiva]);

  const areaDaImagemPx = useMemo(() => {
    if (!image) return 0;
    const { w, h } = dimensoesDe(image);
    return regiao ? regiao.width * regiao.height : w * h;
  }, [image, regiao]);

  const ctxLimite: ContextoDeLimite = useMemo(
    () => ({ umPerPixel, medianaAreaPx, areaDaImagemPx }),
    [umPerPixel, medianaAreaPx, areaDaImagemPx]
  );

  const backgroundSugerido = useMemo(() => raioDeFundoSugerido(ctxLimite), [ctxLimite]);
  const backgroundEfetivo = backgroundManual ?? backgroundSugerido;

  // ---------------------------------------------------------------------
  // Roda a localização + onda — mesmo executor do ensaio ao carregar.
  // ---------------------------------------------------------------------
  const cancelRef = useRef(false);
  const runToken = useRef(0);

  const executar = useCallback(async () => {
    if (!image) {
      setResultado(null);
      setDiagnostico(null);
      onContornosPropostos([]);
      return;
    }
    cancelRef.current = false;
    const token = ++runToken.current;
    setIsRunning(true);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const darkOnLightOpt = polarity === 'auto' ? ('auto' as const) : polarity === 'dark';

      // Sonda: uma passada sem limite de tamanho, só para saber a mediana de
      // área desta imagem — é o que alimenta "fração da mediana" e o raio de
      // fundo sugerido. Sem ela os dois ficariam sempre no padrão de primeira
      // rodada, mesmo depois de já ter achado objetos.
      const sonda = detectObjects(image, {
        sensitivity,
        darkOnLight: darkOnLightOpt,
        backgroundRadius: backgroundManual ?? 0,
        thresholdMode,
        channel,
        denoise,
        roi: regiao ?? undefined,
        minArea: 1,
        maxArea: 0,
      });
      if (cancelRef.current || token !== runToken.current) return;
      const areas = sonda.objects.map((o) => o.area).sort((a, b) => a - b);
      const mediana = areas.length ? areas[Math.floor(areas.length / 2)] : undefined;
      setMedianaAreaPx(mediana);

      const ctx: ContextoDeLimite = { umPerPixel, medianaAreaPx: mediana, areaDaImagemPx };
      const minAreaPx2 = paraPx2(minLimite, ctx) ?? 60;
      const maxAreaPx2 = maxLimite.valor > 0 ? (paraPx2(maxLimite, ctx) ?? 0) : 0;
      const raioDeFundo = backgroundManual ?? raioDeFundoSugerido(ctx);

      const opcoesDeLocalizacao: DetectionOptions = {
        sensitivity,
        minArea: minAreaPx2,
        maxArea: maxAreaPx2 || undefined,
        darkOnLight: darkOnLightOpt,
        splitTouching,
        separation,
        backgroundRadius: raioDeFundo,
        thresholdMode,
        channel,
        denoise,
        maxElongation,
        roi: regiao ?? undefined,
      };
      localizacaoAtualRef.current = opcoesDeLocalizacao;

      const deteccao = detectObjects(image, opcoesDeLocalizacao);
      if (cancelRef.current || token !== runToken.current) return;
      setDarkOnLightDecidido(deteccao.darkOnLight);
      setDiagnostico({
        totalBlobs: deteccao.totalBlobs,
        rejected: deteccao.rejected,
        warnings: deteccao.warnings,
      });

      const limitado = deteccao.objects.length > LIMITE_DE_PONTOS;
      const pontos = (limitado ? deteccao.objects.slice(0, LIMITE_DE_PONTOS) : deteccao.objects).map(
        (o) => ({ x: o.x, y: o.y })
      );

      const receitaTemporaria: Receita = {
        id: 'encontrar',
        nome: 'Encontrar',
        quando: '',
        localizacao: opcoesDeLocalizacao,
        onda: ondaOpcoes,
      };
      const resultadoOnda = await executarReceita(receitaTemporaria, pontos, onda, {
        cancelado: () => cancelRef.current || token !== runToken.current,
      });
      if (!resultadoOnda || cancelRef.current || token !== runToken.current) return;

      setResultado({
        propostos: resultadoOnda.propostos,
        contagem: resultadoOnda.resumo.contagem,
        suspeitos: resultadoOnda.resumo.suspeitos,
        escapes: resultadoOnda.escapes,
        limitado,
      });
      onContornosPropostos(resultadoOnda.propostos.map((p) => p.contorno));
    } finally {
      if (token === runToken.current) setIsRunning(false);
    }
  }, [
    image,
    sensitivity,
    polarity,
    backgroundManual,
    thresholdMode,
    channel,
    denoise,
    splitTouching,
    separation,
    maxElongation,
    minLimite,
    maxLimite,
    regiao,
    umPerPixel,
    areaDaImagemPx,
    onda,
    onContornosPropostos,
    ondaOpcoes,
  ]);

  // Mexer num controle re-executa, com um pequeno atraso — evita rodar a
  // localização inteira a cada pixel de um arraste de slider.
  //
  // SÓ quando um controle mudou. Rodar ao montar ou ao trocar de imagem
  // fazia a localização + onda correrem na imagem inteira sem ninguém pedir:
  // fantasmas apareciam sozinhos e a thread principal ficava ocupada — o
  // clique da onda "não ia". A chave abaixo é o retrato dos controles; a
  // imagem fica de fora de propósito, e ao trocar de imagem a proposta
  // antiga é apagada em vez de recalculada.
  const chaveDosControles = JSON.stringify([
    sensitivity, polarity, backgroundManual, thresholdMode, channel, denoise, splitTouching, separation,
    maxElongation, minLimite, maxLimite, regiao, ondaOpcoes,
  ]);
  const ultimaChaveRef = useRef<string | null>(null);
  useEffect(() => {
    if (ultimaChaveRef.current === null) {
      ultimaChaveRef.current = chaveDosControles; // primeira renderização: só registra
      return;
    }
    if (ultimaChaveRef.current === chaveDosControles) return;
    ultimaChaveRef.current = chaveDosControles;
    const t = setTimeout(() => {
      void executar();
    }, ATRASO_MS);
    return () => {
      clearTimeout(t);
      cancelRef.current = true;
    };
  }, [chaveDosControles, executar]);

  // Imagem nova: a proposta era da anterior.
  useEffect(() => {
    setResultado(null);
    onContornosPropostos([]);
  }, [image, onContornosPropostos]);

  useEffect(() => () => onContornosPropostos([]), [onContornosPropostos]);

  const handleAplicar = useCallback(() => {
    if (!resultado || resultado.propostos.length === 0) return;
    onAplicar(resultado.propostos);
    setResultado(null);
    onContornosPropostos([]);
  }, [resultado, onAplicar, onContornosPropostos]);

  const handleInverterFundo = useCallback(() => {
    setPolarity(darkOnLightDecidido ? 'light' : 'dark');
  }, [darkOnLightDecidido]);

  const handleSalvar = useCallback(() => {
    const nome = nomeDaReceita.trim();
    if (!nome) return;
    onSalvarReceita(nome, localizacaoAtualRef.current, ondaOpcoes);
    setNomeDaReceita('');
  }, [nomeDaReceita, onSalvarReceita, ondaOpcoes]);

  const disabled = !image;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">Encontrar</h3>
      </div>
      <p className="text-[10px] text-ink-3 leading-snug">
        Localiza objetos por contraste — serve para qualquer cultura, sem modelo.
      </p>

      {/* Fundo: o que a polaridade decidiu, com um clique para inverter. */}
      {darkOnLightDecidido != null && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5">
          <span className="text-[11px] text-ink-2">
            {darkOnLightDecidido ? 'Fundo claro, objeto escuro' : 'Fundo escuro, objeto claro'}
          </span>
          <button
            type="button"
            onClick={handleInverterFundo}
            title="Inverter: o fundo era o outro tom"
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-line text-ink-2 hover:bg-surface-2 text-[10px] font-bold uppercase tracking-wide transition-colors"
          >
            <RotateCcw size={11} /> Inverter
          </button>
        </div>
      )}

      {/* Sensibilidade */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
            Sensibilidade
          </label>
          <span className="text-[11px] font-mono text-ink-2">{sensitivity}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <p className="text-[10px] text-ink-3">mais objetos ↔ menos falsos</p>
      </div>

      {/* Limites de tamanho — três formas equivalentes */}
      <SeletorDeLimite titulo="Tamanho mínimo" limite={minLimite} ctx={ctxLimite} onChange={setMinLimite} />
      <SeletorDeLimite
        titulo="Tamanho máximo"
        limite={maxLimite}
        ctx={ctxLimite}
        semLimiteEhZero
        onChange={setMaxLimite}
      />

      {/* Fundo (remoção de gradiente) — auto por padrão, sugerido pela mediana */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
            Remover fundo
          </label>
          <span className="text-[11px] font-mono text-ink-2">
            {backgroundEfetivo} px{backgroundManual == null && ' (auto)'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={300}
          step={5}
          value={backgroundEfetivo}
          onChange={(e) => setBackgroundManual(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-ink-3 leading-snug">
            2 × o raio do maior objeto esperado{medianaAreaPx ? ', pela mediana já encontrada.' : ', por não haver mediana ainda: fração da área da imagem.'}
          </p>
          {backgroundManual != null && (
            <button
              type="button"
              onClick={() => setBackgroundManual(null)}
              className="shrink-0 text-[10px] font-bold uppercase text-accent hover:underline"
            >
              Auto
            </button>
          )}
        </div>
      </div>

      {/* Avançado */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-ink-3 hover:bg-surface-2 transition-colors"
      >
        Ajustes avançados
        {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {showAdvanced && (
        <div className="space-y-3 pl-1 border-l-2 border-line-soft">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Limiar</label>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ['otsu', 'Global'],
                  ['adaptive', 'Local'],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setThresholdMode(v)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    thresholdMode === v
                      ? 'bg-accent border-accent text-accent-on'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
              Canal analisado
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ['luminance', 'Lum'],
                  ['r', 'R'],
                  ['g', 'G'],
                  ['b', 'B'],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setChannel(v)}
                  className={`px-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    channel === v
                      ? 'bg-accent border-accent text-accent-on'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Contraste</label>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['auto', 'Auto'],
                  ['dark', 'Escuras'],
                  ['light', 'Claras'],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setPolarity(v)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    polarity === v
                      ? 'bg-accent border-accent text-accent-on'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
                Limpeza de ruído
              </label>
              <span className="text-[11px] font-mono text-ink-2">{denoise}</span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              value={denoise}
              onChange={(e) => setDenoise(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
                Alongamento máx.
              </label>
              <span className="text-[11px] font-mono text-ink-2">
                {maxElongation === 0 ? 'sem limite' : `${maxElongation}:1`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={15}
              value={maxElongation}
              onChange={(e) => setMaxElongation(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={splitTouching}
              onChange={(e) => setSplitTouching(e.target.checked)}
              className="accent-accent"
            />
            <span className="text-[11px] text-ink-2">Separar sementes encostadas</span>
          </label>

          {splitTouching && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
                  Separação (raio, px)
                </label>
                <span className="text-[11px] font-mono text-ink-2">{separation}</span>
              </div>
              <input
                type="range"
                min={3}
                max={60}
                value={separation}
                onChange={(e) => setSeparation(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          )}
        </div>
      )}

      {/* Região de varredura */}
      {onSelecionarRegiao && (
        <div className="space-y-1.5 rounded-xl border border-line p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Região</span>
          <p className="text-[10px] text-ink-3 leading-snug">
            {regiao
              ? `${Math.round(regiao.width)} × ${Math.round(regiao.height)} px selecionados.`
              : 'Sem região: detecta na imagem inteira.'}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={onSelecionarRegiao}
              disabled={!image}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40 text-[10px] font-bold uppercase tracking-wide transition-colors"
            >
              <SquareDashedMousePointer size={12} />
              {regiao ? 'Redesenhar' : 'Selecionar'}
            </button>
            {regiao && onLimparRegiao && (
              <button
                onClick={onLimparRegiao}
                className="px-2 py-1.5 rounded-lg border border-line text-ink-3 hover:bg-surface-2 disabled:opacity-40 text-[10px] font-bold uppercase tracking-wide transition-colors"
              >
                Imagem toda
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resultado */}
      <div className="space-y-2.5 rounded-xl border border-line bg-surface-2 p-3">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 size={14} className="animate-spin text-accent" />
          ) : (
            <Wand2 size={14} className="text-accent" />
          )}
          <p className="text-xs text-ink-2">
            {isRunning ? (
              'Localizando…'
            ) : resultado ? (
              <>
                <strong>{resultado.contagem}</strong> {resultado.contagem === 1 ? 'objeto' : 'objetos'}
                {resultado.suspeitos > 0 && (
                  <span className="text-accent"> · {resultado.suspeitos} suspeitos</span>
                )}
              </>
            ) : (
              'Ajuste os controles para localizar.'
            )}
          </p>
        </div>

        {diagnostico && (
          <p className="text-[10px] text-ink-3">
            {diagnostico.totalBlobs} regiões brutas
            {diagnostico.rejected &&
              ` · descartadas: ${diagnostico.rejected.area} por tamanho, ${diagnostico.rejected.background} como fundo${diagnostico.rejected.elongation ? `, ${diagnostico.rejected.elongation} por forma` : ''}`}
          </p>
        )}
        {resultado?.escapes ? (
          <p className="text-[10px] text-ink-3">
            {resultado.escapes} {resultado.escapes === 1 ? 'ponto' : 'pontos'} sem contorno — a onda escapou.
          </p>
        ) : null}
        {resultado?.limitado && (
          <p className="text-[10px] text-ink-3 leading-snug">
            Mais de {LIMITE_DE_PONTOS} pontos localizados — rodou sobre uma amostra dos{' '}
            {LIMITE_DE_PONTOS} primeiros.
          </p>
        )}
        {diagnostico?.warnings?.map((wmsg, i) => (
          <p key={i} className="flex items-start gap-1.5 text-[10px] text-amber-700 dark:text-amber-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            {wmsg}
          </p>
        ))}

        <div className="flex gap-2">
          <button
            onClick={() => void executar()}
            disabled={disabled || isRunning}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-accent text-accent hover:bg-accent-tint disabled:opacity-40 text-[11px] font-bold uppercase tracking-wide transition-colors"
            title="Rodar com os controles atuais; o resultado aparece tracejado até Aplicar"
          >
            <Eye size={14} /> {isRunning ? 'Rodando…' : 'Prévia'}
          </button>
          <button
            onClick={handleAplicar}
            disabled={disabled || !resultado || resultado.propostos.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accent-strong disabled:opacity-40 text-accent-on text-[11px] font-bold uppercase tracking-wide transition-colors"
          >
            <Check size={14} /> Aplicar
          </button>
          <button
            onClick={() => {
              setResultado(null);
              onContornosPropostos([]);
            }}
            disabled={!resultado}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40 text-[11px] font-bold uppercase tracking-wide transition-colors"
          >
            <X size={14} /> Descartar
          </button>
        </div>
      </div>

      {/* Salvar como receita — vira 4ª opção do ensaio nas próximas imagens */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-ink-3">
          Salvar como receita
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={nomeDaReceita}
            onChange={(e) => setNomeDaReceita(e.target.value)}
            placeholder="Nome da receita"
            className="flex-1 min-w-0 border-line bg-surface-1 text-ink-1 text-[11px] rounded-md border px-2 py-1.5"
          />
          <button
            type="button"
            onClick={handleSalvar}
            disabled={!nomeDaReceita.trim()}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40 text-[10px] font-bold uppercase tracking-wide transition-colors"
          >
            <Save size={12} /> Salvar
          </button>
        </div>
      </div>
    </section>
  );
}
