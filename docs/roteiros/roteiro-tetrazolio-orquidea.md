---
title: "SeedCounter — roteiro de análise"
subtitle: "Tetrazólio e morfometria em sementes de orquídea"
lang: pt-BR
date: "Setembro de 2026"
---

# Antes de começar

Este roteiro acompanha a sua metodologia, não substitui. Onde ele diz "o
aplicativo faz", o método continua sendo o seu — o que muda é quem executa a
contagem e a medida.

O SeedCounter roda **dentro do navegador**. Nenhuma imagem sai da sua máquina:
não há upload, não há servidor, e fechar a aba não manda nada para lugar nenhum.
Isso também significa que **o trabalho fica salvo no navegador daquele
computador**, então use sempre a mesma máquina e o mesmo navegador durante um
ensaio, e exporte ao terminar cada amostra.

## Três coisas para conferir no primeiro dia

**1. Use a versão instalada no computador do laboratório, não o site.**

Existem duas versões do modelo de inteligência artificial: uma leve, que o site
carrega, e uma completa, que só está na máquina do laboratório. A diferença não
é de velocidade — é de **classificação**. A versão leve conta bem, mas erra mais
ao dizer se a semente é viável ou inviável, que é justamente o seu resultado.
Em teste, a completa acertou 24 de 29 onde a leve acertou 7 de 16.

Se o Enrico não tiver dito o contrário, pergunte a ele qual atalho abrir.

**2. Confira o scanner.**

Sua metodologia diz "scanner de mesa HP2470G com resolução de 4800 dpi". Os
arquivos que você já digitalizou declaram valores diferentes disso — 3200 num
caso, 1200 em outro. Vale olhar o aparelho e o que o programa de digitalização
está configurado para fazer.

Isso importa porque a resolução decide **o que é possível medir**:

| Resolução | 1 pixel equivale a | Semente inteira | Embrião |
|---|---|---|---|
| 4800 dpi | 5,3 µm | 66–165 px | **14–23 px** |
| 3200 dpi | 7,9 µm | 44–110 px | 10–15 px |
| 1200 dpi | 21,2 µm | 16–41 px | **4–6 px** |

Um embrião de orquídea tem entre 76 e 120 µm. Com 4 a 6 pixels, **nenhum
programa consegue medir a forma dele** — e a resposta certa nesse caso não é
ajustar o software, é digitalizar em resolução maior. Melhor saber disso antes
de montar a bancada.

**3. Coloque uma régua junto da amostra ao digitalizar.**

Esse é o único acréscimo que peço à sua rotina, e o motivo está na próxima
seção.

---

# Parte 1 — Calibrar a escala

**Por que isto vem primeiro:** sem escala, o aplicativo mede em pixels. Com
escala errada, ele mede em milímetros errados — e esse é o pior dos dois casos,
porque o número *parece* certo.

O valor de DPI que o scanner informa é uma **declaração**: é o que o programa
acha que fez. Já medimos, neste laboratório, uma diferença de 32% entre o DPI
declarado por um scanner e o que a régua da própria imagem mostrava. Uma
diferença dessas entra igual em **todas** as amostras do ensaio, e não aparece
quando você repete — porque não é variação ao acaso, é um desvio constante.

A régua na imagem é quem decide.

## Como fazer

1. Abra a imagem e vá em **Calibração**, na lateral.
2. Em "Método", escolha **Referência**.
3. Clique em **Medir na imagem** e clique nos dois extremos de uma distância
   conhecida — dois traços da régua, por exemplo.
4. Em "Comprimento real", digite quanto vale essa distância (ex.: 10 mm).
5. Clique em **"+ Guardar esta leitura"**.
6. **Repita os passos 3 a 5 em outra região da imagem** — outro trecho da régua,
   de preferência longe do primeiro. Faça pelo menos **três leituras**.

## O que ler no resultado

Depois da segunda leitura, aparece um quadro com:

