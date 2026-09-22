# Pré-definições por perfil — design

Data: 2026-09-22 · Setor B (produto) · Estado: **aprovado para implementação**
(os cinco perfis foram confirmados pelo dono em 22/09).

## O problema

O SeedCounter tem hoje 36 funcionalidades em 34 pastas de `features/`. Quem
abre pela primeira vez vê tudo ao mesmo tempo: quatro bancadas, ensaio ao
carregar, analytics, fila com IA, morfometria, volumes, Germinator. Para um
analista que só quer contar 40 placas por dia, isso é ruído; para um aluno em
treinamento, é medo. O modo de visualização (22/09) resolveu **o que se vê**;
falta resolver **para quem** — e com isso o que vem preenchido, qual receita
roda, qual protocolo se aplica, e como a marca é desenhada.

Uma pré-definição é a resposta de uma vez a cinco perguntas que hoje são
feitas separadamente, em cinco painéis.

## O que uma pré-definição é

Um **conjunto nomeado de escolhas**, todas já existentes no app, escolhido
uma vez e alterável depois campo a campo:

| Escolha | Onde já existe | Chave |
|---|---|---|
| Modo de visualização + sobrescritas | `features/visualizacao/` | `sc:modo-de-visualizacao`, `sc:visibilidade` |
| Estilo e opacidade da marca | `theme/specimen.ts` | `sc:estiloDaMarca`, `sc:opacidadeDaMarca` |
| Receita de detecção padrão | `features/ensaio/receitas.ts` | (nova) `sc:receitaPadrao` |
| Protocolo da amostra | `Metadata.protocolo` (`simples` / `germinacao` / `forrageira`) | (nova) `sc:protocoloPadrao` |
| Espécie de costume | `features/conta/conta.ts` (`PreferenciaDeBancada`) | via conta, ou (nova) `sc:especiePadrao` |
| DPI de costume | `DEFAULT_LAB_DPI` / `PreferenciaDeBancada.umPerPixel` | idem |
| Modo do cronômetro | `hooks/useCronometro.ts` | (nova) `sc:modoDeAnalisePadrao` |
| Sugestões e som | `settings/preferencias.ts` | `sc:sugestoes`, `sc:som` |

**Regra:** a pré-definição **escreve preferências**, não cria um sistema
paralelo. Escolher um perfil é o mesmo que abrir cinco painéis e marcar
opções — só que de uma vez. Por isso trocar uma opção depois **não** "sai do
perfil": o perfil é um ponto de partida, nunca um estado.

## Os cinco perfis, e o que cada voz pediu

### 1. Analista de laboratório comercial

> "Quarenta placas por dia. Quero contar, laudar e ir para a próxima. Não me
> mostre morfometria, volumes, analytics nem bancada dupla. Se a norma diz que
> um número não pode sair, o app tem que me barrar, não a supervisora."

| Escolha | Valor |
|---|---|
| Modo | `laudo` + esconder `morfometria`, `germinacao`, analytics; mostrar fila e exportação |
| Marca | `disco`, 100 % |
| Receita | a da espécie declarada; sem ensaio ao carregar |
| Protocolo | `germinacao` (Cap. 4 da RAS), tolerâncias ligadas |
| Cronômetro | `assistida` |
| Sugestões | ligadas (o nome do arquivo é o lote) |

### 2. Pesquisador de orquídea

> "Mil sementes por imagem, encostadas, num TIFF de dez páginas. Preciso ver
> a semente por baixo da marca, medir centenas e digitar o embrião. E cada
> número tem que sair dizendo de onde veio, porque vai para a banca."

| Escolha | Valor |
|---|---|
| Modo | `completo` |
| Marca | `anel`, 60 % |
| Receita | `orquidea` (a de semente pequena e densa); ensaio ao carregar ligado |
| Protocolo | `simples` (orquídea está fora da RAS; o método é o do grupo) |
| Cronômetro | `manual` (o braço de validação começa por aí) |
| DPI de costume | 4800 (o medido no scanner do laboratório) |

### 3. Pesquisador de forrageira

> "Espigueta cheia ou vazia, dormente ou morta — a dicotomia viável/inviável
> não me serve. Meu eixo de tempo é mês de armazenamento. E eu uso o
> Germinator toda semana."

