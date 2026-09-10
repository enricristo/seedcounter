// =============================================================================
// SeedCounter — a máscara de anotação
//
// POR QUE ISTO NÃO É UM BOTÃO DE CONVENIÊNCIA.
//
// Com o overlay ligado, a pessoa NÃO CONSEGUE conferir a própria anotação: o
// contorno é justamente o que tapa a evidência que ele deveria descrever. Olhar
// um polígono e decidir se ele está sobre uma semente ou sobre uma sombra é
// impossível quando o polígono cobre os dois casos igual.
//
// Sem alternância, conferir é um ato de fé. É o mesmo argumento que colocou
// imagem original e imagem analisada lado a lado no laudo — aqui é a versão
// interativa da mesma ideia.
//
// TRÊS ESTADOS, E NÃO DOIS.
//
// "Tudo ou nada" não serve, porque o caso de dúvida mais comum não é "o
// contorno existe?" e sim "este contorno pegou UMA semente ou DUAS?". Para
// julgar isso é preciso ver os pontos — que dizem quantas sementes a pessoa
// identificou ali — sobre a imagem crua, sem o polígono por cima.
//
// O estado intermediário é, portanto, o mais útil dos três, e é justamente o
// que um botão de liga-desliga não consegue oferecer.
// =============================================================================

export type Mascara = 'tudo' | 'pontos' | 'nada';

/** A ordem do ciclo. Nada é o último: sai do overlay e volta ao começo. */
export const CICLO: Mascara[] = ['tudo', 'pontos', 'nada'];

export const ESTADO_INICIAL: Mascara = 'tudo';

/** O próximo estado do ciclo. */
export function proxima(atual: Mascara): Mascara {
  const i = CICLO.indexOf(atual);
  return CICLO[(i + 1) % CICLO.length];
}

/** Os pontos de marcação aparecem? */
export function mostraPontos(m: Mascara): boolean {
  return m === 'tudo' || m === 'pontos';
}

/** Os contornos de segmentação aparecem? */
export function mostraContornos(m: Mascara): boolean {
  return m === 'tudo';
}

/** Alguma coisa é desenhada sobre a imagem? */
export function temOverlay(m: Mascara): boolean {
  return m !== 'nada';
}

export interface DescricaoDaMascara {
  rotulo: string;
  /** O que a pessoa vê neste estado, em uma frase. */
  explicacao: string;
}

export const DESCRICOES: Record<Mascara, DescricaoDaMascara> = {
  tudo: {
    rotulo: 'Tudo',
    explicacao: 'Pontos e contornos sobre a imagem.',
  },
  pontos: {
    rotulo: 'Só pontos',
    explicacao: 'Contornos ocultos — dá para ver se o contorno pegou uma semente ou duas.',
  },
  nada: {
    rotulo: 'Imagem limpa',
    explicacao: 'Sem anotação — a evidência crua, para conferir o que está embaixo.',
  },
};

export function descrever(m: Mascara): DescricaoDaMascara {
  return DESCRICOES[m];
}
