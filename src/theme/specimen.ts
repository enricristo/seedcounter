// =============================================================================
// SeedCounter — linguagem do espécime
// Spec: docs/superpowers/specs/2026-09-03-bancada-optica-design.md §3.6
//
// As marcas desenhadas SOBRE a lâmina. Fonte única: o canvas ao vivo, a imagem
// exportada, a barra de ferramentas e os totalizadores leem tudo daqui, para
// que a legenda nunca minta sobre a imagem.
//
// POR QUE CIANO E MAGENTA
// Ciano e magenta praticamente não ocorrem em material biológico. Semente,
// tegumento, ágar e embrião corado por tetrazólio ocupam a faixa âmbar–carmim.
// O código anterior desenhava viável em #ef4444 — ou seja, carmim sobre
// embrião carmim, o pior caso de visibilidade possível numa lâmina corada.
//
// POR QUE A FORMA TAMBÉM MUDA
// Cor sozinha nunca é o único portador de significado. Viável é disco
// preenchido, inviável é anel vazado: a distinção sobrevive ao daltonismo e à
// impressão em escala de cinza, que é como estas imagens acabam num artigo.
//
// Estes valores NÃO mudam com o tema: a fotografia da amostra não tem tema.
// =============================================================================

export const ESPECIME = {
  viable: '#00e5ff',
  inviable: '#ff3dc8',
  /** Ferramenta de medição e régua. */
  tool: '#ffffff',
  /** Halo escuro sob toda marca, para sobreviver a lâmina clara. */
  halo: 'rgba(0, 0, 0, 0.55)',
} as const;

/** Preenchimento translúcido dos polígonos de segmentação. */
export const ESPECIME_FILL = {
  viable: 'rgba(0, 229, 255, 0.22)',
  inviable: 'rgba(255, 61, 200, 0.22)',
  viableHover: 'rgba(0, 229, 255, 0.42)',
  inviableHover: 'rgba(255, 61, 200, 0.42)',
} as const;

export type MarkKind = 'viable' | 'inviable';

export const corDoEspecime = (tipo: MarkKind) =>
  tipo === 'viable' ? ESPECIME.viable : ESPECIME.inviable;

/**
 * O estilo da marca — quanto da semente ela deixa ver.
 *
 * O DEFEITO QUE ORIGINOU ISTO. Numa amostra de orquídea com ~120 sementes
 * amontoadas, o disco preenchido cobria exatamente a semente que deveria
 * apontar: dava para contar as marcas e não dava mais para conferir o que
 * estava embaixo — nem a cor do tetrazólio, que é o critério do teste. Um
 * instrumento de conferência que impede a conferência está errado, por mais
 * legível que a marca seja isolada.
 *
 * A LEI QUE NENHUM ESTILO PODE QUEBRAR. Cor sozinha nunca carrega o
 * significado: em TODOS os estilos, viável e inviável diferem também na FORMA.
 * É o que sobrevive ao daltonismo e à impressão em escala de cinza, que é como
 * estas imagens acabam num artigo. Por isso não existe estilo "só muda a cor" —
 * cada um abaixo declara qual é o par de formas.
 */
export type EstiloDaMarca = 'disco' | 'anel' | 'ponto' | 'cruz';

export const ESTILOS_DA_MARCA: { valor: EstiloDaMarca; rotulo: string; ajuda: string }[] = [
  {
    valor: 'disco',
    rotulo: 'Disco',
    ajuda: 'Viável cheio, inviável vazado. O mais visível de longe; tapa a semente.',
  },
  {
    valor: 'anel',
    rotulo: 'Anel',
    ajuda: 'Os dois vazados — contínuo e tracejado. A semente aparece inteira por dentro.',
  },
  {
    valor: 'ponto',
    rotulo: 'Ponto',
    ajuda: 'Um ponto pequeno no centro. Para amostra densa, onde a marca grande vira mancha.',
  },
  {
    valor: 'cruz',
    rotulo: 'Cruz',
    ajuda: 'Viável "+", inviável "×". Marca o centro sem cobrir quase nada.',
  },
];

/** Opacidade mínima útil: abaixo disso a marca some sobre fundo claro. */
export const OPACIDADE_MINIMA = 0.25;

/**
 * Desenha uma marca no contexto 2D, com a forma redundante do sistema.
 * Usado tanto pelo canvas ao vivo quanto pela imagem exportada, para que as
 * duas nunca divirjam.
 *
 * `estilo` e `opacidade` são opcionais e caem no comportamento antigo quando
 * ausentes — sessão e laudo gerados antes disto continuam idênticos.
 */
export function desenharMarca(
  ctx: CanvasRenderingContext2D,
  tipo: MarkKind,
  x: number,
  y: number,
  raio: number,
  estilo: EstiloDaMarca = 'disco',
  opacidade = 1
) {
  const cor = corDoEspecime(tipo);
  const alfaAnterior = ctx.globalAlpha;
  ctx.globalAlpha = Math.max(OPACIDADE_MINIMA, Math.min(1, opacidade));

  // Halo primeiro: garante contraste sobre lâmina clara. Some no estilo
  // "ponto", onde ele dobraria a área da marca e desfaria o propósito.
  if (estilo !== 'ponto') {
    ctx.beginPath();
    if (estilo === 'cruz') {
      ctx.moveTo(x - raio, y);
      ctx.lineTo(x + raio, y);
      ctx.moveTo(x, y - raio);
      ctx.lineTo(x, y + raio);
    } else {
      ctx.arc(x, y, raio + 1.5, 0, Math.PI * 2);
    }
    ctx.strokeStyle = ESPECIME.halo;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.setLineDash([]);

  if (estilo === 'disco') {
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    if (tipo === 'viable') {
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(2, raio * 0.5);
      ctx.stroke();
    }
  } else if (estilo === 'anel') {
    // Os dois vazados. A forma que distingue passa a ser o TRAÇO: contínuo
    // para viável, tracejado para inviável — a mesma redundância, agora sem
    // nenhum preenchimento sobre o espécime.
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.5, raio * 0.22);
    if (tipo === 'inviable') ctx.setLineDash([raio * 0.9, raio * 0.7]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (estilo === 'ponto') {
    // Viável: ponto cheio. Inviável: anel minúsculo com furo — a distinção
    // sobrevive em preto e branco mesmo neste tamanho.
    const r = Math.max(1.5, raio * 0.34);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (tipo === 'viable') {
      ctx.fill();
    } else {
      ctx.lineWidth = Math.max(1.2, r * 0.8);
      ctx.stroke();
    }
  } else {
    // Cruz: "+" para viável, "×" para inviável. Cobre quase nada e ainda diz
    // exatamente onde está o centro, que é o que a marca precisa dizer.
    const d = raio * 0.72;
    ctx.lineWidth = Math.max(1.5, raio * 0.26);
    ctx.beginPath();
    if (tipo === 'viable') {
      ctx.moveTo(x - d, y);
      ctx.lineTo(x + d, y);
      ctx.moveTo(x, y - d);
      ctx.lineTo(x, y + d);
    } else {
      ctx.moveTo(x - d, y - d);
      ctx.lineTo(x + d, y + d);
      ctx.moveTo(x + d, y - d);
      ctx.lineTo(x - d, y + d);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = alfaAnterior;
}