| Escolha | Valor |
|---|---|
| Modo | `completo` + `germinacao` visível |
| Marca | `disco`, 100 % |
| Receita | a da espécie (*Urochloa*), com `splitTouching` |
| Protocolo | `forrageira` (classes: dormente, dura, morta, vazia; vazia sai do denominador) |
| Cronômetro | `assistida` |

### 4. Aluno em treinamento

> "Não sei o que é Feret. Quero marcar, contar e ver o número — e que o app
> me diga o que fazer em seguida. Se eu errar, quero desfazer."

| Escolha | Valor |
|---|---|
| Modo | `contagem` (só canvas, marcar, contar; sem ensaio, sem IA) |
| Marca | `disco`, 100 %, tamanho 1,3× |
| Receita | nenhuma automática |
| Protocolo | `simples` |
| Cronômetro | `manual` — o tempo dele é o dado do treinamento |
| Ajuda | painel de ajuda aberto na primeira vez; dicas em `title` em tudo |

### 5. Apresentação

Já existe (`?modo=apresentacao`). A pré-definição só o nomeia no cartão e
**não grava preferência** — a mesma regra do link: apresentação não gruda na
máquina.

## A tela

**Primeira abertura** (nenhuma preferência gravada): uma tela única, antes do
canvas, com **cinco cartões** — título, uma frase na voz do perfil (as citações
acima, encurtadas), três ícones do que fica visível — e o rodapé "Posso mudar
depois em Configurações". Escolher um cartão grava as preferências e abre o
app. Fechar sem escolher = `completo`, sem gravar nada (para não fazer a
pergunta de novo, grava `sc:perfil = 'nenhum'`).

**Depois:** em Configurações, uma seção "Perfil" com os mesmos cinco cartões
e o atual marcado. Trocar reaplica as preferências do perfil — e **diz o que
vai mudar antes de mudar**, com a lista das chaves que serão sobrescritas (a
pessoa pode ter ajustado a opacidade da marca à mão; o perfil novo vai por
cima, e isso precisa ser dito).

**No cabeçalho:** o nome do perfil aparece ao lado do modo, no menu "Exibir",
como origem do modo atual ("Contagem · perfil Aluno").

## O que NÃO entra

- Perfis criados pelo usuário. Cinco cobrem quem existe hoje; perfil
  customizado é o que o menu "Exibir" já faz campo a campo.
- Sincronizar perfil pela conta. A conta sincroniza `PreferenciaDeBancada`;
  o perfil é a chave `sc:perfil` local. Quando a conta guardar mais, o perfil
  vai junto — mas não nesta rodada.
- Reorganizar painéis por perfil. Perfil escolhe o que se vê, não onde fica.

## Implementação (para o `writing-plans`)

- `src/features/perfis/perfis.ts` — puro: `Perfil`, `PERFIS` (os cinco),
  `preferenciasDoPerfil(perfil): Record<chave, valor>`, `lerPerfilAtual()`,
  `aplicarPerfil(perfil)` (grava cada chave via `preferencias.ts` e o modo via
  `useModoDeVisualizacao`), `oQueMuda(perfilAtual, perfilNovo)` (diff de
  chaves, para a tela dizer). Testes: cada perfil produz um conjunto completo
  e coerente; `apresentacao` não grava; `oQueMuda` lista só o que difere.
- `src/features/perfis/TelaDePerfil.tsx` — os cinco cartões; usada na primeira
  abertura (montada em `App.tsx` antes do canvas, condicionada a
  `sc:perfil === undefined`) e em Configurações.
- `features/visualizacao/MenuExibir.tsx` — mostra a origem ("perfil X").
- Consumidores das chaves novas: `App.tsx` lê `sc:receitaPadrao` e
  `sc:modoDeAnalisePadrao`; `useMetadata` lê `sc:protocoloPadrao` ao criar
  metadado novo.

## Critério de pronto

Alguém que nunca viu o app escolhe "Aluno em treinamento" e, sem abrir nenhum
painel, marca dez sementes, vê o contador e o cronômetro em `manual`, e
exporta o CSV com `modo_analise = manual`. Alguém que escolhe "Analista
comercial" abre uma imagem e **não** vê o ensaio ao carregar rodar.