- **µm/px** — a escala média das suas leituras. É ela que será aplicada, e não a
  última medição.
- **CV** — o quanto as leituras discordaram entre si. Abaixo de 1% está bom.
- **vs. DPI informado** — a diferença entre o que o scanner declarou e o que a
  régua mediu.

Se aparecer um aviso, leia com atenção. Há três:

| Aviso | O que significa |
|---|---|
| "Uma leitura não tem dispersão" | Você mediu só uma vez. Meça mais. |
| "As leituras discordam entre si" | Confira se a régua estava encostada no vidro e se você mediu os mesmos traços. |
| "A escala muda ao longo do eixo…" | A escala é diferente no canto e no meio da mesa. Meça a amostra sempre na mesma região do campo. |

Clique em **Aplicar** ao final. Os três números — quantas leituras, o CV e a
escala medida — vão junto com os seus dados na exportação.

---

# Parte 2 — Contar viáveis e inviáveis

Corresponde ao **item 4.5** da sua metodologia. O critério continua sendo o seu:
tons de rosa a avermelhado são viáveis, sementes brancas são inviáveis.

## Antes de marcar a primeira semente: declare o modo

No rodapé da tela há um relógio e, ao lado dele, um seletor com **manual**,
**assistida** e **automática**. Ele não adivinha nada — você declara.

**Por que isso existe:** ninguém publica quanto tempo leva uma análise de imagem
de sementes, porque ninguém mede. O manual de tetrazólio diz que um analista
experiente rende quatro a cinco amostras por hora; se registrarmos o tempo dos
dois jeitos, na mesma imagem e pela mesma pessoa, você terá um número que quase
nenhum trabalho da área tem.

O relógio conta só o **tempo de trabalho**: para quando você troca de aba e para
quando ninguém mexe em nada por um minuto. Almoço e telefonema saem sozinhos da
conta. E ele **zera a cada imagem ou página**, porque o que interessa é quanto
custou *aquela* amostra.

## Se você for comparar os dois métodos

Faça o **braço manual primeiro**, com o modo em *manual*. Depois de ver a
proposta do computador, ninguém consegue mais desmarcar o que já viu — e a
comparação perde o valor.

## Marcando

Na barra de ferramentas lateral, escolha **Viável** ou **Inviável** e clique
sobre cada semente. O número no rodapé acompanha.

**Se as marcas estiverem tapando as sementes** — e numa amostra densa de
orquídea elas tapam mesmo —, com a ferramenta de marcar ativa aparecem três
controles na lateral:

- **Um botão com o nome do estilo** (Disco, Anel, Ponto, Cruz). Clique para
  alternar. Para amostra amontoada, **Anel** ou **Cruz** deixam ver a semente.
- **Um controle de tamanho** (0,5× a 2,5×).
- **Um controle de opacidade**. Abaixe para enxergar a cor do tetrazólio por
  baixo da marca.

Em todos os estilos, viável e inviável têm **formas diferentes**, não só cores
diferentes — para a figura continuar legível se for impressa em preto e branco.

## Contagem assistida

Se for usar a detecção automática, ela **propõe** e você **confere**. Toda
proposta aparece tracejada antes de virar dado, e nada entra na contagem sem
você aceitar. Corrigir uma proposta é normal e esperado — e essas correções são
o material que melhora o modelo para a próxima rodada.

---

# Parte 3 — Morfometria e volumes

Corresponde ao **item 4.9**. Sua metodologia mede 20 sementes por lote no
microscópio, com o ISCapture. O aplicativo não substitui isso — mas se a
resolução da imagem permitir, ele mede **centenas** por lote na digitalização, e
aí o intervalo de confiança da média fecha de um jeito que 20 sementes não
fecham.

## Onde está

Abra o painel **Morfometria**. Ele mostra, para os objetos com contorno:

- comprimento e largura (mediana e faixa de 5% a 95%);
- área;
- diâmetro de Feret — a medida do paquímetro;
- razão comprimento/largura;
- solidez e circularidade.

