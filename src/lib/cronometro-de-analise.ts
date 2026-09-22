// =============================================================================
// SeedCounter — quanto tempo esta análise custou
//
// POR QUE ESTE MÓDULO EXISTE.
//
// "Quanto tempo leva?" é a pergunta que decide se um laboratório adota uma
// ferramenta, e é a que ninguém responde com número. O manual de tetrazólio do
// grupo diz que um analista experiente rende quatro a cinco amostras por hora;
// nenhum software de análise de imagem publica o número equivalente, porque
// nenhum mede.
//
// Medir isto transforma "é mais rápido" — opinião — em "levou 11 min contra
// 47 min, na mesma imagem, pela mesma pessoa" — resultado. É o dado que
// sustenta uma seção de metodologia, e é, pela pesquisa de mercado deste
// projeto, o número de divulgação mais honesto que a ferramenta pode ter.
//
// A REGRA QUE FAZ O NÚMERO VALER: TEMPO ATIVO, NÃO TEMPO DE PAREDE.
//
// Uma aba aberta a noite inteira não são catorze horas de análise. Um
// cronômetro que conta tempo de parede produz números grandes, impressionantes
// e falsos — e um número falso a favor da nossa ferramenta é pior que nenhum,
// porque a primeira pessoa que conferir joga fora o resto do trabalho junto.
//
// Então: o relógio só corre quando a janela está VISÍVEL e houve interação nos
// últimos `OCIOSO_APOS_MS`. Almoço, reunião e telefonema saem da conta
// sozinhos. Guardamos os dois tempos — o ativo e o de parede — porque a razão
// entre eles também informa: uma análise com muito tempo de parede e pouco
// ativo é uma análise que foi interrompida, e isso explica um resultado
// estranho melhor que qualquer outra coisa.
//
// O MODO PRECISA SER DECLARADO, E NÃO DÁ PARA ADIVINHAR.
//
// O mesmo minuto vale coisas diferentes se a pessoa marcou tudo à mão ou
// conferiu o que o modelo propôs. Quem compara os dois braços de uma validação
// precisa saber qual foi qual, e o aplicativo não tem como inferir sem errar:
// alguém pode rodar o modelo e refazer tudo por cima. Por isso `modo` é
// declarado por quem analisa, e viaja junto do tempo.
// =============================================================================

/** Como a contagem foi feita. Declarado por quem analisa, nunca inferido. */
export type ModoDeAnalise = 'manual' | 'assistida' | 'automatica';

/** Sem interação por este tempo, o relógio para. */
export const OCIOSO_APOS_MS = 60_000;

export interface EstadoDoCronometro {
  /** Milissegundos de trabalho efetivo acumulado. */
  ativoMs: number;
  /** Instante em que o trecho atual começou a contar. `null` = parado. */
  correndoDesde: number | null;
  /** Instante da última interação — é o que adia o ocioso. */
  ultimaInteracao: number | null;
  /** Primeiro instante de todos, para o tempo de parede. */
  inicio: number | null;
  /** Último instante conhecido, para o tempo de parede. */
  fim: number | null;
  modo: ModoDeAnalise;
}

export interface TempoDaAnalise {
  ativoMs: number;
  paredeMs: number;
  modo: ModoDeAnalise;
  /** Quanto do tempo de parede foi trabalho, de 0 a 1. `null` sem parede. */
  aproveitamento: number | null;
}

export function iniciarCronometro(modo: ModoDeAnalise = 'assistida'): EstadoDoCronometro {
  return { ativoMs: 0, correndoDesde: null, ultimaInteracao: null, inicio: null, fim: null, modo };
}

/**
 * Fecha o trecho em curso, somando o que ele durou.
 *
 * O trecho nunca vale mais que `OCIOSO_APOS_MS` além da última interação: se a
 * pessoa parou de mexer às 10h00 e a aba só perdeu o foco às 11h30, valeram um
 * minuto, não noventa. É aqui que a honestidade do número é imposta, e não na
 * boa vontade de quem usa.
 */
