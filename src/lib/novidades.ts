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
    numero: '3.3.0',
    data: '2026-09-10',
    titulo: 'Desfazer de verdade, e o contorno na mão',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Desfazer e refazer para tudo (Ctrl+Z · Ctrl+Shift+Z)',
        detalhe:
          'Antes o Ctrl+Z só tirava a última marcação — um contorno apagado por engano não voltava. Agora cada gesto é um passo: marcação, contorno, arraste, corte, lote. O que caiu junto volta junto: apagar uma marcação leva o contorno dela, e um Ctrl+Z devolve os dois. Refazer com Ctrl+Shift+Z ou Ctrl+Y, ou pelos botões no cabeçalho.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Ajustar contorno (C): alças que se pegam',
        detalhe:
          'Puxar um vértice leva os vizinhos junto, com decaimento — corrige uma barriga do contorno num gesto, em vez de um espinho por vértice (Shift move só o vértice). As alças têm o mesmo tamanho em qualquer zoom e o arraste não escapa quando o cursor sai da alça. Clicar na borda cria um vértice ali e já sai arrastando; duplo clique ou Ctrl+clique numa alça remove. A alça acende antes do clique para dizer o que ele vai fazer.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Raspar a borda só funcionava começando em cima de uma marcação',
        detalhe:
          'A camada que ouvia o mouse não estava ligada na ferramenta de contorno. Agora o traço começa em qualquer ponto do contorno selecionado.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Ctrl+Z num campo de texto desfazia uma marcação',
        detalhe: 'Dentro das Observações, Ctrl+Z desfaz o texto, como em qualquer editor.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Instruções de uso completas',
        detalhe:
          'A ajuda da barra lateral passou a listar todas as ferramentas — onda, ajuste, desenho, máscara, galeria — com os gestos de cada uma. Um teste confere que nenhum atalho fica de fora.',
      },
      {
        tipo: 'novo',
        titulo: 'Classificar cada semente por subclasse, direto na galeria',
        detalhe:
          'Normal, anormal, dura, dormente, morta ou vazia — um seletor em cada célula, sem mexer no que já conta como viável/inviável na imagem. O rodapé da galeria consolida a germinação na hora e avisa quantas sementes ainda faltam classificar; o laudo ganha um bloco "Teste de germinação" com a contagem e a porcentagem por classe.',
      },
      {
        tipo: 'novo',
        titulo: 'Uso anônimo do aplicativo passou a ser medido',
        detalhe:
          'Estatística de acesso (Google Analytics), para saber quais partes do aplicativo são realmente usadas. Imagem, sessão e laudo continuam só na sua máquina — isso não muda.',
      },
    ],
  },
  {
    numero: '3.2.0',
    data: '2026-09-09',
    titulo: 'Curadoria, escala e laudo',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Classes de germinação, com o denominador certo',
        detalhe:
          'Escolha o protocolo (germinação ou forrageira) na barra lateral e classifique cada semente na galeria: normal, anormal, dura, dormente, morta, vazia. Espigueta vazia sai do denominador — é a regra da RAS, e muda o número. Dormência a partir de 5% pede tetrazólio, e o laudo já leva isso para Observações.',
      },
      {
        tipo: 'novo',
        titulo: 'Desenhar contorno à mão (tecla P)',
        detalhe:
          'Para quando a onda falha de vez. Clique coloca vértice, duplo clique ou clicar no primeiro vértice fecha, Esc cancela. Se desenhar em volta de uma marcação sem contorno, o polígono é dela; senão, cria a marcação no centro.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Cada contorno sabe de qual marcação é',
        detalhe:
          'O vínculo entre ponto e polígono passou a ser explícito. Separar um contorno em dois agora cria a segunda marcação — antes a contagem ficava um a menos. Apagar uma marcação apaga o contorno dela.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Barra de ferramentas em grupos',
        detalhe: 'Classe · instrumento · navegação · visão, separados por um fio.',
      },
      {
        tipo: 'novo',
        titulo: 'Conta opcional, que lembra a sua bancada',
        detalhe:
          'Entrar com Google guarda espécie, escala e nome entre máquinas. Nada além disso sobe: sessão, imagem e laudo continuam só na sua máquina. Sem conta configurada, o botão nem aparece.',
      },
      {
        tipo: 'novo',
        titulo: 'Contornar tudo que já foi marcado',
        detalhe:
          'Na galeria, um botão roda a onda a partir de cada marcação que ainda não tem contorno. Você já disse onde está a semente; a onda só mede a borda. A contagem NÃO muda — só contornos são acrescentados, e o que sai duvidoso fica de fora.',
      },
      {
        tipo: 'novo',
        titulo: 'Alvo de calibração por espécie',
        detalhe:
          'O painel de calibração mostra quanto a semente daquela espécie deveria medir, quantos pixels tem um objeto típico da imagem, e quanto isso dá na escala informada. Com um botão para partir da escala que a espécie sugere.',
      },
      {
        tipo: 'novo',
        titulo: 'Separar sementes encostadas',
        detalhe:
          'Com a ferramenta de contorno, ao selecionar um contorno que tem cintura o aplicativo mostra uma linha tracejada onde separaria — e espera você decidir. O limiar se ajusta à espécie: semente alongada precisa de cintura mais funda para valer corte.',
      },
      {
        tipo: 'novo',
        titulo: 'Achatar o fundo do scanner',
        detalhe:
          'Modela o gradiente de iluminação e o remove, em três modos: nivelar, realçar ou isolar. A segmentação por clique passa a parar na borda certa. A detecção automática e o laudo continuam recebendo a imagem original.',
      },
      {
        tipo: 'novo',
        titulo: 'Ajustar contorno (tecla C)',
        detalhe:
          'Clique num contorno para selecioná-lo: os pontos viram alças que se arrastam, e duplo clique remove um. Arrastar sobre a imagem raspa a borda — e ela não vai para onde o cursor passou, vai para a borda de verdade mais próxima. Com Shift, o traço acrescenta em vez de remover.',
      },
      {
        tipo: 'novo',
        titulo: 'Conferência de forma, sem precisar de calibração',
        detalhe:
          'A razão comprimento/largura do contorno é comparada com a da espécie. Medida em 1200 sementes de soja, ela pega o contorno que engoliu a vizinha sem saber quantos µm tem o pixel.',
      },
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
      {
        tipo: 'melhorado',
        titulo: 'O rodapé diz o que está em curso',
        detalhe:
          'Abrindo imagem, detectando, modelando o fundo, contornando em lote, gerando o laudo — tudo se anuncia no rodapé, com progresso quando há como saber. Tela parada sem sinal era indistinguível de tela travada.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Espécie direto no painel de calibração',
        detalhe:
          'Não precisa mais ligar o modo laudo. Escolher a espécie mostra o alvo de tamanho e ajusta o corte de sementes encostadas à forma dela.',
      },
    ],
  },
  {
    numero: '3.1.0',
    data: '2026-09-08',
    titulo: 'Medidas em milímetro, e a segmentação por clique',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Segmentação por clique (a "onda")',
        detalhe:
          'Tecla S: clique numa semente e o contorno cresce sozinho até a borda, sem precisar de modelo nem de espécie treinados. A marcação sempre conta, mesmo quando a onda não encontra uma borda confiável — nesse caso o aviso pede para clicar mais para dentro da semente. Corrigido no caminho: doze cliques estavam sendo contados como vinte e quatro sementes, porque a marcação e o contorno do mesmo clique somavam em dobro.',
      },
      {
        tipo: 'novo',
        titulo: 'Medidas em milímetro, e cor por objeto',
        detalhe:
          'Comprimento, largura e área agora saem em mm além de pixel, na tela e na exportação. Corrigido junto: o casamento entre marcação e contorno falhava em imagens de resolução alta ("não está encontrando nada") — a tolerância passa a acompanhar o tamanho do objeto, em vez de um raio fixo em pixels.',
      },
      {
        tipo: 'novo',
        titulo: 'Comparação longitudinal com eixo de tempo configurável',
        detalhe:
          'Dias após plantio (germinação) ou dias de armazenamento (forrageira) — cada um mostra só os índices que fazem sentido para ele, em vez de calcular velocidade de germinação sobre uma curva de deterioração.',
      },
      {
        tipo: 'novo',
        titulo: 'Cenas de exemplo e ensaios simulados',
        detalhe:
          'Para experimentar contagem, medida e estatística sem ter uma imagem própria à mão. Sempre identificados como demonstração — nunca entram como sessão real.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Região desenhada com o mouse restringe os dois motores de detecção',
        detalhe:
          'Antes só o detector clássico aceitava a região; a IA sempre varria a imagem inteira. Agora os dois respeitam o retângulo, e o painel mostra quantas janelas vai rodar antes de começar.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Tela branca ao abrir o aplicativo em produção',
      },
      {
        tipo: 'corrigido',
        titulo: 'Comparação de médias quebrava com poucas repetições',
        detalhe:
          'Um ensaio com 3 ou 4 repetições era declarado "não normal" por um erro de cálculo, e escolher Tukey travava a análise inteira.',
      },
    ],
  },
  {
    numero: '3.0.0',
    data: '2026-09-03',
    titulo: 'Identidade visual Bancada Óptica, e três perdas de dados corrigidas',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Novo visual: Bancada Óptica',
        detalhe:
          'Tipografia própria (Archivo e IBM Plex Mono) e uma paleta de cores consistente em todo o aplicativo — cabeçalho, rodapé, ferramentas, zoom e exportação redesenhados.',
      },
      {
        tipo: 'corrigido',
        titulo: 'O botão de tema (sol/lua) não tinha efeito nenhum na tela',
      },
      {
        tipo: 'corrigido',
        titulo: 'Tema claro ficou difícil de ler depois do novo visual',
        detalhe: 'Contraste de texto pequeno ajustado para o mínimo legível.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Ícone do aplicativo instalado (PWA) não funcionava',
        detalhe:
          'O navegador recusava o ícone para o prompt de instalação. Corrigido, com uma marca própria — e o pacote instalável ficou bem mais leve.',
      },
      {
        tipo: 'corrigido',
        titulo: 'A marca do ícone tinha um fundo sólido feio atrás dela',
        detalhe: 'Agora é transparente.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Trocar de imagem na fila apagava a contagem da imagem anterior',
        detalhe: 'Sem aviso e sem como desfazer. Agora cada imagem guarda a sua própria contagem.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Clicar numa marcação para arrastar podia trocar viável por inviável sem querer',
        detalhe: 'Agora troca com Ctrl+clique; o clique simples fica livre para arrastar.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Exportações saíam com nome ilegível, e o que a pessoa digitava podia se perder',
        detalhe:
          'O nome do arquivo agora traz projeto, tratamento, placa e data; e preencher os campos rapidamente não derruba mais uma letra digitada antes.',
      },
      {
        tipo: 'novo',
        titulo: 'Dividir uma digitalização em vários pedaços, e recortar o campo circular',
        detalhe:
          'Uma folha de scanner com várias sub-amostras é fatiada e entra direto na fila. Fotos por lupa têm o campo circular da ocular recortado automaticamente, descartando o entorno escuro.',
      },
    ],
  },
  {
    numero: '2.1.0',
    data: '2026-09-03',
    titulo: 'Classificação incerta, e exportar para treinar IA',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Terceira opção de classificação: "incerto"',
        detalhe:
          'Além de viável e inviável, para quando a imagem não deixa decidir. O resumo de resultados foi redesenhado para mostrar as três.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Exportar dataset para treinar IA (YOLO) sai do experimental',
        detalhe: 'Fica ligado por padrão — empacota as anotações que você já fez.',
      },
    ],
  },
  {
    numero: '2.0.0',
    data: '2026-08-23',
    titulo: 'Remoção de fundo, e o fluxo em etapas',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Remover o fundo da imagem',
        detalhe: 'Com limiar que se adapta à imagem, em vez de um valor fixo.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Sementes encostadas eram separadas do jeito errado',
      },
      {
        tipo: 'melhorado',
        titulo: 'Interface reorganizada em etapas',
        detalhe: 'Abrir, ajustar, contar, exportar — cada etapa dobrável, em vez de tudo aberto de uma vez.',
      },
      {
        tipo: 'corrigido',
        titulo: 'Uma falha de build travava a instalação do aplicativo (PWA)',
      },
      {
        tipo: 'corrigido',
        titulo: 'Detecção assistida parou de funcionar, e foi reconstruída',
      },
      {
        tipo: 'melhorado',
        titulo: 'O modelo de IA só carrega quando é realmente usado',
        detalhe: 'Quem não usa a detecção assistida nem baixa o modelo — o aplicativo abre mais rápido.',
      },
    ],
  },
  {
    numero: '1.0.0',
    data: '2026-08-19',
    titulo: 'Câmera, detecção assistida e calibração',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Capturar direto da câmera',
        detalhe: 'Celular ou lupa digital, sem precisar passar pelo scanner primeiro.',
      },
      {
        tipo: 'novo',
        titulo: 'Detecção assistida por IA',
        detalhe:
          'Um modelo (AI Pointer) sugere onde estão as sementes, para revisar em vez de marcar uma por uma.',
      },
      {
        tipo: 'melhorado',
        titulo: 'Correções na detecção assistida',
        detalhe: 'Menos sugestões fora do lugar.',
      },
      {
        tipo: 'novo',
        titulo: 'Calibração espacial por vários métodos',
        detalhe: 'Régua na tela e arraste de pontos, além da entrada manual.',
      },
      {
        tipo: 'novo',
        titulo: 'Morfometria',
        detalhe: 'Comprimento, largura e outras medidas de forma de cada semente.',
      },
      {
        tipo: 'novo',
        titulo: 'Painel de funcionalidades',
        detalhe: 'Para ver o que o aplicativo sabe fazer, num só lugar.',
      },
      { tipo: 'melhorado', titulo: 'Réguas no canvas, e créditos do projeto atualizados' },
    ],
  },
  {
    numero: '0.2.0',
    data: '2026-05-20',
    titulo: 'Modo Diferencial, e aplicativo instalável',
    mudancas: [
      {
        tipo: 'novo',
        titulo: 'Modo Diferencial',
        detalhe: 'Compara a contagem atual com uma contagem anterior salva da mesma placa.',
      },
      {
        tipo: 'novo',
        titulo: 'Aplicativo instalável (PWA)',
        detalhe: 'Funciona sem precisar abrir o navegador toda vez.',
      },
      { tipo: 'melhorado', titulo: 'Informações de créditos atualizadas' },
      { tipo: 'corrigido', titulo: 'Importar uma sessão do histórico falhava' },
    ],
  },
  {
    numero: '0.1.0',
    data: '2026-05-13',
    titulo: 'Primeira versão',
    mudancas: [
      { tipo: 'novo', titulo: 'Primeira versão do contador de sementes por clique' },
      { tipo: 'novo', titulo: 'Aplicativo em português' },
      { tipo: 'novo', titulo: 'Alternar entre tema claro e escuro' },
      { tipo: 'novo', titulo: 'Modo de navegação por arraste (panning) na imagem' },
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
