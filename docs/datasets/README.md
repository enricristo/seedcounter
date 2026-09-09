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
