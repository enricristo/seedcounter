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
