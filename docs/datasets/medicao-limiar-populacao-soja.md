# Medição: limiar da população na soja indonésia

Task A0 do `docs/superpowers/plans/2026-09-13-degrau-2-lote-a.md`. A Task 4
do Degrau 1 mediu o falso alarme de `limiaresDaPopulacao` (`src/lib/aglomerado.ts`)
só na orquídea. O critério de pronto dizia *orquídea e soja*; esta medição
fecha a soja.

## Dados

**Conjunto:** `datasets/Image Dataset of Local Indonesian Soybean Seed Var/`
(Mendeley `c733bjz4m3`, três variedades — Anjasmoro, Dega I, Grobogan).
`Segmented_*_Seed/seed/*.png` é RGBA com o canal alfa como máscara de
instância — 3493 + 4490 + 4700 = 12.683 sementes, sobre 30 + 45 + 47 = 122
digitalizações reais (contagem de `Scanned_*/`).

**Por que a acusação é diretamente o falso alarme:** neste conjunto as
sementes foram dispostas em grade à mão e **nunca se tocam** — cada PNG é uma
semente sadia isolada. Toda vez que um limiar marca "aglomerado" aqui, é
erro, sem ambiguidade (ver `docs/datasets/README.md` §2.1).

## Amostra

20 digitalizações, `seed 42`, balanceadas entre as 3 variedades: 7
(Anjasmoro) + 7 (Dega) + 6 (Grobogan).

**Desvio do plano, documentado:** o plano supunha que "o nome do arquivo
carrega o índice da digitalização". Não carrega — os PNG são numerados
sequencialmente por variedade (`Anjasmoro_seed_0001.png`, `0002`, ...) sem
nenhum campo de origem, e não há metadado (EXIF, CSV, texto embutido no PNG)
que amarre instância a digitalização. A única informação real disponível é a
**contagem** de digitalizações por variedade (pastas `Scanned_*`: 30/45/47).
Para obter uma "população da própria digitalização" sem essa amarração,
cada variedade foi particionada em N blocos contíguos (N = contagem real de
digitalizações daquela variedade), na ordem do índice do arquivo, com
tamanhos o mais igual possível — blocos de 116–117 (Anjasmoro), 99–100
(Dega), 100 (Grobogan). Isso pressupõe que o pipeline de extração processou
as digitalizações em ordem e concatenou as sementes; as sementes "dispostas
em grade à mão" tornam plausível que os tamanhos de bloco resultantes
fiquem parecidos com grades reais, mas a suposição **não foi verificada**.
Se estiver errada, o efeito mais provável é misturar sementes de duas
digitalizações vizinhas da mesma variedade num "bloco" — o que só
acrescentaria variância *dentro* do bloco, empurrando o limiar da população
para o lado mais permissivo (mais MAD), nunca para o lado que favoreceria
esta decisão. Não afeta o limiar absoluto, que não depende de agrupamento.

**Ambiente sem OpenCV:** o contorno externo de cada máscara alfa foi extraído
por um traçado de borda próprio (Moore-neighbor tracing, 8-conectado, sem
`cv2`/`skimage` — nenhum dos dois está instalado neste ambiente). Validado
antes de rodar no conjunto real contra um quadrado sintético (solidez 1,000)
e um círculo sintético (solidez 0,984, profundidade relativa 0,025) — ambos
dentro do esperado para essas formas.

## Método (espelha `src/lib/aglomerado.ts`)

- Área pelo cadarço (shoelace); fecho convexo pela cadeia monótona de
  Andrew; maior defeito de convexidade restrito ao arco correspondente do
  contorno (não ao contorno inteiro) — mesma geometria do script da Task 4.
- `limiaresDaPopulacao`: mediana + `K·MAD` sobre a própria digitalização,
  `K_DA_POPULACAO = 3,5`, pisos `MAD_MINIMO_SOLIDEZ = 0,01` e
  `MAD_MINIMO_PROFUNDIDADE = 0,02` — conferido linha a linha contra
  `aglomerado.ts`, sem divergência.
- A regra de acusação usa só solidez e profundidade (não razão de área) —
  mesma simplificação do checkpoint da orquídea (Task 4), que também não
  calculou uma referência de área separada; as duas medições ficam
  comparáveis entre si por usarem exatamente os mesmos dois sinais.

## Resultado — soja (20 digitalizações, 2.114 sementes avaliáveis)

| limiar | falso alarme mediano | falso alarme médio |
|---|---|---|
| absoluto (`PADROES`: solidez 0,92 / profundidade 0,15) | 0,0% | 0,0% |
| **população (`limiaresDaPopulacao` da própria digitalização)** | **0,0%** | **0,0%** |
| irregular (`LIMIARES_DE_CONTORNO_IRREGULAR`, só registro — preset de orquídea) | 0,0% | 0,0% |

