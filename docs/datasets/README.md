# Catálogo de conjuntos de imagens

Registro dos conjuntos de imagens de semente disponíveis ou candidatos, com o
que cada um serve para responder — e o que **não** serve.

> **Por que um catálogo e não os arquivos.** Os conjuntos somam dezenas de
> gigabytes e têm licenças diferentes; versionar imagem de terceiro num
> repositório público é problema de licença e de tamanho ao mesmo tempo. O que
> fica aqui é a procedência, o que o conjunto contém, e para que ele serve na
> validação. As imagens ficam fora do repositório, na máquina do laboratório.

Convenção de pasta local (fora do controle de versão):

```
seedcounter_git/
├─ seedcounter/            ← o repositório
└─ datasets/               ← imagens, NÃO versionadas
   ├─ soja-indonesia/
   ├─ orquidea-gpeorq/
   └─ roboflow/
```

---

## 1. O que cada conjunto responde

A pergunta antes do conjunto. Um conjunto sem pergunta é arquivo ocupando disco.

| Pergunta | Precisa de | Temos? |
|---|---|---|
| O contorno está no lugar certo? | Máscara de referência por semente | **Sim** — soja indonésia |
| A contagem bate com a do analista? | Contagem humana por imagem | Parcial — orquídea do grupo |
| Separa sementes encostadas? | Imagens com aglomerado **e** máscara por instância | **Não** — é a lacuna |
| A morfometria bate com o paquímetro? | Medição manual pareada | **Não** — aguarda dados |
| O tetrazólio é lido corretamente? | Imagens coradas com leitura de referência | **Não** — só o boletim publicado |
| Generaliza para outras culturas? | Espécies fora de orquídea/soja | Candidatos abaixo |

---

## 2. Disponível e verificado

### 2.1 Soja indonésia — máscara de referência por instância

**Local:** `seedcounter_git/Image Dataset of Local Indonesian Soybean Seed Var/`
**Origem:** https://data.mendeley.com/datasets/c733bjz4m3/3
**Licença:** verificar na página do Mendeley antes de redistribuir.

Três variedades (Anjasmoro, Dega I, Grobogan), **119 digitalizações** e
**12.683 sementes segmentadas individualmente** (3.493 + 4.490 + 4.700).

O que o torna valioso: os PNG em `Segmented_*/seed` são **RGBA e o canal alfa é
a máscara de instância** — não é recorte retangular. Dá para medir IoU semente
a semente.

Imagens 6800×9359 (~800–950 dpi), semente creme sobre bandeja cinza, sombra
suave sob cada uma. Separação forte no b\* e na luminância.

**Limite que precisa ser dito:** as sementes **nunca se tocam** — foram
dispostas em grade à mão. Valida segmentação e morfometria; **não** valida
separação de encostadas, que é exatamente onde orquídea e forrageira doem.

### 2.2 Orquídea — GPEOrq / GPSEM

Digitalizações de trabalhos do grupo, mais o material do doutorado do Prof.
Nelson (com contagem, pesagem de 100 sementes e anotações já feitas).

Não tem máscara de referência: a referência é anotação humana, que é mais fraca
e precisa ser declarada como tal. Em compensação é o **único** material com
tetrazólio real e com sementes encostadas de verdade.

### 2.3 Cenas geradas por código

`src/lib/synthetic-scene.ts`. Verdade perfeita por construção — posição, área e
classe de cada semente. Três modalidades: soja separada, orquídea com
tetrazólio e sementes encostadas, forrageira com espigueta vazia.

**O que valida:** o erro do algoritmo contra verdade exata, sem intermediário.
**O que não valida:** nada sobre imagem real. Cena desenhada não tem a
variabilidade de uma digitalização — foi assim que dois critérios de tolerância
passaram no sintético e falharam na soja real.

---

## 3. Conjuntos externos baixados e disponíveis na pasta `datasets/`

Os conjuntos abaixo foram baixados e organizados na pasta `datasets/` para treinamento de modelos de detecção, segmentação e classificação de qualidade:

