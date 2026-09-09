# Plano de implementação — normatização, laudo e a frente forrageira

> Plano da próxima rodada. Escrito depois de três levantamentos (separação de
> encostadas, prática de laboratório e norma, robustez de modelo) e da medição
> da linha de base.
>
> A tese: **a diferenciação do SeedCounter não é algoritmo, é conformidade.**

Data: 2026-09-09 · GPEOrq / GPSEM — Unoeste

---

## 1. Por que normatização vem antes de mais algoritmo

O levantamento de mercado achou uma coisa que muda a prioridade: **nenhum
software de análise de imagem de sementes implementa tabelas de tolerância
normativas.** Nem o GroundEye, nem o MARViN, nem o SeedCount, nem o WinSEEDLE,
nem o ImageJ. Todos entregam números. **Nenhum diz "este número não pode ser
emitido".**

E a norma é taxativa. RAS 2025, Cap. 4: se a amplitude entre repetições estoura
a tolerância e o descarte da repetição mais baixa não resolve, *"o resultado
deste teste **não deve ser informado** no Boletim e um novo teste deve ser
realizado"*. Não é recomendação — é proibição.

Isso significa que existe um espaço vago que não exige nenhum avanço de visão
computacional para ocupar. E ele é exatamente o que faz um analista de
laboratório credenciado olhar duas vezes para uma ferramenta nova.

Há ainda um segundo motivo, menos óbvio e mais incômodo: **sem as tolerâncias,
não sabemos validar o nosso próprio algoritmo.** Se dois analistas humanos podem
diferir legitimamente em 12 pontos numa germinação de 90%, então medir acurácia
contra um único rótulo humano não significa nada. O comparador correto é a
tolerância da norma. Implementar as tabelas é pré-requisito da própria
validação.

---

## 2. Onde ancorar, e onde não prometer

A norma **já** aceita análise de imagem em três lugares. Ancorar ali é ganhar
legitimidade sem pedir licença.

| Porta | O que a norma diz | Estado |
|---|---|---|
| **RAS Cap. 9 — PMS** | Nomeia "contador automático de sementes" no Método 1 | Aberta, e é a mais barata |
| **RAS Cap. 11 — Raios X** | "Automaticamente por análise de imagem usando **algoritmos de computação validados**" | Precedente a citar, mesmo sem fazer raios X |
| **Vigor** | A RAS **não tem capítulo de vigor** — todo teste de vigor já é fora da RAS, e vai para "Observações" com o método declarado | **Menor atrito que existe** |

**Onde não prometer:** pureza (o resultado é por **peso**; a balança é
irremovível) e germinação (julgamento de estrutura essencial). Posicionar como
**triagem, pré-separação e registro**. Um modo "auxílio à pureza" que separe
candidatos a inerte para o analista pesar é útil e honesto; "pureza automática"
é vender o que a norma não compra.

---

## 3. As frentes

Ordenadas por (valor de conformidade) ÷ (esforço). Cada uma diz o que entrega,
o que toca, e o que destrava.

### F1 — Modelo de dados normativo

**A base de tudo o que vem depois.** Barato agora, caro se ficar para depois.

**1.1 As quatro semânticas de zero.** Hoje o app tem um número e pronto. A
norma distingue quatro estados que hoje colapsam num só:

| Estado | Significa | Quando |
|---|---|---|
| `0` / `0,0` | Medido, e o resultado é zero | Contou, deu zero |
| `-0-` | Campo sem conteúdo aplicável | A espécie não tem essa fração |
| `-N-` | Determinação não realizada | Não foi feito o teste |
| `Traço` | Menor que 0,05% na pureza | Existe, mas fora do cálculo de 100% |

Confundir "não medi" com "medi e deu zero" num laudo é erro de laboratório, não
detalhe de interface.

**1.2 Versionamento da norma.** A RAS 2025 é digital e viva: 15 capítulos, cada
um com revisão própria. O Cap. 5 já teve duas revisões em 2025. Cada resultado
precisa guardar **capítulo + revisão + data** do método aplicado — senão dois
laudos sob revisões diferentes parecem comparáveis e não são.

**1.3 Identidade da amostra, como o BAS exige.** Espécie (nome comum + nome
científico em itálico), cultivar, lote, representatividade, safra, categoria
(Básica, C1, C2, S1, S2), procedência, amostrador + nº RENASEM, data da
amostragem, peneira. Hoje o app tem `project`, `treatment`, `plate`, `quadrant`
— genéricos, e nenhum deles é campo de boletim.

**Toca:** `src/types.ts`, `src/lib/db.ts` (nova versão de esquema),
`src/hooks/useMetadata.ts`, painel de metadados.
**Esforço:** médio. **Destrava:** F2, F3, F4.

---

### F2 — Tolerâncias como bloqueio de emissão

**A diferenciação.** Não é relatório: é validação de primeira classe. Nenhum
resultado exportável sem ter passado.

Tabelas a implementar:

- **Germinação (Tabela 4.1)** — amplitude máxima entre repetições de 100, a
  2,5%. Se estourar: oferecer o descarte da repetição mais baixa, revalidar com
  3×100; se ainda estourar, **bloquear a emissão** e sinalizar "novo teste
  necessário".
