// =============================================================================
// SeedCounter — pré-definições por perfil (o módulo puro)
// Spec: docs/superpowers/specs/2026-09-22-predefinicoes-por-perfil-design.md
//
// O QUE UMA PRÉ-DEFINIÇÃO É.
//
// Um conjunto NOMEADO de preferências que já existem no app, escrito de uma
// vez. Escolher "Aluno em treinamento" é o mesmo que abrir cinco painéis e
// marcar opções — modo de visualização, estilo da marca, receita, protocolo,
// cronômetro — só que de uma vez. Por isso este módulo não cria estado
// paralelo nenhum: `aplicarPerfil` grava as MESMAS chaves de localStorage que
// os painéis gravam, e cada consumidor continua lendo a própria chave sem
// saber que um perfil existe. Trocar uma opção depois não "sai do perfil":
// o perfil é ponto de partida, nunca estado.
//
// O QUE ESTE MÓDULO NÃO SABE.
//
// Nada de React, nada de tela. Quem desenha é `TelaDePerfil.tsx`; quem aplica
// o modo na sessão viva é o contexto de visualização (`aplicar`). Aqui só há
// a tabela, o diff e a gravação — o que dá para testar em Node.
//
// POR QUE `oQueMuda` COMPARA COM O QUE ESTÁ GRAVADO, E NÃO COM O PERFIL ANTIGO.
//
// A pessoa pode ter ajustado a opacidade da marca à mão depois de escolher um
// perfil. O perfil novo vai por cima, e isso precisa ser dito — comparar com
// a tabela do perfil antigo esconderia justamente o ajuste manual.
//
// O QUE FICOU DE FORA, E POR QUÊ.
//
// - `sc:som`: opt-in por lei (AGENTS.md, 10). Nenhuma voz pediu som, e um
//   perfil desligá-lo desfaria uma escolha deliberada sem ganho nenhum.
// - DPI de costume: DPI é declaração, não calibração (lei 9); um perfil não
//   pode escrever escala. O 4800 da orquídea já é `DEFAULT_LAB_DPI`.
// - Flags experimentais (`ensaioAoCarregar`): ficam atrás de flag por
//   política de medição; o perfil só DESLIGA o ensaio, nunca liga a flag.
// =============================================================================

import {
  lerPreferenciaTexto,
  gravarPreferenciaTexto,
  CHAVE_SUGESTOES,
} from '../settings/preferencias';
import { CHAVE_MODO, CHAVE_SOBRESCRITAS } from '../visualizacao/useModoDeVisualizacao';
import {
  descricaoDoModo,
  ehModoDeVisualizacao,
  lerSobrescritas,
  serializarSobrescritas,
  ROTULO_DA_PARTE,
  type ModoDeVisualizacao,
  type ParteDaInterface,
  type Visibilidade,
} from '../visualizacao/modo';
import { ESTILOS_DA_MARCA, OPACIDADE_MINIMA, type EstiloDaMarca } from '../../theme/specimen';
import { RECEITAS } from '../ensaio/receitas';
import type { ModoDeAnalise } from '../../lib/cronometro-de-analise';
import type { Metadata } from '../../types';

// -----------------------------------------------------------------------------
// Os perfis
// -----------------------------------------------------------------------------

export type PerfilId = 'analista' | 'orquidea' | 'forrageira' | 'aluno' | 'apresentacao';

/** O que `sc:perfil` pode guardar: um perfil, ou "perguntei e a pessoa fechou". */
export type PerfilGravado = PerfilId | 'nenhum';

/** Onde fica a resposta à pergunta da primeira abertura. */
export const CHAVE_PERFIL = 'sc:perfil';

/** Os cinco, na ordem dos cartões. */
export const PERFIS_IDS: readonly PerfilId[] = [
  'analista',
  'orquidea',
  'forrageira',
  'aluno',
  'apresentacao',
];

