// =============================================================================
// SeedCounter — Germinação: a tela do Germinator (Joosen et al., 2010)
//
// O núcleo (`lib/germinacao`) reproduz a planilha Germinator_curve-fitting
// contra 24 amostras reais; esta é a tela que a substitui no laboratório.
// Três áreas, na ordem em que a pessoa trabalha: DADOS (colar, importar,
// corrigir), CURVAS (ver), PARÂMETROS (ler, comparar, exportar).
//
// AS VOZES QUE DESENHARAM ISTO (regra da casa desde 22/09):
//
//   Pesquisadora de forrageira — "eu colo a aba INPUT do Excel e quero a
//     curva por tratamento, t50 e U7525 na tabela, a comparação entre T0 e
//     T8 com letras de Tukey, e exportar de volta no formato da planilha."
//     → área de colar em cima; tratamento = código repetido; letras na
//     tabela por tratamento; três exportações, duas delas TSV da planilha.
//   Pesquisador de orquídea — "meu eixo é dias; quero trazer as leituras do
//     longitudinal sem redigitar." → o botão "Importar do experimento",
//     dias × 24, sem fundir os dois modelos.
//   Aluno em treinamento — "não sei o que é U7525." → toda coluna tem uma
//     frase no `title` (`colunas.ts`), e o estado da amostra recusada é
//     texto, não ícone.
//   Analista comercial — "não uso isso; que não apareça no meu modo." → a
//     aba obedece à parte `germinacao` de `visualizacao/modo.ts`: some em
//     contagem e apresentação.
//   Apresentação — "a curva tem que ficar bonita em tela cheia." → o botão
//     de tela cheia leva só o cartão do gráfico, com legenda e fundo do tema.
//
// O QUE É ESTADO AQUI E O QUE NÃO É.
//
// Estado: a grade de texto e a configuração (persistidas), o modo do gráfico
// e os tratamentos escondidos pela legenda. Todo o resto — entradas,
// análise, pontos do gráfico — é derivado a cada render por `useMemo`, sem
// cache manual: 24 ajustes de Hill levam ~40 ms, o que cabe numa digitação.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize2, Minimize2, Plus, Sprout, Trash2, X } from 'lucide-react';
import type { Experiment } from '../../types';
import { sobDemanda } from '../../lib/sob-demanda';
import { baixarArquivo, nomeDeExportacao } from '../../lib/download';
import { gravarPreferenciaTexto, lerPreferenciaTexto } from '../settings/preferencias';
import {
  doLongitudinal,
  escreverTabelaINPUT,
  lerTabelaColada,
  motivoParaNaoImportar,
} from './entrada';
import {
  analisar,
  CONFIGURACAO_PADRAO,
  PARAMETROS_COMPARADOS,
  UNIFORMIDADES,
  type Analise,
  type ConfiguracaoDaAnalise,
  type LinhaAnalisada,
  type ParametroComparado,
  type ResumoDoTratamento,
  type Uniformidade,
} from './analise';
import {
  acrescentarLinha,
  acrescentarTempo,
  CHAVE_DO_ESTADO,
  editarCelula,
  editarTempo,
  entradasDaTabela,
  lerEstadoGravado,
  removerLinha,
  removerTempo,
  serializarEstado,
  TABELA_VAZIA,
  tabelaDasAmostras,
  type TabelaDeEntrada,
} from './tabela';
import { corDoTratamento, dadosDoGrafico, type ModoDoGrafico } from './curvas';
import { escreverCsv, escreverTabelaOUTPUT } from './saida';
import { AJUDA_FIXA, COLUNAS_DE_PARAMETROS } from './colunas';
import { carregarExemplo, NOME_DO_EXEMPLO } from './exemplo';

// O gráfico é a única parte que pesa (`recharts`); o resto chega na hora.
const GraficoDeGerminacao = sobDemanda(() =>
  import('./GraficoDeGerminacao').then((m) => m.GraficoDeGerminacao)
);

