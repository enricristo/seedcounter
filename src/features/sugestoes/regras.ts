// =============================================================================
// SeedCounter — motor de sugestões contextuais
//
// POR QUE JUNTAR NUM SÓ LUGAR.
//
// O aplicativo já sabe de tudo isto: quantas marcações não têm contorno, se a
// escala bate com a espécie declarada, se a forma de um contorno é suspeita, há
// quanto tempo não se salva. Cada sinal já existe em algum canto do código —
// `conferirEscala`, `conferirForma`, o protocolo de germinação — mas hoje
// nenhum chega à pessoa como sugestão; fica esperando que ela lembre de olhar.
// Este arquivo não inventa sinal novo: reúne o que já existe e decide qual, se
// algum, vale a pena mostrar agora.
//
// POR QUE NO MÁXIMO UMA.
//
// Um cartão que empilha vários avisos vira parte do ruído da tela — o mesmo
// destino de todo aviso que a pessoa aprende a ignorar. Mostrar só a de maior
// prioridade obriga a ordenar o que importa mais. E o que importa mais é o que
// muda o NÚMERO que vai para o laudo (escala errada, forma suspeita, dormência
// sem tetrazólio), não o que só economiza um clique.
//
// PURO DE PROPÓSITO.
//
// Nada aqui toca DOM, localStorage ou React. `EstadoParaSugestao` é um retrato
// montado por quem chama (App.tsx); as regras só leem esse retrato. É o que
// torna cada regra testável em isolamento, em Node, sem simular tela nem
// clique — e é o que permite testar a de escala contra `conferirEscala` de
// verdade, não contra uma cópia da lógica.
// =============================================================================

import { conferirEscala } from '../../lib/normas/tamanhos-de-semente';

/** O retrato do estado atual que as regras leem. Montado por quem chama. */
export interface EstadoParaSugestao {
  temImagem: boolean;
  /** Para dispensa por imagem — null quando não há imagem carregada. */
  chaveDaImagem: string | null;
  totalDeMarcas: number;
  marcasSemContorno: number;
  totalDeContornos: number;
  umPerPixel?: number;
  /** Nome declarado no boletim — o mesmo texto livre que `acharPorNome` lê. */
  especie?: string;
  /** Mediana dos contornos, em pixels — o "objeto típico" desta imagem. */
  comprimentoTipicoEmPixels?: number;
  /** Quantos contornos falharam em `conferirForma`. */
  contornosComFormaSuspeita: number;
  /** null = nunca gravou nesta imagem. */
  minutosDesdeUltimaGravacao: number | null;
  protocoloExigeTetrazolio: boolean;
}

export type AcaoDeSugestao =
  | 'abrir-galeria'
  | 'abrir-calibracao'
  | 'ferramenta-contorno'
  | 'salvar-sessao'
  | 'abrir-identificacao';

export interface Sugestao {
  /** Estável por regra — é a chave que `dispensadas.ts` guarda. */
  id: string;
  /** Maior = mais urgente. */
  prioridade: number;
  titulo: string;
  texto: string;
  acao?: { rotulo: string; id: AcaoDeSugestao };
  /** Dispensa vale só para esta imagem, ou para sempre? */
  escopoDaDispensa: 'imagem' | 'sempre';
}

export type Regra = (e: EstadoParaSugestao) => Sugestao | null;

/**
 * Prioridades — maior primeiro.
 *
 * O critério é o custo do que passa despercebido. Escala e tetrazólio mudam um
 * número que vai para o laudo; forma suspeita é indício forte de contorno
 * errado; o resto é conveniência de fluxo de trabalho.
 */
const PRIORIDADE = {
  escalaSuspeita: 90,
  tetrazolio: 85,
  paresSuspeitos: 70,
  marcasSemContorno: 60,
  salvar: 50,
  semCalibracao: 40,
  identificacao: 30,
} as const;

/**
 * marcas-sem-contorno — a pessoa já disse "aqui tem semente" mas o polígono
 * falta. A onda resolve isso em lote, então o número que importa é "quantas
 * ainda faltam", não "há alguma faltando".
 */
const marcasSemContorno: Regra = (e) => {
  if (!e.temImagem) return null;
  if (e.marcasSemContorno < 5) return null;
  return {
    id: 'marcas-sem-contorno',
    prioridade: PRIORIDADE.marcasSemContorno,
    titulo: 'Marcações sem contorno',
    texto: `${e.marcasSemContorno} marcações ainda sem contorno. A onda pode medir todas de uma vez.`,
    acao: { rotulo: 'Abrir galeria', id: 'abrir-galeria' },
    escopoDaDispensa: 'imagem',
  };
};

/**
 * escala-suspeita — usa `conferirEscala` de verdade, não uma cópia da lógica.
 * Prioridade mais alta do grupo: é o erro que troca milímetro por centímetro e
 * vai para o laudo sem ninguém estranhar, porque a escala "parece" plausível.
 */
const escalaSuspeita: Regra = (e) => {
  if (!e.temImagem) return null;
  const conferencia = conferirEscala(e.comprimentoTipicoEmPixels ?? 0, e.umPerPixel, e.especie);
  if (conferencia.veredicto !== 'suspeita') return null;
  return {
    id: 'escala-suspeita',
    prioridade: PRIORIDADE.escalaSuspeita,
    titulo: 'Escala pode estar errada',
    texto: conferencia.recado,
    acao: { rotulo: 'Abrir calibração', id: 'abrir-calibracao' },
    escopoDaDispensa: 'imagem',
  };
};