export type Protocolo = NonNullable<Metadata['protocolo']>;

/**
 * A receita que o painel Encontrar carrega ao abrir. Só as FIXAS de
 * `RECEITAS` (por id) ou nenhuma: a "pela espécie" e as salvas são
 * derivadas em tempo de execução (precisam de espécie, imagem e calibração)
 * e não cabem numa chave gravada. O teste confere que cada id existe.
 */
export type ReceitaPadrao = 'nenhuma' | 'padrao' | 'sensivel' | 'conservador' | 'ia';

/**
 * Tudo o que um perfil escreve, tipado. A tabela `CHAVES` diz em qual chave
 * de localStorage cada campo mora, e `serializar` diz em que formato — o
 * MESMO que o painel de origem grava, para que ninguém precise saber que
 * o valor veio de um perfil.
 */
export interface Preferencias {
  modo: ModoDeVisualizacao;
  sobrescritas: Partial<Visibilidade>;
  estiloDaMarca: EstiloDaMarca;
  opacidadeDaMarca: number;
  receitaPadrao: ReceitaPadrao;
  protocoloPadrao: Protocolo;
  modoDeAnalisePadrao: ModoDeAnalise;
  sugestoes: boolean;
}

export type CampoDePreferencia = keyof Preferencias;

/** Chaves novas, introduzidas por este módulo. Os consumidores as leem por aqui. */
export const CHAVE_RECEITA_PADRAO = 'sc:receitaPadrao';
export const CHAVE_PROTOCOLO_PADRAO = 'sc:protocoloPadrao';
export const CHAVE_MODO_DE_ANALISE_PADRAO = 'sc:modoDeAnalisePadrao';

/** Chaves que já existiam, gravadas por outros painéis. */
export const CHAVE_ESTILO_DA_MARCA = 'sc:estiloDaMarca';
export const CHAVE_OPACIDADE_DA_MARCA = 'sc:opacidadeDaMarca';

/** Campo → chave de localStorage. */
export const CHAVES: Record<CampoDePreferencia, string> = {
  modo: CHAVE_MODO,
  sobrescritas: CHAVE_SOBRESCRITAS,
  estiloDaMarca: CHAVE_ESTILO_DA_MARCA,
  opacidadeDaMarca: CHAVE_OPACIDADE_DA_MARCA,
  receitaPadrao: CHAVE_RECEITA_PADRAO,
  protocoloPadrao: CHAVE_PROTOCOLO_PADRAO,
  modoDeAnalisePadrao: CHAVE_MODO_DE_ANALISE_PADRAO,
  sugestoes: CHAVE_SUGESTOES,
};

/** Os campos, na ordem em que a tela lista "o que vai mudar". */
export const CAMPOS: readonly CampoDePreferencia[] = [
  'modo',
  'sobrescritas',
  'estiloDaMarca',
  'opacidadeDaMarca',
  'receitaPadrao',
  'protocoloPadrao',
  'modoDeAnalisePadrao',
  'sugestoes',
];

/**
 * O que o app faz quando a chave NÃO está gravada — o mesmo padrão que cada
 * consumidor usa (`App.tsx`, `useCronometro`, `useMetadata`). É contra isto
 * que `oQueMuda` compara numa máquina limpa.
 */
export const PADRAO_SEM_PERFIL: Preferencias = {
  modo: 'completo',
  sobrescritas: {},
  estiloDaMarca: 'disco',
  opacidadeDaMarca: 1,
  receitaPadrao: 'nenhuma',
  protocoloPadrao: 'simples',
  modoDeAnalisePadrao: 'assistida',
  sugestoes: true,
};

export interface Perfil {
  id: PerfilId;
  titulo: string;
  /** A citação da spec, encurtada para caber num cartão. Na voz da pessoa. */
  voz: string;
  /** Três coisas que ficam à vista, para os ícones do cartão. */
  aVista: readonly [string, string, string];
  /**
   * O que o perfil escreve. `null` para "apresentação": ela só é nomeada no
   * cartão e não grava preferência — a mesma regra do link `?modo=apresentacao`,
   * que não gruda na máquina.
   */
  preferencias: Preferencias | null;
}

