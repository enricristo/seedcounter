// =============================================================================
// SeedCounter — "a semente cai": o tic de uma marca
//
// POR QUE ISTO NUNCA TOCA SOZINHO.
//
// Nenhum navegador deixa um AudioContext soar sem gesto explícito da pessoa
// (política de autoplay) — e faz sentido que não deixe: instrumento de
// laboratório não enche a sala de bipe sozinho. Por isso o AudioContext só é
// criado dentro de `tocarMarca`, chamada a partir de um evento real (clicar
// para marcar uma semente); nunca no carregamento do módulo, nunca num
// efeito que roda ao montar um componente. Se o navegador recusar de
// qualquer forma, a falha vira silêncio — nunca um erro no console: o som é
// charme, jamais pode interromper a contagem.
//
// E é OPT-IN, lembrado entre sessões. Por padrão está desligado: quem nunca
// descobriu a sequência que liga o som (ver `sequencia.ts` /
// `useEasterEggs.ts`) nunca ouve nada. Todo acesso ao localStorage é blindado
// com try/catch — modo privado, cota esgotada ou política do navegador
// viram "desligado", não uma exceção.
// =============================================================================

const CHAVE_SOM = 'sc:som';

/** A preferência da pessoa: ligada só se ela ligou explicitamente. */
export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) === '1';
  } catch {
    return false;
  }
}

function salvarPreferencia(ligado: boolean): void {
  try {
    if (ligado) localStorage.setItem(CHAVE_SOM, '1');
    else localStorage.removeItem(CHAVE_SOM);
  } catch {
    // Sem storage não há memória entre sessões, mas a sessão atual segue
    // funcionando — o som só não sobrevive a um F5.
  }
}

export function ligarSom(): void {
  salvarPreferencia(true);
}

export function desligarSom(): void {
  salvarPreferencia(false);
}

// -----------------------------------------------------------------------------
// O AudioContext em si — um só, criado sob demanda.
// -----------------------------------------------------------------------------

interface JanelaComAudioAntigo extends Window {
  webkitAudioContext?: typeof AudioContext;
}

let contexto: AudioContext | null = null;
/** Uma vez recusado (política do navegador, API ausente), não insiste a
 * cada marca — cada clique já teria seu próprio try/catch, mas evitar a
 * tentativa repetida evita reconstruir o motivo da recusa toda hora. */
let contextoFalhou = false;

function obterContexto(): AudioContext | null {
  if (contextoFalhou) return null;
  if (contexto) return contexto;
  try {
    const Construtor = window.AudioContext ?? (window as JanelaComAudioAntigo).webkitAudioContext;
    if (!Construtor) {
      contextoFalhou = true;
      return null;
    }
    contexto = new Construtor();
    return contexto;
  } catch {
    contextoFalhou = true;
    return null;
  }
}

// -----------------------------------------------------------------------------
// O timbre do "tic".
// -----------------------------------------------------------------------------

// Faixa de frequência do tic — a variação aleatória dentro dela é o que
// evita som de metrônomo (cada marca soa um pouco diferente da anterior).
const FREQ_MIN_HZ = 800;
const FREQ_MAX_HZ = 1200;

// Inviável soa meio tom (um semitom) abaixo de viável — a mesma forma de
// onda, só a nota muda; é diferença suficiente para o ouvido separar as
// duas classes sem precisar de dois timbres inteiros.
const RAZAO_SEMITOM_ABAIXO = Math.pow(2, -1 / 12);

// Ganho baixo de propósito: é um tic de confirmação, não uma notificação.
const GANHO = 0.08;
const ATAQUE_S = 0.004;
const DECAIMENTO_S = 0.06;

/**
 * Toca o tic de uma marca — viável e inviável em notas ligeiramente
 * diferentes. Não faz nada (silenciosamente) se o som está desligado, se o
 * navegador recusou o áudio, ou se qualquer coisa falhar no meio do
 * caminho.
 */
export function tocarMarca(tipo: 'viable' | 'inviable'): void {
  if (!somLigado()) return;

  const ctx = obterContexto();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      // resume() é assíncrono; não esperamos por ele — se a nota atual sair
      // baixinha ou atrasada por causa disso, a próxima já vem normal.
      void ctx.resume().catch(() => {});
    }

    const base = FREQ_MIN_HZ + Math.random() * (FREQ_MAX_HZ - FREQ_MIN_HZ);
    const frequencia = tipo === 'inviable' ? base * RAZAO_SEMITOM_ABAIXO : base;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequencia;

    const ganho = ctx.createGain();
    const agora = ctx.currentTime;
    ganho.gain.setValueAtTime(0, agora);
    ganho.gain.linearRampToValueAtTime(GANHO, agora + ATAQUE_S);
    // exponentialRamp não aceita 0 como alvo; 0,0001 é inaudível e evita a
    // exceção.
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + ATAQUE_S + DECAIMENTO_S);

    osc.connect(ganho);
    ganho.connect(ctx.destination);

    osc.start(agora);
    osc.stop(agora + ATAQUE_S + DECAIMENTO_S + 0.02);
  } catch {
    // Silêncio. Um efeito sonoro nunca é motivo para um erro no console.
  }
}
