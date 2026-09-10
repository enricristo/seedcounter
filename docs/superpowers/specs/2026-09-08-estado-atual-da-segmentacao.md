# Estado atual da segmentação — medição e auditoria

> Documento de base. Não propõe solução: mede o que temos e mapeia as peças que
> existem, para que o desenho que vier depois seja dirigido por número e não por
> impressão.

Data: 2026-09-08 · GPEOrq / GPSEM — Unoeste

---

## 1. Linha de base, medida

Trinta sementes por cena, clicando no **centro verdadeiro** de cada uma — ou
seja, na condição mais favorável possível. Verdade conhecida porque as cenas
são desenhadas (`lib/synthetic-scene.ts`).

| cena | n | contorno confiável | erro mediano de área | erro > 30% | engoliu vizinha (> 1,6×) |
|---|---:|---:|---:|---:|---:|
| soja | 12 | 12 | **+0,6 %** | 0 | 0 |
| orquídea-tz | 30 | 30 | **−72,2 %** | 20 | 2 |
| forrageira | 30 | 28 | **+19,1 %** | 11 | **9 (30 %)** |

### 1.1 O que estes números dizem

**A soja está resolvida.** Semente grande, redonda, separada, sobre fundo
uniforme: +0,6 % de erro mediano é melhor do que a variação entre operadores
humanos. Não há problema a atacar aqui.

**A orquídea erra por motivo conhecido e diagnosticado.** O −72,2 % é a onda
segmentando o **embrião** em vez da semente. O embrião ocupa 28 % da elipse por
construção, e o erro previsto de pegar só ele é −72 % — bateu com o medido. Não
é defeito de algoritmo: é o clique escolhendo qual estrutura medir, sem que o
sistema saiba dizer qual foi.

**A forrageira mostra o problema das encostadas.** Nove de trinta contornos
engoliram a vizinha. A onda não tem como saber onde uma semente termina e a
outra começa, porque as duas têm a mesma cor: o critério dela é semelhança com
o pixel clicado, e a vizinha é igualmente semelhante.

### 1.2 O achado mais importante

Em **30 de 30** casos de orquídea e **28 de 30** de forrageira, a onda se
declarou **confiante** (`tocouBorda: false`).

Ela está *confiantemente errada*. A medida de confiança atual responde "a onda
escapou da janela?", que é uma pergunta sobre o processo. Não responde "a onda
pegou a coisa certa?", que é a pergunta sobre o resultado.

Isso é pior que errar: um contorno errado marcado como duvidoso é um convite à
conferência; um contorno errado marcado como bom vira área e comprimento no CSV
sem que ninguém olhe. **Qualquer desenho novo tem que atacar isto junto com a
segmentação, não depois.**

---

## 2. As peças que já existem

Levantamento do que é reaproveitável, para não reimplementar.

### 2.1 `lib/detect.ts` (671 linhas) — visão computacional clássica

| Peça | O que faz | Reaproveitável? |
|---|---|---|
| `otsuThreshold` | Limiar global por histograma | Sim |
| Limiar adaptativo | Janela local com imagem integral | Sim |
| `subtractBackground` | Estimativa de fundo por raio, para iluminação desigual | Sim |
| `distanceTransform` | Chanfro 3-4 | **Sim — é a base do watershed** |
| Máximos locais | Já filtra máximos espúrios por raio | Sim |
| Componentes conexos | Com estatísticas de caixa e área | Sim |
| `morph` / `cleanup` | Erosão, dilatação, remoção de ruído | Sim |

**A limitação:** tudo isso roda **global e em escala reduzida**
(`maxProcessingSize`), e produz apenas *centros* para contagem —
`DetectedObject` tem `x`, `y`, `area`, `raio`, `bbox`, mas **não tem máscara nem
contorno por instância**. Para morfometria por semente isso não serve.

Ou seja: a lógica de separar aglomerado por distância **já foi escrita uma vez**,
mas para outro produto final.

### 2.2 `lib/region-growing.ts` — a onda

Local, resolução plena, uma instância por clique. Produz máscara e contorno.
Critério: componente conexo do clique dentro do conjunto de pixels com ΔE menor
que uma tolerância, escolhida pelo ponto de fuga com recuo de 10 %.

**A limitação estrutural:** o critério é *semelhança com o pixel clicado*. Não
existe noção de fundo, e portanto não existe noção de "onde o objeto acaba"
independente de "onde a cor muda". Numa semente encostada em outra da mesma
cor, não há informação no critério que permita separar.

### 2.3 `lib/yolo-onnx.ts` — o modelo

Entrega instância de verdade (máscara → polígono), mas depende de espécie:
treinado em orquídea, duas classes. Não serve para soja nem forrageira sem
retreino.

---

## 3. A leitura estrutural

Os três caminhos existentes falham por razões diferentes e complementares:

| | escopo | resolução | saída | sabe o que é fundo? | depende de espécie? |
|---|---|---|---|---|---|
| `detect.ts` | global | reduzida | centros | **sim** | não |
| onda | local | plena | contorno | **não** | não |
| YOLO | global | plena | contorno | implícito | **sim** |

A lacuna é exatamente a interseção que falta: **local, resolução plena, com
contorno, ciente do fundo e independente de espécie.**

E o `detect.ts` prova que a parte "ciente do fundo" já foi resolvida neste
repositório — só que no escopo errado e produzindo o artefato errado.

---

## 4. O que este documento NÃO decide

Deliberadamente. A escolha de técnica depende do levantamento de literatura em
andamento, e decidir antes seria escolher pela primeira ideia em vez de pela
melhor. Ficam registradas as perguntas que o desenho terá de responder:

1. Como estimar o fundo de forma robusta a sombra projetada e a iluminação
   desigual, nas três modalidades.
2. Como separar instâncias dentro de um aglomerado — e como evitar a
   sobre-segmentação, que é o defeito clássico do watershed.
3. **Como medir confiança de forma que detecte o erro que hoje passa como
   acerto.** Sem isto, melhorar a média não ajuda: continua entrando número
   errado sem aviso.
4. Como o clique escolhe entre estruturas aninhadas (embrião dentro da semente)
   e como o sistema DIZ qual escolheu.
5. Quais parâmetros expor e com quais predefinições por alvo.