export const PERFIS: Record<PerfilId, Perfil> = {
  analista: {
    id: 'analista',
    titulo: 'Analista de laboratório comercial',
    voz: 'Quarenta placas por dia. Quero contar, laudar e ir para a próxima — sem morfometria, sem analytics, sem bancada dupla.',
    aVista: ['Laudo', 'Fila', 'Exportar'],
    preferencias: {
      // Laudo, sem o que distrai de um laudo. Morfometria sai; o ensaio ao
      // carregar sai pelo custo — quem faz quarenta placas por dia não pediu
      // três receitas por imagem. Fila e exportação já estão visíveis em laudo.
      modo: 'laudo',
      sobrescritas: { morfometria: false, ensaioAoCarregar: false },
      estiloDaMarca: 'disco',
      opacidadeDaMarca: 1,
      // "A da espécie declarada" é derivada pelo ensaio (`receitaPelaEspecie`),
      // que este perfil desliga. O painel Encontrar parte da fixa "Padrão".
      receitaPadrao: 'padrao',
      protocoloPadrao: 'germinacao',
      modoDeAnalisePadrao: 'assistida',
      // O nome do arquivo é o lote: a sugestão de espécie e continuidade vale.
      sugestoes: true,
    },
  },
  orquidea: {
    id: 'orquidea',
    titulo: 'Pesquisador de orquídea',
    voz: 'Mil sementes encostadas num TIFF de dez páginas. Preciso ver a semente por baixo da marca — e cada número tem que dizer de onde veio.',
    aVista: ['Morfometria', 'Ensaio', 'Procedência'],
    preferencias: {
      modo: 'completo',
      sobrescritas: {},
      // Anel a 60 %: a semente aparece inteira por dentro, e a cor do
      // tetrazólio — que é o critério — continua visível.
      estiloDaMarca: 'anel',
      opacidadeDaMarca: 0.6,
      // Não há receita "orquidea"; a de semente pequena e de cor próxima do
      // fundo é a "Sensível". A de IA fica de fora: `detectObjects` a ignora.
      receitaPadrao: 'sensivel',
      // Orquídea está fora da RAS; o método é o do grupo.
      protocoloPadrao: 'simples',
      // O braço de validação começa pelo tempo manual.
      modoDeAnalisePadrao: 'manual',
      sugestoes: true,
    },
  },
  forrageira: {
    id: 'forrageira',
    titulo: 'Pesquisador de forrageira',
    voz: 'Espigueta cheia ou vazia, dormente ou morta — viável/inviável não me serve. E eu uso o Germinator toda semana.',
    aVista: ['Classes', 'Germinator', 'Armazenamento'],
    preferencias: {
      modo: 'completo',
      sobrescritas: {},
      estiloDaMarca: 'disco',
      opacidadeDaMarca: 1,
      // "Com splitTouching" não existe como receita fixa; a pessoa liga a
      // separação no painel Encontrar, que parte da "Padrão".
      receitaPadrao: 'padrao',
      // Dormente, dura, morta, vazia — e vazia sai do denominador.
      protocoloPadrao: 'forrageira',
      modoDeAnalisePadrao: 'assistida',
      sugestoes: true,
    },
  },
  aluno: {
    id: 'aluno',
    titulo: 'Aluno em treinamento',
    voz: 'Não sei o que é Feret. Quero marcar, contar e ver o número — e que o app me diga o que fazer em seguida.',
    aVista: ['Marcar', 'Contar', 'Cronômetro'],
    preferencias: {
      // Só canvas, marcar e contar. Sem ensaio, sem calibração na frente.
      modo: 'contagem',
      sobrescritas: {},
      estiloDaMarca: 'disco',
      opacidadeDaMarca: 1,
      receitaPadrao: 'nenhuma',
      protocoloPadrao: 'simples',
      // O tempo dele é o dado do treinamento.
      modoDeAnalisePadrao: 'manual',
      // "Que o app me diga o que fazer em seguida" é exatamente o cartão de sugestão.
      sugestoes: true,
    },
  },
  apresentacao: {
    id: 'apresentacao',
    titulo: 'Apresentação',
    voz: 'Vou projetar isto numa sala. Só a imagem e as marcas, sem painel na frente — e sem mudar nada na minha máquina.',
    aVista: ['Projetar', 'Marcas', 'Totais'],
    preferencias: null,
  },
};

