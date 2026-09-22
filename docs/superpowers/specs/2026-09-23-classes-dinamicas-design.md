# Classes dinâmicas: raiz normativa, caminho e rótulo

**Data:** 2026-09-23 · **Estado:** aprovado nas três decisões de escopo (23/09), a implementar por fatias

## O problema

O aplicativo marca `viável` / `inviável`. Isso basta para orquídea e não basta
para o resto: em forrageira, uma semente que não germinou pode ser **dormente,
dura, vazia ou morta**, e as quatro significam coisas diferentes para quem
compra o lote. Na bancada aparecem ainda **detrito, sujeira, semente quebrada,
contaminada, fungo** — e "aglomerado", que não é semente nenhuma: são duas
grudadas.

O pedido do dono (23/09): *"sair do somente viável-inviável, manter um padrão de
classe e mudar só o nome visual, ir adicionando"*.

## O que JÁ existe, testado, e está desligado

| Módulo | O que faz | Quem consome hoje |
|---|---|---|
| `lib/normas/classes-de-semente.ts` | seis classes com `ehSemente` e `germinou`; `PROTOCOLOS` (simples, germinação, forrageira); `consolidar`, `exigeTetrazolio`, `contarPorClasse` | só `lib/laudo/montagem.ts` |
| `lib/normas/taxonomia.ts` | classe como **caminho** (`['anormal','danificada']`); a raiz manda na conta, os níveis abaixo refinam | menu radial (só as raízes) |
| `Mark.subclasse` | a classe fina gravada na marca | galeria (seletor), menu radial |
| `metadata.protocolo` | qual protocolo vale na amostra | formulário de amostra; perfis (`sc:protocoloPadrao`) |

**O que não existe:** a barra de ferramentas só oferece `viável`/`inviável`; o
contador do rodapé, o CSV por objeto e as Estatísticas ignoram a classe fina —
`subclasse` **nem sai no CSV**, então a curadoria feita na galeria se perde na
exportação. Não há classe definida por quem usa, nem renomear rótulo, nem cor e
forma por classe.

## A decisão que muda número (e por que "só o nome visual" não serve)

A lista pedida mistura três naturezas, e confundi-las produz porcentagem errada:

1. **Não é semente** — detrito, sujeira, pedra, espigueta vazia. A RAS chama de
   *material inerte*: **sai do denominador**. 400 objetos com 80 detritos dão
   germinação sobre **320**, não sobre 400. Num lote de forrageira, é a
   diferença entre aprovar e reprovar.
2. **É semente com um defeito** — quebrada, contaminada, com fungo. Fica no
   denominador; refina a leitura e não muda a conta.
3. **Não é um objeto** — *aglomerado*. Um contorno com duas sementes grudadas é
   uma **contagem errada**, não uma classe. Virar classe mascara o erro.

## O desenho: três camadas + um marcador

```
raiz normativa (fixa, RAS)      →  ehSemente? germinou?   →  denominador, laudo, tolerância
   └─ caminho (extensível)      →  'morta › contaminada › fungo'  →  refina, não muda conta
        └─ rótulo visual        →  nome, cor e FORMA (Lei 4)      →  só aparência
marcador de artefato (à parte)  →  'aqui há N sementes'           →  corrige a contagem
```

**Decisões tomadas em 23/09:**

- **D1.** Ligar primeiro o que já existe; classes definidas pelo usuário vêm
  depois, em cima disso.
