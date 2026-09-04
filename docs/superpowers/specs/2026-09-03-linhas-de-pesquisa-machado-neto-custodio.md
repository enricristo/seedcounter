# Linhas de pesquisa do grupo (Machado Neto & Custódio) e o que elas exigem do SeedCounter

> Documento de fundamentação. Não é plano de implementação — é a base de evidência
> que justifica quais funcionalidades entram, em que ordem, e por quê.
>
> Público final: os alunos dos dois orientadores. O SeedCounter só é útil para eles
> se falar a língua dos ensaios que eles de fato conduzem.

Data: 2026-09-03 · Autor: Enrico S. Ambrosio (com Claude) · GPEOrq / GPSEM — Unoeste

---

## 1. Por que este documento existe

Até aqui o SeedCounter foi desenhado a partir de uma necessidade concreta (contar
semente de orquídea em imagem de scanner) e de referências externas (MARVIN,
MachVision, AIseed). Falta a peça mais importante: **o que o laboratório que vai
usar o app realmente mede.**

A diferença é prática. Um app de contagem genérico entrega "número de sementes".
Um ensaio do grupo entrega "porcentagem de viabilidade por repetição, comparada
entre níveis de um fator, com o teste estatístico que a revista aceita". São
produtos diferentes. O segundo é o que precisa sair do app.

Este documento levanta o que os dois orientadores publicam, extrai os **padrões de
delineamento** que se repetem, e mapeia cada um contra o que o SeedCounter já faz,
faz mal, ou não faz.

---

## 2. Fonte primária verificada

O documento âncora foi lido na íntegra (6 páginas, PDF de imagem — leitura página
a página):

> CUSTÓDIO, C.C.; HOSOMI, S.T.; MACHADO NETO, N.B. **Teste de tetrazólio em
> sementes de orquídeas.** Boletim de Pesquisa PPGA, Unoeste, v. 2, n. 2, 2021,
> p. 54–59.
> https://sites.unoeste.br/boletimppga/wp-content/uploads/2021/09/BoletimPPGAV22021-54-59.pdf

Os demais trabalhos foram levantados por busca bibliográfica com DOI conferido
(seção 9). Onde afirmo algo que **não** consegui verificar em fonte, digo
explicitamente "a confirmar".

---

## 3. O protocolo de tetrazólio em orquídeas — o que o boletim diz

Isto não é paráfrase distante; é o método que o app precisa saber representar.

**Por que TZ em orquídea é diferente.** A semente mede de 0,05 a 6 mm
(Arditti & Ghani, 2000) e **não tem o aparato necessário para catabolizar as
reservas e reativar o metabolismo respiratório** — por isso foi preciso
desenvolver o **pré-condicionamento em solução de sacarose** (Hosomi et al.,
2011). Sem ele o TZ subestima a viabilidade. Além disso, parte das espécies tem
tegumento escurecido (que precisa ser **clareado depois** da coloração, para que
o embrião fique visível) e outras têm tegumento resistente (que precisa ser
**escarificado antes**, para o TZ penetrar) — ambos com hipoclorito de sódio
(Custódio et al., 2016).

**Experimento 1 — Cattleya tigrina e C. walkeriana.** Fatorial 3 × 4 × 4, três
repetições por tratamento:

| Fator | Níveis |
|---|---|
| Pré-condicionamento 24 h | água · sacarose 10% · sem pré-condicionamento |
| Tempo de exposição ao TZ | 3 h · 6 h · 12 h · 24 h |
| Concentração de TZ (m/v) | 0,1% · 0,25% · 0,5% · 1,0% |

**Experimento 2 — escarificação e clareamento.** *Dactylorhiza fuchsii*:
sacarose 10% 24 h → NaOCl 0,5% por 1 · 2,5 · 5 · 10 min, com e sem vácuo → TZ 1%.
*Vanda curvifolia*: sacarose 10% 24 h → TZ 1% → clareamento em NaOCl 0,5 · 1 ·
1,5 · 2% por 5 · 10 · 15 · 40 min.

**Condições fixas.** Coloração a **40 °C, por 24 h, no escuro**. Cada repetição
com **10 a 20 mg de semente**.

**Avaliação.** Por **análise digital de imagens** (Hosomi et al., 2011): gotas com
as sementes distribuídas em **lâminas de vidro para microscopia**, imagens
capturadas em **scanner de mesa HP G2710** em alta resolução, ampliadas em
software (o boletim cita o Paint).

