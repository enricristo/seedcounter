// =============================================================================
// SeedCounter — marcar direto na classe do protocolo
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Marcar era binário: viável ou inviável. Para orquídea está certo; para
// forrageira, não — ali uma semente que não germinou pode ser dormente, dura,
// vazia ou morta, e as quatro significam coisas diferentes para quem compra o
// lote. A classe fina já existia (`lib/normas/classes-de-semente.ts`) e só
// podia ser dada DEPOIS, na galeria ou no menu radial: marcava-se inviável e
// corrigia-se em seguida. Este módulo é a tabela que permite marcar já na
// classe certa.
//
// AS REGRAS QUE O DESENHO CARREGA (spec 2026-09-23-classes-dinamicas):
//
//   1. Os botões de classe só existem com PROTOCOLO declarado e diferente de
//      `simples`. Quem usa orquídea nunca os vê. O que o modo esconde também
//      não custa (Lei 8).
//   2. `V` e `I` não mudam de sentido: continuam marcando viável/inviável SEM
//      classe fina. Refinar depois na galeria continua valendo.
//   3. A tecla da classe é a POSIÇÃO dela na lista do protocolo — 1 a 6 —
//      porque a norma publica essa lista em ordem e porque é assim que um
//      analista lê a tabela impressa: "classe 1, classe 2". As teclas 1 e 2
//      eram os modos de exibição até 23/09; eles passaram para `N`, que
//      alterna pontos e índices, porque número na mão de quem conta é classe.
//   4. A categoria (viável/inviável) da marca vem de `germinou`, nunca de uma
//      segunda tabela escrita aqui (Lei 1).
// =============================================================================

import { CLASSES, type ClasseDeSemente, type Protocolo } from '../../lib/normas/classes-de-semente';

/**
 * O ícone de cada classe, por mnemônica — e é o vocabulário de FORMAS que a
 * fatia 3b leva para o canvas, onde ele vira a redundância da Lei 4.
 *
 * losango para `dura` porque diamante é duro; lua para `dormente`, que está
 * viva e dormindo; `×` para morta; círculo cortado para o que nem semente é.
 */
export type IconeDeClasse = 'circulo' | 'triangulo' | 'losango' | 'lua' | 'x' | 'cortado';

const ICONES: Record<ClasseDeSemente, IconeDeClasse> = {
  normal: 'circulo',
  anormal: 'triangulo',
  dura: 'losango',
  dormente: 'lua',
  morta: 'x',
  vazia: 'cortado',
};

/** A primeira tecla das classes: a primeira classe é a tecla 1. */
export const PRIMEIRA_TECLA = 1;

export interface FerramentaDeClasse {
  classe: ClasseDeSemente;
  rotulo: string;
  /** A frase que explica a classe — o aluno precisa dela junto do botão. */
  explicacao: string;
  /** A tecla, como a pessoa a lê: '1', '2'… */
  atalho: string;
  icone: IconeDeClasse;
  /** O que a marca vira: viável quando a classe germinou. */
  categoria: 'viable' | 'inviable';
  /** Entra no denominador? `false` só para material inerte. */
  ehSemente: boolean;
}

/** A categoria binária de uma classe fina. Uma tabela, não duas (Lei 1). */
export function categoriaDaClasse(classe: ClasseDeSemente): 'viable' | 'inviable' {
  return CLASSES[classe].germinou ? 'viable' : 'inviable';
}

/**
 * As ferramentas de classe de um protocolo, na ordem em que ele as declara.
 *
 * Devolve lista VAZIA para `simples` e para protocolo ausente: ali as classes
 * são exatamente viável e inviável, e dois botões a mais diriam a mesma coisa
 * duas vezes.
 */
export function ferramentasDoProtocolo(protocolo: Protocolo | undefined): FerramentaDeClasse[] {
  if (!protocolo || protocolo.chave === 'simples') return [];
  return protocolo.classes.map((classe, i) => ({
    classe,
    rotulo: CLASSES[classe].rotulo,
    explicacao: CLASSES[classe].explicacao,
    atalho: String(PRIMEIRA_TECLA + i),
    icone: ICONES[classe],
    categoria: categoriaDaClasse(classe),
    ehSemente: CLASSES[classe].ehSemente,
  }));
}

/**
 * A classe que uma tecla escolhe, dentro do protocolo — ou `null`.
 *
 * `null` para tecla fora da faixa E para protocolo que não tem aquela posição:
 * apertar 6 num protocolo de cinco classes não pode marcar a última "porque
 * estava perto".
 */
export function classeDaTecla(
  tecla: string,
  protocolo: Protocolo | undefined
): ClasseDeSemente | null {
  const ferramentas = ferramentasDoProtocolo(protocolo);
  return ferramentas.find((f) => f.atalho === tecla)?.classe ?? null;
}

/** Todas as teclas que as classes podem ocupar, para a tabela da ajuda. */
export const TECLAS_DE_CLASSE = Array.from({ length: 6 }, (_, i) => String(PRIMEIRA_TECLA + i));
