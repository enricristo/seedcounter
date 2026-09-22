# Demonstrações, ideias e expansão

> Registro vivo. Três seções: o que mostrar e em que ordem (demonstrações), o
> que ainda não existe e por que vale (ideias, com a ressalva de cada uma), e
> o que muda quando o app deixa de ser de um laboratório só (expansão e
> escalonamento). Atualizado em 21/09/2026.

---

## 1. Demonstrações — roteiros de tela

Cada roteiro dura de 3 a 6 minutos e mostra **uma tese**. Um vídeo que mostra
tudo não mostra nada. A ordem dentro de cada um é a ordem em que o argumento
se constrói.

### 1.1 "A máquina propõe, a pessoa confere" (a tese do produto)

Público: quem decide se adota — chefe de laboratório, gerente de qualidade.

1. Abrir uma digitalização de tetrazólio de orquídea (amostra densa). Sem
   marcar nada, mostrar o **ensaio ao carregar**: três receitas lado a lado,
   com contagem e Feret em cada uma. Nada foi aplicado.
2. Passar o mouse: a proposta aparece **tracejada**. "Usar esta".
3. Trocar o estilo da marca para **anel** e baixar a opacidade: a semente
   aparece por dentro; a cor do tetrazólio fica visível — o critério do teste
   continua sendo o olho.
4. Corrigir duas marcas à mão. Abrir o inspetor: a semente corrigida tem
   `origem: manual`, as outras `modelo`. **O CSV diz de onde veio cada uma.**
5. Exportar o CSV e abrir a coluna `procedencia`: versão, commit, página,
   modo, tempo, DPI declarado e medido. "Daqui a um ano, este número se
   explica sozinho."

Frase de fechamento: *"Nenhum número entra sem alguém aceitar, e todo número
sai dizendo quem o produziu."*

### 1.2 "Medida conferida, não assumida" (para quem publica)

Público: pesquisador, orientador, banca.

1. Calibração → Referência → Medir na imagem, em três pontos da régua.
   Mostrar o CV e o "vs. DPI informado". Se o scanner declarar diferente do
   medido, **melhor ainda** — é o argumento inteiro.
2. Painel de Morfometria → Volumes: as equações escritas, o embrião digitado,
   o seletor de convenção da altura. "As duas leituras diferem por 2×; a banca
   pode ver qual foi usada."
3. Cronômetro no rodapé com o modo em *manual*, marcar 30 sementes; trocar
   para *assistida* e aceitar a proposta do modelo. Exportar os dois CSVs:
   `tempo_ativo_s` e `modo_analise` lado a lado. "É o número que ninguém
   publica porque ninguém mede."

### 1.3 "Do arquivo ao laudo em lote" (para o laboratório comercial)

Público: quem tem 40 placas por dia.

1. Explorador de datasets: apontar a pasta; Ctrl+clique em seis imagens →
   "Adicionar à fila".
2. **Processar Fila** (IA): barra "imagem 3 de 6", **Parar** no meio para
   mostrar que a imagem em andamento não vira sessão. Rodar de novo: as já
   gravadas são puladas e nomeadas.
3. Galeria: filtrar inviáveis, ordenar por área — "resíduo e semente
   monstruosa aparecem em dois cliques".
4. Laudo PDF em lote: bloco "Métricas Avançadas" com a\* por classe.

### 1.4 "Modo apresentação" (o que você está gravando)

`?modo=apresentacao` (ou o antigo `?mode=enterprise`): sem abas, sem frasco,
selo "Analytics". O botão de olho no cabeçalho é a saída. Para esconder até
ele, é uma linha em `MenuExibir.tsx` (`modo === 'apresentacao' && null`).

### 1.5 Regras para qualquer demonstração

- **Nunca** mostrar um número que o app inventou. Se o Analytics estiver sem
  cor extraída, dizer que está. Um número falso a favor da ferramenta custa
  a credibilidade do resto.
- Preferir a imagem difícil (orquídea densa) à fácil (soja espaçada): a fácil
  qualquer software faz; a difícil é onde os concorrentes de grão falham
  ("as sementes não podem se tocar").
- Rodar **local** com o modelo fp32 quando a demonstração envolver
  viável/inviável. O quantizado erra justamente isso.

---

## 2. Ideias — o que ainda não existe, e a ressalva de cada uma

Ordenadas por **valor para a primeira usuária real ÷ custo**. A ressalva não
é pessimismo: é o que decide se a ideia entra ou espera.