function fecharTrecho(e: EstadoDoCronometro, agora: number): EstadoDoCronometro {
  if (e.correndoDesde === null) return { ...e, fim: agora > (e.fim ?? 0) ? agora : e.fim };
  const limite = e.ultimaInteracao !== null ? e.ultimaInteracao + OCIOSO_APOS_MS : agora;
  const ate = Math.min(agora, limite);
  const duracao = Math.max(0, ate - e.correndoDesde);
  return {
    ...e,
    ativoMs: e.ativoMs + duracao,
    correndoDesde: null,
    fim: agora > (e.fim ?? 0) ? agora : e.fim,
  };
}

/**
 * A pessoa fez alguma coisa: marcou, clicou, arrastou, digitou.
 *
 * Também é o que RELIGA o relógio depois de um período ocioso — sem isso, um
 * café de dez minutos encerraria a medição da amostra inteira.
 */
export function registrarInteracao(e: EstadoDoCronometro, agora: number): EstadoDoCronometro {
  const ociosoDemais =
    e.ultimaInteracao !== null && agora - e.ultimaInteracao > OCIOSO_APOS_MS;

  // Estava correndo e ficou ocioso no meio: fecha o trecho (que será aparado
  // no limite do ocioso) e abre um novo a partir de agora.
  const base = e.correndoDesde !== null && ociosoDemais ? fecharTrecho(e, agora) : e;

  return {
    ...base,
    correndoDesde: base.correndoDesde ?? agora,
    ultimaInteracao: agora,
    inicio: base.inicio ?? agora,
    fim: agora > (base.fim ?? 0) ? agora : base.fim,
  };
}

/** A janela sumiu (outra aba, minimizou) ou a análise acabou. */
export function pausar(e: EstadoDoCronometro, agora: number): EstadoDoCronometro {
  return fecharTrecho(e, agora);
}

/**
 * A janela voltou.
 *
 * NÃO religa o relógio sozinho: voltar para a aba não é analisar. O relógio
 * volta a correr na primeira interação de verdade — que é a diferença entre
 * medir trabalho e medir presença.
 */
export function retomar(e: EstadoDoCronometro, agora: number): EstadoDoCronometro {
  return { ...e, fim: agora > (e.fim ?? 0) ? agora : e.fim };
}

export function declararModo(e: EstadoDoCronometro, modo: ModoDeAnalise): EstadoDoCronometro {
  return { ...e, modo };
}

/** O resultado, fechando qualquer trecho aberto sem alterar o estado original. */
export function lerTempo(e: EstadoDoCronometro, agora: number): TempoDaAnalise {
  const f = fecharTrecho(e, agora);
  const paredeMs = f.inicio !== null && f.fim !== null ? Math.max(0, f.fim - f.inicio) : 0;
  return {
    ativoMs: f.ativoMs,
    paredeMs,
    modo: f.modo,
    aproveitamento: paredeMs > 0 ? Math.min(1, f.ativoMs / paredeMs) : null,
  };
}

/**
 * Tempo em `h:mm:ss` ou `m:ss`, para caber no rodapé sem pular de largura.
 */
export function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dd = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dd(m)}:${dd(s)}` : `${m}:${dd(s)}`;
}

/**
 * Segundos por objeto — o número que se compara entre braços de uma validação.
 *
 * Tempo total não compara: uma imagem com 900 sementes demora mais que uma com
 * 120 e isso não diz nada sobre o método. `null` sem objeto, porque dividir
 * por zero aqui produziria "Infinity segundos por semente", que é pior que não
 * responder.
 */
export function segundosPorObjeto(ativoMs: number, objetos: number): number | null {
  if (!Number.isFinite(objetos) || objetos <= 0) return null;
  return ativoMs / 1000 / objetos;
}