/**
 * sem-calibracao — só dispara com contornos suficientes para a falta de
 * escala já ter custo (medir em pixel um punhado de sementes não compensa o
 * aviso). Nunca com `escala-suspeita` ao mesmo tempo: sem `umPerPixel` a
 * conferência de escala não tem o que conferir e devolve 'sem-referencia'.
 */
const semCalibracao: Regra = (e) => {
  if (!e.temImagem) return null;
  if (e.totalDeContornos < 10 || e.umPerPixel) return null;
  return {
    id: 'sem-calibracao',
    prioridade: PRIORIDADE.semCalibracao,
    titulo: 'Sem calibração',
    texto: 'Sem calibração, as medidas saem em pixels. Com a escala, saem em milímetros.',
    acao: { rotulo: 'Abrir calibração', id: 'abrir-calibracao' },
    escopoDaDispensa: 'imagem',
  };
};

/**
 * pares-suspeitos — contornos que `conferirForma` já marcou como fora da
 * faixa da espécie. Dois ou mais é o piso: um só pode ser variedade atípica,
 * mas dois já sugere um padrão sistemático de sementes encostadas.
 */
const paresSuspeitos: Regra = (e) => {
  if (!e.temImagem) return null;
  if (e.contornosComFormaSuspeita < 2) return null;
  return {
    id: 'pares-suspeitos',
    prioridade: PRIORIDADE.paresSuspeitos,
    titulo: 'Contornos com forma suspeita',
    texto:
      `${e.contornosComFormaSuspeita} contornos têm forma incompatível com a espécie — ` +
      'podem ser duas sementes num contorno só. A ferramenta de contorno (C) mostra onde separar.',
    acao: { rotulo: 'Ferramenta de contorno', id: 'ferramenta-contorno' },
    escopoDaDispensa: 'imagem',
  };
};

/**
 * salvar — 20 marcações é trabalho real para perder. `minutosDesdeUltimaGravacao`
 * null (nunca gravou nesta imagem) ou >= 10 min: não incomoda quem acabou de
 * salvar e continuou trabalhando.
 */
const salvar: Regra = (e) => {
  if (!e.temImagem) return null;
  if (e.totalDeMarcas < 20) return null;
  if (!(e.minutosDesdeUltimaGravacao === null || e.minutosDesdeUltimaGravacao >= 10)) return null;
  return {
    id: 'salvar',
    prioridade: PRIORIDADE.salvar,
    titulo: 'Nada salvo ainda',
    texto: `${e.totalDeMarcas} marcações e nada gravado. Ctrl+S guarda a sessão no histórico.`,
    acao: { rotulo: 'Salvar sessão', id: 'salvar-sessao' },
    escopoDaDispensa: 'imagem',
  };
};

/**
 * tetrazolio — informativo, sem ação: o que falta não é um botão do
 * aplicativo, é um teste de bancada. `protocoloExigeTetrazolio` já encapsula o
 * limiar de 5% de dormência (RAS) — esta regra só decide se avisa.
 */
const tetrazolio: Regra = (e) => {
  if (!e.temImagem) return null;
  if (!e.protocoloExigeTetrazolio) return null;
  return {
    id: 'tetrazolio',
    prioridade: PRIORIDADE.tetrazolio,
    titulo: 'Tetrazólio necessário',
    texto:
      'Dormentes acima de 5%: a RAS pede confirmação por tetrazólio, com o método em Observações.',
    escopoDaDispensa: 'imagem',
  };
};

/**
 * identificacao-para-laudo — escopo 'sempre', não 'imagem': declarar a
 * espécie é hábito de bancada, não pendência de uma imagem específica. Sem
 * espécie, nem `conferirEscala` nem `conferirForma` têm o que conferir.
 */
const identificacaoParaLaudo: Regra = (e) => {
  if (!e.temImagem) return null;
  if (e.totalDeMarcas < 50 || e.especie) return null;
  return {
    id: 'identificacao-para-laudo',
    prioridade: PRIORIDADE.identificacao,
    titulo: 'Espécie não declarada',
    texto: 'Declare a espécie na identificação para o aplicativo conferir escala e forma.',
    acao: { rotulo: 'Abrir identificação', id: 'abrir-identificacao' },
    escopoDaDispensa: 'sempre',
  };
};

/** Todas as regras. A ordem aqui não importa — `sugerir` ordena por prioridade. */
export const REGRAS: Regra[] = [
  escalaSuspeita,
  tetrazolio,
  paresSuspeitos,
  marcasSemContorno,
  salvar,
  semCalibracao,
  identificacaoParaLaudo,
];

/**
 * A sugestão a mostrar agora: a de MAIOR prioridade entre as que dispararam e
 * não estão dispensadas. No máximo uma — nunca uma lista.
 */
export function sugerir(e: EstadoParaSugestao, dispensadas: Set<string>): Sugestao | null {
  if (!e.temImagem) return null;

  let melhor: Sugestao | null = null;
  for (const regra of REGRAS) {
    const s = regra(e);
    if (!s) continue;
    if (dispensadas.has(s.id)) continue;
    if (!melhor || s.prioridade > melhor.prioridade) melhor = s;
  }
  return melhor;
}