- **Tetrazólio (Tabelas 5.1, 5.2, 5.3)** — entre repetições do mesmo teste,
  mesmo laboratório, e laboratórios diferentes.
- **Pureza (Anexo 2.6)** — quatro tabelas, incluindo o caso "segunda análise
  pior que a primeira".
- **Embrapa/soja** — reanálise obrigatória se as duas subamostras diferirem
  ≥ 10% em viabilidade.

Junto vêm os **arredondamentos exatos**, que são o tipo de coisa que faz um
analista confiar ou desconfiar em trinta segundos:

- Pureza: uma decimal, soma 100,0%, ajuste de ±0,1% no maior valor, "Traço"
  fora do cálculo.
- Germinação: inteiros, soma 100%, mantém-se o inteiro das normais, ajusta-se a
  maior parte fracionária, e o **desempate segue a ordem anormais → duras →
  dormentes → mortas**.

**Toca:** módulo novo `src/lib/normas/` (tabelas + verificação + arredondamento),
`src/features/stats/`, exportação.
**Esforço:** médio-alto — as tabelas são dado, a lógica de desempate é fina.
**Destrava:** o laudo, e a validação honesta do nosso próprio algoritmo.

---

### F3 — O laudo: BAS/BASO com os campos da norma

Hoje o PDF é um relatório do app. Precisa virar um documento que um analista
reconhece.

**Cabeçalho obrigatório:** logomarca, nome do laboratório, **número do RENASEM
e validade**, **número da Portaria de credenciamento**, endereço.

**Numeração:** consecutiva, **reiniciada a cada ano**, com barra e ano
(`0411/2025`).

**Campos de resultado**, na numeração da IN 40/2010: semente pura, material
inerte, outras sementes, verificação de outras cultivares, plântulas normais,
anormais, duras, dormentes, mortas, outras espécies cultivadas, silvestres,
nocivas toleradas, nocivas proibidas, e **Outras Determinações** (onde o
tetrazólio entra).

Mais: natureza do material inerte, substrato, temperatura, tratamento especial,
data de conclusão e duração do teste, **Observações**, e local/data com
**Responsável Técnico, CREA e RENASEM**.

**O campo que nos interessa mais.** A IN 40 é literal sobre Observações:

> "este campo é destinado aos relatos e observações relacionadas... aos testes
> realizados e outras determinações, como por exemplo, **resultado do teste e
> metodologia utilizada em testes de vigor que não consta nas RAS**."

É por ali que tudo o que fazemos e a RAS não prevê pode ser reportado
legitimamente — inclusive orquídea, que está inteiramente fora da RAS (busca
por `Cattleya`, `Dendrobium`, `Phalaenopsis` no Quadro 1.5: zero ocorrências).

**Regras de preenchimento que viram validação:** nenhum campo em branco (usa-se
os quatro estados de F1), **sem rasuras**, soma fechando 100, três vias.

**Rebrand junto.** O laudo é o artefato que sai do laboratório e circula. Ele
carrega a identidade visual do sistema Bancada Óptica que já existe no app, mas
hoje não a usa.

**Toca:** `src/lib/pdf-generator.ts` (reescrita), tipos de F1, tabelas de F2.
**Esforço:** alto — é onde tudo converge.
**Depende de:** F1 e F2.

---

### F4 — Peso de Mil Sementes completo (Cap. 9)

A porta mais barata, e uma funcionalidade fechada e verificável.

- **Método 2:** 8 repetições de 100 sementes puras, pesadas individualmente.
- Variância, desvio-padrão e **CV**, com o limiar certo: **≤ 4%** (não
  palhentas) ou **≤ 6%** (palhentas e florestais).
- CV maior → disparo automático de "conte mais 8 repetições" (16 no total), com
  **descarte das repetições que divirjam da média em mais de 2 desvios**.
- Resultado = peso médio de 100 × 10, com as casas decimais da Tabela 9.1.

O app já conta. Falta o peso — que entra como dado do analista — e a
estatística.

**Toca:** módulo novo, integração com o histórico de sessões.
**Esforço:** baixo-médio. **Valor:** alto, porque é a única coisa da lista que a
norma já autoriza nomeadamente.

---

### F5 — Emergência de radícula: o alvo estratégico

**ISTA Rules 2026, Cap. 15: o teste passou a valer para *Glycine max*.**

Por que é o alvo: é **contagem única de um critério binário e geométrico** —
radícula de **2 mm** emergida, num único momento (soja: 48 h a 20 °C ou 24 h a
25 °C). Sem classificação de plântula normal/anormal, sem julgamento de
estrutura essencial, sem firmeza de tecido.

**É a tarefa de visão computacional mais simples de todo o catálogo de testes de
sementes — e é a única que é simultaneamente fácil, normatizada e ainda não
comoditizada.**

O que precisa:
- Detecção da radícula emergida (protrusão além do tegumento)
- Medida de comprimento em **mm** contra o limiar de 2 mm — a calibração já
  existe
