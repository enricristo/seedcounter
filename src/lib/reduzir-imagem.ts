// =============================================================================
// Redução de imagem para exibição (Bancadas — Task 4, memória)
// =============================================================================
// Quatro digitalizações de 6800×9359 são ~1 GB de bitmap descomprimido — um
// tablet cai com isso na memória. A bancada INATIVA não precisa da imagem
// cheia: ninguém está medindo nela, só olhando. Estas duas funções são a
// parte PURA da conta (quanto reduzir, e se vale a pena) — a parte que decodifica
// de verdade (canvas, `Image`, blob) mora em `useBancada.ts`, porque toca DOM
// e este módulo, por estar em `src/lib/`, não pode.
// =============================================================================

/**
 * Abaixo deste tamanho, reduzir não compensa: uma imagem de 640px já cabe
 * várias vezes na memória sem problema, e decodificar de novo ao reativar a
 * bancada custaria mais do que o espaço economizado enquanto ficou inativa.
 */
export const LADO_MINIMO_PARA_REDUZIR = 2500;

/**
 * Maior lado da versão reduzida: grande o bastante para preencher a tela de
 * uma bancada inativa (que ninguém vai medir), pequeno o bastante para não
 * pesar quase nada — 2000px é ~1/12 dos pixels de uma digitalização de
 * 6800×9359.
 */
export const LADO_MAXIMO_REDUZIDO = 2000;

/** Só vale a pena gerar uma reduzida acima do piso — ver `LADO_MINIMO_PARA_REDUZIR`. */
export function deveReduzir(largura: number, altura: number): boolean {
  return Math.max(largura, altura) > LADO_MINIMO_PARA_REDUZIR;
}

/**
 * Dimensões da versão reduzida, preservando a proporção. Devolve as
 * dimensões originais sem alteração se já estiverem dentro do teto — quem
 * chama normalmente já filtrou com `deveReduzir`, mas a função fica correta
 * mesmo chamada sozinha.
 */
export function dimensoesReduzidas(
  largura: number,
  altura: number
): { width: number; height: number } {
  const maior = Math.max(largura, altura);
  if (maior <= LADO_MAXIMO_REDUZIDO) return { width: largura, height: altura };
  const fator = LADO_MAXIMO_REDUZIDO / maior;
  return {
    width: Math.max(1, Math.round(largura * fator)),
    height: Math.max(1, Math.round(altura * fator)),
  };
}
