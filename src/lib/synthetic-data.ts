// =============================================================================
// SeedCounter — gerador de dados SIMULADOS para demonstração
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Painel de estatística e visão longitudinal só ficam legíveis com dados
// dentro. Num app novo eles abrem vazios, e vazio não demonstra nada — não dá
// para mostrar ANOVA, curva de germinação ou perda de viabilidade no
// armazenamento para quem nunca usou o app sem ter, antes, meses de contagem
// acumulada.
//
// A alternativa (inventar número no olho) produz curva que não se parece com
// semente nenhuma. Aqui os quatro ensaios são cópias de delineamentos que o
// grupo publica, e os números saem de modelos usados na área:
//
//   - contagem por repetição: binomial com superdispersão logit-normal, que é
//     como repetição de laboratório realmente varia — mais que binomial pura;
//   - germinação ao longo do tempo: curva logística;
//   - perda de viabilidade no armazenamento: equação de viabilidade de
//     Ellis & Roberts, v = Ki - p/sigma em probitos (a mesma que a ISTA usa —
//     e o Nelson é do Storage Committee da ISTA);
//   - resposta a potencial osmótico: quadrática com ponto de ótimo, porque é
//     o que MACHADO NETO, COSTA & CUSTÓDIO (2004) reportam em soja: a máxima
//     germinação não foi em água, foi por volta de -0,5 MPa.
//
// TUDO AQUI É SIMULADO. Nada é medição. Por isso todo registro gerado carrega
// o prefixo `demo-` no id, "[DEMO]" no nome e um aviso em `notes`: para que
// nenhum número simulado seja confundido com resultado, e para que a remoção
// seja exata (apaga por prefixo, nunca por adivinhação).
//
// O gerador é determinístico: a mesma semente produz o mesmo conjunto. Sem
// isso, "o gráfico mudou" nunca se distingue de "o gerador é aleatório".
//
// Fundamentação e referências: docs/superpowers/specs/
// 2026-09-03-linhas-de-pesquisa-machado-neto-custodio.md
// =============================================================================

import type {
  Experiment,
  Metadata,
  PlateRun,
  ProtocormStage,
  Session,
  Treatment,
} from '../types';

/** Prefixo de todo id gerado. É o que torna a remoção exata. */
export const PREFIXO_DEMO = 'demo-';

/** Aviso anexado a todo registro simulado. */
export const AVISO_DEMO =
  'DADOS SIMULADOS — gerados pelo SeedCounter para demonstração. Não são medições.';

/** Um registro é de demonstração se o id começa com o prefixo. */
export function ehDemonstracao(id: string): boolean {
  return id.startsWith(PREFIXO_DEMO);
}

// ---------------------------------------------------------------------------
// Aleatoriedade determinística
// ---------------------------------------------------------------------------

/**
 * mulberry32 — gerador pequeno, rápido e com estado de 32 bits.
 *
 * O ponto não é qualidade criptográfica, é reprodutibilidade: a mesma semente
 * tem que dar o mesmo conjunto em qualquer navegador e no vitest.
 */
export function criarRng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal padrão por Box-Muller. */
function normalPadrao(rng: () => number): number {
  // rng() pode devolver 0; log(0) é -Infinity.
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Função de distribuição acumulada da normal padrão (Abramowitz & Stegun 7.1.26). */
export function phi(x: number): number {
  const sinal = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sinal * y);
}

const logit = (p: number) => Math.log(p / (1 - p));
const invLogit = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Proporção de uma repetição, com superdispersão.
 *
 * Repetição de laboratório varia MAIS que binomial pura: a placa inteira pega
 * um pouco menos de solução, o lote daquela repetição veio de outra parte da
 * amostra. Perturbar o logit da proporção antes de sortear a contagem produz
 * exatamente esse excesso, e nunca escapa de (0, 1) — que é o defeito de
 * somar ruído direto na proporção.
 */
function proporcaoDaRepeticao(rng: () => number, p: number, dispersao: number): number {
  const seguro = Math.min(0.999, Math.max(0.001, p));
  return invLogit(logit(seguro) + dispersao * normalPadrao(rng));
}