| Ideia | Por que vale | Ressalva |
|---|---|---|
| **Germinator dentro do app** (núcleo nesta rodada; tela na próxima) | O laboratório usa a planilha hoje; t50, U8416, AUC e MGT são o que eles publicam. Com a curva no app, a contagem semanal vira gráfico sem Excel. | Nada entra sem bater com a planilha da Ceci. O Solver do Excel para perto do chute inicial em várias amostras; reproduzir isso é parte do trabalho. |
| **Alvo de resolução** (não só de escala) | A régua pega escala errada; não pega pixel interpolado. Um padrão de linhas (USAF 1951 ou uma grade impressa) diz quantos pixels *reais* há. | Precisa de um alvo físico no laboratório. Barato (impressão em transparência), mas é bancada, não código. |
| **"Esta sessão curada vira dataset"** em um clique | Cada laudo é uma amostra rotulada por especialista. É o funil que transforma uso em material de treino. | Só vale depois de haver volume. Exportador YOLO já existe; falta o caminho de um clique e o manifesto de reprodutibilidade junto. |
| **Dataset público de orquídea com máscara**, publicado por vocês | A pesquisa de mercado não achou concorrente. Contribuição original citável, com DOI via Zenodo. | Curadoria humana de centenas de imagens. É trabalho da Mayara e dos orientandos, não de código. |
| **Retreinar o YOLO** com as anotações da semana | O modelo atual foi treinado em outra condição; as correções dela são exatamente o dado que falta. | **Depois** de ela produzir anotações. E o v11 em `models/` está em `.pt`, não em ONNX — exportar é passo próprio. |
| **Barra de menu** (Arquivo/Editar/Exibir/Ferramentas/Ajuda) | O que todo aplicativo tem; os modos de visualização já são o "Exibir". | Só depois de alguém que não escreveu os modos usá-los. Menu antes de uso vira menu que ninguém abre. |
| **Comparar dois lotes lado a lado** (bancadas já existem) | Armazenamento a 0 e a 44 meses na mesma tela é o ensaio da Ceci. | O `PainelDeComparacao` existe; falta o eixo "meses de armazenamento" no longitudinal. |
| **Emergência de radícula (ISTA Cap. 15, soja)** | Critério binário e geométrico, 2 mm, agora ISTA-validado. A tarefa de visão mais simples do catálogo. | Precisa de imagem de plântula em rolo/papel, que é outro fluxo de captura. |
| **Captura ao vivo** (microscópio USB, webcam) | O hardware já existe na bancada. | Degrau 3 inteiro: trava de exposição, flat-field, foco. Não é uma feature, é um subsistema. |
| **Sessões na nuvem / conta com histórico** | O dado hoje mora no navegador; "limpar dados" apaga a semana. | Bloqueado por hospedagem com disco e pelos quatro furos do backend (`docs/backend/revisao-2026-09-18.md`). Export/import do espaço de trabalho resolve 80% sem servidor. |

---

## 3. Expansão e escalonamento

### 3.1 O que muda quando há mais de um laboratório

Hoje o app é **local-first sem conta obrigatória**: isso é a vantagem
competitiva (nada sobe; roda onde o scanner está) e a limitação (o dado não
sai da máquina). Escalar não é "colocar tudo num servidor" — é dar
**caminhos opcionais** de saída sem tirar o modo local:

1. **Export/import do espaço de trabalho** (um arquivo, tudo dentro). Zero
   servidor. Resolve backup e transferência entre máquinas.
2. **Conta com sessões** (backend existente, depois de fechar os furos e
   trocar o SQLite efêmero). Para quem quer histórico entre máquinas.
3. **Instância por laboratório** (Docker já existe em `docs/DOCKER.md`).
   Para quem tem TI e quer o dado dentro da rede.

Na ordem. Cada uma é independente da seguinte.

### 3.2 Custos, medidos (18/09)

Domínio `.com.br` R$ 40/ano no Registro.br; hospedagem com disco US$ 2–7/mês
(Fly, Railway, Render); Sentry grátis até 5 000 erros/mês (**sem** session
replay, que é o que estoura). Vercel Hobby é não-comercial — cobrar por algo
exige Pro (US$ 20/usuário/mês). **Total para começar: US$ 10–25/mês.** O
gargalo não é dinheiro, é tempo de quem mantém.

### 3.3 Modelos de produto, em ordem de viabilidade

1. **App grátis + implantação e treinamento pagos.** O roteiro de bancada e o
   treinamento da semana de 22/09 são o protótipo disso.
2. **Conta paga** para sessões na nuvem e laudo com identidade do laboratório.
3. **Indústria**: beneficiadoras querem **lote e esteira**, não semente a
   semente. É o Degrau 3 + fila com IA, que agora existe e é cancelável.

### 3.4 O que NÃO escalar

- Ads (R$ 10–40 por clique em SaaS no Brasil, para um público de algumas
  centenas de laboratórios): o canal é o treinamento, os grupos, a ABRATES e
  um artigo.
- O nome, antes de decidir: **SeedCounter existe desde 2017** (app Android de
  trigo, publicado). Gastar com identidade antes disso é gastar duas vezes.

### 3.5 O que sustenta tudo isso

Três coisas que já existem e precisam continuar existindo em cada release:

- **Uma fonte por verdade** (`enumerarObjetos`, `classeDoModelo`,
  `buildMeasurements`) com teste estático que impede a próxima duplicata.
- **Procedência em toda linha exportada** — é o que a ISTA chama de validação
  e o que nenhum concorrente entrega.
- **Campo vazio em vez de número inventado.** A regra que faz o resto valer.

---

## Referências no repositório

- Plano de fases: `docs/superpowers/plans/2026-09-21-plano-de-acao-fases.md`
- Mercado e lacunas: `docs/mercado/`
- Backend, estado real: `docs/backend/revisao-2026-09-18.md`
- Roteiro de bancada: `docs/roteiros/roteiro-tetrazolio-orquidea.md`
- Bibliografia: `docs/referencias/seedcounter.bib`