export function ehPerfilId(valor: unknown): valor is PerfilId {
  return typeof valor === 'string' && (PERFIS_IDS as readonly string[]).includes(valor);
}

/** As preferências de um perfil, ou `null` para o que não grava (apresentação). */
export function preferenciasDoPerfil(id: PerfilId): Preferencias | null {
  return PERFIS[id].preferencias;
}

// -----------------------------------------------------------------------------
// Serialização: cada campo no formato que o painel de origem já grava
// -----------------------------------------------------------------------------

/** `Preferencias` → o texto de cada chave, exatamente como o consumidor lê. */
export function serializar(p: Preferencias): Record<string, string> {
  return {
    [CHAVES.modo]: p.modo,
    [CHAVES.sobrescritas]: serializarSobrescritas(p.sobrescritas),
    [CHAVES.estiloDaMarca]: p.estiloDaMarca,
    [CHAVES.opacidadeDaMarca]: String(p.opacidadeDaMarca),
    [CHAVES.receitaPadrao]: p.receitaPadrao,
    [CHAVES.protocoloPadrao]: p.protocoloPadrao,
    [CHAVES.modoDeAnalisePadrao]: p.modoDeAnalisePadrao,
    // O formato booleano de `preferencias.ts`: '1' ligado, '0' desligado.
    [CHAVES.sugestoes]: p.sugestoes ? '1' : '0',
  };
}

const ESTILOS = new Set<string>(ESTILOS_DA_MARCA.map((e) => e.valor));
const RECEITAS_PADRAO = new Set<string>(['nenhuma', ...RECEITAS.map((r) => r.id)]);
const PROTOCOLOS = new Set<string>(['simples', 'germinacao', 'forrageira']);
const MODOS_DE_ANALISE = new Set<string>(['manual', 'assistida', 'automatica']);

export function ehReceitaPadrao(v: unknown): v is ReceitaPadrao {
  return typeof v === 'string' && RECEITAS_PADRAO.has(v);
}
export function ehProtocolo(v: unknown): v is Protocolo {
  return typeof v === 'string' && PROTOCOLOS.has(v);
}
export function ehModoDeAnalise(v: unknown): v is ModoDeAnalise {
  return typeof v === 'string' && MODOS_DE_ANALISE.has(v);
}

/**
 * O que está em vigor AGORA: cada chave lida do armazenamento, e o padrão do
 * consumidor quando ela não existe ou está corrompida. Nunca lança.
 */
