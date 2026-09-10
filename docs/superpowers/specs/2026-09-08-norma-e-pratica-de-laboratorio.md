# A norma, a rotina e o que elas exigem do SeedCounter

> Levantamento sobre como laboratórios de análise de sementes realmente
> trabalham, o que a norma exige, e onde a análise de imagem já é aceita.
>
> Contém **uma correção à premissa do projeto** (seção 2) e **a notícia de que
> a norma mudou** (seção 1).

Data: 2026-09-08 · GPEOrq / GPSEM — Unoeste

---

## 1. A RAS mudou, e mudou de natureza

**A RAS 2009 está revogada.** A edição nova foi publicada em 28/03/2025 e está
em vigor desde 26/06/2025.

E mudou o formato, o que importa mais que o conteúdo: **publicação
exclusivamente digital**, na plataforma **Wikisda** do MAPA. Não existe mais "o
livro da RAS". São **15 capítulos independentes, cada um com número de revisão
próprio e histórico datado.**

O Cap. 5 (Tetrazólio) já sofreu revisões em 14/10/2025 e 01/12/2025. O Quadro
1.5 está na revisão 1.6, de 02/04/2026.

**A consequência de produto é direta:** qualquer software que represente a
norma precisa versionar contra **capítulo + revisão + data**, nunca contra
"RAS 2025". Um laudo emitido sob a revisão 1.1 do Cap. 5 e outro sob a 1.2
podem não ser comparáveis, e é preciso saber qual foi qual.

Duas mudanças de conteúdo relevantes:

- **Novo Cap. 11 — Teste de Raios X.** O primeiro capítulo da RAS que autoriza
  explicitamente avaliação automática por análise de imagem (seção 4).
- **Nomenclatura: *Urochloa* substitui *Brachiaria*.** O nome científico é
  campo obrigatório do boletim, então isso é mudança de dado, não de estilo.

---

## 2. A correção à premissa: o critério do tetrazólio é topográfico

Este é o achado que mais afeta o que já foi construído.

A RAS 2025, Cap. 5, diz textualmente:

> "A **posição e o tamanho das áreas necrosadas**, e **não necessariamente a
> intensidade da coloração**, determinam se tais sementes podem ser
> classificadas como viáveis. Estas diferenças de coloração também devem estar
> associadas à **firmeza dos tecidos**."

### 2.1 O que isso corrige

O projeto vinha tratando o **a\* do CIELAB** como *a* medida do tetrazólio — o
eixo verde-vermelho como tradução numérica de "núcleo com qualquer grau de
vermelho". Essa leitura está **incompleta**, e a norma é explícita sobre o
ponto: quem decide é **onde** a lesão está em relação às estruturas essenciais,
e **qual a extensão** dela. Não a intensidade.

Um classificador que aprende "quanto vermelho tem" está aprendendo a coisa
errada, e vai falhar exatamente onde importa — na fronteira entre viável e
inviável, que é onde a decisão tem consequência.

Há ainda um componente que **nenhuma imagem 2D captura**: firmeza do tecido. O
analista aperta. Isso é limite do método, não do software, e precisa estar
escrito.

### 2.2 O que continua válido

O a\* não vira inútil — vira **insumo em vez de veredito**. Ele mede
coloração, que é um dos dois componentes; falta a topografia. E o argumento de
transferência entre capturas (espaço perceptualmente uniforme, limiar que
sobrevive à mudança de brilho) continua de pé para o que ele mede.

### 2.3 O que o produto deveria extrair

1. **Segmentação do embrião e das estruturas essenciais** — eixo
   hipocótilo-radícula, plúmula, meristemas.
2. **Localização das lesões relativamente a essas estruturas.**
3. **Extensão relativa** da lesão.

Isto é mais difícil que medir cor, e é o que separa uma ferramenta que o
laboratório usa de uma que ele acha interessante.

### 2.4 Onde reportar concordância, e onde não

O manual da Embrapa (França Neto, Krzyzanowski & Costa, Documentos 116, 1998)
admite:

> "As classes de vigor 5 e 6 (esta última não viável) são as de interpretação
> [mais difícil]... **discrepâncias são esperadas**."

A fronteira 5/6 é subjetiva por confissão da norma de referência. **Reportar
acurácia global agregada esconde exatamente o único número que interessa.** A
concordância na fronteira 5/6 tem que ser reportada em separado.

---

## 3. Os números que viram interface

### 3.1 Germinação (Cap. 4)

- **400 sementes em 4 repetições de 100** (ou 8×50, 16×25), retiradas ao acaso
  da fração Semente Pura, "sem seleção, para não causar resultados
  tendenciosos".
- **Espaçamento entre sementes: 1,5 a 5,0 vezes a largura.** A própria norma já
  obriga o analista a separar fisicamente as sementes — é o mesmo problema que
  a segmentação por clique resolve na imagem.
- Cinco categorias em **números inteiros**, somando 100%: normais, anormais,
  duras, dormentes, mortas.
- **Dormentes ≥ 5% → confirmação de viabilidade obrigatória** (tetrazólio), com
  o método declarado em "Observações".

