# Plano de ação — fases a partir de 21/09/2026

> Documento de orientação, não de execução passo a passo. Cada fase vira um
> plano próprio (`writing-plans`) quando entra em execução. O que está aqui é
> a ordem, o porquê da ordem, e o critério de pronto de cada uma.

## Onde estamos

| Branch | O quê | Estado |
|---|---|---|
| `main` | 3.5.0 em produção | — |
| `develop` | **3.6.0** — pronto para a bancada (PR #40 → main) | CI verde; é a `-teste` que o Enrico usa para gravar |
| `feature/enterprise-polish` | Enterprise verificado + modos de visualização (PR #42 → develop) | 1147 testes; candidato a 3.7.0 |

**A primeira usuária real** (doutorado, tetrazólio em 10 *Cattleya*) mede na
semana de 22/09 com a 3.6.0. **Tudo que entra depois disso tem que passar pela
pergunta: ajuda a análise dela a virar dado publicável, ou é só feature?**

## A lição que se repetiu três vezes nesta semana

Contagem, CSV, canvas e inspetor liam de lugares diferentes (18/09). A
exportação de imagem contava por conta própria e dava 2 onde o CSV dava 1
(21/09). A fila com IA lia a classe do modelo pelo índice errado e mandava
tudo para inviável (21/09). **Três defeitos, uma causa: mais de uma fonte para
a mesma verdade.** A Fase 1 existe para fechar isso de vez, com um teste que
impede de reabrir.

---

## Fase 1 — Uma fonte para cada verdade (esta rodada)

**Objetivo:** nenhum componente conta, classifica ou enumera objetos por conta
própria. `enumerarObjetos` / `contarObjetos` são a única enumeração;
`classeDoModelo` é a única tradução de classe do YOLO; `buildMeasurements` é
a única medida.

**Critério de pronto:** um teste estático em `src/__tests__/` que varre
`components/` e `features/` e reprova `marks.length`, `.filter(m => m.type ===`,
`classId === 1`, `class_name === 'inviavel'` e afins fora dos módulos
canônicos. O teste é o que impede a quarta ocorrência.

**Inclui:** o `seg.class === 1` do importador de JSON antigo (App.tsx ~1146),
que ficou de fora do #42 por falta de esquema — resolver descobrindo o esquema
(os JSONs vêm do exportador YOLO do próprio app; `yolo-exporter.ts` diz o que
escreve).

## Fase 2 — O gesto de carregar uma amostra (esta rodada)

**Objetivo:** ao abrir uma imagem com a bancada ocupada, perguntar **"adicionar
à fila ou substituir?"** — e, junto, propor se é o **mesmo experimento** (mesmo
projeto/tratamento da cena atual → só muda a repetição) ou **outro tratamento**
(mesmo projeto, tratamento novo), preenchendo a identificação a partir do que
já está lá + o que o nome do arquivo sugere (`sugestoes-do-arquivo`).

**Por quê:** é o gesto que a pessoa faz 30 vezes por sessão; cada pergunta
respondida aqui é um metadado que não fica vazio no CSV. E é onde o "mesmo
experimento" do `LongitudinalView` começa a se preencher sozinho.

**Critério de pronto:** o diálogo aparece só quando há cena ocupada; "adicionar
à fila" não descarta nada; "substituir" pede confirmação se houver marcação não
salva; a sugestão de experimento/tratamento vem com a origem visível; nada é
preenchido sem clique.

## Fase 3 — Germinator dentro do app (esta rodada: o núcleo; a próxima: a tela)

**Objetivo:** o módulo de curve-fitting do Germinator (Joosen et al. 2010) em
TypeScript puro: ajuste de Hill de 4 parâmetros, e os parâmetros que a
planilha da Ceci extrai — gMAX, t50, U(b−a), r², t-x do máximo e do total,
AUC, MGT, skewness — mais os índices de dormência e de estresse por diferença
de AUC.

**Oráculo:** `seedcounter_git/germinator_/Germinator_curve-fitting Llanero agua
mat.xls`, aba `output`. Cada parâmetro tem que bater com a planilha dentro da
tolerância do Solver. **Nada entra sem bater.**

**Depois (Fase 3b):** eixo do tempo em horas no longitudinal; a tela de curvas;
t de Student / Tukey entre tratamentos; exportar no formato de `INPUT` da
planilha, para quem ainda usa o Excel.

## Fase 4 — Funcionalidades ligáveis e carregamento sob demanda (esta rodada)

**Objetivo:** o que o modo de visualização esconde também **não custa**: o
modo "contagem" não roda o ensaio ao carregar; `recharts` e o `AnalyticsModal`
só baixam quando alguém abre; o Analytics não extrai cor até abrir. E os
atalhos de teclado conferidos um a um contra o que a ajuda promete.

**Critério de pronto:** `npm run build` mostra `recharts` num chunk separado
que a página inicial não carrega; teste estático confere que toda tecla listada
na ajuda tem um manipulador e vice-versa.

## Fase 5 — Barra de menu (próxima rodada)

Arquivo / Editar / Exibir / Ferramentas / Ajuda, em cima do que a Fase 4
deixou. "Exibir" já existe como botão; vira o segundo menu. Só depois de os
modos terem sido usados por alguém que não seja quem os escreveu.

## Fase 6 — Backend e conta (bloqueada)

Fechar os quatro furos da revisão de 18/09 (`/telemetry/session` sem auth,
mock-upload sem teto, `TESTING` padrão, `ADMIN_EMAILS` vazio) e trocar o SQLite
efêmero por Postgres. **Só então** sessões na nuvem. Bloqueada por hospedagem
com disco, que é decisão de conta, não de código.

## O que NÃO entra em nenhuma fase agora, com motivo

- Retreinar o YOLO: só depois de a Mayara produzir anotações curadas — é o
  material de treino, e não existe ainda.
- Ads e domínio: decidido em 18/09 (`estrategia-laboratorio-custos-e-canal`).
- Trocar o nome (SeedCounter existe desde 2017): decisão do Enrico, não de
  código; precede gastar com identidade.