Tudo em pixels sempre, e em milímetros quando a escala estiver calibrada.

## Os volumes

No fim desse painel há o bloco **Volumes**, com as três equações escritas na
tela e os seus valores dentro:

- **(1)** Ev = ⁴⁄₃ · π · a · b² — embrião, esferoide prolato
- **(2)** Sv = 2 · ⅓ · π · r² · h — semente, dois cones unidos pela base
- **(3)** Var = Sv − Ev — o volume de ar

O comprimento e a largura da **semente** vêm da própria imagem. O **embrião**
você digita, em micrômetros, vindo do microscópio — porque ele está dentro da
testa translúcida e um scanner de mesa raramente tem resolução para separá-lo.
O aplicativo faz a conta e mostra o resultado; ele não finge ter medido o que
não mediu.

A fração de ar não é um número decorativo: em Francisqueti et al. (2024), as
três espécies de semente mais longeva foram justamente as de **menor espaço de
ar, 9% a 11%**.

## Uma decisão que você precisa tomar, e não é do software

Na equação (2), **h** é a altura de *um* cone. Há duas leituras possíveis:

- **h = comprimento / 2** — dois cones unidos pela base, e a figura fechada tem
  o comprimento que você mediu. É o padrão do aplicativo.
- **h = comprimento** — e aí **Sv dobra**, e a fração de ar publicada muda junto.

Há um seletor na tela para escolher. **Confira no artigo original qual convenção
foi usada antes de publicar qualquer número.** Um fator de 2 silencioso num
volume é o tipo de erro que só aparece na banca.

---

# Parte 4 — Exportar

Ao terminar cada amostra, exporte. O trabalho fica no navegador, mas navegador
se limpa.

**CSV de medidas** — uma linha por objeto. Além das medidas, cada linha traz:

- **espécie**, lote e página do arquivo;
- **modo de análise** e **tempo ativo** em segundos;
- **DPI declarado** pelo arquivo e **DPI medido** pela sua calibração;
- **quantas leituras** de calibração e o **CV** delas;
- **versão do programa** e o código exato da compilação.

Esses campos existem para que, daqui a um ano, você consiga responder "de onde
saiu este número?" sem depender da memória. É o que permite replicar o
resultado — e é justamente o que as ferramentas comerciais da área não entregam.

Se algum campo sair vazio, é porque aquilo não foi medido. Vazio é honesto;
número inventado não seria.

**Também disponíveis:** laudo em PDF, imagem anotada, banco SQL e exportação
para treinamento de modelo.

---

# Se algo der errado

Se a tela travar, ficar branca ou algo se comportar de forma estranha:

1. Vá em **Configurações** (ou clique no ícone ao lado do número da versão, no
   rodapé).
2. Procure **Relatar problema**.
3. Clique em **Baixar relatório** e mande o arquivo para o Enrico.

O arquivo é um texto com a versão do programa, o navegador e a sequência do que
você fez antes do erro. **Não contém imagem, nem pixel, nem dado pessoal** —
você pode abrir e conferir antes de enviar. Com ele, um problema que levaria
meia hora de conversa se resolve olhando a sequência.

Se preferir relatar por mensagem, há também **Copiar resumo**.

---

# Resumo da ordem

1. Conferir o scanner e colocar a régua junto da amostra.
2. Abrir a imagem. Conferir a espécie sugerida pelo nome do arquivo.
3. **Calibrar** com pelo menos três leituras da régua. Ler o CV.
4. Declarar o **modo** no rodapé.
5. **Contar** viáveis e inviáveis, ajustando o estilo da marca se ela estiver
   tapando a semente.
6. Ler a **morfometria**; digitar o embrião se for calcular volumes.
7. **Exportar** o CSV antes de passar para a próxima amostra.

Qualquer coisa que não estiver neste roteiro, ou que estiver e não funcionar
como descrito, é falha do roteiro ou do programa — não sua. Anote e mande.