**Resultados.** *C. tigrina* pré-condicionada 24 h em sacarose e corada com TZ 1%
por 24 h: **97% de viabilidade e 100% de germinação**. *C. walkeriana*: 94% e 98%.
Sem pré-condicionamento, viabilidade menor. Em *Vanda*, NaOCl 0,5% de 5 a 10 min
não diferiu; concentração maior **perde viabilidade**. Em *Dactylorhiza* não
houve clareamento, e sim escarificação prévia (NaOCl 0,5%, 2,5 min).

**Tabela 1 do boletim** resume o método adequado por grupo — e é, na prática, um
catálogo de protocolos:

| Grupo | Pré-cond. sacarose 10% 24 h | Escarificação pré-coloração | Clareamento pós-coloração | Resultado |
|---|:--:|:--:|:--:|:--:|
| *Cattleya* | – | – | – | – |
| *Disa*, *Grammatophyllum* | + | – | – | + |
| *Dactylorhiza* | – | – | – | – |
| *Dactylorhiza* | + | + | – | + |
| *Vanda* | – | – | – | – |
| *Aerides* | + | – | + | + |

(– ausência de utilização ou resultado inadequado; + utilização ou resultado adequado.)

**Conclusão do boletim:** o TZ é eficiente para determinar viabilidade, tem alta
relação com a germinação (Hosomi et al., 2012), e **pode ser usado para monitorar
lotes armazenados para conservação**.

### 3.1 Três consequências diretas para o app

1. **O protocolo é um objeto de dados, não um texto livre.** Espécie → precisa de
   pré-condicionamento? escarificação? clareamento? concentração e tempo? Isso é
   exatamente o "Protocolo de Análise" já previsto no roadmap de modularidade.
   A Tabela 1 é o conteúdo inicial dele.
2. **10–20 mg de semente por repetição** significa da ordem de milhares de
   sementes por imagem. Contar isso no Paint é o gargalo que o app remove. É
   também a justificativa do divisor de digitalização (fatiar a folha do scanner)
   e do teto de desempenho que precisamos respeitar.
3. **O scanner do artigo é o mesmo scanner que já é o padrão do app**
   (`DEFAULT_LAB_SCANNER = 'HP Scanjet G2710'`, `DEFAULT_LAB_DPI = 3600` em
   `src/lib/calibration.ts`). A calibração por DPI não é enfeite: é a ponte entre
   o pixel e o micrômetro no método publicado do grupo.

---

## 4. O precedente que valida o SeedCounter inteiro

> CUSTÓDIO, C.C.; DAMASCENO, R.L.; MACHADO NETO, N.B. **Imagens digitalizadas na
> interpretação do teste de tetrazólio em sementes de *Brachiaria brizantha*.**
> Revista Brasileira de Sementes, v. 34, n. 2, p. 334–341, 2012.
> DOI 10.1590/s0101-31222012000200020

Cinco lotes de *B. brizantha* 'Marandu' de origens diferentes, avaliados por
germinação (com e sem escarificação com ácido sulfúrico) e por tetrazólio de duas
formas: **método convencional sob estereomicroscópio** contra **análise de imagens
digitalizadas**, com as sementes agrupadas em placa de vidro de alta transparência
e imagem capturada a **1200 dpi**. Delineamento inteiramente casualizado.

**Resultado: a avaliação por imagem digitalizada é equivalente à feita sob
estereomicroscópio.**

Este é o artigo que o SeedCounter deveria citar na tela "Sobre". Não é uma
analogia — é o mesmo laboratório, o mesmo teste, o mesmo hardware (scanner de
mesa), a mesma pergunta metodológica, publicado e revisado por pares. O app é a
continuação natural desse trabalho: o que em 2012 era "abrir a imagem e
interpretar", agora é "abrir a imagem, contar, medir, classificar e exportar com
metadado".

E ele é sobre **forrageira**, não orquídea — o que amarra as duas frentes.

---

## 5. Nelson Barbosa Machado Neto — o que se repete

Formação e vínculos (levantados; a confirmar no CV Lattes): professor na Unoeste
desde 1991; doutorado em Biologia Vegetal (UNESP Rio Claro, 1999); pós-doutorados
no **Millennium Seed Bank – Kew Gardens** (biologia de sementes) e no IAPAR
(marcadores moleculares); bolsista de produtividade CNPq; membro do **Storage
Committee da ISTA**; co-coordenador para a América do Sul do **Orchid Specialist
Group da IUCN-SSC**.

**Padrão de ensaio recorrente — estresse osmótico em série.**