export function lerPreferenciasAtuais(): Preferencias {
  const modo = lerPreferenciaTexto(CHAVES.modo, '');
  const estilo = lerPreferenciaTexto(CHAVES.estiloDaMarca, '');
  const opacidade = Number(lerPreferenciaTexto(CHAVES.opacidadeDaMarca, ''));
  const receita = lerPreferenciaTexto(CHAVES.receitaPadrao, '');
  const protocolo = lerPreferenciaTexto(CHAVES.protocoloPadrao, '');
  const analise = lerPreferenciaTexto(CHAVES.modoDeAnalisePadrao, '');
  const sugestoes = lerPreferenciaTexto(CHAVES.sugestoes, '');
  return {
    modo: ehModoDeVisualizacao(modo) ? modo : PADRAO_SEM_PERFIL.modo,
    sobrescritas: lerSobrescritas(lerPreferenciaTexto(CHAVES.sobrescritas, '')),
    estiloDaMarca: ESTILOS.has(estilo)
      ? (estilo as EstiloDaMarca)
      : PADRAO_SEM_PERFIL.estiloDaMarca,
    opacidadeDaMarca:
      Number.isFinite(opacidade) && opacidade >= OPACIDADE_MINIMA && opacidade <= 1
        ? opacidade
        : PADRAO_SEM_PERFIL.opacidadeDaMarca,
    receitaPadrao: ehReceitaPadrao(receita) ? receita : PADRAO_SEM_PERFIL.receitaPadrao,
    protocoloPadrao: ehProtocolo(protocolo) ? protocolo : PADRAO_SEM_PERFIL.protocoloPadrao,
    modoDeAnalisePadrao: ehModoDeAnalise(analise) ? analise : PADRAO_SEM_PERFIL.modoDeAnalisePadrao,
    // Ausente = ligado (é o padrão de `sc:sugestoes`); só '0' desliga.
    sugestoes: sugestoes === '' ? PADRAO_SEM_PERFIL.sugestoes : sugestoes === '1',
  };
}

// -----------------------------------------------------------------------------
// Leitura e gravação do perfil
// -----------------------------------------------------------------------------

/**
 * `undefined` = nunca perguntado (é o que dispara a tela da primeira
 * abertura); `'nenhum'` = perguntado e fechado sem escolher.
 */
export function lerPerfilAtual(): PerfilGravado | undefined {
  const bruto = lerPreferenciaTexto(CHAVE_PERFIL, '');
  if (bruto === '') return undefined;
  if (bruto === 'nenhum') return 'nenhum';
  return ehPerfilId(bruto) ? bruto : undefined;
}

/** "Fechei sem escolher": não pergunta de novo, não grava mais nada. */
export function registrarSemPerfil(): void {
  gravarPreferenciaTexto(CHAVE_PERFIL, 'nenhum');
}

/**
 * Grava o perfil: a resposta em `sc:perfil` e, quando o perfil define
 * preferências, cada uma na própria chave — e SÓ essas. Nada é apagado, nada
 * fora da tabela é tocado. Devolve o que foi escrito para quem precisa
 * aplicar na sessão viva (o modo, via contexto; o resto é lido na próxima
 * montagem de cada consumidor).
 */
export function aplicarPerfil(id: PerfilId): Preferencias | null {
  gravarPreferenciaTexto(CHAVE_PERFIL, id);
  const p = preferenciasDoPerfil(id);
  if (!p) return null;
  for (const [chave, valor] of Object.entries(serializar(p))) {
    gravarPreferenciaTexto(chave, valor);
  }
  return p;
}

// -----------------------------------------------------------------------------
// "O que vai mudar antes de mudar"
// -----------------------------------------------------------------------------

export interface Mudanca {
  campo: CampoDePreferencia;
  /** O nome que a pessoa vê no painel de origem. */
  rotulo: string;
  de: string;
  para: string;
}

export const ROTULO_DO_CAMPO: Record<CampoDePreferencia, string> = {
  modo: 'Modo de visualização',
  sobrescritas: 'Partes ligadas e desligadas',
  estiloDaMarca: 'Estilo da marca',
  opacidadeDaMarca: 'Opacidade da marca',
  receitaPadrao: 'Receita ao abrir o painel Encontrar',
  protocoloPadrao: 'Protocolo das amostras novas',
  modoDeAnalisePadrao: 'Modo do cronômetro',
  sugestoes: 'Sugestões contextuais',
};

