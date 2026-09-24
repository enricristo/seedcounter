# Organizar a interface: uma decisão, um lugar

**Data:** 2026-09-24 · **Estado:** diagnóstico medido; proposta aguardando decisão

## O pedido

Em 24/09/2026, perguntado qual das barras estava confusa, o dono respondeu:
*"pra falar a verdade, tá todas bem confusas, nunca paramos muito para pensar
nisso, tem que organizar."*

É o primeiro pedido de **arquitetura de interface** do projeto. Até aqui cada
funcionalidade escolheu sozinha onde morar, e o resultado é o que está medido
abaixo.

## O que existe hoje, contado

| Superfície | Controles | O que ela decide |
|---|---:|---|
| Cabeçalho | 40 | abas de navegação, bancadas, espécie, menu Exibir, exportar, salvar, configurações, novidades |
| Galeria | 40 | filtros, ações em lote, classe de cada objeto, inspeção |
| Barra de ferramentas | 17 | classe ativa, instrumento, réguas, máscara, estilo/opacidade/tamanho da marca |
| Painel direito | 16 | seis abas (resultados, inspetor, galeria, datasets, lote, analytics) |
| Rodapé | 7 | modo de análise, cronômetro, versão, relatar problema |
| Lateral esquerda | 6 | quatro etapas numeradas + exemplos + ajuda |
| Ensaio ao carregar | 6 | qual receita aceitar |
| Identificar amostra | 3 | espécie, lote, **protocolo** |

Mais **15 janelas** que abrem por cima (`setIs*Open`): câmera, divisão,
recorte circular, histórico, exportar, exportar YOLO, analytics, identificação
normativa, experimento, corrida de placa, configurações, confirmação, galeria
grande, novidades, relatar problema.

**Ao redor de 135 controles em 8 superfícies, mais 15 janelas e 6 abas.**

## Os três defeitos que a medição mostra

### 1. A mesma decisão mora em vários lugares

- **A classe de um objeto**: barra de ferramentas, célula da galeria, seletor
  de classe fina, inspetor, menu radial e o painel de totalizadores. Seis
  portas — e até ontem duas delas gravavam em campos diferentes, o que produzia
  o defeito de "a cor muda e o número não" (corrigido no PR #87).
- **Como encontrar objetos**: a etapa 2 da lateral (Encontrar), os cartões do
  ensaio ao carregar, o painel de Lote e a tela de perfil escolhem a MESMA
  coisa — a receita de localização — com três vocabulários diferentes.
- **A contagem**: o componente `Counters` é renderizado nas DUAS laterais, com
  uma bandeira (`hideCounters`) decidindo qual delas mostra.

### 2. Não há princípio declarado de "o que vai onde"

A ajuda tem um fluxo canônico, escrito e testado
(`features/ajuda/atalhos.ts`, `FLUXO_DE_TRABALHO`):

> Abrir → Calibrar → Encontrar → Curar → Medir → Identificar → Exportar

A **interface não segue esse fluxo**. A lateral esquerda numera quatro etapas
(calibrar, encontrar, preparar, identificar) e deixa "curar", "medir" e
"exportar" para outras três superfícies, sem dizer que são a continuação da
mesma sequência. Quem aprendeu o fluxo na ajuda não o encontra na tela.

### 3. Um controle não diz o que ele governa

O caso que provocou o pedido: o **protocolo** vive num `<select>` no meio do
formulário de identificação, e é ele que decide quais classes existem na barra
de ferramentas, quais teclas de 1 a 6 funcionam, o que o painel de
totalizadores lista e o que o laudo consolida. Nada na tela liga uma coisa à
outra.

## A proposta: um papel por superfície

Cada superfície ganha UMA pergunta para responder, e nada que não responda a
ela mora lá:

| Superfície | A pergunta | O que sai de lá |
|---|---|---|
| **Lateral esquerda** | *o que eu preparo antes de contar?* | os passos do fluxo, na ordem da ajuda, numerados de 1 a N — incluindo o protocolo, que hoje está enterrado |
| **Barra de ferramentas** | *o que o meu gesto faz agora?* | os controles de VER (réguas, máscara) saem para o menu Exibir; ficam classe e instrumento |
| **Painel direito** | *o que eu já tenho?* | resultado, inspeção, galeria — e só |
| **Cabeçalho** | *onde eu estou, e o que eu levo?* | abas, bancada, exportar, salvar |
| **Rodapé** | *como eu estou trabalhando?* | modo de análise, cronômetro, versão |

E três regras:

1. **Uma decisão, um dono.** Quem repete é ATALHO, e o atalho leva ao dono em
   vez de ter estado próprio. A classe é o exemplo já resolvido no PR #87:
   seis portas, uma operação.
2. **Quem governa, anuncia.** Um controle que muda outra superfície diz o que
   vai mudar antes — é o que a tela de perfil já faz com `oQueMuda`, e o
   protocolo precisa fazer.
3. **O fluxo da ajuda é o índice da tela.** Se um passo do fluxo não tem lugar
   óbvio na interface, é defeito da interface, não da ajuda.

## O que NÃO se faz aqui

- Não se muda o que cada botão FAZ. Isto é arrumação de onde ele mora.
- Não se mexe no canvas nem em nenhuma conta.
- Não se resolve tudo de uma vez: reorganização é a mudança que mais quebra
  memória muscular, e quem usa o app todo dia é quem mais perde com isso.

## Fatias propostas, em ordem de risco

| # | O quê | Risco |
|---|---|---|
| 1 | **O protocolo sobe** para a lateral, como passo próprio, dizendo o que muda (classes, teclas, totalizadores, laudo) | baixo — um campo muda de lugar |
| 2 | **A lateral segue o fluxo da ajuda**: os passos ganham os nomes do fluxo e a numeração passa a bater com ele | baixo — rótulos e ordem |
| 3 | **Ver sai da barra de ferramentas** (réguas, máscara, galeria) para o menu Exibir, onde já moram as partes ligáveis | médio — mexe em memória muscular; as teclas continuam |
| 4 | **Uma receita, um dono**: a etapa "Encontrar" passa a ser a única que escolhe receita; ensaio e lote viram atalhos para ela | médio — três painéis conversam |
| 5 | **Contagem num lugar só**: some a duplicata `Counters`, e a lateral escolhida vira a única | baixo, depois de 1–4 |

## O que decidir antes de começar

1. Vale reorganizar **agora** ou depois do design system da marca nova? A
   identidade muda cor, tipografia e espaçamento; a arrumação muda ONDE as
   coisas estão. São trabalhos independentes, mas fazer os dois juntos numa
   mesma versão dobra o estranhamento de quem já usa.
2. A fatia 3 (tirar "ver" da barra) é a que mais mexe em hábito. Vale?
3. Alguém além do dono já usa o app com frequência? Se sim, a reorganização
   precisa de aviso nas notas de versão, não só de changelog.