- **D2.** Ao criar uma classe, quem usa **escolhe a raiz** ("do que isto é um
  tipo?"). A raiz manda na conta; nome, cor e forma são livres. O laudo pode
  sempre dizer a que classe da norma uma classe inventada descende.
- **D3.** *Aglomerado* é **marcador de artefato**, não classe: marca o contorno
  como "N sementes", a contagem soma N em vez de 1, e o CSV registra que a
  medida daquele objeto não vale.

## As fatias, em ordem (uma por PR)

### Fatia 1 — a classe fina chega ao CSV *(aditiva, nenhum número muda)*

`buildMeasurements` ganha as colunas `classe_norma` (a chave: `vazia`,
`dormente`, …), `classe_rotulo` e `conta_como_semente` (`sim`/`nao`). Vazias
quando não há subclasse — **campo vazio, nunca o provável** (Lei 2). A coluna
`classe` (viável/inviável) continua como está, para não quebrar planilha de
ninguém.

*Prova:* teste de `buildMeasurements` com marca sem subclasse (colunas vazias),
com `vazia` (`conta_como_semente = nao`) e com `dormente` (`sim`).

### Fatia 2 — o denominador *(muda número; exige aviso na tela)*

`contarObjetos` passa a devolver, além do total, **quantos contam como
semente**. O rodapé mostra os dois quando diferem ("312 sementes · 8 inertes"), e
o laudo/Estatísticas usam o denominador certo. Sem protocolo declarado nada
muda — o comportamento de hoje é o caso `simples`.

*Prova:* a porcentagem de germinação de 400 objetos com 80 `vazia` é sobre 320;
com protocolo `simples`, é sobre 400.

### Fatia 3 — marcar direto na classe do protocolo

**As cinco vozes, antes de desenhar** (AGENTS.md):

- *Analista de laboratório comercial:* "faço 400 numa sentada; quero uma tecla
  por classe, a mesma todo dia, e nada de abrir menu."
- *Pesquisador de orquídea:* "eu só uso viável e inviável — não quero seis
  botões na minha barra."
- *Pesquisador de forrageira:* "preciso das seis o dia inteiro, e preciso ver
  na tela qual eu marquei."
- *Aluno em treinamento:* "não sei o que é 'anormal'; preciso do nome e da
  explicação junto do botão."
- *Apresentação:* "a barra não pode virar sopa de ícones."

**A regra que sai daí:** os botões de classe **só aparecem com protocolo
declarado e diferente de `simples`**. Quem usa orquídea nunca os vê; quem usa
forrageira os vê sempre. O que o modo esconde também não custa (Lei 8).

**V e I não mudam de sentido.** Continuam marcando viável/inviável *sem* classe
fina — é o gesto rápido de sempre, e refinar depois na galeria continua valendo.
As classes finas têm teclas próprias: **3 a 8, na ordem do protocolo**, porque a
tecla é a POSIÇÃO na lista que a norma já publica, e porque 1 e 2 são modos de
exibição desde a primeira versão (memória de quem já usa não se quebra por
simetria). O menu radial (botão direito + arraste) continua sendo o caminho sem
tecla, e já oferece exatamente as seis raízes.

**Como a marca nasce.** Marcar na classe `c` cria `{ type: categoriaDaClasse(c),
subclasse: c }` — `categoriaDaClasse` vem de `germinou`, para não existir uma
segunda tabela dizendo o que é viável. `activeTool` continua sendo
`viable`/`inviable`: o canvas não aprende classe nenhuma, e a onda por clique
herda a classe ativa de graça.

**Ícone por classe, com mnemônica** (e é o vocabulário de formas que a fatia 3b
leva para o canvas): normal → círculo; anormal → triângulo; dura → losango
(*diamante é duro*); dormente → lua; morta → ×; vazia → círculo cortado.

**Fica para a 3b:** a marca DESENHADA por classe. Hoje ela sai ciano (germinou)
ou magenta (não germinou), igual para dormente e morta. A forma virá da RAIZ
normativa e a cor poderá ser do usuário — o que torna a fatia 5 coerente: uma
classe inventada herda a forma da raiz de que descende.

### Fatia 4 — aglomerado como marcador

`YoloSegmentation.sementesNoContorno?: number` (padrão 1). O gesto marca "2",
"3"…; `contarObjetos` soma; o CSV ganha `sementes_no_contorno` e as colunas
morfométricas daquele objeto saem **vazias** (a medida de um aglomerado não é
medida de semente). Conversa com o corte por concavidade, que já existe.

### Fatia 5 — classes definidas por quem usa

`ClasseDoUsuario { chave, rotulo, raiz: ClasseDeSemente, cor, forma }`, guardada
por perfil/espécie. A criação pergunta a raiz (D2). A taxonomia passa a aceitar
filhos vindos daí, e `caminhoValido` valida contra a árvore montada. `classeExterna`
(nome cru vindo de dataset de terceiros) continua sendo a saída de emergência
para o que não se quis classificar.

## Riscos e o que não se faz

- **Não** se inventa correspondência entre nome externo e classe da norma:
  `categoriaDoNome` devolve `null` e o nome cru fica em `classeExterna`.
- **Não** se muda o formato de sessão gravada sem migração: `subclasse` já
  existe no `Mark`; as fatias 4 e 5 acrescentam campos opcionais.
- A fatia 2 muda um número que sai em laudo. Precisa de linha nas notas de
  versão dizendo **quando** o denominador muda (só com protocolo declarado).

## Pendência conhecida

`handleClassificarRadial` faz `chave as ClasseDeSemente` sem guarda. Hoje é
seguro (o menu só oferece as seis raízes), mas a fatia 5 acrescenta filhos ao
menu — a guarda entra junto com ela.
