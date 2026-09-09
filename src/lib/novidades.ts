// =============================================================================
// SeedCounter — notas de versão
//
// O QUE MUDOU, EM LINGUAGEM DE QUEM USA.
//
// Não é o log do git. O log responde "o que foi commitado"; isto responde "o
// que mudou para mim". Um item só entra aqui se alguém que usa o aplicativo
// notaria a diferença — refatoração, teste e ajuste interno ficam de fora.
//
// POR QUE UM ARQUIVO, E NÃO UMA CHAMADA DE REDE.
//
// O aplicativo funciona sem internet, e é isso que permite usá-lo numa bancada
// sem rede. Buscar as novidades de um servidor faria a tela de novidades ser a
// única parte que não funciona offline — o pior lugar possível para uma
// dependência de rede.
//
// A REGRA DE QUANDO APARECER.
//
// Só quando a versão MUDOU desde a última vez. Na primeira visita não aparece:
// quem abre o aplicativo pela primeira vez quer contar sementes, não ler o
// histórico de um programa que ainda não usou. Para esse caso existe o número
// da versão no rodapé, que abre esta mesma tela quando alguém quiser.
// =============================================================================

export type TipoDeMudanca = 'novo' | 'melhorado' | 'corrigido';

export interface Mudanca {
  tipo: TipoDeMudanca;
  titulo: string;
  /** O detalhe que importa. Vazio quando o título já diz tudo. */
  detalhe?: string;
}

export interface Versao {
  /** Sem o "v": '3.2.0'. */
  numero: string;
  /** Data de publicação, em ISO. */
  data: string;
  /** Um nome curto para a leva, quando ela tem um tema. */
  titulo?: string;
  mudancas: Mudanca[];
}

export const ROTULOS: Record<TipoDeMudanca, string> = {
  novo: 'Novo',
  melhorado: 'Melhor',
  corrigido: 'Corrigido',
};

/**
 * O histórico, do mais recente para o mais antigo.
 *
 * Entrada nova vai SEMPRE no topo.
 */
export const VERSOES: Versao[] = [
  {
    numero: '3.2.0',
    data: '2026-09-09',
    titulo: 'Curadoria, escala e laudo',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Galeria de objetos (tecla G)',
        detalhe:
          'Vê todos os objetos recortados lado a lado, com ou sem fundo. Marcações sem contorno aparecem como região a segmentar — a lista de pendências e a de resultados são a mesma lista.',
      },
      {
        tipo: 'novo',
        titulo: 'Máscara de anotação (tecla M)',
        detalhe:
          'Alterna entre tudo, só pontos e imagem limpa. O estado do meio é o que responde "este contorno pegou uma semente ou duas?".',
      },
      {
        tipo: 'novo',
        titulo: 'Laudo profissional, com a imagem original ao lado da analisada',
        detalhe:
          'O documento declara o que é: com a identificação completa sai Boletim de Análise de Sementes; sem ela sai Relatório de Contagem, com a ressalva impressa e a lista do que falta.',
      },
      {
        tipo: 'novo',
        titulo: 'Identificação para laudo (BAS/BASO)',
        detalhe:
          'Campos de laboratório e de amostra que a IN 40/2010 exige, com conferência do que ainda está em branco.',
      },
      {
        tipo: 'novo',
        titulo: 'Régua com as duas escalas',
        detalhe: 'Milímetro e pixel ao mesmo tempo, como régua de desenho técnico.',
      },
      {
        tipo: 'novo',
        titulo: 'Conferência da calibração por espécie',
        detalhe:
          'Se a escala informada implica uma soja de 0,6 mm, o aplicativo avisa antes do laudo sair. Pega o erro de trocar centímetro por milímetro, que passa despercebido na checagem antiga.',
      },
      {
        tipo: 'corrigido',
        titulo: 'A marca sumia nas digitalizações grandes',
        detalhe:
          'O ponto tinha tamanho fixo, então num scan de 2400 px virava 1,5 pixel de tela. Agora acompanha a imagem, com ajuste manual na barra.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Atalhos disparavam duas vezes',
        detalhe:
          'Ctrl+Z desfazia duas marcações, Ctrl+S gravava duas sessões e a tecla D não trocava o tema porque trocava duas vezes.',
      },
      {
        tipo: 'corrigido',
        titulo: 'O laudo usava cores que a tela já tinha abandonado',
        detalhe:
          'O PDF desenhava viável em vermelho sobre embrião vermelho. Agora lê a mesma linguagem visual do canvas.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Comprimento e largura no contorno da onda',
        detalhe: 'Medidos pelos eixos principais (PCA), não pela caixa alinhada à imagem.',
      },
      { tipo: 'melhorado', titulo: 'Tela de abertura com a identidade dos grupos' },
    ],
  },
];

/** A versão mais recente registrada. */
export function versaoAtual(): Versao | undefined {
  return VERSOES[0];
}

/** Todas as versões publicadas depois da que a pessoa já viu. */
export function novidadesDesde(vista: string | null | undefined): Versao[] {
  if (!vista) return [];
  return VERSOES.filter((v) => compararVersoes(v.numero, vista) > 0);
}

/**
 * Compara duas versões semânticas.
 *
 * Positivo quando `a` é mais nova. Comparar como texto daria '3.10.0' < '3.9.0',
 * que é o erro clássico e só aparece na décima publicação.
 */
export function compararVersoes(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

const CHAVE = 'sc:versaoVista';

/** Qual versão a pessoa já viu, ou `null` na primeira visita. */
export function versaoVista(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    // Navegador com armazenamento bloqueado: sem novidades, com aplicativo.
    return null;
  }
}

export function marcarVersaoComoVista(numero: string): void {
  try {
    localStorage.setItem(CHAVE, numero);
  } catch {
    // Ignorado de propósito: não poder lembrar não pode impedir de usar.
  }
}

/**
 * Deve abrir a tela de novidades agora?
 *
 * Na primeira visita, não: registra a versão em silêncio e deixa a pessoa
 * trabalhar. É o comportamento que todo aplicativo bem-educado tem, e o
 * contrário — despejar o histórico em quem nunca usou — é ruído.
 */
export function decidirAbertura(
  numeroAtual: string,
  vista: string | null
): { abrir: boolean; versoes: Versao[] } {
  if (!vista) return { abrir: false, versoes: [] };
  const versoes = novidadesDesde(vista).filter(
    (v) => compararVersoes(v.numero, numeroAtual) <= 0
  );
  return { abrir: versoes.length > 0, versoes };
}
