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
 * Desenha uma marca no contexto 2D, com a forma redundante do sistema.
 * Usado tanto pelo canvas ao vivo quanto pela imagem exportada, para que as
 * duas nunca divirjam.
 */
export function desenharMarca(
  ctx: CanvasRenderingContext2D,
  tipo: MarkKind,
  x: number,
  y: number,
  raio: number
) {
  const cor = corDoEspecime(tipo);

  // Halo primeiro: garante contraste sobre lâmina clara.
  ctx.beginPath();
  ctx.arc(x, y, raio + 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = ESPECIME.halo;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);

  if (tipo === 'viable') {
    // Disco preenchido.
    ctx.fillStyle = cor;
    ctx.fill();
  } else {
    // Anel vazado: o espécime aparece por dentro.
    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(2, raio * 0.5);
    ctx.stroke();
  }
}