/** Contagem binomial exata (soma de Bernoulli — n aqui é da ordem de centenas). */
function amostrarBinomial(rng: () => number, n: number, p: number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

/** Inteiro em [min, max]. */
function inteiroEntre(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Modelos biológicos
// ---------------------------------------------------------------------------

/** Curva logística de germinação acumulada. */
export function germinacaoLogistica(dia: number, maximo: number, t50: number, k: number): number {
  return maximo / (1 + Math.exp(-k * (dia - t50)));
}

/**
 * Equação de viabilidade de Ellis & Roberts: v = Ki − p/sigma, em probitos.
 *
 * `ki` é a viabilidade inicial do lote em probitos (2,0 ≈ 97,7%); `sigma` é o
 * número de dias de armazenamento para perder um probito. Umidade relativa
 * mais baixa e espigueta mais pesada aumentam sigma — isto é, conservam mais.
 */
export function viabilidadeNoArmazenamento(dias: number, ki: number, sigma: number): number {
  return phi(ki - dias / sigma);
}

/**
 * Resposta quadrática a potencial osmótico, com ponto de ótimo.
 *
 * Não é um artifício: MACHADO NETO, COSTA & CUSTÓDIO (2004) calculam por
 * regressão que a germinação máxima da soja ocorreu em -0,52 e -0,49 MPa, e
 * não em água. É esse formato que o ensaio produz.
 */
export function respostaAoPotencial(
  potencial: number,
  maximo: number,
  potencialOtimo: number,
  curvatura: number
): number {
  const g = maximo - curvatura * (potencial - potencialOtimo) ** 2;
  return Math.min(0.995, Math.max(0.02, g));
}

// ---------------------------------------------------------------------------
// Entrada e saída
// ---------------------------------------------------------------------------

export interface OpcoesDeDemonstracao {
  /** Semente do gerador. A mesma semente dá o mesmo conjunto. */
  semente?: number;
  /** Data de referência — o ensaio mais recente termina nela. */
  agora?: Date;
  /** Nome que aparece como responsável nos metadados. */
  responsavel?: string;
}

export interface ConjuntoDeDemonstracao {
  experimentos: Experiment[];
  sessoes: Session[];
}

const RESPONSAVEL_PADRAO = 'Demonstração — SeedCounter';
const INSTITUICAO = 'GPEOrq / GPSEM — Unoeste';

function iso(base: Date, deslocamentoEmDias: number): string {
  const d = new Date(base.getTime() + deslocamentoEmDias * 86400000);
  return d.toISOString();
}

function metadados(parcial: Partial<Metadata>): Metadata {
  return {
    researcher: RESPONSAVEL_PADRAO,
    project: '',
    treatment: '',
    plate: '',
    quadrant: '',
    notes: AVISO_DEMO,
    baselineCount: 0,
    useDifferential: false,
    ...parcial,
  };
}

// ---------------------------------------------------------------------------
// Ensaio 1 — tetrazólio em Cattleya (fatorial, uma leitura)
// ---------------------------------------------------------------------------

/**
 * Fatorial pré-condicionamento × concentração de TZ, três repetições — o
 * desenho de CUSTÓDIO, HOSOMI & MACHADO NETO (2021), reduzido a seis
 * tratamentos para caber nas oito séries da paleta sem reciclar cor.
 *
 * As viabilidades reproduzem o achado do boletim: sacarose 10% por 24 h com
 * TZ 1% chega a 97%; sem pré-condicionamento, despenca.
 */
const TRATAMENTOS_TZ: { codigo: string; nome: string; viabilidade: number }[] = [
  { codigo: 'T1', nome: 'Sem pré-condicionamento + TZ 0,25%', viabilidade: 0.41 },
  { codigo: 'T2', nome: 'Sem pré-condicionamento + TZ 1,0%', viabilidade: 0.56 },
  { codigo: 'T3', nome: 'Água 24 h + TZ 0,25%', viabilidade: 0.68 },
  { codigo: 'T4', nome: 'Água 24 h + TZ 1,0%', viabilidade: 0.79 },
  { codigo: 'T5', nome: 'Sacarose 10% 24 h + TZ 0,25%', viabilidade: 0.88 },
  { codigo: 'T6', nome: 'Sacarose 10% 24 h + TZ 1,0%', viabilidade: 0.97 },
];

const PROJETO_TZ = '[DEMO] Tetrazólio em Cattleya tigrina';

function gerarEnsaioTetrazolio(rng: () => number, agora: Date, responsavel: string): Session[] {
  const sessoes: Session[] = [];
  // O ensaio de TZ é uma leitura só, feita bem antes do resto.
  const base = -210;

  TRATAMENTOS_TZ.forEach((trat, iTrat) => {
    for (let rep = 1; rep <= 3; rep++) {
      // 10-20 mg de semente de orquídea são centenas de sementes por lâmina.
      const total = inteiroEntre(rng, 620, 940);
      const p = proporcaoDaRepeticao(rng, trat.viabilidade, 0.22);
      const viaveis = amostrarBinomial(rng, total, p);

      sessoes.push({
        id: `${PREFIXO_DEMO}tz-${trat.codigo}-r${rep}`,
        date: iso(agora, base + iTrat),
        filename: `tz_cattleya_${trat.codigo}_r${rep}.jpg`,
        viableCount: viaveis,
        inviableCount: total - viaveis,
        metadata: metadados({
          researcher: responsavel,
          project: PROJETO_TZ,
          treatment: `${trat.codigo} — ${trat.nome}`,
          plate: `L${String(iTrat + 1).padStart(2, '0')}`,
          quadrant: `R${rep}`,
          notes: `${AVISO_DEMO} Lâmina de microscopia, scanner de mesa, 3600 dpi.`,
        }),
      });
    }
  });

  return sessoes;
}

// ---------------------------------------------------------------------------
// Ensaio 2 — estresse osmótico por manitol (fator quantitativo)
// ---------------------------------------------------------------------------

/** Potenciais da série de manitol, em MPa (MACHADO NETO et al., 2010). */
const POTENCIAIS_MPA = [0, -0.3, -0.6, -0.9, -1.2];

const PROJETO_OSMOTICO = '[DEMO] Estresse osmótico — manitol';

function gerarEnsaioOsmotico(rng: () => number, agora: Date, responsavel: string): Session[] {
  const sessoes: Session[] = [];
  const base = -120;

  POTENCIAIS_MPA.forEach((psi, iPsi) => {
    // Ótimo em -0,5 MPa: a germinação em água NÃO é a maior. É o achado que a
    // regressão polinomial detecta e a separação de médias por letras esconde.
    const esperada = respostaAoPotencial(psi, 0.94, -0.5, 0.8);

    for (let rep = 1; rep <= 4; rep++) {
      // 4 x 50 sementes é o padrão das Regras para Análise de Sementes.
      const total = 50;
      const p = proporcaoDaRepeticao(rng, esperada, 0.18);
      const germinadas = amostrarBinomial(rng, total, p);

      const rotulo = psi === 0 ? '0 MPa (controle)' : `${psi.toFixed(1).replace('.', ',')} MPa`;

      sessoes.push({
        id: `${PREFIXO_DEMO}osm-${iPsi}-r${rep}`,
        date: iso(agora, base + iPsi),
        filename: `manitol_${String(Math.abs(psi * 10)).padStart(2, '0')}_r${rep}.jpg`,
        viableCount: germinadas,
        inviableCount: total - germinadas,
        metadata: metadados({
          researcher: responsavel,
          project: PROJETO_OSMOTICO,
          treatment: rotulo,
          plate: `P${String(iPsi + 1).padStart(2, '0')}`,
          quadrant: `R${rep}`,
          notes: `${AVISO_DEMO} Potencial pela equação de Van't Hoff; leitura no 7º dia.`,
        }),
      });
    }
  });

  return sessoes;
}

// ---------------------------------------------------------------------------
// Ensaio 3 — germinação in vitro acompanhada por DAP
// ---------------------------------------------------------------------------

const DIAS_DE_AVALIACAO = [0, 14, 30, 45, 60, 90];

/** Meio de cultura, velocidade e teto de germinação de cada tratamento. */
const TRATAMENTOS_MEIO = [
  { codigo: 'KC', nome: 'Knudson C', meio: 'KC' as const, maximo: 0.72, t50: 34, k: 0.11 },
  { codigo: 'MS2', nome: 'Murashige & Skoog ½ força', meio: 'half-MS' as const, maximo: 0.86, t50: 27, k: 0.14 }, // prettier-ignore
  { codigo: 'MS', nome: 'Murashige & Skoog completo', meio: 'MS' as const, maximo: 0.64, t50: 31, k: 0.12 },
];

/**
 * Distribuição de estágio de protocormo, dado quantas sementes já germinaram.
 *
 * O estágio avança com o tempo: no dia 14 quase tudo que germinou está no
 * estágio 1; no dia 90 a massa já migrou para 3-5. Modelado como um centro que
 * caminha e uma dispersão em volta dele, e não como fração fixa por dia, que
 * produziria degraus onde a cultura tem transição.
 */
function distribuirEstagios(
  rng: () => number,
  germinadas: number,
  dia: number,
  naoGerminadas: number
): Partial<Record<ProtocormStage, number>> {
  const dist: Partial<Record<ProtocormStage, number>> = { 0: naoGerminadas };
  if (germinadas <= 0) return dist;

  // Centro do desenvolvimento: começa no estágio 1 e sobe ~1 estágio a cada 18 dias.
  const centro = Math.min(5.6, 1 + Math.max(0, dia - 14) / 18);

  for (let i = 0; i < germinadas; i++) {
    const bruto = centro + normalPadrao(rng) * 0.85;
    const estagio = Math.min(6, Math.max(1, Math.round(bruto))) as ProtocormStage;
    dist[estagio] = (dist[estagio] ?? 0) + 1;
  }
  return dist;
}

function gerarEnsaioInVitro(
  rng: () => number,
  agora: Date,
  responsavel: string
): { experimento: Experiment; sessoes: Session[] } {
  const idExp = `${PREFIXO_DEMO}exp-invitro`;
  const semeadura = -95;
  const sessoes: Session[] = [];

  const treatments: Treatment[] = TRATAMENTOS_MEIO.map((meio, iMeio) => {
    // É a MESMA placa reavaliada a cada data: o total é semeado uma vez só, e
    // germinação acumulada não pode cair. Sortear cada dia de forma
    // independente produzia curva que descia — impossível, e a primeira coisa
    // que um avaliador experiente nota no gráfico.
    const total = inteiroEntre(rng, 260, 340);
    let acumuladoAnterior = 0;

    const plates: PlateRun[] = DIAS_DE_AVALIACAO.map((dia) => {
      const esperada = dia === 0 ? 0 : germinacaoLogistica(dia, meio.maximo, meio.t50, meio.k);
      const p = proporcaoDaRepeticao(rng, Math.max(0.002, esperada), 0.16);
      const sorteadas = dia === 0 ? 0 : amostrarBinomial(rng, total, p);
      const germinadas = Math.max(acumuladoAnterior, sorteadas);
      acumuladoAnterior = germinadas;

      // Uma contaminação fúngica de verdade acontece, e o painel precisa ter o
      // que mostrar na aba de contaminação. Cai no MS completo, que é o meio
      // mais rico — que é onde de fato acontece mais.
      const contaminada = meio.codigo === 'MS' && dia >= 45;

      const idSessao = `${PREFIXO_DEMO}invitro-${meio.codigo}-d${dia}`;
      sessoes.push({
        id: idSessao,
        date: iso(agora, semeadura + dia),
        filename: `invitro_${meio.codigo}_d${String(dia).padStart(2, '0')}.jpg`,
        viableCount: germinadas,
        inviableCount: total - germinadas,
        metadata: metadados({
          researcher: responsavel,
          project: '[DEMO] Germinação in vitro de Cattleya labiata',
          treatment: `${meio.codigo} — ${meio.nome}`,
          plate: `PL${String(iMeio + 1).padStart(2, '0')}`,
          quadrant: `D${dia}`,
          notes: `${AVISO_DEMO} Avaliação no ${dia}º DAP.`,
        }),
        experimentId: idExp,
        treatmentId: `${idExp}-${meio.codigo}`,
        dayIndex: dia,
      });

      return {
        sessionId: idSessao,
        dayIndex: dia,
        evaluationDate: iso(agora, semeadura + dia),
        totalSeeds: total,
        germinatedSeeds: germinadas,
        stageDistribution: distribuirEstagios(rng, germinadas, dia, total - germinadas),
        contamination: contaminada ? 'fungal' : 'none',
        status: contaminada ? 'contaminated' : dia === 90 ? 'completed' : 'active',
        observerName: responsavel,
        notes: contaminada ? 'Contaminação fúngica na borda da placa (simulado).' : undefined,
      };
    });

    return {
      id: `${idExp}-${meio.codigo}`,
      experimentId: idExp,
      name: meio.nome,
      code: meio.codigo,
      description: `Meio ${meio.nome}, 15 g/L sacarose`,
      plates,
    };
  });

  const experimento: Experiment = {
    id: idExp,
    name: '[DEMO] Germinação in vitro de Cattleya labiata',
    species: 'Cattleya labiata',
    genus: 'Cattleya',
    seedLot: 'DEMO-CL-2026-01',
    collectionDate: iso(agora, semeadura - 150).slice(0, 10),
    responsible: responsavel,
    institution: INSTITUICAO,
    cultureMedia: 'half-MS',
    cultureMediaNotes: 'Comparação entre KC, ½MS e MS completo — dados simulados.',
    sterilizationProtocol: 'NaOCl 1%, 15 min + Tween 80',
    preconditioningTreatment: 'Sacarose 10%, 24 h',
    seedsPerPlate: 300,
    replicates: 1,
    sowingDate: iso(agora, semeadura).slice(0, 10),
    evaluationDays: DIAS_DE_AVALIACAO,
    treatments,
    tags: ['demo', 'orquídea', 'in vitro'],
    notes: AVISO_DEMO,
    createdAt: iso(agora, semeadura),
    updatedAt: iso(agora, semeadura + 90),
  };

  return { experimento, sessoes };
}

// ---------------------------------------------------------------------------
// Ensaio 4 — armazenamento de Urochloa (forrageira)
// ---------------------------------------------------------------------------

/** Dias de armazenamento avaliados: trimestral no 1º ano, depois anual. */
const DIAS_DE_ARMAZENAMENTO = [0, 90, 180, 270, 360, 720, 1080];

/**
 * Quatro tratamentos: umidade relativa de equilíbrio × peso da espigueta —
 * o desenho de CUSTÓDIO, ABRANTES & MACHADO NETO (2025).
 *
 * `ki` é a viabilidade inicial em probitos e `sigma` os dias para perder um
 * probito: espigueta pesada parte de mais alto e conserva melhor; 4,5% UR
 * conserva muito melhor que 50% UR.
 */
const TRATAMENTOS_ARMAZENAMENTO = [
  { codigo: 'A45P', nome: '4,5% UR · espigueta pesada', ki: 2.15, sigma: 980, dormencia0: 0.52 },
  { codigo: 'A45L', nome: '4,5% UR · espigueta leve', ki: 1.8, sigma: 760, dormencia0: 0.58 },
  { codigo: 'A50P', nome: '50% UR · espigueta pesada', ki: 2.1, sigma: 430, dormencia0: 0.5 },
  { codigo: 'A50L', nome: '50% UR · espigueta leve', ki: 1.75, sigma: 330, dormencia0: 0.57 },
];

/** Dias para a dormência cair a 1/e do valor inicial (superação no armazenamento). */
const TAU_DORMENCIA = 150;

function gerarEnsaioArmazenamento(
  rng: () => number,
  agora: Date,
  responsavel: string
): { experimento: Experiment; sessoes: Session[] } {
  const idExp = `${PREFIXO_DEMO}exp-armazenamento`;
  const inicio = -1080;
  const sessoes: Session[] = [];

  const treatments: Treatment[] = TRATAMENTOS_ARMAZENAMENTO.map((trat, iTrat) => {
    const plates: PlateRun[] = DIAS_DE_ARMAZENAMENTO.map((dias) => {
      const total = 100;

      // O tetrazólio enxerga a semente dormente como viável; a germinação não.
      // É essa diferença que fecha ao longo do armazenamento, à medida que a
      // dormência é superada — e é ela que justifica fazer os dois testes.
      const viabilidade = viabilidadeNoArmazenamento(dias, trat.ki, trat.sigma);
      const dormencia = trat.dormencia0 * Math.exp(-dias / TAU_DORMENCIA);
      const germinacaoEsperada = viabilidade * (1 - dormencia);

      const pGerm = proporcaoDaRepeticao(rng, Math.max(0.01, germinacaoEsperada), 0.15);
      const germinadas = amostrarBinomial(rng, total, pGerm);

      const pTz = proporcaoDaRepeticao(rng, viabilidade, 0.13);
      // O TZ nunca pode acusar menos vivas do que germinaram: seria leitura
      // impossível, e o painel mostraria uma diferença negativa sem sentido.
      const viaveisTz = Math.max(germinadas, amostrarBinomial(rng, total, pTz));

      const idSessao = `${PREFIXO_DEMO}arm-${trat.codigo}-d${dias}`;
      sessoes.push({
        id: idSessao,
        date: iso(agora, inicio + dias),
        filename: `urochloa_${trat.codigo}_d${String(dias).padStart(4, '0')}.jpg`,
        viableCount: viaveisTz,
        inviableCount: total - viaveisTz,
        metadata: metadados({
          researcher: responsavel,
          project: '[DEMO] Armazenamento de Urochloa brizantha',
          treatment: `${trat.codigo} — ${trat.nome}`,
          plate: `LT${String(iTrat + 1).padStart(2, '0')}`,
          quadrant: `M${Math.round(dias / 30)}`,
          notes: `${AVISO_DEMO} Tetrazólio aos ${Math.round(dias / 30)} meses de armazenamento.`,
        }),
        experimentId: idExp,
        treatmentId: `${idExp}-${trat.codigo}`,
        dayIndex: dias,
      });

      return {
        sessionId: idSessao,
        dayIndex: dias,
        evaluationDate: iso(agora, inicio + dias),
        totalSeeds: total,
        germinatedSeeds: germinadas,
        // Semente de forrageira não forma protocormo. O estágio 1 aqui é
        // "plântula normal" e o 0 é "não germinada" — dormente, dura ou morta,
        // que o app ainda não separa (é a lacuna de classes dinâmicas).
        stageDistribution: { 0: total - germinadas, 1: germinadas },
        contamination: 'none',
        status: dias === DIAS_DE_ARMAZENAMENTO[DIAS_DE_ARMAZENAMENTO.length - 1]
          ? 'completed'
          : 'active',
        observerName: responsavel,
        notes: `Dormência estimada em ${(dormencia * 100).toFixed(0)}% (simulado).`,
      };
    });

    return {
      id: `${idExp}-${trat.codigo}`,
      experimentId: idExp,
      name: trat.nome,
      code: trat.codigo,
      description: 'Espiguetas equilibradas na UR indicada, armazenadas a 20 °C',
      plates,
    };
  });

  const experimento: Experiment = {
    id: idExp,
    name: '[DEMO] Armazenamento de Urochloa brizantha cv. Marandu',
    species: 'Urochloa brizantha',
    genus: 'Urochloa',
    seedLot: 'DEMO-UB-MAR-01',
    collectionDate: iso(agora, inicio - 60).slice(0, 10),
    responsible: responsavel,
    institution: INSTITUICAO,
    cultureMedia: 'other',
    cultureMediaNotes: 'Germinação sobre papel; tetrazólio em paralelo. Dados simulados.',
    preconditioningTreatment: 'Sem escarificação',
    seedsPerPlate: 100,
    replicates: 4,
    sowingDate: iso(agora, inicio).slice(0, 10),
    evaluationDays: DIAS_DE_ARMAZENAMENTO,
    // O eixo é tempo de armazenamento, não dias após plantio: cada data é uma
    // amostra nova do lote, e índice de velocidade de germinação não se aplica.
    timeAxis: 'armazenamento',
    treatments,
    tags: ['demo', 'forrageira', 'armazenamento'],
    notes: `${AVISO_DEMO} O eixo de dias é tempo de ARMAZENAMENTO, não dias após plantio.`,
    createdAt: iso(agora, inicio),
    updatedAt: iso(agora, inicio + 1080),
  };

  return { experimento, sessoes };
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/**
 * Monta o conjunto completo de demonstração.
 *
 * A mesma semente devolve o mesmo conjunto — carregar duas vezes sobrescreve
 * os mesmos ids em vez de duplicar.
 */
export function gerarDadosDeDemonstracao(
  opcoes: OpcoesDeDemonstracao = {}
): ConjuntoDeDemonstracao {
  const rng = criarRng(opcoes.semente ?? 20260903);
  const agora = opcoes.agora ?? new Date();
  const responsavel = opcoes.responsavel?.trim() || RESPONSAVEL_PADRAO;

  const tz = gerarEnsaioTetrazolio(rng, agora, responsavel);
  const osmotico = gerarEnsaioOsmotico(rng, agora, responsavel);
  const inVitro = gerarEnsaioInVitro(rng, agora, responsavel);
  const armazenamento = gerarEnsaioArmazenamento(rng, agora, responsavel);

  return {
    experimentos: [inVitro.experimento, armazenamento.experimento],
    sessoes: [...tz, ...osmotico, ...inVitro.sessoes, ...armazenamento.sessoes],
  };
}

/** Resumo curto do que o conjunto contém, para a interface anunciar antes de gravar. */
export function resumirDemonstracao(conjunto: ConjuntoDeDemonstracao): string {
  const projetos = new Set(conjunto.sessoes.map((s) => s.metadata.project));
  return `${projetos.size} ensaios · ${conjunto.sessoes.length} contagens · ${conjunto.experimentos.length} experimentos longitudinais`;
}
