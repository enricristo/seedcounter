// =============================================================================
// SeedCounter — região de interesse retangular
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Os dois motores de detecção varriam coisas diferentes. O clássico
// (`detect.ts`) já aceitava um retângulo em `DetectionOptions.roi`; o YOLO
// (`yolo-onnx.ts`) sempre percorria a imagem inteira, sem opção.
//
// Isso não é detalhe de desempenho. Uma digitalização de scanner a 3600 dpi
// gera centenas de janelas de 960 px: varrer tudo leva minutos, e o
// pesquisador esperava por uma resposta sobre um pedaço da lâmina que ele já
// sabia apontar com o mouse. A região transforma o modelo de "o contador" em
// "o sugeridor": a pessoa escolhe ONDE, o modelo propõe O QUÊ, e a curadoria
// continua humana — que é o único uso honesto enquanto a classificação
// viável/inviável do modelo quantizado não estiver validada.
//
// O retângulo usa os mesmos nomes de campo que `DetectionOptions.roi` já
// usava (x, y, width, height). Renomear para português aqui obrigaria a
// converter nas fronteiras, e conversão silenciosa entre dois formatos de
// retângulo é uma fonte clássica de recorte trocado.
// =============================================================================

export interface Regiao {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Uma janela de inferência, em coordenadas absolutas da imagem. */
export interface Janela {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Retângulo a partir dos dois cantos de um arraste.
 *
 * Arrastar da direita para a esquerda, ou de baixo para cima, é tão natural
 * quanto o contrário — sem normalizar, metade dos arrastes produziria largura
 * negativa e um recorte vazio.
 */
export function regiaoDeDoisPontos(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Regiao {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/**
 * Recorta a região aos limites da imagem, em pixels inteiros.
 *
 * Devolve `null` quando não sobra nada — arraste fora da imagem, ou clique
 * sem arrastar. Quem chama precisa tratar isso como "não há região", nunca
 * como "região vazia": pedir inferência num retângulo de área zero devolve
 * silenciosamente nenhuma detecção, e parece que o modelo falhou.
 */
export function limitarRegiao(
  regiao: Regiao,
  larguraDaImagem: number,
  alturaDaImagem: number
): Regiao | null {
  const x = Math.max(0, Math.floor(regiao.x));
  const y = Math.max(0, Math.floor(regiao.y));
  const direita = Math.min(larguraDaImagem, Math.ceil(regiao.x + regiao.width));
  const base = Math.min(alturaDaImagem, Math.ceil(regiao.y + regiao.height));

  const width = direita - x;
  const height = base - y;
  if (width <= 0 || height <= 0) return null;

  return { x, y, width, height };
}

/** Área mínima, em pixels, para um arraste contar como região deliberada. */
export const LADO_MINIMO_DA_REGIAO = 16;

/** Um arraste curto demais é clique com a mão trêmula, não seleção. */
export function regiaoUtilizavel(regiao: Regiao | null): regiao is Regiao {
  return (
    !!regiao &&
    regiao.width >= LADO_MINIMO_DA_REGIAO &&
    regiao.height >= LADO_MINIMO_DA_REGIAO
  );
}

/** Fração da imagem que a região cobre, de 0 a 1. Serve para estimar o custo. */
export function fracaoDaImagem(
  regiao: Regiao,
  larguraDaImagem: number,
  alturaDaImagem: number
): number {
  const total = larguraDaImagem * alturaDaImagem;
  if (total <= 0) return 0;
  return Math.min(1, (regiao.width * regiao.height) / total);
}

/**
 * Divide a região em janelas do tamanho nativo do modelo.
 *
 * Extraído de `detectWithYolo` sem mudar o comportamento: com a região igual à
 * imagem inteira, produz exatamente as mesmas janelas de antes. As coordenadas
 * saem ABSOLUTAS (não relativas à região), porque é assim que `decodeOutput`
 * já devolve as detecções ao espaço da imagem — converter depois seria uma
 * segunda chance de errar o deslocamento.
 *
 * @param lado         tamanho da janela quadrada (o treino usou 960)
 * @param sobreposicao 0 a 0.5 — janelas vizinhas se sobrepõem para que uma
 *                     semente na emenda não seja cortada em duas
 */
export function planejarJanelas(regiao: Regiao, lado: number, sobreposicao: number): Janela[] {
  const passo = Math.max(1, Math.round(lado * (1 - sobreposicao)));
  const janelas: Janela[] = [];

  // Região que já cabe numa janela vira uma janela só, do tamanho dela.
  if (regiao.width <= lado && regiao.height <= lado) {
    janelas.push({ x: regiao.x, y: regiao.y, w: regiao.width, h: regiao.height });
    return janelas;
  }

  const fim = { x: regiao.x + regiao.width, y: regiao.y + regiao.height };
  for (let y = regiao.y; y < fim.y; y += passo) {
    for (let x = regiao.x; x < fim.x; x += passo) {
      const w = Math.min(lado, fim.x - x);
      const h = Math.min(lado, fim.y - y);
      // Faixa fina na borda não tem contexto para o modelo e só custa tempo.
      if (w > 8 && h > 8) janelas.push({ x, y, w, h });
    }
  }
  return janelas;
}

/** Quantas janelas a região exigiria — para avisar o custo ANTES de rodar. */
export function contarJanelas(regiao: Regiao, lado: number, sobreposicao: number): number {
  return planejarJanelas(regiao, lado, sobreposicao).length;
}
