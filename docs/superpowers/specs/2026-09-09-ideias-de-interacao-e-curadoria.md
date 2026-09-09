# Ideias de interação e curadoria — rodada de 09/09/2026

Origem: lote de ideias do Enrico, enviado enquanto a frente de normatização corria.
Registrado aqui para não competir por foco na hora, e para a próxima rodada já
começar com o problema formulado.

Estado em 09/09/2026: **o laudo (I0) foi implementado.** As demais são projeto.

---

## I0 — Laudo profissional ✅ FEITO

Rebranding completo, logotipos, metadados, imagem original **e** imagem
analisada lado a lado.

Decisão que emergiu na implementação e vale registrar: o documento passou a
**declarar o que é**. Identidade normativa completa → *Boletim de Análise de
Sementes*; incompleta → *Relatório de Contagem*, com a ressalva impressa no
corpo e no rodapé. Quem decide é `conferirParaEmissao`, a mesma função do painel
de pendências — não existe caminho para imprimir "Boletim" sem os campos que o
boletim exige.

Ver `src/lib/laudo/`.

---

## I1 — Borracha de segmentação

**A ideia.** Quando a onda segmenta demais — pegou sombra, pegou a vizinha
encostada — a pessoa vai raspando as bordinhas de fora, e o contorno se fecha e
se reajusta sozinho.

**Por que é uma boa ideia, tecnicamente.** Ela ataca o modo de falha dominante
que a medição do baseline expôs: em forrageira, **9 de 30 segmentações engoliram
a vizinha** (30%). Hoje o único remédio é apagar tudo e clicar de novo, o que
descarta também a parte que estava certa.

**O ponto não óbvio.** "Vai fechando e se ajustando" é a parte difícil e a parte
valiosa. Uma borracha que só apaga pixel deixa o contorno esfarrapado. O que
faz a borda *se reassentar* depois de raspar é rodar de novo a mesma decisão de
fronteira da onda, agora restrita ao que sobrou — ou seja, a borracha não é uma
ferramenta de pintura, é uma **restrição a mais no problema de segmentação**.

Duas formulações plausíveis, a decidir na hora:

- **Recorte com reassentamento local.** Apaga os pixels sob o cursor, depois
  reexecuta o crescimento só na vizinhança da borda afetada, com os pixels
  raspados marcados como proibidos. Barato, local, previsível.
- **Corte por caminho de custo mínimo** (estilo *intelligent scissors* /
  *livewire*). A raspada define de onde a fronteira deve fugir, e o contorno se
  refaz pelo caminho de maior gradiente que respeita essa proibição. Mais
  elegante, resolve o caso de "duas encostadas" de uma vez, mais caro.

**Depende de:** nada. Pode começar já.
**Relação:** é a alternativa *manual* ao corte por concavidade (F7). As duas se
complementam — a automática resolve o caso fácil em lote, a borracha resolve o
caso que a automática errou.

---

## I2 — Botão de máscara (mostrar/ocultar)

**A ideia.** Um botão que oculta pontos e segmentações, para ver a imagem crua.

**Por que importa mais do que parece.** É a única forma de a pessoa **conferir**
a anotação: com o overlay ligado, o olho não consegue julgar se aquele contorno
está sobre uma semente ou sobre uma sombra, porque o overlay é justamente o que
tapa a evidência. Sem alternância, a conferência é um ato de fé.

É também o mesmo argumento que motivou as duas imagens no laudo — e por isso
essas duas peças são a mesma ideia em dois lugares.

**Escopo mínimo:** três estados (tudo / só pontos / nada), com tecla de atalho —
alternância precisa ser mais rápida que a dúvida.
**Depende de:** nada. É pequeno e destrava conferência.

---

## I3 — Galeria de segmentações

**A ideia.** Ver todas as segmentações recortadas, sem fundo, lado a lado. Para
as que só têm ponto e não têm contorno, recortar uma caixa em volta do ponto e
mostrar essa região — "sei que aqui tem algo de interessante, só preciso
determinar o contorno dentro desta região".

**Por que esta é a ideia mais forte do lote.** Ela muda a unidade de trabalho.
Hoje a pessoa trabalha na *imagem*: procura o erro no meio de 200 objetos, com
zoom e pan. Na galeria a pessoa trabalha no *objeto*, e o erro salta —
comparação lado a lado é o que o olho humano faz bem e o que a imagem inteira
impede.