const ROTULO_DA_RECEITA: Record<ReceitaPadrao, string> = {
  nenhuma: 'nenhuma',
  padrao: 'Padrão',
  sensivel: 'Sensível',
  conservador: 'Conservador',
  ia: 'IA (YOLO)',
};

const ROTULO_DO_PROTOCOLO: Record<Protocolo, string> = {
  simples: 'Simples',
  germinacao: 'Germinação (RAS, cap. 4)',
  forrageira: 'Forrageira',
};

const ROTULO_DA_ANALISE: Record<ModoDeAnalise, string> = {
  manual: 'manual',
  assistida: 'assistida',
  automatica: 'automática',
};

function descreverSobrescritas(s: Partial<Visibilidade>): string {
  const partes = (Object.keys(s) as ParteDaInterface[]).filter((p) => p in ROTULO_DA_PARTE);
  if (partes.length === 0) return 'as do modo';
  return partes.map((p) => `${ROTULO_DA_PARTE[p]} ${s[p] ? 'ligado' : 'desligado'}`).join(', ');
}

/** O valor de um campo como a pessoa o lê no painel de origem. */
export function descreverValor(campo: CampoDePreferencia, p: Preferencias): string {
  switch (campo) {
    case 'modo':
      return descricaoDoModo(p.modo).rotulo;
    case 'sobrescritas':
      return descreverSobrescritas(p.sobrescritas);
    case 'estiloDaMarca':
      return ESTILOS_DA_MARCA.find((e) => e.valor === p.estiloDaMarca)?.rotulo ?? p.estiloDaMarca;
    case 'opacidadeDaMarca':
      return `${Math.round(p.opacidadeDaMarca * 100)} %`;
    case 'receitaPadrao':
      return ROTULO_DA_RECEITA[p.receitaPadrao];
    case 'protocoloPadrao':
      return ROTULO_DO_PROTOCOLO[p.protocoloPadrao];
    case 'modoDeAnalisePadrao':
      return ROTULO_DA_ANALISE[p.modoDeAnalisePadrao];
    case 'sugestoes':
      return p.sugestoes ? 'ligadas' : 'desligadas';
  }
}

function iguais(campo: CampoDePreferencia, a: Preferencias, b: Preferencias): boolean {
  if (campo === 'sobrescritas') {
    return serializarSobrescritas(a.sobrescritas) === serializarSobrescritas(b.sobrescritas);
  }
  return a[campo] === b[campo];
}

/**
 * Só o que difere entre o que está em vigor (`atuais`, normalmente
 * `lerPreferenciasAtuais()`) e o que o perfil `novo` vai escrever. Perfil
 * que não grava (apresentação) não muda nada, por definição.
 */
export function oQueMuda(atuais: Preferencias, novo: PerfilId): Mudanca[] {
  const p = preferenciasDoPerfil(novo);
  if (!p) return [];
  const mudancas: Mudanca[] = [];
  for (const campo of CAMPOS) {
    if (iguais(campo, atuais, p)) continue;
    mudancas.push({
      campo,
      rotulo: ROTULO_DO_CAMPO[campo],
      de: descreverValor(campo, atuais),
      para: descreverValor(campo, p),
    });
  }
  return mudancas;
}

/**
 * O perfil que explica o modo atual, para o menu "Exibir" ("Contagem ·
 * perfil Aluno"). Só quando o modo em vigor É o do perfil: se a pessoa
 * trocou o modo à mão depois, a origem já não é o perfil, e dizer que é
 * seria mentir. Apresentação vale quando o modo em vigor é apresentação.
 */
export function perfilDeOrigemDoModo(modo: ModoDeVisualizacao): Perfil | null {
  const gravado = lerPerfilAtual();
  if (!gravado || gravado === 'nenhum') return null;
  const perfil = PERFIS[gravado];
  const modoDoPerfil =
    perfil.preferencias?.modo ?? (gravado === 'apresentacao' ? 'apresentacao' : null);
  return modoDoPerfil === modo ? perfil : null;
}
