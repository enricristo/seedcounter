// =============================================================================
// SeedCounter — o que a ajuda diz sobre mouse e teclado
//
// Uma fonte só para as instruções de uso. Antes elas moravam soltas no JSX
// do HelpTip e ficaram para trás: a ajuda não sabia da onda (S), do ajuste
// (C), do desenho (P), da máscara (M) nem da galeria (G) — e dizia que Ctrl+Z
// "desfaz ponto", quando já desfaz qualquer gesto.
//
// As ferramentas vêm do registro delas (`TOOLS`): a tecla e o nome que a barra
// mostra são os mesmos que a ajuda mostra, por construção. Os demais atalhos
// são listados aqui e um teste confere que todo `case` do gancho de teclado
// aparece nesta lista — a ajuda não pode voltar a ficar para trás em silêncio.
// =============================================================================

import { TOOLS } from '../../hooks/useTools';

export interface Atalho {
  /** Como aparece na tela: "Ctrl + Z", "Espaço". */
  teclas: string;
  acao: string;
  /** Uma linha a mais, quando a ação precisa de contexto. */
  nota?: string;
}

export interface GrupoDeAtalhos {
  titulo: string;
  atalhos: Atalho[];
}

export const GRUPOS_DE_ATALHOS: GrupoDeAtalhos[] = [
  {
    titulo: 'Ferramentas',
    atalhos: [
      ...TOOLS.map((t) => ({ teclas: t.shortcut.toUpperCase(), acao: t.label })),
      { teclas: 'X', acao: 'Inverter viável ↔ inviável' },
      { teclas: 'Alt', acao: 'Borracha enquanto segurar' },
      { teclas: '[ ]', acao: 'Tamanho da borracha' },
    ],
  },
  {
    titulo: 'Edição',
    atalhos: [
      {
        teclas: 'Ctrl + Z',
        acao: 'Desfazer',
        nota: 'Um passo por gesto: marca, contorno, arraste, corte, lote. Contorno apagado volta.',
      },
      { teclas: 'Ctrl + Shift + Z', acao: 'Refazer' },
      { teclas: 'Ctrl + Y', acao: 'Refazer' },
      { teclas: 'Esc', acao: 'Cancelar o desenho · desmarcar o contorno' },
    ],
  },
  {
    titulo: 'Visualização',
    atalhos: [
      { teclas: '1', acao: 'Ver pontos' },
      { teclas: '2', acao: 'Ver índices' },
      { teclas: 'M', acao: 'Máscara: tudo → só pontos → nada' },
      { teclas: 'G', acao: 'Galeria de objetos' },
      { teclas: '+ / −', acao: 'Zoom' },
      { teclas: '0', acao: 'Ajustar à tela' },
      { teclas: 'D', acao: 'Tema claro / escuro' },
    ],
  },
  {
    titulo: 'Navegação e sessão',
    atalhos: [
      { teclas: 'Espaço', acao: 'Próxima imagem' },
      { teclas: 'Backspace', acao: 'Imagem anterior' },
      { teclas: 'Ctrl + S', acao: 'Salvar a sessão' },
      { teclas: 'Ctrl + E', acao: 'Exportar' },
    ],
  },
  {
    titulo: 'Bancadas',
    atalhos: [
      {
        teclas: 'Ctrl + Alt + 1',
        acao: 'Ativar a bancada 1',
        nota: 'O seletor no cabeçalho (perto do chip de espécie) faz o mesmo com o mouse — é o caminho normal.',
      },
      { teclas: 'Ctrl + Alt + 2', acao: 'Ativar a bancada 2' },
      { teclas: 'Ctrl + Alt + 3', acao: 'Ativar a bancada 3' },
      { teclas: 'Ctrl + Alt + 4', acao: 'Ativar a bancada 4' },
      {
        teclas: 'Ctrl + Alt + N',
        acao: 'Abrir uma nova bancada',
        nota: 'Até quatro ao mesmo tempo; clicar em qualquer ponto de uma bancada também a ativa.',
      },
    ],
  },
];

export interface InstrucaoDoMouse {
  gesto: string;
  efeito: string;
}

export interface GrupoDeInstrucoes {
  titulo: string;
  /** A tecla da ferramenta, quando o grupo é uma. */
  tecla?: string;
  instrucoes: InstrucaoDoMouse[];
}