E o ponto sobre "ponto sem contorno" é a parte mais fina: transforma a marcação
manual em **proposta de região**. O trabalho deixa de ser "encontre e contorne"
e vira "contorne o que já foi encontrado", que é um problema bem menor e é
exatamente a divisão de trabalho que a onda foi feita para servir.

**Depende de:** nada tecnicamente, mas rende muito mais depois de I1 (a borracha
seria acionada de dentro da célula da galeria).

---

## I4 — Classes dentro das segmentações

**A ideia.** A partir da galeria, criar classes facilmente, com os exemplares
visualmente próximos. Bom para determinar tonalidade e porcentagem.

**A conexão com a norma, que é o que dá peso.** Isto é a interface de
**classificação topográfica do tetrazólio**. A memória
`criterio-do-tetrazolio-e-topografico` registra que a RAS 2025 decide por
posição e extensão da necrose, não por intensidade de cor. Uma galeria agrupável
é a ferramenta em que essa decisão é *tomada por uma pessoa* e apenas *registrada*
pelo software — que é a única divisão de trabalho defensável aqui.

Serve igualmente para as classes de forrageira (F6: dormente / dura / vazia /
morta), onde a classificação também é do analista.

**Depende de:** I3.
**Cuidado registrado:** as classes precisam ser dado do laboratório, não
constante no código — espécie diferente tem classe diferente, e a de orquídea
não é a de *Urochloa*.

---

## I5 — Removedor de fundo

**A ideia.** Remover o fundo para facilitar a segmentação, sobretudo em scanner
e lupa.

**O que já existe.** `src/lib/background.ts` já modela o fundo por superfície
polinomial de 2ª ordem com IRLS, e classifica pixel em fundo / sombra / objeto.
A peça que falta não é o algoritmo — é **expor isso como ação**: aplicar o
modelo e devolver a imagem com o fundo achatado, para a onda e o YOLO
trabalharem em cima.

**O ganho esperado, e por que é mensurável.** O scanner é justamente o caso em
que o modelo de fundo é mais confiável (iluminação controlada, fundo uniforme) e
em que o gradiente de iluminação mais atrapalha a onda. Dá para medir com o
baseline que já existe: 30 sementes por cena, erro mediano por cena, antes e
depois.

**Depende de:** nada. O núcleo está pronto e testado.
**Relação com o YOLO:** cuidado — o modelo foi treinado em imagem original.
Achatar o fundo é *alteração*, e a memória já registra que o YOLO degrada em
imagem alterada. Então: fundo removido serve à onda e ao olho; para o YOLO,
continuar mandando a original.

---

## I6 — Modo avançado de segmentação assistida

**A ideia.** Mais configurações e controles para a detecção assistida.

**A ressalva que precisa acompanhar.** Parâmetro exposto sem medida vira
tentativa e erro, e tentativa e erro num instrumento de medição vira ajuste até
o número agradar — que é o pior desfecho possível num laboratório.

Portanto o modo avançado só deve nascer junto de **um jeito de saber se ficou
melhor**: aplicar a mudança sobre a cena sintética de referência (ground truth
conhecido) e mostrar o erro antes/depois. Sem isso, o painel é uma armadilha.

**Depende de:** os parâmetros da onda (já planejado) + a cena sintética (já
existe, `synthetic-scene.ts`).

---

## Ordem sugerida

```
I2 (máscara)  ──▶ destrava conferência, é pequeno
I3 (galeria)  ──▶ muda a unidade de trabalho; maior ganho por esforço
I1 (borracha) ──▶ dentro da galeria, ataca os 30% de vizinha engolida
I5 (fundo)    ──▶ núcleo pronto; medir antes/depois no baseline
I4 (classes)  ──▶ depende de I3; é a interface do TZ topográfico
I6 (avançado) ──▶ só com medida de erro junto
```

I2 e I3 antes de tudo: as duas reduzem o custo de *achar o erro*, e todas as
outras são ferramentas para *corrigir* o erro. Não adianta afiar a correção
enquanto encontrar continua caro.