export interface PainelDeGerminacaoProps {
  /** Os experimentos do longitudinal, para o botão de importar. */
  experiments: readonly Experiment[];
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

/** Número com vírgula decimal; "—" para o que não existe. */
function numero(v: number | null | undefined, casas: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(casas).replace('.', ',');
}

const NOMES_DOS_COMPARADOS: Record<ParametroComparado, string> = {
  t50MaxG: 't50',
  gMax: 'gMAX',
  auc: 'AUC',
};

// ---------------------------------------------------------------------------
// Classes repetidas
// ---------------------------------------------------------------------------

const CARTAO = 'bg-surface-1 border-line rounded-panel border p-4';
const TITULO = 'text-ink-3 text-[10px] font-bold tracking-widest uppercase';
const CAMPO =
  'bg-surface-2 border-line rounded-control text-ink-1 focus:border-accent border px-2 py-1 text-xs focus:outline-none';
const BOTAO_SECUNDARIO =
  'rounded-control border-line text-ink-2 hover:bg-surface-2 flex cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-bold tracking-wide uppercase transition-colors disabled:cursor-default disabled:opacity-40';
const BOTAO_PRIMARIO =
  'rounded-control bg-accent text-accent-on hover:bg-accent-strong flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase transition-colors disabled:cursor-default disabled:opacity-40';
const CELULA_DA_GRADE =
  'bg-transparent text-ink-1 focus:bg-surface-2 w-16 rounded-control px-1.5 py-0.5 text-right font-mono text-xs tabular-nums focus:outline-none';

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

function estadoInicial(): { tabela: TabelaDeEntrada; configuracao: ConfiguracaoDaAnalise } {
  const gravado = lerEstadoGravado(lerPreferenciaTexto(CHAVE_DO_ESTADO, ''));
  return gravado ?? { tabela: TABELA_VAZIA, configuracao: CONFIGURACAO_PADRAO };
}

// ---------------------------------------------------------------------------
// O painel
// ---------------------------------------------------------------------------

export function PainelDeGerminacao({ experiments }: PainelDeGerminacaoProps) {
  const [inicial] = useState(estadoInicial);
  const [tabela, setTabela] = useState<TabelaDeEntrada>(inicial.tabela);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDaAnalise>(inicial.configuracao);
  const [textoColado, setTextoColado] = useState('');
  const [erroDaColagem, setErroDaColagem] = useState<string | null>(null);
  const [experimentoEscolhido, setExperimentoEscolhido] = useState('');
  const [avisoDaImportacao, setAvisoDaImportacao] = useState<string | null>(null);
  const [modoDoGrafico, setModoDoGrafico] = useState<ModoDoGrafico>('amostras');
  const [ocultos, setOcultos] = useState<ReadonlySet<string>>(() => new Set());
  const [emTelaCheia, setEmTelaCheia] = useState(false);
  const cartaoDoGrafico = useRef<HTMLDivElement>(null);

  // Persistência: a grade e a configuração sobrevivem a sair da aba.
  useEffect(() => {
    gravarPreferenciaTexto(CHAVE_DO_ESTADO, serializarEstado({ tabela, configuracao }));
  }, [tabela, configuracao]);

  // Tela cheia: o navegador é a fonte da verdade (Esc sai sem avisar o React).
  useEffect(() => {
    const aoMudar = () =>
      setEmTelaCheia(
        document.fullscreenElement === cartaoDoGrafico.current && cartaoDoGrafico.current !== null
      );
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  const { entradas, erroDosTempos } = useMemo(() => entradasDaTabela(tabela), [tabela]);
  const analise: Analise = useMemo(
    () => analisar(entradas, configuracao),
    [entradas, configuracao]
  );
  const dados = useMemo(() => dadosDoGrafico(analise, modoDoGrafico), [analise, modoDoGrafico]);
  const haDados = analise.linhas.length > 0;

  // --- Entrada -------------------------------------------------------------

  const substituirGrade = useCallback(
    (nova: TabelaDeEntrada) => {
      const temAlgo = tabela.linhas.some(
        (l) => l.codigo.trim() !== '' || l.contagens.some((c) => c.trim() !== '')
      );
      if (
        temAlgo &&
        !window.confirm('Substituir a grade atual? As linhas de agora serão perdidas.')
      )
        return false;
      setTabela(nova);
      setOcultos(new Set());
      return true;
    },
    [tabela]
  );

  const lerColagem = () => {
    const r = lerTabelaColada(textoColado);
    if (r.amostras === null) {
      setErroDaColagem(r.erro);
      return;
    }
    setErroDaColagem(null);
    if (substituirGrade(tabelaDasAmostras(r.amostras))) setTextoColado('');
  };

  const importarDoLongitudinal = () => {
    const experimento = experiments.find((e) => e.id === experimentoEscolhido);
    if (!experimento) return;
    const motivo = motivoParaNaoImportar(experimento);
    if (motivo !== null) {
      setAvisoDaImportacao(motivo);
      return;
    }
    const amostras = doLongitudinal(experimento);
    if (amostras.length === 0) {
      setAvisoDaImportacao(
        'Nenhum tratamento deste experimento tem avaliação com sementes contadas.'
      );
      return;
    }
    setAvisoDaImportacao(null);
    substituirGrade(tabelaDasAmostras(amostras));
  };

  const carregarOExemplo = async () => {
    const amostras = await carregarExemplo();
    if (substituirGrade(tabelaDasAmostras(amostras)))
      setConfiguracao((c) => ({ ...c, tMaxParaAuc: 504 }));
  };

  // --- Saída ---------------------------------------------------------------

  const amostrasLegiveis = useMemo(
    () => analise.linhas.flatMap((l) => (l.amostra === null ? [] : [l.amostra])),
    [analise]
  );

  const exportarCsv = () =>
    baixarArquivo(
      escreverCsv(analise, configuracao),
      nomeDeExportacao({ tipo: 'germinacao-parametros' }, 'csv'),
      'text/csv;charset=utf-8'
    );
  const exportarInput = () =>
    baixarArquivo(
      escreverTabelaINPUT(amostrasLegiveis),
      nomeDeExportacao({ tipo: 'germinator-INPUT' }, 'tsv'),
      'text/tab-separated-values;charset=utf-8'
    );
  const exportarOutput = () =>
    baixarArquivo(
      escreverTabelaOUTPUT(analise, configuracao),
      nomeDeExportacao({ tipo: 'germinator-output' }, 'tsv'),
      'text/tab-separated-values;charset=utf-8'
    );

  // --- Gráfico -------------------------------------------------------------

  const alternarTratamento = (nome: string) =>
    setOcultos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(nome)) proximo.delete(nome);
      else proximo.add(nome);
      return proximo;
    });

