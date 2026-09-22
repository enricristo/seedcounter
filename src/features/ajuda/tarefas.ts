// =============================================================================
// SeedCounter — a ajuda por TAREFA, com o porquê
//
// POR QUE ESTE MÓDULO EXISTE.
//
// A ajuda tinha o fluxo (a ordem), o mouse e o teclado (os gestos). Faltava a
// pergunta que a pessoa faz de verdade na bancada: "como eu calibro de um
// jeito que sirva para publicar?", "por que a marca tapa a semente?", "o que
// é esse relógio no rodapé?". Cada tarefa aqui responde COMO em passos e POR
// QUE em uma frase — porque um passo sem o porquê é decorado e esquecido, e
// um porquê sem o passo não ajuda ninguém às 17h.
//
// O critério de pronto do produto, escrito em 22/09: alguém que nunca viu o
// app faz uma análise até o CSV sem um PDF ao lado. Esta é a metade "sem PDF".
//
// É conteúdo GENÉRICO, de propósito: nada de metodologia de um ensaio
// específico, nada de espécie de ninguém — isso mora em roteiros privados. O
// que está aqui vale para qualquer laboratório.
// =============================================================================

export interface PassoDaTarefa {
  faca: string;
  /** Onde clicar, quando não é óbvio. */
  onde?: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  /** A pergunta que a pessoa faria. */
  pergunta: string;
  /** Uma frase: por que isto importa. */
  porque: string;
  passos: PassoDaTarefa[];
  /** O que conferir para saber que deu certo. */
  confira: string;
}