### 3.2 Tetrazólio (Cap. 5) — a RAS usa 200, não 400

- **200 sementes**: 2×100, 4×50 ou 8×25. Opcionalmente 400.
- TZ de 0,05% a 1,0%, **pH 6,5–7,5**, coloração no escuro.
- **Estereomicroscópio obrigatório.**
- Reporte no campo **"Outras Determinações"**, em números inteiros e %, **mais
  a metodologia**.

Nota: a ISTA historicamente usa 400 em 4×100. A RAS diverge. As Rules 2026
alteraram o número mínimo e criaram a seção 6.6.1 sobre arredondamento.

### 3.3 Peso de Mil Sementes (Cap. 9) — onde o contador automático já é legal

- **Método 1** nomeia explicitamente o **"contador automático de sementes"**.
- **Método 2** (usual): **8 repetições de 100**, pesadas individualmente.
  **CV ≤ 4%** (não palhentas) ou **≤ 6%** (palhentas e florestais). CV maior →
  mais 8 repetições, descartando as que divirjam da média em mais de 2 desvios.

### 3.4 Pureza (Cap. 2) — o resultado é por PESO

Três frações: Semente Pura, Outras Sementes, Material Inerte. **Percentual por
peso, não por contagem.** Uma única amostra de trabalho, não quatro repetições.

Uma regra que é geométrica e portanto atacável por imagem:

> Pedaços **maiores do que a metade** do tamanho original = semente pura.
> **Iguais ou menores do que a metade** = material inerte.

**Semente vazia**, em pureza, é **material inerte**.

---

## 4. Onde a análise de imagem já é aceita

### 4.1 No Brasil — dois pontos concretos e citáveis

| Onde | O que é aceito |
|---|---|
| **Cap. 9, Método 1** | "Contador automático de sementes", nomeado na norma |
| **Cap. 11, item 11.5.3** | Avaliação "automaticamente por análise de imagem usando **algoritmos de computação validados**" |

O Cap. 11 traz também o **único mandato de retenção de imagem** que existe na
RAS:

> "As imagens de raios X **devem ser identificadas e armazenadas** para
> garantir sua rastreabilidade pela duração da validade do Teste de
> Germinação."

E legitima o pós-processamento:

> "Preferencialmente, as sementes não devem se tocar... No entanto, se isso não
> for possível, o problema **pode ocasionalmente ser resolvido durante o
> processamento digital da imagem**."

**Não é aceito** para pureza (é peso, a balança é irremovível), germinação
(julgamento de estrutura essencial) nem tetrazólio (o Cap. 5 não menciona
imagem, e o critério inclui firmeza tátil).

### 4.2 A terceira porta, menos óbvia

**A RAS não tem capítulo de vigor.** Portanto todo teste de vigor já é, por
construção, "fora da RAS", e vai para "Observações" com a metodologia
declarada. Uma ferramenta de vigor por imagem **não precisa de validação
normativa para ser usada e reportada** — só precisa declarar o método.

É o caminho de menor atrito que existe.

### 4.3 O alvo estratégico: emergência de radícula

**ISTA Rules 2026, Cap. 15: o teste de emergência de radícula passou a valer
para *Glycine max*.** Antes era milho, colza e rabanete.

Por que importa: é **uma contagem única de um critério binário e geométrico** —
radícula de **2 mm** emergida, num único momento (soja: 48 h a 20 °C ou 24 h a
25 °C). Sem classificação de plântula, sem julgamento de estrutura essencial,
sem firmeza de tecido.

**É a tarefa de visão computacional mais simples de todo o catálogo de testes
de sementes — e agora é um teste ISTA-validado para soja.**

---

## 5. A diferenciação que ninguém ocupou

**Nenhum dos softwares levantados implementa tabelas de tolerância
normativas.** Nem GroundEye, nem MARViN, nem SeedCount, nem WinSEEDLE, nem
ImageJ. Todos entregam números; **nenhum diz "este número não pode ser
emitido".**

E a norma é taxativa: se a amplitude entre repetições estoura a Tabela 4.1 e o
descarte da repetição mais baixa não resolve, "o resultado deste teste **não
deve ser informado** no Boletim e um novo teste deve ser realizado". Não é
recomendação, é proibição.

Tolerância de germinação, amplitude máxima entre repetições de 100 (2,5%):

| Média | 4×100 | 3×100 |
|---:|---:|---:|
| 99% | 5 | 4 |
| 95% | 9 | 8 |
| 90% | 12 | 11 |
| 85% | 14 | 13 |
| 80% | 16 | 15 |
| 75% | 17 | 16 |
| 70% | 18 | 17 |

**A consequência para a validação do nosso próprio algoritmo:** se dois
analistas humanos podem legitimamente diferir em 12 pontos numa germinação de
90%, **acurácia contra um único rótulo humano não significa nada**. O
comparador correto é a tolerância da norma, não o rótulo.

---

## 6. Decisões de produto que isto implica

Em ordem de retorno sobre esforço.