| Conjunto | Cultura / Alvo | Formato / Anotação | Quantidade | Origem & Licença |
|---|---|---|---|---|
| `lucasiturriago-seeds` | Sementes em geral | Máscaras binárias semânticas (512×512) | 2.807 imagens (5.614 máscaras) | [Kaggle](https://www.kaggle.com/datasets/lucasiturriago/seeds) (CC BY-SA 4.0) |
| `seed detect.v3i.yolov8` | Semente de trigo | YOLOv8 Bounding Boxes (`.txt` + `data.yaml`) | 113 imagens | [Roboflow Universe](https://universe.roboflow.com/kyoung-do-min/seed-detect-nmxet) (CC BY 4.0) |
| `wheat quality detection.v2i.multiclass` | Trigo (qualidade/sanidade) | CSV multiclasse (*bad seed*, *healthy seed*, *impurity*) | 7.217 imagens | [Roboflow Universe](https://universe.roboflow.com/first-pijnk/wheat-quality-detection) (Public Domain) |
| `wheat seed classification.v2i.multiclass` | Trigo (classificação) | CSV multiclasse (*bad seed*, *healthy seed*, *impurity*) | 538 imagens | [Roboflow Universe](https://universe.roboflow.com/bcd-hhv9y/wheat-seed-classification) (CC BY 4.0) |
| `rice.v1i.multiclass` | Arroz, impurezas e pragas | CSV multiclasse (12 classes: grãos, cascas, *Sitophilus*, daninhas) | 591 imagens | [Roboflow Universe](https://universe.roboflow.com/test-rzp49/rice-te3lx) (CC BY 4.0) |
| `peanuts.v2-release.multiclass` | Amendoim (sanidade) | CSV multiclasse (*with mold*, *without mold*) | 387 imagens | [Roboflow 100](https://universe.roboflow.com/roboflow-100/peanuts-sd4kf) (CC BY 4.0) |

Consulte o guia completo em [`datasets/README.md`](../../../datasets/README.md) para detalhes de pipeline de treino e métricas.

### 3.1 O que conferir em cada um antes de usar

Um conjunto do Roboflow não é automaticamente utilizável. Ordem de conferência:

1. **Licença.** Roboflow Universe tem de CC0 a proprietário. Sem licença clara,
   não entra em validação publicável.
2. **Tipo de anotação.** Caixa delimitadora resolve contagem, **não** resolve
   morfometria nem separação de encostadas. Só polígono/máscara serve para
   contorno. A maioria dos conjuntos de detecção é caixa.
3. **As sementes se tocam?** É a pergunta central. Um conjunto sem aglomerado
   não acrescenta nada ao que a soja já dá.
4. **Resolução e escala.** Sem µm/px declarado, a morfometria não é comparável.
   Foto de celular a distância desconhecida serve para contagem e nada mais.
5. **Procedência da anotação.** Anotada por quem, com que critério, com que
   verificação. Anotação sem critério declarado não é referência.

### 3.2 Onde mais procurar

- **Hugging Face Datasets** — buscar por `seed`, `grain`, `germination`,
  `phenotyping`. Vantagem sobre o Roboflow: licença costuma estar declarada e
  há carregador padronizado.
- **Mendeley Data e Zenodo** — onde os conjuntos que acompanham artigo são
  depositados. Foi de lá que veio a soja. Costumam ter DOI, que é citável.
- **PlantVillage, GBIF, Kew SID** (Seed Information Database) — mais botânica
  que fenotipagem, mas úteis para morfologia de referência por espécie.
- **Repositórios de artigos de fenotipagem** — AIseed, SmartGrain, GrainScan e
  SeedExtractor publicam material suplementar; ver
  [`2026-09-03-linhas-de-pesquisa-machado-neto-custodio.md`](../superpowers/specs/2026-09-03-linhas-de-pesquisa-machado-neto-custodio.md).

---

## 4. A lacuna que nenhum destes preenche

Nenhum conjunto listado tem, ao mesmo tempo: **sementes encostadas** e
**máscara por instância**. Essa combinação é o que falta para medir a separação
de aglomerados contra verdade, e é exatamente o problema em aberto.

Três saídas, em ordem de custo:

1. **Cenas geradas** — já dão aglomerado com verdade perfeita, e é como as
   presets de orquídea e forrageira foram construídas. Mede o algoritmo, não a
   realidade.
2. **Anotar à mão um subconjunto de orquídea real.** Caro, mas é a única
   referência real com tetrazólio e aglomerado. Cinquenta sementes bem anotadas
   valem mais que cinco mil caixas de outra cultura.
3. **Conjuntos de células** — a literatura de microscopia tem material com
   objetos encostados e máscara por instância em abundância (linhagens
   celulares, núcleos). A geometria do problema é a mesma; a aparência não.
   Serve para desenvolver e calibrar o método, não para validar a aplicação.

---

## 5. Medições feitas sobre os conjuntos

Registro do que foi de fato medido, para os números do código terem procedência
e para ninguém repetir o trabalho sem saber que já existe.

### 5.1 Soja — dimensões por PCA sobre a máscara de instância

**Conjunto:** Mendeley c733bjz4m3 (Anjasmoro, Dega I, Grobogan)
**Amostra:** 400 sementes por variedade, 1200 no total, sorteio com semente fixa
**Método:** máscara do canal alfa → eixos principais → extensão em cada eixo

| medida | valor |
|---|---|
| comprimento mediano | 285,5 px |
| p5 – p95 | 256,9 – 319,9 px |
| **razão C/L mediana** | **1,208** |
| razão p1 – p99 | 1,054 – 1,364 |
| razão máxima observada | 1,396 |
| área mediana | 52.723 px |

O EXIF das digitalizações declara **800 dpi**. A essa escala o comprimento
mediano dá **9,07 mm** — exatamente no antigo teto de 9,0 mm da tabela do
aplicativo, que por isso foi alargado para 11,0 mm. São variedades de semente
graúda (Dega I tem ~22 g/100 sementes), então o valor é plausível; ainda assim,
tratar o dpi do EXIF como medido seria erro — scanner grava o nominal.

**O resultado que mais valeu:** a razão comprimento/largura é **invariante de
escala**. Com limiar no p99 das isoladas (1,36), um par simulado por
duplicação de comprimento é detectado em 100% dos casos com 1% de falso alarme.

**Ressalva obrigatória:** neste conjunto as sementes **nunca se tocam** — foram
dispostas em grade à mão. O número do par é o que a aritmética prevê, não uma
medição de par.

### 5.2 Trigo — razão observada em cena com sementes encostadas

**Conjunto:** `wheat quality detection.v2i.multiclass`, subconjunto
`(bad=0, healthy=1, impurity=0)` — imagens só com semente sadia
**Amostra:** 229 imagens originais distintas (descontadas as variantes
aumentadas do Roboflow), 2222 blobs após descartar fragmentos
**Método:** limiar de Otsu → componentes conexos → eixos principais.
Sem máscara de referência: a segmentação é do próprio experimento.

| percentil | razão C/L |
|---|---|
| p5 | 1,08 |
| p25 | 1,49 |
| **p50** | **1,87** |
| p75 | 2,38 |
| p95 | 3,20 |

**O que isto corrigiu no código.** A mediana 1,87 confirma a faixa de
literatura do grão (1,8–2,8). Mas **45% dos blobs ficam abaixo de 1,8**, e isso
não é ruído de segmentação: é ORIENTAÇÃO. A imagem vê a projeção de como a
semente caiu, e um grão de trigo apoiado na ponta projeta quase redondo.

A tabela do aplicativo guardava a razão da SEMENTE; passou a guardar a razão
**observada na imagem**, com piso rebaixado para tudo que é alongado. Sem essa
correção, metade de um lote de trigo seria acusada por estar deitada de outro
jeito.

Consequência de projeto: a checagem de forma serve sobretudo para o lado ALTO
da faixa — que é onde mora o contorno que engoliu a vizinha. O veredito
"redondo demais" é fraco para espécie alongada, e isso está dito no código.

### 5.3 Orquídea — o conjunto que treinou o YOLO em produção

**Conjunto:** `datasets/Sementes de Orquideas` — Roboflow
`sementes-de-orqudea/sementes-de-orquideas` v8, CC BY 4.0
**Anotação:** polígonos de segmentação YOLO, duas classes (viável, inviável)
**Amostra:** 610 imagens de treino a 946×946, **21.655 sementes anotadas**

| classe | n | comprimento mediano | razão C/L mediana | p1 – p99 |
|---|---|---|---|---|
| viável | 10.180 | 124,4 px | 3,84 | — |
| inviável | 11.475 | 96,7 px | 3,56 | — |
| **todas** | **21.655** | — | **3,70** | 1,73 – 7,11 |

Detalhe biológico que apareceu sozinho: a semente **viável é mais longa e mais
alongada** que a inviável (124 contra 97 px; 3,84 contra 3,56). Faz sentido —
a inviável costuma ser testa sem embrião desenvolvido. Não é separação
suficiente para classificar, mas mostra que uma faixa única por espécie é
simplificação.

#### O achado que corrigiu o código

Este conjunto tem o que faltava: **1728 pares de contornos que realmente se
encostam** (distância inferior a 2 px entre polígonos anotados). Fundindo cada
par e medindo o resultado, dá para saber o que um contorno errado produz — sem
simular.

E o resultado **refutou** o que estava escrito no código.

A versão anterior afirmava que a checagem de forma "serve sobretudo para o lado
ALTO, que é onde mora o contorno que engoliu a vizinha". Isso vale para semente
redonda e é falso para semente alongada:

```
ponta a ponta   2L × W   → razão DOBRA
lado a lado     L × 2W   → razão CAI PELA METADE
```

Semente alongada assenta alinhada com a vizinha, então lado a lado domina.
Medido: a razão dos pares fundidos ficou em **1,90**, contra 3,70 das isoladas,
e **88,7% dos pares ficaram abaixo da mediana isolada**.

Desempenho medido, não simulado:

| lado | limiar | falso alarme | pares reais pegos |
|---|---|---|---|
| alto | 6,00 | 4,1% | 1,7% |
| alto | 7,11 | 1,0% | 0,3% |
| **baixo** | **2,00** | **3,3%** | **54,3%** |
| baixo | 2,20 | 6,1% | 63,0% |

O lado alto é inútil para orquídea. O piso da tabela foi para **2,0** — acima do
p1 medido (1,73) de propósito, porque é ele que denuncia o par. E o texto do
aviso passou a mudar conforme a espécie: dizer "duas encostadas" no lado errado
mandaria a pessoa procurar o erro errado.

#### O detector de aglomerado, medido contra a mesma verdade

Os limiares de `aglomerado.ts` foram escolhidos por julgamento. Agora deu para
medi-los: 3530 contornos isolados contra 240 pares reais, na normalização que o
próprio código usa (profundidade dividida pelo raio do círculo de mesma área).

| sinal | isolada (mediana) | fundida (mediana) |
|---|---|---|
| solidez | 0,942 | 0,615 |
| profundidade relativa | 0,199 | 0,852 |
| área | 1234 px | 2012 px (1,63×) |

Os sinais separam bem. **Os limiares padrão é que não servem para orquídea:**

| limiar | falso alarme | pares pegos |
|---|---|---|
| `profundidadeMaxima` 0,15 (padrão) | **78,0%** | 100% |
| `profundidadeMaxima` 0,40 | 12,9% | 100% |
| `profundidadeMaxima` 0,60 | 5,8% | 95,8% |
| `solidezMinima` 0,92 (padrão) | **40,1%** | 100% |
| `solidezMinima` 0,75 | 8,4% | 87,8% |

Não é defeito da métrica: semente de orquídea tem testa papirácea e o contorno
dela **não é convexo**. Uma constante calibrada para soja lisa não pode servir
a isso.

**Conclusão de projeto:** constante absoluta é a forma errada para este
problema. O limiar certo é relativo à população da própria imagem — a mesma
ideia que `medianaDaCena` já aplica à área. Enquanto isso não existe, entrou
`LIMIARES_DE_CONTORNO_IRREGULAR` com os valores medidos, e há teste que fixa as
medianas para ninguém apertar o limiar sem ver o custo.

### 5.4 O que ainda falta medir

- ~~Par real de sementes encostadas, com máscara por instância.~~ **Fechado**
  pelo conjunto de orquídea (§5.3): 1728 pares medidos.
- **Par real em semente REDONDA.** O de soja não tem par nenhum e o de orquídea
  é alongado. A afirmação de que o par de soja aparece no lado alto continua
  sendo aritmética, não medição.
- **Tetrazólio com leitura de referência.** `nelson_phd_images_orquid_enrico`
  tem material corado, mas sem laudo pareado por semente.
- **Morfometria contra paquímetro.** Nenhum conjunto tem medição manual pareada.