  const alternarTelaCheia = () => {
    const el = cartaoDoGrafico.current;
    if (!el) return;
    if (document.fullscreenElement === el) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  const configurar = <K extends keyof ConfiguracaoDaAnalise>(
    chave: K,
    valor: ConfiguracaoDaAnalise[K]
  ) => setConfiguracao((c) => ({ ...c, [chave]: valor }));

  return (
    <div className="bg-surface-0 flex-1 overflow-auto p-4 md:p-6">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-ink-1 flex items-center gap-2 text-base font-bold tracking-tight">
              <Sprout size={18} strokeWidth={2.25} aria-hidden="true" className="text-accent" />
              Germinação
            </h2>
            <p className="text-ink-3 mt-0.5 text-xs">
              Curva de Hill e parâmetros do Germinator (Joosen et al., 2010): gMAX, t50,
              uniformidade, AUC, MGT — e a comparação entre tratamentos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregarOExemplo()}
            className={BOTAO_SECUNDARIO}
            title={`Carrega ${NOME_DO_EXEMPLO}: as 24 amostras reais que validaram o núcleo.`}
          >
            Exemplo
          </button>
        </header>

        {/* ── 1. DADOS ─────────────────────────────────────────────────── */}
        <section aria-labelledby="germinacao-dados" className="flex flex-col gap-3">
          <h3 id="germinacao-dados" className={TITULO}>
            1 · Dados
          </h3>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
            {/* Colar */}
            <div className={`${CARTAO} flex flex-col gap-2`}>
              <label htmlFor="germinacao-colar" className="text-ink-2 text-xs font-semibold">
                Colar a aba INPUT da planilha
              </label>
              <textarea
                id="germinacao-colar"
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
                rows={5}
                spellCheck={false}
                placeholder={'t\t\t48\t96\t168\nT0\t50\t0\t21\t30\nT0\t50\t0\t17\t25'}
                className={`${CAMPO} w-full font-mono whitespace-pre`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={lerColagem}
                  disabled={textoColado.trim() === ''}
                  className={BOTAO_PRIMARIO}
                >
                  Ler a tabela
                </button>
                <span className="text-ink-3 text-[11px]">
                  Selecione a aba INPUT no Excel, Ctrl+C, e cole aqui.
                </span>
              </div>
              {erroDaColagem !== null && (
                <p role="alert" className="text-danger text-[11px]">
                  {erroDaColagem}
                </p>
              )}
            </div>

            {/* Importar do longitudinal */}
            <div className={`${CARTAO} flex flex-col gap-2`}>
              <label htmlFor="germinacao-experimento" className="text-ink-2 text-xs font-semibold">
                Importar do experimento longitudinal
              </label>
              <select
                id="germinacao-experimento"
                value={experimentoEscolhido}
                onChange={(e) => setExperimentoEscolhido(e.target.value)}
                className={`${CAMPO} w-full`}
              >
                <option value="">— escolher um experimento —</option>
                {experiments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={importarDoLongitudinal}
                  disabled={experimentoEscolhido === ''}
                  className={BOTAO_SECUNDARIO}
                >
                  Importar
                </button>
                <span className="text-ink-3 text-[11px]">
                  Dias após a semeadura viram horas (× 24); uma amostra por tratamento.
                </span>
              </div>
              {experiments.length === 0 && (
                <p className="text-ink-3 text-[11px] italic">
                  Nenhum experimento cadastrado na aba Longitudinal.
                </p>
              )}
              {avisoDaImportacao !== null && (
                <p role="alert" className="text-warn text-[11px]">
                  {avisoDaImportacao}
                </p>
              )}
            </div>

            {/* Configuração */}
            <div className={`${CARTAO} flex flex-col gap-2`}>
              <span className="text-ink-2 text-xs font-semibold">Configuração</span>
              <label
                className="flex items-center justify-between gap-2 text-[11px]"
                title="Amostras em que germinaram menos sementes que isto ao fim não recebem curva: com uma ou duas a curva não significa nada. A planilha usa 3."
              >
                <span className="text-ink-2">Germinação mínima</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={configuracao.germinacaoMinima}
                  onChange={(e) =>
                    configurar('germinacaoMinima', Math.max(1, Number(e.target.value) || 1))
                  }
                  className={`${CAMPO} w-20 text-right font-mono`}
                />
              </label>
              <label
                className="flex items-center justify-between gap-2 text-[11px]"
                title="Até que hora a AUC e o MGT integram a curva. Vazio = o último tempo observado. A planilha original usa 504 h. Só compare AUC calculadas com o mesmo tMAX."
              >
                <span className="text-ink-2">tMAX para AUC (h)</span>
                <input
                  type="number"
                  min={1}
                  value={configuracao.tMaxParaAuc ?? ''}
                  placeholder={analise.tMax === null ? 'último' : String(analise.tMax)}
                  onChange={(e) =>
                    configurar(
                      'tMaxParaAuc',
                      e.target.value === '' ? null : Math.max(1, Number(e.target.value) || 1)
                    )
                  }
                  className={`${CAMPO} w-20 text-right font-mono`}
                />
              </label>
              <label
                className="flex items-center justify-between gap-2 text-[11px]"
                title="O x de t-x: a coluna t20 é a hora em que a curva atinge 20 % da germinação máxima. A planilha usa 20."
              >
                <span className="text-ink-2">x de t-x (%)</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={configuracao.percentualParaTx}
                  onChange={(e) =>
                    configurar(
                      'percentualParaTx',
                      Math.min(99, Math.max(1, Number(e.target.value) || 20))
                    )
                  }
                  className={`${CAMPO} w-20 text-right font-mono`}
                />
              </label>
              <label
                className="flex items-center justify-between gap-2 text-[11px]"
                title={UNIFORMIDADES[configuracao.uniformidade].ajuda}
              >
                <span className="text-ink-2">Uniformidade</span>
                <select
                  value={configuracao.uniformidade}
                  onChange={(e) => configurar('uniformidade', e.target.value as Uniformidade)}
                  className={`${CAMPO} w-24`}
                >
                  {(Object.keys(UNIFORMIDADES) as Uniformidade[]).map((u) => (
                    <option key={u} value={u}>
                      {UNIFORMIDADES[u].rotulo}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* A grade */}
          <Grade
            tabela={tabela}
            setTabela={setTabela}
            erroDosTempos={erroDosTempos}
            analise={analise}
          />
        </section>

        {/* ── 2. CURVAS ────────────────────────────────────────────────── */}
        <section aria-labelledby="germinacao-curvas" className="flex flex-col gap-3">
          <h3 id="germinacao-curvas" className={TITULO}>
            2 · Curvas
          </h3>
          <div
            ref={cartaoDoGrafico}
            className={`${CARTAO} flex flex-col gap-3 ${emTelaCheia ? 'h-screen w-screen justify-center p-8' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Legenda: sempre presente com ≥ 2 séries; clicar esconde sem repintar. */}
              <ul
                className="flex flex-wrap items-center gap-x-4 gap-y-1"
                aria-label="Legenda: tratamentos"
              >
                {dados.tratamentos.map((t) => {
                  const escondido = ocultos.has(t.nome);
                  return (
                    <li key={t.nome}>
                      <button
                        type="button"
                        onClick={() => alternarTratamento(t.nome)}
                        aria-pressed={!escondido}
                        title={
                          escondido
                            ? `Mostrar ${t.nome}`
                            : `Esconder ${t.nome} (${t.amostras} amostra${t.amostras === 1 ? '' : 's'})`
                        }
                        className={`rounded-control flex cursor-pointer items-center gap-1.5 px-1 py-0.5 text-xs transition-opacity ${escondido ? 'opacity-40' : ''}`}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-block h-0.5 w-4"
                          style={{ backgroundColor: corDoTratamento(t.indiceDaCor) }}
                        />
                        <span className="text-ink-2 font-semibold">{t.nome}</span>
                      </button>
                    </li>
                  );
                })}
                {dados.tratamentos.length === 0 && (
                  <li className="text-ink-3 text-xs italic">Sem amostras para desenhar.</li>
                )}
              </ul>
              <div className="flex items-center gap-2">
                <div
                  role="radiogroup"
                  aria-label="O que desenhar"
                  className="bg-surface-2 rounded-control flex p-0.5 text-[10px] font-bold tracking-wider uppercase"
                >
                  {(
                    [
                      ['amostras', 'Amostras'],
                      ['tratamentos', 'Médias'],
                    ] as const
                  ).map(([modo, rotulo]) => (
                    <button
                      key={modo}
                      type="button"
                      role="radio"
                      aria-checked={modoDoGrafico === modo}
                      onClick={() => setModoDoGrafico(modo)}
                      title={
                        modo === 'amostras'
                          ? 'Uma curva e um conjunto de pontos por amostra.'
                          : 'A média das curvas e dos pontos das repetições de cada tratamento.'
                      }
                      className={`rounded-control cursor-pointer px-2 py-1 transition-colors ${modoDoGrafico === modo ? 'bg-surface-1 text-ink-1 shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-ink-3 hover:text-ink-1'}`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={alternarTelaCheia}
                  disabled={!haDados}
                  className={BOTAO_SECUNDARIO}
                  title={emTelaCheia ? 'Sair da tela cheia (Esc)' : 'Só o gráfico, em tela cheia'}
                >
                  {emTelaCheia ? (
                    <Minimize2 size={12} aria-hidden="true" />
                  ) : (
                    <Maximize2 size={12} aria-hidden="true" />
                  )}
                  {emTelaCheia ? 'Sair' : 'Tela cheia'}
                </button>
              </div>
            </div>
            <div className={emTelaCheia ? 'min-h-0 flex-1' : 'h-[380px]'}>
              {dados.series.length > 0 ? (
                <GraficoDeGerminacao dados={dados} modo={modoDoGrafico} ocultos={ocultos} />
              ) : (
                <div className="border-line text-ink-3 flex h-full items-center justify-center rounded-panel border border-dashed text-xs">
                  Cole a aba INPUT, importe um experimento ou carregue o exemplo.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 3. PARÂMETROS ────────────────────────────────────────────── */}
        <section aria-labelledby="germinacao-parametros" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="germinacao-parametros" className={TITULO}>
              3 · Parâmetros
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportarCsv}
                disabled={!haDados}
                className={BOTAO_SECUNDARIO}
                title="Uma linha por amostra e uma seção com as médias por tratamento e as letras de Tukey. Ponto e vírgula, vírgula decimal."
              >
                <Download size={12} aria-hidden="true" />
                CSV
              </button>
              <button
                type="button"
                onClick={exportarInput}
                disabled={amostrasLegiveis.length === 0}
                className={BOTAO_SECUNDARIO}
                title="A grade, no formato da aba INPUT da planilha: para colar de volta no Excel do coautor."
              >
                <Download size={12} aria-hidden="true" />
                Planilha · INPUT
              </button>
              <button
                type="button"
                onClick={exportarOutput}
                disabled={!haDados}
                className={BOTAO_SECUNDARIO}
                title="Os parâmetros com as colunas da aba output da planilha, nome por nome: para comparar célula a célula."
              >
                <Download size={12} aria-hidden="true" />
                Planilha · output
              </button>
            </div>
          </div>

          <TabelaPorAmostra analise={analise} configuracao={configuracao} />
          <TabelaPorTratamento analise={analise} configuracao={configuracao} />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A grade editável
// ---------------------------------------------------------------------------

interface GradeProps {
  tabela: TabelaDeEntrada;
  setTabela: (t: TabelaDeEntrada) => void;
  erroDosTempos: string | null;
  analise: Analise;
}

function Grade({ tabela, setTabela, erroDosTempos, analise }: GradeProps) {
  // O estado de cada linha da grade, pela posição — para mostrar o motivo
  // ao lado da linha que o causou. `analise.linhas` pula as linhas vazias,
  // então o casamento é por ordem entre as não vazias.
  const motivoPorLinha = useMemo(() => {
    const m = new Map<number, string>();
    let k = 0;
    tabela.linhas.forEach((l, i) => {
      const vazia =
        l.codigo.trim() === '' &&
        l.sementes.trim() === '' &&
        l.contagens.every((c) => c.trim() === '');
      if (vazia) return;
      const analisada = analise.linhas[k++];
      if (analisada?.motivo) m.set(i, analisada.motivo);
    });
    return m;
  }, [tabela, analise]);

  const nLinhas = tabela.linhas.length;

  return (
    <div className={`${CARTAO} flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-2 text-xs font-semibold">
          Grade{' '}
          {nLinhas > 0 && (
            <span className="text-ink-3 font-normal">
              · {nLinhas} linha{nLinhas === 1 ? '' : 's'} · {tabela.tempos.length} tempo
              {tabela.tempos.length === 1 ? '' : 's'}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTabela(acrescentarTempo(tabela))}
            className={BOTAO_SECUNDARIO}
            title="Uma coluna de tempo a mais, em horas"
          >
            <Plus size={12} aria-hidden="true" />
            tempo
          </button>
          <button
            type="button"
            onClick={() => setTabela(acrescentarLinha(tabela))}
            className={BOTAO_SECUNDARIO}
            title="Uma linha de amostra a mais"
          >
            <Plus size={12} aria-hidden="true" />
            amostra
          </button>
          <button
            type="button"
            onClick={() => window.confirm('Limpar a grade inteira?') && setTabela(TABELA_VAZIA)}
            disabled={nLinhas === 0 && tabela.tempos.length === 0}
            className={BOTAO_SECUNDARIO}
            title="Apaga todas as linhas e tempos"
          >
            <Trash2 size={12} aria-hidden="true" />
            limpar
          </button>
        </div>
      </div>

      {erroDosTempos !== null && (
        <p role="alert" className="text-danger text-[11px]">
          {erroDosTempos}
        </p>
      )}

      {nLinhas === 0 && tabela.tempos.length === 0 ? (
        <p className="text-ink-3 text-[11px] italic">
          A grade está vazia. Cole a aba INPUT acima, importe um experimento, ou acrescente tempos e
          amostras à mão.
        </p>
      ) : (
        // Teto de altura: 24 linhas coladas não podem empurrar o gráfico para
        // fora da tela. O cabeçalho fica fixo para os tempos continuarem
        // legíveis ao rolar.
        <div className="max-h-[360px] overflow-auto">
          <table className="w-auto text-xs">
            <caption className="sr-only">
              Uma linha por amostra: código, sementes e a contagem acumulada em cada tempo (horas)
            </caption>
            <thead className="bg-surface-1 sticky top-0 z-10">
              <tr className="border-line-soft text-ink-3 border-b text-left">
                <th scope="col" className="py-1 pr-2 font-medium" title={AJUDA_FIXA.codigo}>
                  código
                </th>
                <th
                  scope="col"
                  className="py-1 pr-2 text-right font-medium"
                  title={AJUDA_FIXA.sementes}
                >
                  sementes
                </th>
                {tabela.tempos.map((t, k) => (
                  <th key={k} scope="col" className="py-1 pr-1 text-right font-medium">
                    <span className="flex items-center gap-0.5">
                      <input
                        aria-label={`Tempo da coluna ${k + 1}, em horas`}
                        value={t}
                        onChange={(e) => setTabela(editarTempo(tabela, k, e.target.value))}
                        placeholder="h"
                        className={`${CELULA_DA_GRADE} text-ink-3 w-14`}
                      />
                      <button
                        type="button"
                        onClick={() => setTabela(removerTempo(tabela, k))}
                        aria-label={`Remover o tempo ${t || k + 1}`}
                        title="Remover esta coluna"
                        className="text-ink-3 hover:text-danger rounded-control cursor-pointer p-0.5"
                      >
                        <X size={10} aria-hidden="true" />
                      </button>
                    </span>
                  </th>
                ))}
                <th scope="col" className="py-1 pl-2 font-medium" title={AJUDA_FIXA.estado}>
                  estado
                </th>
                <th scope="col" className="sr-only">
                  remover
                </th>
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((linha, i) => {
                const motivo = motivoPorLinha.get(i);
                return (
                  <tr key={i} className="border-line-soft border-b">
                    <td className="py-0.5 pr-2">
                      <input
                        aria-label={`Código da linha ${i + 1}`}
                        value={linha.codigo}
                        onChange={(e) =>
                          setTabela(editarCelula(tabela, i, { campo: 'codigo' }, e.target.value))
                        }
                        className={`${CELULA_DA_GRADE} w-24 text-left font-sans`}
                      />
                    </td>
                    <td className="py-0.5 pr-2">
                      <input
                        aria-label={`Sementes da linha ${i + 1}`}
                        value={linha.sementes}
                        onChange={(e) =>
                          setTabela(editarCelula(tabela, i, { campo: 'sementes' }, e.target.value))
                        }
                        inputMode="decimal"
                        className={CELULA_DA_GRADE}
                      />
                    </td>
                    {linha.contagens.map((c, k) => (
                      <td key={k} className="py-0.5 pr-1">
                        <input
                          aria-label={`Contagem da linha ${i + 1} em ${tabela.tempos[k] || `coluna ${k + 1}`} h`}
                          value={c}
                          onChange={(e) =>
                            setTabela(
                              editarCelula(
                                tabela,
                                i,
                                { campo: 'contagem', coluna: k },
                                e.target.value
                              )
                            )
                          }
                          inputMode="decimal"
                          className={CELULA_DA_GRADE}
                        />
                      </td>
                    ))}
                    <td
                      className={`py-0.5 pl-2 text-[11px] ${motivo ? 'text-warn' : 'text-ink-3'}`}
                    >
                      {motivo ?? (linha.codigo.trim() ? 'ajustada' : '')}
                    </td>
                    <td className="py-0.5 pl-1">
                      <button
                        type="button"
                        onClick={() => setTabela(removerLinha(tabela, i))}
                        aria-label={`Remover a linha ${i + 1}`}
                        title="Remover esta linha"
                        className="text-ink-3 hover:text-danger rounded-control cursor-pointer p-0.5"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela por amostra (a aba output)
// ---------------------------------------------------------------------------

interface TabelaProps {
  analise: Analise;
  configuracao: ConfiguracaoDaAnalise;
}

function valorFormatado(
  coluna: (typeof COLUNAS_DE_PARAMETROS)[number],
  linha: LinhaAnalisada
): string {
  const v = coluna.valor(linha);
  if (v === null) return '—';
  return numero(coluna.emPercentual ? v * 100 : v, coluna.casas);
}

function TabelaPorAmostra({ analise, configuracao }: TabelaProps) {
  if (analise.linhas.length === 0) return null;
  return (
    <div className={`${CARTAO} overflow-x-auto`}>
      <table className="w-full text-xs">
        <caption className="text-ink-2 mb-2 text-left text-xs font-semibold">Por amostra</caption>
        <thead>
          <tr className="border-line-soft text-ink-3 border-b text-left">
            <th scope="col" className="py-1 pr-2 font-medium" title={AJUDA_FIXA.codigo}>
              código
            </th>
            <th
              scope="col"
              className="py-1 pr-2 text-right font-medium"
              title={AJUDA_FIXA.repeticao}
            >
              rep.
            </th>
            <th
              scope="col"
              className="py-1 pr-2 text-right font-medium"
              title={AJUDA_FIXA.sementes}
            >
              sementes
            </th>
            {COLUNAS_DE_PARAMETROS.map((c) => (
              <th
                key={c.chave}
                scope="col"
                className="cursor-help py-1 pr-2 text-right font-medium whitespace-nowrap underline decoration-dotted underline-offset-2"
                title={c.ajuda(configuracao)}
              >
                {c.rotulo(configuracao)}
                {c.unidade !== '' && (
                  <span className="text-ink-3 ml-1 font-normal">({c.unidade})</span>
                )}
              </th>
            ))}
            <th scope="col" className="py-1 pl-2 font-medium" title={AJUDA_FIXA.estado}>
              estado
            </th>
          </tr>
        </thead>
        <tbody className="text-ink-1 font-mono tabular-nums">
          {analise.linhas.map((l) => {
            const tratamento = analise.tratamentos.find((t) => t.tratamento === l.tratamento);
            return (
              <tr key={l.indice} className="border-line-soft border-b">
                <td className="py-1 pr-2 font-sans">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block h-0.5 w-3 shrink-0"
                      style={{ backgroundColor: corDoTratamento(tratamento?.indiceDaCor ?? 99) }}
                    />
                    {l.codigo || <span className="text-ink-3 italic">sem código</span>}
                  </span>
                </td>
                <td className="py-1 pr-2 text-right">{l.repeticao}</td>
                <td className="py-1 pr-2 text-right">{l.sementes ?? '—'}</td>
                {COLUNAS_DE_PARAMETROS.map((c) => (
                  <td
                    key={c.chave}
                    className={`py-1 pr-2 text-right ${c.chave === 'r2' && l.parametros?.r2AbaixoDoLimite ? 'text-warn' : ''}`}
                    title={
                      c.chave === 'r2' && l.parametros?.r2AbaixoDoLimite
                        ? 'r² abaixo de 0,4: a curva não descreve bem os pontos.'
                        : undefined
                    }
                  >
                    {valorFormatado(c, l)}
                  </td>
                ))}
                <td
                  className={`py-1 pl-2 font-sans text-[11px] ${l.motivo ? 'text-warn' : 'text-ink-3'}`}
                >
                  {l.motivo ?? 'ajustada'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabela por tratamento (a aba statistics, mais Tukey)
// ---------------------------------------------------------------------------

function mediaFormatada(
  t: ResumoDoTratamento,
  coluna: (typeof COLUNAS_DE_PARAMETROS)[number]
): string {
  const m = t.medias[coluna.chave];
  if (m === null) return '—';
  const fator = coluna.emPercentual ? 100 : 1;
  const media = numero(m.media * fator, coluna.casas);
  return m.n > 1 ? `${media} ± ${numero(m.sd * fator, coluna.casas)}` : media;
}

function TabelaPorTratamento({ analise, configuracao }: TabelaProps) {
  if (analise.tratamentos.length === 0) return null;
  const letrasDe = (parametro: ParametroComparado, tratamento: string): string | null => {
    const c = analise.comparacoes.find((x) => x.parametro === parametro);
    if (!c) return null;
    return c.letras.get(tratamento) ?? null;
  };
  const comparado = (chave: string): ParametroComparado | null =>
    (PARAMETROS_COMPARADOS as readonly string[]).includes(chave)
      ? (chave as ParametroComparado)
      : null;

  return (
    <div className={`${CARTAO} flex flex-col gap-2 overflow-x-auto`}>
      <table className="w-full text-xs">
        <caption className="text-ink-2 mb-2 text-left text-xs font-semibold">
          Por tratamento — média ± desvio padrão das repetições ajustadas
        </caption>
        <thead>
          <tr className="border-line-soft text-ink-3 border-b text-left">
            <th scope="col" className="py-1 pr-2 font-medium" title={AJUDA_FIXA.codigo}>
              tratamento
            </th>
            <th scope="col" className="py-1 pr-2 text-right font-medium" title={AJUDA_FIXA.n}>
              n
            </th>
            {COLUNAS_DE_PARAMETROS.map((c) => (
              <th
                key={c.chave}
                scope="col"
                className="cursor-help py-1 pr-2 text-right font-medium whitespace-nowrap underline decoration-dotted underline-offset-2"
                title={c.ajuda(configuracao)}
                colSpan={comparado(c.chave) !== null ? 2 : 1}
              >
                {c.rotulo(configuracao)}
                {c.unidade !== '' && (
                  <span className="text-ink-3 ml-1 font-normal">({c.unidade})</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-ink-1 font-mono tabular-nums">
          {analise.tratamentos.map((t) => (
            <tr key={t.tratamento} className="border-line-soft border-b">
              <td className="py-1 pr-2 font-sans font-semibold">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-0.5 w-3 shrink-0"
                    style={{ backgroundColor: corDoTratamento(t.indiceDaCor) }}
                  />
                  {t.tratamento || (
                    <span className="text-ink-3 font-normal italic">sem código</span>
                  )}
                </span>
              </td>
              <td className="py-1 pr-2 text-right" title={AJUDA_FIXA.n}>
                {t.nAjustadas}
                {t.nAjustadas !== t.n && <span className="text-ink-3">/{t.n}</span>}
              </td>
              {COLUNAS_DE_PARAMETROS.map((c) => {
                const p = comparado(c.chave);
                const letras = p === null ? null : letrasDe(p, t.tratamento);
                return [
                  <td key={c.chave} className="py-1 pr-1 text-right whitespace-nowrap">
                    {mediaFormatada(t, c)}
                  </td>,
                  p !== null ? (
                    <td
                      key={`${c.chave}-letras`}
                      className="text-ink-2 py-1 pr-2 text-left font-sans font-semibold"
                      title={AJUDA_FIXA.letras}
                    >
                      {analise.comparacoes.length > 0
                        ? (letras ?? <span className="text-ink-3 font-normal">—</span>)
                        : ''}
                    </td>
                  ) : null,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {analise.comparacoes.length > 0 ? (
        <p className="text-ink-3 text-[11px]">
          {analise.comparacoes.map((c) => (
            <span key={c.parametro} className="mr-3 whitespace-nowrap">
              ANOVA {NOMES_DOS_COMPARADOS[c.parametro]}: F({c.anova.dfBetween}; {c.anova.dfWithin})
              = {numero(c.anova.fStat, 2)},{' '}
              {c.anova.pValue < 0.001 ? 'p < 0,001' : `p = ${numero(c.anova.pValue, 3)}`}
            </span>
          ))}
          <span className="block">
            Tukey a 5 %: tratamentos com uma letra em comum não diferem; &quot;a&quot; é a maior
            média (em t50, a mais lenta).
            {analise.comparacoes[0].excluidos.length > 0 && (
              <>
                {' '}
                Fora da comparação:{' '}
                {analise.comparacoes[0].excluidos
                  .map((e) => `${e.tratamento} (${e.motivo})`)
                  .join(', ')}
                .
              </>
            )}
          </span>
        </p>
      ) : (
        <p className="text-ink-3 text-[11px] italic">{analise.motivoSemComparacao}</p>
      )}
    </div>
  );
}