- Contagem única, sem série temporal
- Já existe literatura de automação disso publicada no periódico da própria
  ISTA (Shinohara et al., 2021; Matthews et al., 2024)

**Toca:** detecção de protrusão (novo), morfometria existente, calibração
existente.
**Esforço:** médio. **Valor estratégico:** o mais alto da lista.

---

### F6 — A frente forrageira

Interesse declarado, e é onde a linha da Profa. Ceci vive. O que ela exige e
orquídea não:

**6.1 Classes dinâmicas.** Em forrageira, semente não germinada pode ser
**dormente, dura, vazia ou morta**. A dicotomia viável/inviável não cobre, e
**contar espigueta vazia como semente produz porcentagem errada**. A RAS é
explícita: em pureza, "unidade de dispersão na qual for óbvio que não contenha
a semente" é **material inerte**, não semente.

Isto é o "Protocolo de Análise" do roteiro antigo, e a forrageira é o caso que
o torna urgente.

**6.2 Dormência é resultado, não ruído.** A RAS obriga: **dormentes ≥ 5% →
confirmação de viabilidade por tetrazólio**, com o método declarado em
Observações. O app precisa saber disparar isso.

**6.3 Nomenclatura.** A RAS 2025 mudou: ***Urochloa* substitui *Brachiaria***.
Nome científico é campo obrigatório do boletim, então é mudança de dado.

**6.4 Escarificação.** Superação de dormência com ácido sulfúrico é parte do
protocolo, e muda o que se está medindo. Precisa ser registrada.

**6.5 O eixo do tempo é armazenamento.** Já feito — `timeAxis:
'armazenamento'` existe desde 8bc44a8. Os trabalhos da Ceci avaliam até 44
meses, e o que a curva mostra é **deterioração**, não germinação acumulada.

**6.6 Classe de peso como fator.** Espigueta leve × pesada é fator de
delineamento nos trabalhos dela. A morfometria que já extraímos é o que separa
essas classes — falta **classificar** a partir dela.

**Toca:** `src/types.ts` (classes dinâmicas), protocolo por espécie, estatística.
**Esforço:** médio-alto. **Depende de:** F1.

---

### F7 — Segmentação: corte por concavidade

A continuação do que já foi construído. O detector de aglomerado
(`lib/aglomerado.ts`) já **marca** o problema; falta **resolvê-lo**.

- Defeitos de convexidade → emparelhamento de concavidades opostas → corte
- Aceitar o corte só se **ambas** as partes passarem no detector
- Elipse (Halir-Flusser 3×3) como **validador**, jamais como medida

**Por que depois das anteriores:** o detector já impede que o erro entre em
silêncio, que era o dano real. Separar é melhoria de produtividade; **marcar era
correção de integridade.**

**Esforço:** médio. **Valor:** alto para forrageira e orquídea, nulo para soja
(já resolvida em +0,6%).

---

## 4. O que NÃO fazer

Registrado com motivo, para não voltar como boa ideia:

| Não fazer | Por quê |
|---|---|
| Prometer conformidade RAS/ISTA | Nenhuma ferramenta comercial declara isso. Prometer só o verificável: *"implementa as tolerâncias, arredondamentos e regras de emissão da RAS 2025, cap. X rev. Y, e bloqueia fora de tolerância"* |
| Substituir pureza ou germinação | Pureza é peso; germinação é julgamento de estrutura essencial |
| Classificar tetrazólio só por intensidade de cor | A norma decide por **posição e extensão da necrose**. O a\* é insumo, não veredito |
| Reportar acurácia global agregada do TZ | O manual da Embrapa admite que a fronteira 5/6 é subjetiva. A concordância ali vai em separado |
| Medir área pela elipse ajustada | Estreita a distribuição artificialmente e apaga a variabilidade que se quer publicar |
| Watershed na imagem inteira | 77–83% na literatura, e falha estruturalmente em semente alongada |
| Citar o número da portaria da RAS 2025 | **Não foi localizado.** Confirmar com a CGAL antes de escrever |

---

## 5. Sequência sugerida

```
F1 modelo de dados normativo
 ├─→ F2 tolerâncias como bloqueio ──→ F3 laudo BAS/BASO + rebrand
 ├─→ F4 PMS completo
 └─→ F6 classes dinâmicas (forrageira)

F5 emergência de radícula   (independente — pode correr em paralelo)
F7 corte por concavidade    (independente — continua a linha da segmentação)
```

F1 primeiro porque tudo o mais depende do modelo de dados, e mudá-lo depois de
existirem laudos emitidos é caro. F2 e F4 podem correr juntas. F5 é
independente e é a aposta estratégica.

---

## 6. Uma medida de sucesso que não é técnica

O teste desta rodada não é passar em teste unitário. É este: **um analista de
laboratório credenciado olha o laudo e reconhece o documento dele.**

Se ele encontrar os campos que espera, na numeração que conhece, com os quatro
estados de preenchimento corretos, com o arredondamento fechando 100 e com um
bloqueio quando a repetição estoura a tolerância — a ferramenta passa a ser
dele. Se encontrar um relatório bonito de software, continua sendo nossa.
