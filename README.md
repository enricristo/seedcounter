<div align="center">

<img src="public/mark.svg" alt="" height="72" />

# SeedCounter

**Contar · medir · laudar** — análise de imagem de sementes que roda inteira no navegador.

<sub>A marca é o que o aplicativo faz: a semente, e em volta o contorno tracejado que a segmentação propõe — ainda não aceito, esperando o olho de quem analisa.</sub>

[![App](https://img.shields.io/badge/app-produção%20v3.7.0-10b981?style=flat-square)](https://seedcounter.vercel.app)
[![Beta](https://img.shields.io/badge/beta-versão%20de%20teste-f0b45a?style=flat-square)](https://seedcounter-teste.vercel.app)
[![PWA](https://img.shields.io/badge/PWA-offline-5a0fc8?style=flat-square)](#privacidade-e-dados)
[![Licença](https://img.shields.io/badge/licença-MIT-3b82f6?style=flat-square)](LICENSE)

[**Abrir aplicativo**](https://seedcounter.vercel.app) · [Versão de teste](https://seedcounter-teste.vercel.app) · [Site do projeto](https://enricristo.github.io/seedcounter/) · [Como citar](#como-citar)

</div>

---

## O problema

Contar e medir sementes é trabalho manual, lento e sujeito a variação entre operadores. Em sementes de orquídea — que medem entre 0,2 e 2,0 mm — uma única placa pode conter centenas de unidades, e a avaliação de viabilidade depende de julgamento visual repetido milhares de vezes.

O SeedCounter reduz esse esforço sem trocar o julgamento por automação cega: **a máquina propõe, a pessoa confere**. Toda proposta aparece tracejada antes de virar dado, toda medida diz de onde veio, e nada entra na contagem sem alguém aceitar.

## A solução

Uma aplicação web que roda **inteiramente no navegador**, sem servidor, sem envio de imagens e sem instalação. Funciona offline, no computador do laboratório ou no celular.

| | |
|---|---|
| **Aquisição** | Scanner de mesa (PNG, JPG e **TIFF**), lupa, estereomicroscópio, celular ou tablet |
| **Calibração** | Quatro métodos, e a régua da própria imagem para conferir o que o driver declara |
| **Contagem** | Manual assistida, segmentação por clique, receitas de detecção e modelo embarcado |
| **Medida** | Área, comprimento × largura, **Feret**, solidez — com os eixos visíveis e aviso quando a forma não é elíptica |
| **Escala** | Conjuntos de imagens: abrir a pasta de datasets, rodar a mesma receita em lote, medir perfil por classe |
| **Comparação** | **Modo Multibancada**: até quatro cenas abertas, cada uma com imagem, medidas e calibração próprias |
| **Saída** | CSV por objeto (com a origem de cada um), banco SQL, laudo PDF, imagem anotada e dataset YOLO |

## O que as versões 3.6 e 3.7 trouxeram

**Pronto para a bancada.** A 3.6.0 é a versão que a primeira usuária real leva para o laboratório, e a 3.7.0 é o que a verificação do trabalho seguinte encontrou — inclusive dois defeitos que teriam invalidado qualquer resultado da fila com IA (toda semente saía inviável; nenhum contorno chegava) e que nunca chegaram a produção.

| | |
|---|---|
| **Calibração conferida** | A régua medida em vários pontos do campo: µm/px médio, CV, divergência contra o DPI que o arquivo declara, e alerta quando a escala muda de um lado para o outro da mesa. Com leituras guardadas, é a média que vale — e ela vai para o CSV. |
| **TIFF por página** | Uma digitalização de tetrazólio com dez espécies é um arquivo de dez páginas. Seletor no cabeçalho. |
| **Cronômetro por cena** | Tempo de trabalho efetivo (para no ocioso, zera ao trocar de imagem), com o modo — manual, assistida, automática — **declarado** por quem analisa. É o número que nenhum software da área publica, porque nenhum mede. |
| **Marcas que não tapam a semente** | Disco, anel, ponto ou cruz, com opacidade. Em todos, viável e inviável diferem também na forma. |
| **Volumes com as equações na tela** | Embrião (esferoide prolato), semente (dois cones) e ar — escritas ao lado do resultado, para quem apresenta poder apontar. |
| **Uma fonte para cada número** | Contagem, índice e classe vêm de um lugar só; um teste estático impede que alguém volte a contar por conta própria. Sete lugares foram corrigidos. |
| **Germinator dentro do app** | O ajuste de Hill de quatro parâmetros e tudo que a planilha extrai (t50, uniformidade, AUC, MGT), validado contra 24 amostras reais da planilha original. |
| **Regressão polinomial e ponto de ótimo** | A análise certa para fator quantitativo (MPa, horas, meses): graus 1 a 3, F sequencial, ótimo só dentro da faixa observada. |
| **Carregar com a cena ocupada** | Substituir ou adicionar à fila, com a continuidade do experimento proposta pelo nome do arquivo — e a origem de cada proposta visível. |
| **Modos de visualização** | Completo, contagem, laudo, apresentação; dezesseis partes ligáveis; o que o modo esconde também não custa. |
| **Fila com IA cancelável** | "Processar Fila" vira "Parar fila"; a imagem em andamento não vira sessão; falhas e duplicatas no relato. |
| **"Relatar problema"** | Erro que antes deixava tela branca agora mostra o que houve e oferece um relatório sem imagem, sem pixel e sem nome de arquivo. |
| **Catálogo de datasets e 92 exemplos reais** | 23 conjuntos catalogados com origem, licença e formato — o app diz o que é referenciável e o que é só local. 46 exemplos de orquídea corada por tetrazólio, com a escala dizendo de onde veio. |

## O que a versão 3.5.0 trouxe

**A escala estava 32% errada — e o aplicativo agora sabe disso.** O padrão do laboratório assumia 3600 DPI porque é o que o driver do scanner informa. Medindo a régua colada na própria digitalização, em duas imagens independentes, o aparelho entrega ~4735 e ~4771 DPI — e a resolução óptica dele é 4800. O padrão foi corrigido, e o painel de calibração passou a dizer, com todas as letras, que **o DPI do driver é uma declaração; a régua na imagem é a conferência**. Contagens não mudam; medidas em milímetros, sim. Método e números em [`docs/datasets/auditoria-de-medida.md`](docs/datasets/auditoria-de-medida.md).

Esse é o tipo de achado que resume a postura do projeto: preferir o número medido ao número declarado, e escrever a diferença.

| | |
|---|---|
| **Explorador de datasets** | Aponte a pasta uma vez; o aplicativo reconhece o formato de cada conjunto (YOLO caixa ou polígono, multiclasse por CSV, pasta por classe, máscara), lista com miniaturas e carrega a anotação como referência — marcada como tal no CSV. Nada é copiado. |
| **Exemplos reais** | Recortes de conjuntos reais e cenas compostas, com espécie, origem e escala já preenchidas ao abrir (92 na 3.7.0). |
| **Ensaio ao carregar** | Três receitas de detecção lado a lado — mais uma derivada da espécie declarada — com a proposta tracejada ao passar o mouse. Nada é aplicado sem escolher. |
| **Lote** | A mesma receita em N imagens, com miniatura por linha para conferir antes de aceitar, resumo com dispersão, aviso de duplicata e retomada depois de fechar a aba. |
| **Perfil medido por classe** | A versão honesta dos priores: os números vêm da nossa própria segmentação, nas nossas condições, e aparecem acima da referência de literatura. |
| **Modo Multibancada** | Até quatro cenas abertas ao mesmo tempo: quatro imagens para comparar, ou a mesma placa em quatro datas. |

## Recursos

### Aquisição de imagem
- Captura por câmera: lupa e estereomicroscópio no computador (com seleção de dispositivo), ou câmera traseira em celular e tablet
- Importação avulsa ou em lote
- Ajuste não destrutivo de brilho, contraste, gama, saturação e canais RGB, com histograma

### Calibração espacial
Toda medida só tem significado se a escala for conhecida. Quatro caminhos:

| Método | Uso |
|---|---|
| DPI do scanner | Padrão do laboratório: HP Scanjet G2710 a 3600 DPI (≈ 7,06 µm/px) |
| Objeto de referência | Régua, marcação na placa ou o diâmetro da placa, medidos com dois cliques |
| Micrômetro de platina | Lupa e microscópio, onde a escala muda a cada aumento |
| µm/px direto | Quando a escala já é conhecida |

Réguas nas bordas do canvas exibem as unidades reais e acompanham o zoom.

### Contagem e classificação
- Ferramentas em barra flutuante: marcar viável, marcar inviável, borracha com raio ajustável, mover imagem
- Arrastar reposiciona uma marcação; `Ctrl`+clique inverte a classe
- Atalhos: `V` viável · `I` inviável · `S` segmentar por clique · `X` inverter · `E` borracha · `H` mover · `Alt` borracha temporária · `[ ]` tamanho

### Segmentação por clique

Clicar numa semente faz uma frente de onda crescer a partir daquele ponto, em CIELAB, até encontrar a borda. A região é o componente conexo do ponto dentro do conjunto de pixels cuja diferença de cor até a referência é menor que uma tolerância — e a tolerância **não é escolhida à mão**: a onda cresce até escapar e recua uma fração.

Por que isso importa: **não depende de espécie nem de modelo treinado**. Funciona em soja, orquídea e forrageira do mesmo jeito, porque é geometria e cor. E o clique é a própria curadoria — a pessoa escolhe onde, o algoritmo responde o quê.

Um clique marca e contorna no mesmo gesto (tecla `S`). A **marcação é criada sempre**, mesmo quando o contorno não sai confiável — o ponto clicado é a identidade e a localização da semente, e a contagem não pode depender de o algoritmo ter acertado a borda. O contorno só entra quando dá para confiar: contorno errado vira área e comprimento no CSV, e número errado é pior que número nenhum.

### Trabalhar com imagens grandes
- **Divisão de digitalização** — fatia a folha do scanner em N pedaços e envia todos para a fila
- **Recorte circular (ROI)** — delimita o campo da ocular, corta o entorno escuro e restringe a detecção
- **Região de detecção** — um retângulo desenhado com o mouse restringe onde os detectores procuram. Numa digitalização a 3600 DPI a varredura completa são centenas de janelas e minutos de espera; uma região são segundos

### Análise

**Estatística.** Taxa de germinação com intervalo de confiança de Wilson (preferido ao de Wald em amostra pequena e em proporção extrema). Comparação entre tratamentos com transformação arcsin√x, verificação de normalidade e o caminho apropriado:

| Situação | Teste |
|---|---|
| Fator qualitativo, normalidade não rejeitada | ANOVA + **Scott-Knott** (padrão na agronomia brasileira) ou Tukey-Kramer HSD |
| Normalidade rejeitada com amostra suficiente | Kruskal-Wallis + Dunn com correção de Holm |
| Menos de 5 repetições | O teste de normalidade não tem poder e o painel diz **"não avaliável"** em vez de inventar veredito |

**Cinética.** IVG (Maguire, 1962), tempo médio de germinação, t50 e curva acumulada por dias após semeadura.

**Longitudinal.** O eixo do tempo é declarado por experimento: *dias após plantio*, onde a mesma placa é reavaliada e os índices de vigor fazem sentido; ou *dias de armazenamento*, onde cada data é uma amostra nova do lote, a curva é de deterioração e o painel esconde os índices que não se aplicam.

**Morfometria por semente.** Comprimento, largura, área, perímetro, razão de aspecto e circularidade — em pixels, µm e mm.

### Cor e tetrazólio

Vinte características de cor por semente, medidas **dentro do contorno**: média e desvio de R, G, B, H, S, V, L\*, a\*, b\* e cinza. É o mesmo conjunto de cor do AIseed (Tu et al., 2023), para que os dois sistemas sejam comparáveis.

O campo que mais importa é o **a\*** do CIELAB — o eixo verde–vermelho, e portanto a medida direta do que o critério do teste de tetrazólio descreve em palavras ("núcleo com qualquer grau de vermelho → viável"). Em espaço perceptualmente uniforme, o limiar transfere entre capturas: numa amostra medida, o canal R variou mais de 40 níveis entre condições de brilho enquanto o a\* variou menos de um quinto disso.

### Exemplos e demonstração

O aplicativo não abre vazio.

- **Cenas de exemplo** (barra lateral) — soja, orquídea com tetrazólio e forrageira, desenhadas por código. Não são digitalizações: a posição, a área e a classe de cada semente são conhecidas, então dá para medir o **erro** do algoritmo, não só olhar o contorno.
- **Ensaios de demonstração** (telas vazias de Longitudinal e Estatística) — quatro experimentos simulados: tetrazólio fatorial, estresse osmótico por manitol, germinação in vitro por DAP e armazenamento de *Urochloa* por três anos.

Tudo marcado com `[DEMO]` e removível sem tocar em contagem real.

### Exportação
- **CSV por semente** — uma linha por objeto, com metadados repetidos para permitir empilhar arquivos
- **SQL** — esquema normalizado (`amostra` + `medida`), compatível com SQLite e PostgreSQL, para acumular safras e culturas
- PDF, imagem anotada, JSON e **dataset no formato YOLO**, para treinar novos modelos

## Como funciona o ciclo

O aplicativo não é apenas uma ferramenta de contagem — é também um gerador de dados de treinamento:

```
adquirir → calibrar → contar e medir → exportar → treinar modelo → volta a assistir a contagem
```

Cada contagem revisada por um pesquisador vira dado anotado. À medida que o conjunto cresce, o modelo melhora, e a contagem seguinte fica mais rápida. É esse ciclo que permite estender a ferramenta para outras culturas.

## Fundamentação científica

A abordagem deste aplicativo **já foi validada e publicada pelo próprio laboratório**, treze anos antes dele existir:

> CUSTÓDIO, C.C.; DAMASCENO, R.L.; MACHADO NETO, N.B. Imagens digitalizadas na interpretação do teste de tetrazólio em sementes de *Brachiaria brizantha*. **Revista Brasileira de Sementes**, v. 34, n. 2, p. 334–341, 2012. [doi:10.1590/s0101-31222012000200020](https://doi.org/10.1590/s0101-31222012000200020)

Cinco lotes avaliados por tetrazólio de duas formas — sob estereomicroscópio e por análise de imagem digitalizada a 1200 dpi, com as sementes sobre placa de vidro. **A avaliação por imagem é equivalente à leitura sob estereomicroscópio.** Mesmo laboratório, mesmo teste, mesmo tipo de hardware, revisado por pares — e sobre forrageira, não orquídea.

O protocolo de tetrazólio em orquídeas que o aplicativo representa vem de:

> CUSTÓDIO, C.C.; HOSOMI, S.T.; MACHADO NETO, N.B. Teste de tetrazólio em sementes de orquídeas. **Boletim de Pesquisa PPGA**, v. 2, n. 2, p. 54–59, 2021.

Dele saem o pré-condicionamento em sacarose (necessário porque a semente de orquídea não tem o aparato para reativar sozinha o metabolismo respiratório), o clareamento e a escarificação com hipoclorito por gênero, e as condições fixas: **40 °C, 24 h, no escuro, 10 a 20 mg de semente por repetição** — que é a ordem de milhares de sementes por imagem, e a razão de existir da contagem assistida.

O padrão de calibração do aplicativo (HP Scanjet G2710) é o mesmo scanner do artigo.

Um levantamento das linhas de pesquisa do grupo, com o mapa entre o que os ensaios exigem e o que o aplicativo faz ou ainda não faz, está em [`docs/superpowers/specs/`](docs/superpowers/specs/). O catálogo dos conjuntos de imagem usados na validação — o que cada um responde e o que **não** responde — está em [`docs/datasets/`](docs/datasets/).

## Versões

| Versão | Endereço | Conteúdo |
|---|---|---|
| **Produção** | https://seedcounter.vercel.app | v3.7.0 — recursos validados para uso em pesquisa |
| **Teste** | https://seedcounter-teste.vercel.app | O que está sendo avaliado antes de virar produção |

O histórico completo, em linguagem de quem usa, está dentro do aplicativo (número da versão no rodapé) e, em detalhe técnico, no [`CHANGELOG.md`](CHANGELOG.md).

Recursos experimentais ficam desativados por padrão e podem ser ligados individualmente no painel de Funcionalidades. Números produzidos por recursos experimentais devem ser conferidos antes de uso científico.

## Privacidade e dados

- Imagens e contagens permanecem no navegador (IndexedDB) e **nunca são enviadas a servidores**
- A inferência de modelos roda localmente, no próprio dispositivo
- Funciona offline após o primeiro acesso (PWA instalável)

> Ao migrar entre endereços, exporte o histórico em JSON antes: o armazenamento do navegador é isolado por domínio.

## Executar localmente

Requisitos: Node.js 22+ e npm, ou Docker.

```bash
git clone https://github.com/enricristo/seedcounter.git
cd seedcounter
npm install
npm run dev          # http://localhost:3000
```

Com Docker, para padronizar as máquinas do laboratório:

```bash
docker compose --profile dev up             # desenvolvimento
docker compose --profile prod up --build    # build de produção
```

Detalhes em [`docs/DOCKER.md`](docs/DOCKER.md). Para implantação e uso offline, [`docs/README-DEPLOY.md`](docs/README-DEPLOY.md).

### Modelo de detecção (opcional)

A detecção por IA requer um modelo em ONNX salvo em `public/models/seeds-yolov8m-seg.onnx`. Para exportar a partir de pesos YOLOv8:

```python
from ultralytics import YOLO
YOLO('best.pt').export(format='onnx', imgsz=960, opset=12, simplify=True)
```

Modelos com prefixo `_` em `public/models/` são ignorados pelo controle de versão.

## Arquitetura

```text
src/
├─ lib/           o núcleo puro e testado: objetos (a enumeração canônica), medidas,
│                 calibração, detecção clássica, ONNX, Germinator, regressão, laudo, diagnóstico
├─ features/      uma pasta por funcionalidade: visualização (modos), carregar, lote (fila com IA),
│                 exportar, bancadas, ensaio, datasets, analytics, morfometria, longitudinal…
├─ hooks/         a cena (useBancada), as quatro bancadas, o cronômetro, a fila de imagens
├─ components/    canvas, ferramentas, réguas, layout
└─ theme/         as cores e formas das marcas; os tokens do sistema de design
```

Cada recurso é um módulo isolado; o aplicativo funciona com todos desligados. As regras que sustentam isso — uma fonte por verdade, campo vazio em vez de inventado, sugere-nunca-preenche, forma além da cor — estão em [`AGENTS.md`](AGENTS.md), com o teste que vigia cada uma.

## Aplicação a outras culturas

A arquitetura é agnóstica à espécie, e em dois níveis diferentes.

**Sem modelo nenhum.** Marcação manual, segmentação por clique, calibração, morfometria, cor e exportação não sabem que espécie estão medindo. Funcionam em soja, forrageira e orquídea sem treinar nada — é por isso que a segmentação por clique veio antes do classificador.

**Com modelo.** A detecção por rede neural é a única parte que depende de espécie: o modelo embarcado foi treinado em semente de orquídea, com duas classes, e **não serve para outras culturas como está**. Trocar de cultura aqui significa treinar e trocar o `.onnx`.

O ciclo de exportação em formato YOLO existe justamente para fechar essa lacuna: cada contagem revisada vira dado anotado da cultura nova.

## O que falta, e por quê

Registrado aqui porque lacuna conhecida vale mais que lacuna esquecida. O levantamento completo, com a fundamentação de cada item, está em [`docs/superpowers/specs/`](docs/superpowers/specs/).

| Lacuna | Por que importa | Estado |
|---|---|---|
| **Registro de curadoria** | A metade fácil está feita: cada objeto já carrega a origem (manual, ia, modelo, referência) no CSV. Falta a decisão — aceita, corrigida, rejeitada —, que é o que responde "o modelo ajuda ou cria retrabalho?" | Metade feita |
| **Classificador calibrável** | Um limiar sobre o a\* que se recalibra com o que a pessoa curou — auditável, ao contrário de uma rede | Desenhado; depende do registro |
| **Regressão polinomial** | Os ensaios de estresse osmótico têm fator **quantitativo** (MPa), e a análise publicada é regressão com ponto de ótimo — não separação de médias por letras | Núcleo pronto na 3.7.0 (`lib/regressao-polinomial.ts`); falta a tela |
| **Blocos casualizados (DBC)** | Delineamento dos ensaios de campo de produção de sementes. A ANOVA atual é só de um fator | Lacuna aberta |
| **Classes dinâmicas** | Em forrageira, semente não germinada pode ser dormente, dura, vazia ou morta. A dicotomia viável/inviável não cobre, e contar espigueta vazia como semente produz porcentagem errada | Lacuna aberta |
| **Protocolo por espécie** | Pré-condicionamento, escarificação e clareamento variam por gênero — a Tabela 1 do boletim de 2021 é um catálogo pronto | Lacuna aberta |
| **Separação de sementes encostadas** | O corte por concavidade separa 95,8% dos pares reais, e o aviso de aglomerado passou a sair da própria população da imagem (falso alarme em orquídea caiu de 78% para 13%). O que falta é separar automaticamente sem a pessoa pedir — e em semente alongada o watershed comprovadamente fatia a semente ao meio | Parcialmente resolvido |
| **Textura (GLCM)** | As 28 características que faltam para completar as 54 do AIseed. Servem para pureza física e cariopse vazia, não para tetrazólio — por isso não são prioridade | Adiado com motivo |
| **Validação da morfometria** | Contra medição manual com paquímetro. Espera dados de outras culturas | Aguardando dados |
| **Teste de interface** | O projeto não tem biblioteca de teste de componente: tipos, mais de 1 300 testes de lógica e testes estáticos de estrutura são a rede, mas nenhum deles renderiza tela. Cada entrega de interface depende de um roteiro manual — que fica escrito nos planos, não na cabeça de ninguém | Decisão consciente |
| **Verificação do pacote de produção** | O CI compila mas nunca **abre** a página compilada. Um ciclo entre pedaços do empacotamento derrubou o site em 2026-09-06 com todo o portão de qualidade verde — foi verificado que o empacotador não avisa desse caso | Risco conhecido |

## Equipe

| | |
|---|---|
| **Desenvolvimento** | Enrico S. Ambrosio — Matemático, graduando em Agronomia · [enrico.ambrosio@unesp.br](mailto:enrico.ambrosio@unesp.br) |
| **Orientação** | Prof. Dr. Nelson Barbosa Machado Neto |
| **Coorientação científica** | Profa. Dra. Ceci Castilho Custódio |
| **Aplicação e validação** | Mayara de Oliveira Vidotto Figueiredo (doutoranda) |

GPEOrq · GPSEM
[@gpeorq](https://www.instagram.com/gpeorq) · [@gpsem_2000](https://www.instagram.com/gpsem_2000/)

## Contribuindo

Fluxo de branches e boas práticas em [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Como citar

> AMBROSIO, E. S.; MACHADO NETO, N. B.; CUSTÓDIO, C. C.; FIGUEIREDO, M. O. V. *SeedCounter: ferramenta client-side para contagem, classificação e morfometria de sementes*. GPEOrq / GPSEM — Laboratório de Sementes e Tecido Vegetal, 2026. Disponível em: https://seedcounter.vercel.app

Em formato legível por máquina (Zotero, Mendeley, GitHub): [`CITATION.cff`](CITATION.cff).

## Licença

MIT — ver [`LICENSE`](LICENSE).