Zero sementes acusadas em qualquer um dos três limiares, em qualquer uma das
20 digitalizações — não é arredondamento (1 semente em 100 já daria 1,0%).

**Distribuição de solidez** (2.114 sementes, as 20 digitalizações):

| percentil | solidez |
|---|---|
| p5 | 0,990 |
| p50 | 0,992 |
| p95 | 0,994 |

É por isso que o resultado é zero para os três limiares: o limiar da
população por digitalização veio em ~0,956–0,958 (mediana ≈0,992 menos
3,5×0,01 — o piso do MAD domina porque a população de uma digitalização é
extremamente homogênea), e mesmo esse limiar mais apertado que o absoluto
(0,92) fica **abaixo** do p5 observado (0,990). A profundidade relativa
segue o mesmo padrão: o limiar da população ficou em ~0,090–0,096, mais
apertado que o absoluto (0,15), e ainda assim nenhuma semente o ultrapassou.
Semente de soja lisa e convexa, digitalizada sem sujeira nem sombra dura,
não dá margem para nenhum dos dois sinais reagirem.

## Resultado — orquídea (copiado de `2026-09-13-degrau-1-progress.md`, Task 4)

Checkpoint da Task 4: 20 imagens amostradas (`seed 42`), 14 com os ≥8
contornos exigidos por `limiaresDaPopulacao`, sobre
`datasets/Sementes de Orquideas/train/labels` (YOLO, polígonos anotados,
3.530 contornos isolados no total).

| limiar | falso alarme mediano | falso alarme médio |
|---|---|---|
| absoluto `profundidadeMaxima` 0,15 (`PADROES`) | 78,0% | — |
| absoluto `solidezMinima` 0,92 (`PADROES`) | 40,1% | — |
| **população (`limiaresDaPopulacao` da própria imagem)** | **13,2%** | **10,8%** |
| `LIMIARES_DE_CONTORNO_IRREGULAR` (calibrado especificamente para este conjunto) | 5,8% / 8,4% | — |

(A tabela de `PADROES` na orquídea foi reportada por sinal separado no
checkpoint original, não como fração combinada por imagem; os dois números
absolutos acima bastam para comparar ordem de grandeza com a população.)

## Tabela lado a lado

| limiar | soja — mediano | soja — médio | orquídea — mediano | orquídea — médio |
|---|---|---|---|---|
| absoluto (`PADROES`) | 0,0% | 0,0% | 78,0%* | — |
| população (`limiaresDaPopulacao`) | 0,0% | 0,0% | 13,2% | 10,8% |
| irregular (`LIMIARES_DE_CONTORNO_IRREGULAR`) | 0,0% | 0,0% | 5,8%* | — |

\* `PADROES` e `LIMIARES_DE_CONTORNO_IRREGULAR` na orquídea foram medidos
por sinal (profundidade OU solidez) separadamente no checkpoint da Task 4,
não como uma única fração combinada por imagem como aqui; o número mais
alto (`profundidadeMaxima`, 78,0%) é o citado para deixar a comparação
conservadora — o ponto qualitativo (absoluto reprova em massa a orquídea
sadia) não muda com qualquer um dos dois números daquele checkpoint.

## Decisão

**Regra de decisão do plano, copiada literalmente:**

> - Se população ≤ absoluto na soja **e** população ≪ absoluto na orquídea
>   (já medido): *"população é o default para toda forma; presets absolutos
>   viram referência"*. Nada muda no código.
> - Se população > absoluto na soja por até 3 pontos percentuais: *"empate
>   no caso fácil; população segue default pela generalidade"*. Nada muda.
> - Se população > absoluto na soja por mais de 3 pp: *"default por forma:
>   redonda usa absoluto, alongada/irregular usa população; população é
>   fallback para forma desconhecida"* — e abra uma tarefa (não implemente
>   aqui) para `App.tsx` escolher `limiares` por forma.

**Números:** na soja, população = 0,0% e absoluto = 0,0% — população ≤
absoluto (empatados, a condição "≤" vale). Na orquídea (já medido, Task 4),
população = 13,2% (mediana) contra absoluto = 78,0% (`profundidadeMaxima`)
ou 40,1% (`solidezMinima`) — população é de 3× a 6× menor, o que satisfaz
"≪" por qualquer leitura razoável do termo.

**Ramo aplicado: o primeiro.** *"População é o default para toda forma;
presets absolutos viram referência."* Nada muda no código —
`limiaresDaPopulacao` continua podendo ser o limiar padrão tanto para forma
redonda (soja: empate no caso fácil, sem custo) quanto para forma irregular
(orquídea: melhora grande sobre o absoluto). `PADROES` e
`LIMIARES_DE_CONTORNO_IRREGULAR` seguem existindo como referência/registro,
não como default.