export const INSTRUCOES_DO_MOUSE: GrupoDeInstrucoes[] = [
  {
    titulo: 'Marcar',
    tecla: 'V · I',
    instrucoes: [
      { gesto: 'Clique', efeito: 'Marca na classe da ferramenta' },
      { gesto: 'Shift / Ctrl + clique, ou botão direito', efeito: 'Marca na classe oposta' },
      { gesto: 'Arrastar uma marca', efeito: 'Reposiciona' },
      { gesto: 'Ctrl + clique numa marca', efeito: 'Inverte a classe' },
      { gesto: 'Shift / Alt + clique numa marca', efeito: 'Apaga a marca — e o contorno dela' },
    ],
  },
  {
    titulo: 'Segmentar por clique',
    tecla: 'S',
    instrucoes: [
      { gesto: 'Clique na semente', efeito: 'Marca e mede: a onda cresce até a borda' },
      { gesto: 'Ctrl + clique num contorno', efeito: 'Inverte a classe' },
      { gesto: 'Shift + clique ou botão direito num contorno', efeito: 'Apaga o contorno' },
    ],
  },
  {
    titulo: 'Ajustar contorno',
    tecla: 'C',
    instrucoes: [
      { gesto: 'Clique num contorno', efeito: 'Seleciona para editar (ganha alças)' },
      { gesto: 'Arrastar uma alça', efeito: 'Move o vértice; os vizinhos acompanham (Shift: só ele)' },
      { gesto: 'Clique na borda', efeito: 'Cria um vértice ali e já sai arrastando' },
      { gesto: 'Duplo clique ou Ctrl + clique numa alça', efeito: 'Remove o vértice' },
      { gesto: 'Arrastar por dentro', efeito: 'Raspa: a borda recua pelo caminho de menor esforço' },
      { gesto: 'Shift + arrastar por fora', efeito: 'Acrescenta: a borda avança até o traço' },
      { gesto: 'Clique no vazio, ou Esc', efeito: 'Desmarca' },
    ],
  },
  {
    titulo: 'Desenhar contorno',
    tecla: 'P',
    instrucoes: [
      { gesto: 'Clique', efeito: 'Coloca um vértice' },
      { gesto: 'Duplo clique, ou clique no primeiro vértice', efeito: 'Fecha o polígono' },
      { gesto: 'Esc', efeito: 'Cancela' },
    ],
  },
  {
    titulo: 'Cota (régua)',
    tecla: 'R',
    instrucoes: [
      { gesto: 'Arrastar', efeito: 'Traça a cota; o valor sai em px, ou em mm se a cena está calibrada' },
      { gesto: 'Soltar', efeito: 'Fixa a cota na prancheta' },
    ],
  },
  {
    titulo: 'Seta',
    tecla: 'A',
    instrucoes: [
      { gesto: 'Arrastar', efeito: 'Desenha uma seta apontando para o que interessa — sem medida' },
    ],
  },
  {
    titulo: 'Área de interesse',
    tecla: 'B',
    instrucoes: [
      { gesto: 'Arrastar', efeito: 'Destaca uma região (fungo, praga, anomalia) sem associá-la a uma semente' },
    ],
  },
  {
    titulo: 'Anotação textual',
    tecla: 'T',
    instrucoes: [
      { gesto: 'Clique', efeito: 'Insere um texto de chamada no ponto' },
    ],
  },
  {
    titulo: 'Borracha',
    tecla: 'E',
    instrucoes: [
      { gesto: 'Clique ou arrastar', efeito: 'Apaga as marcas no círculo, com os contornos delas' },
    ],
  },
  {
    titulo: 'Geral',
    instrucoes: [
      { gesto: 'Scroll', efeito: 'Zoom na posição do cursor' },
      { gesto: 'H + arrastar', efeito: 'Move a imagem' },
      { gesto: 'Ctrl + Z', efeito: 'Desfaz o último gesto — o que caiu junto volta junto' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Fluxo de trabalho — o caminho de uma amostra, do arquivo ao laudo
// ---------------------------------------------------------------------------

export interface PassoDoFluxo {
  titulo: string;
  /** O que fazer, em uma frase. */
  como: string;
  /** Onde fica na tela. */
  onde: string;
}

/**
 * A terceira aba das instruções. As duas primeiras dizem O QUE cada gesto e
 * tecla fazem; esta diz EM QUE ORDEM as coisas acontecem — é o que alguém que
 * chega pela primeira vez pergunta, e nenhuma lista de atalhos responde.
 */
export const FLUXO_DE_TRABALHO: PassoDoFluxo[] = [
  {
    titulo: 'Abrir',
    como: 'Digitalização (PNG, JPG ou TIFF), câmera, um exemplo real, ou uma pasta de datasets.',
    onde: 'Lateral esquerda — Abrir imagem / Exemplos; aba Datasets à direita.',
  },
  {
    titulo: 'Calibrar',
    como: 'Diga a escala: DPI do scanner, régua na imagem ou micrômetro. O DPI do driver é declaração — a régua é a conferência.',
    onde: 'Etapa 1. A escala gráfica no canto da imagem mostra o resultado (mm e px).',
  },
  {
    titulo: 'Encontrar',
    como: 'Marque (V/I), segmente por clique (S), ou deixe o ensaio propor três receitas ao carregar e escolha uma — ou nenhuma.',
    onde: 'Etapa 2 e a aba Inspetor à direita (cartões do ensaio).',
  },
  {
    titulo: 'Curar',
    como: 'Confira na galeria, ajuste contornos (C), separe encostadas pela proposta de corte, aplique regras em lote — o fantasma tracejado mostra antes.',
    onde: 'Abas Galeria e Inspetor; Regras semi-automáticas em Resultados.',
  },
  {
    titulo: 'Medir',
    como: 'Área, comprimento × largura, Feret, solidez por objeto; o botão de eixos mostra de onde cada medida sai e o "≠" avisa quando a forma não é elíptica.',
    onde: 'Inspetor (uma semente) e Resultados (a população); controles de zoom → eixos.',
  },
  {
    titulo: 'Identificar',
    como: 'Espécie, lote, protocolo — é o que dá contexto a todo número e habilita referências e tolerâncias.',
    onde: 'Etapa 4 na lateral esquerda.',
  },
  {
    titulo: 'Exportar',
    como: 'CSV com um objeto por linha (origem marcada: manual, ia, modelo, referência), laudo PDF, sessão JSON para continuar depois.',
    onde: 'Cabeçalho — Exportar; Resultados — Exportar laudo.',
  },
];