export const TAREFAS: Tarefa[] = [
  {
    id: 'calibrar-conferido',
    titulo: 'Calibrar de um jeito que sirva para publicar',
    pergunta: 'O DPI do scanner não basta?',
    porque:
      'O DPI que o arquivo declara é o que o programa de digitalização acha que fez. Já medimos 32 % de diferença entre o declarado e a régua na própria imagem — e esse erro entra igual em todas as amostras, sem aparecer na repetição.',
    passos: [
      { faca: 'Digitalize com uma régua junto da amostra, encostada no vidro.' },
      { faca: 'Abra Calibração e escolha o método Referência.', onde: 'Lateral esquerda, etapa 1.' },
      { faca: 'Clique em "Medir na imagem" e marque os dois extremos de uma distância conhecida da régua.' },
      { faca: 'Digite o comprimento real e clique em "+ Guardar esta leitura".' },
      { faca: 'Repita em pelo menos três regiões diferentes da imagem, longe uma da outra.' },
      { faca: 'Leia o CV e o "vs. DPI informado"; clique em Aplicar.' },
    ],
    confira:
      'CV abaixo de 1 %, nenhum alerta amarelo, e as colunas dpi_medido, calibracao_n e calibracao_cv_pct preenchidas no CSV.',
  },
  {
    id: 'contar',
    titulo: 'Contar viáveis e inviáveis',
    pergunta: 'Por onde começo?',
    porque:
      'A máquina propõe e a pessoa confere: nada entra na contagem sem alguém aceitar. Por isso a proposta aparece tracejada, e o clique é seu.',
    passos: [
      { faca: 'Declare o modo no rodapé: manual, assistida ou automática.', onde: 'Rodapé, ao lado do relógio.' },
      { faca: 'Escolha a ferramenta Viável ou Inviável e clique sobre cada semente.', onde: 'Barra de ferramentas, ou teclas V e I.' },
      { faca: 'Errou a classe? X inverte. Errou o lugar? Alt segura a borracha. Ctrl+Z desfaz o gesto.' },
      { faca: 'Para deixar o programa propor, use "Encontrar" ou o ensaio ao carregar; aceite só o que conferir.' },
    ],
    confira: 'O contador do rodapé bate com o que você vê; o inspetor (aba Resultados) mostra a origem de cada objeto.',
  },
  {
    id: 'ver-a-semente',
    titulo: 'Ver a semente por baixo da marca',
    pergunta: 'A marca está tapando a semente. E agora?',
    porque:
      'Numa amostra densa, o disco cheio cobre justamente o que você precisa conferir — a cor do tetrazólio. A marca é anotação, não objeto da cena.',
    passos: [
      { faca: 'Com a ferramenta de marcar ativa, clique no botão com o nome do estilo (Disco, Anel, Ponto, Cruz) para alternar.', onde: 'Barra de ferramentas.' },
      { faca: 'Baixe a opacidade e, se precisar, o tamanho.' },
      { faca: 'Para amostra amontoada: Anel ou Cruz, opacidade em torno de 60 %.' },
    ],
    confira: 'Em qualquer estilo, viável e inviável têm formas diferentes — não só cores. Isso é de propósito, para a figura sobreviver em preto e branco.',
  },
  {
    id: 'medir',
    titulo: 'Medir, e calcular volumes',
    pergunta: 'Onde estão as medidas?',
    porque:
      'Comprimento, largura, área, Feret e solidez saem do contorno de cada objeto. Volumes precisam do embrião, que o scanner raramente resolve — por isso ele é digitado, vindo do microscópio, e o programa faz a conta com a equação escrita na tela.',
    passos: [
      { faca: 'Abra o painel Morfometria.', onde: 'Aba Resultados, à direita.' },
      { faca: 'Confira mediana e faixa de comprimento e largura — em px sempre, em mm quando calibrado.' },
      { faca: 'No bloco Volumes, digite comprimento e largura do embrião em µm.' },
      { faca: 'Escolha a convenção da altura do cone e confira no artigo de referência qual foi usada.' },
    ],
    confira: 'As três equações aparecem escritas ao lado do resultado. Ar negativo mostra um aviso — é sinal de medida trocada, não de semente.',
  },
  {
    id: 'cronometro',
    titulo: 'O relógio do rodapé',
    pergunta: 'Para que serve, e por que ele para sozinho?',
    porque:
      'Ninguém publica quanto tempo leva uma análise por imagem, porque ninguém mede. O relógio conta só tempo de trabalho: para quando a aba some e quando ninguém mexe por um minuto, e zera a cada imagem ou página.',
    passos: [
      { faca: 'Declare o modo (manual, assistida, automática) antes de começar a marcar.' },
      { faca: 'Para comparar métodos na mesma imagem, faça o braço manual primeiro — depois de ver a proposta do programa, ninguém desmarca o que já viu.' },
    ],
    confira: 'No CSV, tempo_ativo_s e modo_analise preenchidos; segundos por semente é o número que se compara.',
  },
  {
    id: 'exportar',
    titulo: 'Exportar com procedência',
    pergunta: 'O que vai no CSV além das medidas?',
    porque:
      'Duas linhas com o mesmo 1,17 mm podem ter vindo de calibrações, páginas, versões e modos diferentes — e nada nelas denunciaria isso. A procedência faz cada linha responder "de onde saiu?" um ano depois.',
    passos: [
      { faca: 'Exportar → "Por Semente (CSV)" — uma linha por objeto.', onde: 'Cabeçalho, botão Exportar (Ctrl+E). "Tabela (CSV)" é o resumo por sessão, sem as colunas de procedência.' },
      { faca: 'Confira as colunas: especie, pagina, modo_analise, tempo_ativo_s, dpi_declarado, dpi_medido, calibracao_n, versao_app, commit.' },
    ],
    confira: 'Campo vazio significa "não foi medido". Nunca é preenchido com o provável.',
  },
  {
    id: 'relatar',
    titulo: 'Quando algo dá errado',
    pergunta: 'Travou. O que eu mando?',
    porque:
      'Um relato sem a sequência do que aconteceu custa meia hora de conversa. O relatório traz versão, navegador e os últimos passos — e não traz imagem, pixel nem nome de arquivo, então pode ser enviado sem medo.',
    passos: [
      { faca: 'Configurações → Relatar problema.', onde: 'Ou o ícone ao lado do número da versão, no rodapé.' },
      { faca: 'Baixar relatório, ou Copiar resumo para mandar por mensagem.' },
    ],
    confira: 'O trabalho salvo continua no navegador; recarregar a página não o perde.',
  },
  {
    id: 'comparar-tratamentos',
    titulo: 'Comparar tratamentos: letras ou curva?',
    pergunta: 'Meus tratamentos são doses. Tukey serve?',
    porque:
      'Cultivar A contra cultivar B é uma pergunta de "quais diferem", e a resposta são letras (Tukey, Scott-Knott). Dose, tempo, potencial e temperatura são níveis de um fator contínuo: a pergunta vira "como a resposta muda com o nível, e onde está o ótimo", e a resposta é uma curva ajustada. Separar doses por letras responde a pergunta errada.',
    passos: [
      { faca: 'Preencha o campo Tratamento de cada sessão com o nível dentro do rótulo: T0, T8, T16; −0,3 MPa; 12 meses.', onde: 'Metadados da amostra, antes de salvar.' },
      { faca: 'Abra Estatísticas → Comparação de Tratamentos.', onde: 'Aba no cabeçalho.' },
      { faca: 'Leia a ANOVA e as letras — elas continuam valendo como comparação de médias.' },
      { faca: 'Logo abaixo, o cartão "Fator quantitativo" aparece sozinho quando três ou mais tratamentos têm número no rótulo. Confira a linha "T8 → 8": é o número que o app leu.' },
      { faca: 'Leia o grau recomendado, a equação e o ótimo. Ótimo fora da faixa testada vem em aviso — é extrapolação, não resultado.' },
    ],
    confira:
      'Rótulo com dois números ("T8 rep2") não vira nível, de propósito; ponha a repetição no campo próprio. Se o cartão não aparece, é porque menos de três tratamentos têm número.',
  },
  {
    id: 'curva-de-germinacao',
    titulo: 'A curva de germinação, sem a planilha',
    pergunta: 'Tenho as contagens por dia. Como tiro t50 e uniformidade?',
    porque:
      'Contar germinadas em dias seguidos dá uma curva; germinação final é só o último ponto dela. t50, uniformidade e área sob a curva descrevem a velocidade e a sincronia — e dependem de um ajuste que a planilha fazia com o Solver, que às vezes para cedo. Aqui o ajuste converge, e o app diz onde diferiu.',
    passos: [
      { faca: 'Abra Germinação.', onde: 'Aba no cabeçalho; se não aparecer, o modo de visualização a esconde — troque em Exibir.' },
      { faca: 'Cole a aba INPUT da planilha (código, sementes, contagens por hora) ou importe do experimento longitudinal.' },
      { faca: 'Leia a tabela de parâmetros; cada coluna tem uma frase de ajuda ao passar o mouse.' },
      { faca: 'Compare tratamentos: ANOVA e Tukey com letras, embaixo das curvas.' },
      { faca: 'Exporte no formato da planilha (TSV output) para quem ainda usa o Excel.' },
    ],
    confira:
      'R² abaixo do limite aparece em amarelo na tabela — é ajuste que não descreve a curva, e o t50 dele não vale. Onde o Solver do Excel parou cedo, o t50 daqui é diferente, de propósito: o ajuste converge até o fim.',
  },
  {
    id: 'publicar',
    titulo: 'O que vai no artigo',
    pergunta: 'O que eu preciso relatar para alguém reproduzir?',
    porque:
      'Um número de viabilidade sem o método é um número solto. Quem lê precisa saber como a escala foi medida, se a contagem foi manual ou proposta pela máquina, e qual versão do programa fez a conta — e tudo isso já está no CSV, em colunas, esperando ser copiado para a seção de métodos.',
    passos: [
      { faca: 'Método de calibração: régua na imagem, número de leituras e CV (colunas dpi_medido, calibracao_n, calibracao_cv_pct). Se só houver dpi_declarado, diga que a escala é a declarada pelo driver.' },
      { faca: 'Modo de análise (coluna modo_analise): manual, assistida ou automática — e, se automática, que cada proposta foi conferida por uma pessoa.' },
      { faca: 'Versão e commit do programa (colunas versao_app e commit), para a análise ser repetível no mesmo código.' },
      { faca: 'Cite o programa pelo arquivo CITATION.cff do repositório — ele tem os autores na ordem oficial e a versão; o número da versão também está no rodapé.', onde: 'Rodapé, ao lado de Relatar problema.' },
      { faca: 'Para germinação e regressão, relate o modelo ajustado (Hill de quatro parâmetros; polinômio de grau n) e o critério de escolha do grau (F sequencial, p < 0,05).' },
    ],
    confira:
      'Alguém com o CSV e o texto dos métodos consegue refazer a tabela sem perguntar nada a você. Se uma coluna está vazia, o método diz "não medido" — não inventa.',
  },
];
