// =============================================================================
// SeedCounter — que imagem cada automação está lendo
//
// O app tem TRÊS imagens ao mesmo tempo e ninguém dizia qual era qual:
//
//   1. a original, como veio do arquivo;
//   2. a de trabalho — a original com o fundo achatado (`achatar-fundo`),
//      quando alguém achatou;
//   3. a ajustada — a de trabalho com brilho, contraste, gama, canal isolado.
//
// A onda e o Encontrar leem a ajustada de propósito: quem segmenta quer que o
// algoritmo veja o que o olho está vendo. O modelo de IA lê a ORIGINAL, e isso
// não é escolha de interface: ele foi treinado em digitalização crua e degrada
// em imagem alterada (memória do projeto: "removedor de fundo serve à onda e
// ao olho, não ao YOLO").
//
// Saber disso muda a leitura de um resultado ruim — "a detecção piorou" pode
// ser o ajuste, não o algoritmo. Por isso vira um indicador, e por isso existe
// o "forçar original": um experimento de um clique, não uma configuração.
// =============================================================================

export type Automacao = 'onda' | 'encontrar' | 'modelo';

export interface EstadoDaImagem {
  /** Alguém achatou o fundo — a imagem de trabalho difere da original. */
  fundoAchatado: boolean;
  /** Há ajuste que exige reprocessar pixels (canal, gama, deslocamento por cor). */
  ajusteEmPixels: boolean;
  /** Há ajuste aplicado só como filtro de tela (brilho, contraste, saturação, inverter). */
  ajusteEmTela: boolean;
  /** A pessoa pediu que as automações leiam a original, ignorando o resto. */
  forcarOriginal: boolean;
}

export interface FonteDeUmaAutomacao {
  automacao: Automacao;
  rotulo: string;
  fonte: 'original' | 'modificada';
  /** Por que esta e não a outra — a frase que aparece no tooltip. */
  motivo: string;
}

const ROTULOS: Record<Automacao, string> = {
  onda: 'Onda (S)',
  encontrar: 'Encontrar',
  modelo: 'Modelo (IA)',
};

/** O que muda a imagem de trabalho, em texto — vazio quando nada mudou. */
export function modificacoesAtivas(e: EstadoDaImagem): string[] {
  const xs: string[] = [];
  if (e.fundoAchatado) xs.push('fundo achatado');
  if (e.ajusteEmPixels) xs.push('canal/gama/cor');
  if (e.ajusteEmTela) xs.push('brilho/contraste');
  return xs;
}

export function fontesDasAutomacoes(e: EstadoDaImagem): FonteDeUmaAutomacao[] {
  const mods = modificacoesAtivas(e);
  const temMod = mods.length > 0;
  const descricao = mods.join(' + ');

  const paraSegmentacao = (a: Automacao): FonteDeUmaAutomacao => {
    if (e.forcarOriginal) {
      return { automacao: a, rotulo: ROTULOS[a], fonte: 'original', motivo: 'você pediu para ler a original' };
    }
    if (!temMod) {
      return { automacao: a, rotulo: ROTULOS[a], fonte: 'original', motivo: 'a imagem não foi alterada' };
    }
    return { automacao: a, rotulo: ROTULOS[a], fonte: 'modificada', motivo: `lê o que você está vendo (${descricao})` };
  };

  return [
    paraSegmentacao('onda'),
    paraSegmentacao('encontrar'),
    {
      automacao: 'modelo',
      rotulo: ROTULOS.modelo,
      fonte: 'original',
      motivo: 'sempre: foi treinado em digitalização crua e degrada em imagem alterada',
    },
  ];
}

/**
 * Uma palavra para o rodapé: o que a MAIORIA das automações está lendo.
 * O modelo fica de fora da conta — ele nunca muda, e contá-lo faria o
 * indicador dizer "mista" mesmo quando nada foi alterado.
 */
export function resumoDaFonte(e: EstadoDaImagem): { texto: string; alterada: boolean } {
  const mods = modificacoesAtivas(e);
  if (e.forcarOriginal) return { texto: 'original (forçada)', alterada: false };
  if (mods.length === 0) return { texto: 'original', alterada: false };
  return { texto: `modificada · ${mods.join(' + ')}`, alterada: true };
}