**A. Ancorar onde a norma já diz sim.** PMS (Cap. 9) é a porta mais barata — o
contador automático já é nomeado. Implementar o Método 2 completo: 8×100, CV
com o limiar certo por tipo de semente, disparo automático de "mais 8
repetições", descarte de repetições fora de 2 desvios.

**B. Nunca prometer substituir pureza ou germinação.** Posicionar como triagem,
pré-separação e registro. Um modo "auxílio à pureza" que separe candidatos para
o analista pesar é útil e honesto; "pureza automática" é vender o que a norma
não compra.

**C. Modelar as quatro semânticas de zero.** `0` / `0,0` (medido, é zero) ≠
`-0-` (campo sem conteúdo aplicável) ≠ `-N-` (análise não realizada) ≠ `Traço`
(< 0,05%). Trivial agora, caro depois.

**D. Tolerâncias como validação de primeira classe, não como relatório.**
Nenhum resultado exportável sem passar pela verificação. É a maior
diferenciação disponível.

**E. Arredondamentos exatos, incluindo o desempate.** Germinação: mantém-se o
inteiro das normais, ajusta-se a maior parte fracionária, desempate na ordem
anormais → duras → dormentes → mortas. É o tipo de detalhe que faz um analista
confiar ou desconfiar em trinta segundos.

**F. A RAS é dado versionado, não constante no código.** Guardar, com cada
resultado, o capítulo + revisão + data do método aplicado.

**G. Para soja, o TZ tem duas camadas — entregar as duas.** Não basta
viável/inviável. TZ-viabilidade = classes 1–5; TZ-vigor = classes 1–3. Mais o
diagnóstico de causa (dano mecânico, umidade, percevejo) em dois níveis: (1–8)
todos que exibem, e (6–8) só os que **causaram** a perda. É esse número que
dispara ação corretiva na lavoura, e é o que o cliente realmente compra.

A marcação de "qual dano foi o responsável" numa semente com múltiplos danos é
**caso de uso natural para a segmentação por clique**: o analista clica na
lesão que decidiu o destino.

**H. Rastreabilidade espelhando o Cap. 11.** Amostra, lote, repetição,
analista, data/hora, versão do software, versão do método, **e a imagem
original preservada e ligada ao resultado**. Não é conformidade legal — é o que
torna o resultado defensável numa auditoria.

**I. Rodar no navegador é vantagem competitiva concreta.** MARViN roda só em
Windows. GroundEye, SeedCount e WinSEEDLE vendem hardware junto — a Regent nem
vende scanner sem o software. Todos com preço não publicado. Um app que roda em
qualquer scanner ataca onde eles são fracos: **o laboratório que não pode
comprar uma caixa de dezenas de milhares, e o aluno que precisa aprender antes
de ter acesso a uma.**

**J. Para orquídea, o denominador não é o tamanho da amostra — é a massa.** O
método do grupo usa 10 a 20 mg por repetição, 3 repetições. A métrica de saída
é **sementes viáveis por miligrama**, não porcentagem, porque não se conta a
amostra inteira. Isso muda o modelo de dados.

**K. Prometer só o que dá para entregar.** Nenhuma ferramenta comercial
levantada declara conformidade RAS ou ISTA. Não é preciso disputar isso. O que
dá para declarar, e ninguém declara: *"implementa as tolerâncias, os
arredondamentos e as regras de emissão da RAS 2025, capítulo X revisão Y, e
bloqueia resultados fora de tolerância."* Verificável, honesto, e é o que um
analista reconhece como cuidado.

---

## 7. Orquídea está fora da RAS — e o método de referência é da casa

Busca por `orchid`, `Cattleya`, `Dendrobium`, `Phalaenopsis`, `Vanilla` no
Quadro 1.5 e nos capítulos de Tetrazólio e Germinação: **zero ocorrências.**
Orchidaceae está inteiramente fora da RAS.

O caminho normativo existe (IN 40/2010, Disposições Gerais item 7: permitido
emitir BAS para espécie sem método na RAS **mediante anuência da CGAL**,
indicando a metodologia em "Observações").

E o método de referência já está publicado, pelo próprio grupo: Custódio,
Hosomi & Machado Neto (2021), sintetizando Hosomi et al. (2011) e Custódio et
al. (2016) — com **avaliação por análise digital de imagem em scanner de mesa**
já dentro do fluxo.

---

## 8. O que não foi confirmado

Registrado para não virar afirmação por repetição:

1. **Número da portaria que instituiu a RAS 2025.** A norma está vigente, mas o
   número da portaria não foi localizado. Confirmar com a CGAL.
2. **"Vibralab"** — não foi encontrado produto de análise de sementes com esse
   nome. Só fabricantes de equipamento vibratório de beneficiamento.
3. **Preços.** Só um valor, de distribuidor indiano para o MARViN CompactLine.
   Nenhum fabricante publica preço.
4. **Validade do teste de germinação** e **padrões de comercialização da soja**
   — de fontes secundárias; os textos primários não foram abertos.
5. **Versão mais recente do manual de tetrazólio da Embrapa.** Foi usado o
   Documentos 116 (1998). Existe França-Neto & Krzyzanowski (2020) não
   consultado — **os limiares de vigor podem ter sido revisados.**