- MACHADO NETO et al. (2004), *Estresse hídrico induzido por manitol em sementes
  de soja de diferentes tamanhos*, RBS 26(2):105-113 — DIC, fatorial 2×4 e 3×4
  (tamanho de peneira × concentração de manitol), potenciais 0; -0,6; -1,2;
  -1,8 MPa. Avaliações: germinação, primeira contagem, **classificação de vigor de
  plântulas**, comprimento de hipocótilo e raiz, massa seca de parte aérea e raiz.
- MACHADO NETO et al. (2010), *Estresse hídrico com diferentes osmóticos em
  sementes de feijão*, Acta Sci. Agron. 32(3) — manitol, CaCl₂, MgCl₂ e NaCl a
  0; -0,3; -0,6; -0,9; -1,2 MPa (equação de Van't Hoff). DIC, **teste F para a
  ANOVA e regressão polinomial para os níveis de potencial osmótico**.
- MACHADO NETO et al. (2004), *Water stress induced by mannitol and sodium
  chloride in soybean cultivars*, Braz. Arch. Biol. Technol. 47(4):521-529.
- MACHADO NETO, AGOSTINI & CUSTÓDIO (2013), *Induction of water deficit tolerance
  by cold shock and salicylic acid...*, Acta Sci. Agron. 35(2) — manitol a
  0; -0,3; -0,6; -1,2 MPa.

### 5.1 A lacuna estatística que isso revela

Repare no desenho: **o fator principal é quantitativo** (potencial osmótico em
MPa, tempo em horas, concentração em %). Para fator quantitativo a análise
correta **não** é separação de médias por letras — é **regressão polinomial**, e o
resultado de interesse costuma ser o **ponto de ótimo** (o artigo de soja reporta
"os potenciais calculados de -0,52 e -0,49 MPa permitiram a máxima germinação").

O `src/lib/stats.ts` do SeedCounter hoje tem ANOVA, Tukey-Kramer, Scott-Knott,
Kruskal-Wallis e Dunn — **todos para fator qualitativo**. Para o ensaio típico do
Nelson, o app entrega a análise errada. Isso é uma lacuna real, específica e
corrigível, não um "seria bom ter".

---

## 6. Ceci Castilho Custódio — o que se repete

Doutora em Botânica; professora de Produção e Tecnologia de Sementes na Unoeste.
Co-autora do manual da ABRATES *Vigor de sementes: conceitos e testes*.

Duas frentes, e o interesse declarado inclui explicitamente a segunda:

**(a) Sementes pequenas e conservação** — orquídeas, tetrazólio, bancos de
germoplasma (seção 3).

**(b) Forrageiras e pastagem** — é aqui que está o volume:

- CUSTÓDIO, DAMASCENO & MACHADO NETO (2012) — TZ em *B. brizantha* por imagem
  digitalizada (seção 4).
- CUSTÓDIO, ABRANTES & MACHADO NETO (2025), *Seed Storage and Germination of Three
  Grass Species: Effect of Spikelet Weight and Dormancy*, Braz. Arch. Biol.
  Technol. 68 — três espécies de *Urochloa*, lotes separados em **espiguetas leves
  (LS) e pesadas (HS)**, duas condições de armazenamento (4,5% e 50% UR),
  avaliados **a cada três meses no primeiro ano e depois até 44 meses**, por
  **germinação e teste de tetrazólio**.
- CUSTÓDIO, ABRANTES & MACHADO NETO (2021), *Seed moisture content can be used to
  accelerate dormancy release during after-ripening of Urochloa humidicola cv.
  Llanero spikelets*, Ciência Rural 51(1) — avaliações em 0, 3, 6 e 12 meses;
  germinação, dormência, H₂O₂, SOD, PRX; espiguetas contra cariopses.
- CUSTÓDIO, CATUCHI & PARMEZAN (2022), *Sequential cutting of Urochloa brizantha
  cv. MG 5 changes flowering season and seed production components*, Ciência
  Rural 52(5) — **delineamento em blocos casualizados com quatro repetições**,
  dois anos agrícolas.

### 6.1 O que a frente forrageira exige e a de orquídea não

1. **Blocos casualizados (DBC), não só DIC.** O ensaio de campo usa blocos. A
   ANOVA de um fator do app não comporta isso.
2. **O eixo do tempo é o armazenamento, não a germinação.** Em orquídea o
   longitudinal é DAP (dias após plantio) e a curva é de germinação/protocormo. Em
   forrageira o longitudinal é **mês de armazenamento**, até 44 meses, e a curva é
   de **deterioração** — germinação e TZ caindo, dormência caindo. É o mesmo
   modelo de dados com outra unidade e outro sentido: o `LongitudinalView` precisa
   aceitar "meses de armazenamento" como eixo, não só DAP.
3. **Classe de tamanho/peso como fator.** Peneira (soja), espigueta leve × pesada
   (*Urochloa*). A morfometria que o app já extrai (área, eixo maior/menor,
   circularidade) é exatamente o que separa essas classes — e poderia
   **classificar automaticamente** o que hoje é separado no soprador.
4. **Dormência é uma categoria de resultado, não ruído.** Em forrageira, semente
   não germinada pode ser dormente, dura, morta ou vazia. A dicotomia
   viável/inviável do app é insuficiente: precisa de **classes dinâmicas** — que é
   justamente o que o "Protocolo de Análise" do roadmap prevê.
5. **Cariopse vazia.** Lote de forrageira tem proporção alta de espigueta sem
   cariopse. Contar "sementes" sem separar cheia de vazia produz porcentagem
   errada. É um caso de classe adicional, e é o mesmo mecanismo do item 4.

---

## 7. Mapa: o que eles fazem × o que o app faz

| O que o ensaio exige | Estado no SeedCounter | O que falta |
|---|---|---|
| Contar sementes coradas × não coradas em imagem de scanner | **Pronto** — marcação manual, contagem, exportação | — |
| Equivalência com estereomicroscópio | **Precedente publicado** (Custódio et al., 2012) | Citar na tela "Sobre" |
| Calibração pixel → µm/mm via DPI | **Pronto** (`calibration.ts`, G2710 @3600 dpi padrão) | — |
| Fatiar folha de scanner em amostras | **Pronto** (divisor de digitalização) | — |
| Recorte do campo circular (lupa/ocular) | **Pronto** (ROI circular) | — |
| Índice de tetrazólio por cor (a\* do CIELAB) | **Pronto** (`color-features.ts`) | Validar contra leitura humana |
| Repetições por tratamento, DIC | **Pronto** (agrupa sessões por tratamento) | — |
| ANOVA + separação de médias (fator qualitativo) | **Pronto** (Tukey, Scott-Knott) | — |
| **Regressão polinomial em fator quantitativo + ponto de ótimo** | **Ausente** | Ensaio típico do Nelson |
| **Blocos casualizados (DBC)** | **Ausente** | Ensaio de campo da Ceci |
| Curva de germinação por DAP, IVG, MGT, T50 | **Pronto** (`stats.ts`, `LongitudinalView`) | — |
| **Eixo longitudinal em meses de armazenamento** | **Parcial** — o modelo aceita, a UI diz "DAP" | Rotular o eixo pelo tipo de ensaio |
| **Classes dinâmicas** (dormente, dura, vazia, morta) | **Ausente** — dicotomia fixa | Protocolo de Análise |
| **Protocolo por espécie** (pré-cond./escarif./clareamento) | **Ausente** | Tabela 1 do boletim é o conteúdo |
| Classificação por tamanho/peso a partir da morfometria | **Parcial** — mede, não classifica | Regra de corte por classe |
| Metadados de replicabilidade na exportação | **Pronto** (versão, commit, projeto, tratamento, placa) | — |

---

## 8. Prioridade sugerida

Ordenada por (impacto no aluno) ÷ (custo), não por facilidade:

1. **Classes dinâmicas + Protocolo de Análise.** Destrava a frente forrageira
   inteira (dormente/dura/vazia) e o TZ por espécie. É a mudança que transforma o
   app de "contador de orquídea" em "contador de semente".
2. **Regressão polinomial para fator quantitativo.** Entrega ao Nelson a análise
   que ele publica, e é contida: uma função em `stats.ts` mais um cartão de
   resultado.
3. **Eixo longitudinal parametrizado** (DAP × meses de armazenamento). Barato,
   e sem ele metade dos ensaios da Ceci não cabe no app.
4. **DBC na ANOVA.** Mais trabalho, mas é o delineamento do ensaio de campo.
5. **Classificação automática por classe de tamanho.** Depende da validação da
   morfometria contra medição manual, que ainda não foi feita.

---

## 9. Referências verificadas

- ARDITTI, J.; GHANI, A.K.A. Numerical and physical properties of orchid seeds and
  their biological implications. **New Phytologist**, v. 145, p. 367–421, 2000.
- CUSTÓDIO, C.C.; DAMASCENO, R.L.; MACHADO NETO, N.B. Imagens digitalizadas na
  interpretação do teste de tetrazólio em sementes de *Brachiaria brizantha*.
  **Revista Brasileira de Sementes**, v. 34, n. 2, p. 334–341, 2012.
  https://doi.org/10.1590/s0101-31222012000200020
- CUSTÓDIO, C.C.; MARKS, T.R.; PRITCHARD, H.W.; HOSOMI, S.T.; MACHADO NETO, N.B.
  Improved tetrazolium viability testing in orchid seeds with a thick carapace
  (*Dactylorhiza fuchsii*) or dark seed coat (*Vanda curvifolia*). **Seed Science
  and Technology**, v. 44, p. 177–188, 2016.
- CUSTÓDIO, C.C.; HOSOMI, S.T.; MACHADO NETO, N.B. Teste de tetrazólio em sementes
  de orquídeas. **Boletim de Pesquisa PPGA/Unoeste**, v. 2, n. 2, p. 54–59, 2021.
- CUSTÓDIO, C.C.; ABRANTES, F.L.; MACHADO NETO, N.B. Seed moisture content can be
  used to accelerate dormancy release during after-ripening of *Urochloa
  humidicola* cv. Llanero spikelets. **Ciência Rural**, v. 51, n. 1, 2021.
  https://doi.org/10.1590/0103-8478cr20200526
- CUSTÓDIO, C.C.; CATUCHI, T.A.; PARMEZAN, G.C. Sequential cutting of *Urochloa
  brizantha* cv. MG 5 changes flowering season and seed production components.
  **Ciência Rural**, v. 52, n. 5, 2022. https://doi.org/10.1590/0103-8478cr20200912
- CUSTÓDIO, C.C.; ABRANTES, F.L.; MACHADO NETO, N.B. Seed Storage and Germination
  of Three Grass Species: Effect of Spikelet Weight and Dormancy. **Brazilian
  Archives of Biology and Technology**, v. 68, 2025.
  https://doi.org/10.1590/1678-4324-2025241009
- FRANÇA-NETO, J.B.; KRZYZANOWSKI, F.C. Teste de tetrazólio para a determinação do
  vigor em sementes. In: **Vigor de sementes: conceitos e testes**. 2. ed.
  Londrina: ABRATES, 2020. p. 404–417.
- HOSOMI, S.T.; SANTOS, R.B.; CUSTÓDIO, C.C.; SEATON, P.T.; MARKS, T.R.; MACHADO
  NETO, N.B. Preconditioning *Cattleya* seeds to improve the efficacy of the
  tetrazolium test for viability. **Seed Science and Technology**, v. 39,
  p. 178–189, 2011.
- HOSOMI, S.T. et al. Improved assessment of viability and germination of
  *Cattleya* (Orchidaceae) seeds following storage. **In Vitro Cellular and
  Developmental Biology-Plant**, v. 48, n. 1, p. 127–136, 2012.
- MACHADO NETO, N.B.; COSTA, P.R.R.; CUSTÓDIO, C.C. Estresse hídrico induzido por
  manitol em sementes de soja de diferentes tamanhos. **Revista Brasileira de
  Sementes**, v. 26, n. 2, p. 105–113, 2004.
  https://doi.org/10.1590/s0101-31222004000200015
- MACHADO NETO, N.B.; SATURNINO, S.M.; BOMFIM, D.C. Water stress induced by
  mannitol and sodium chloride in soybean cultivars. **Brazilian Archives of
  Biology and Technology**, v. 47, n. 4, p. 521–529, 2004.
  https://doi.org/10.1590/s1516-89132004000400004
- MACHADO NETO, N.B.; CUSTÓDIO, C.C.; COELHO, D.L.M. Estresse hídrico com
  diferentes osmóticos em sementes de feijão e expressão diferencial de proteínas
  durante a germinação. **Acta Scientiarum Agronomy**, v. 32, n. 3, 2010.
  https://doi.org/10.4025/actasciagron.v32i3.4694
- MACHADO NETO, N.B.; AGOSTINI, E.A.T.; CUSTÓDIO, C.C. Induction of water deficit
  tolerance by cold shock and salicylic acid during germination in the common
  bean. **Acta Scientiarum Agronomy**, v. 35, n. 2, 2013.
  https://doi.org/10.4025/actasciagron.v35i2.15967
- MOORE, R.P. **Handbook on tetrazolium testing**. Zurich: ISTA, 1985.
- SEATON, P.T. et al. Orchid seed and pollen: a toolkit for long-term storage,
  viability assessment and conservation. In: **Orchid propagation: from
  laboratories to greenhouses**. New York: Humana Press, 2018. p. 71–98.
