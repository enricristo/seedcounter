<div align="center">

<img src="public/logo-gpeorq.png" alt="GPEOrq" height="60" />&nbsp;&nbsp;<img src="public/logo-gpsem.png" alt="GPSEM" height="60" />

# Contador de Sementes

**Análise de imagem para sementes — contagem, classificação e morfometria diretamente no navegador.**

[![App](https://img.shields.io/badge/app-produção-10b981?style=flat-square)](https://seedcounter.vercel.app)
[![Beta](https://img.shields.io/badge/beta-versão%20de%20teste-f0b45a?style=flat-square)](https://seedcounter-teste.vercel.app)
[![PWA](https://img.shields.io/badge/PWA-offline-5a0fc8?style=flat-square)](#privacidade-e-dados)
[![Licença](https://img.shields.io/badge/licença-MIT-3b82f6?style=flat-square)](LICENSE)

[**Abrir aplicativo**](https://seedcounter.vercel.app) · [Versão de teste](https://seedcounter-teste.vercel.app) · [Site do projeto](https://enricristo.github.io/seedcounter/) · [Como citar](#como-citar)

</div>

---

## O problema

Contar e medir sementes é trabalho manual, lento e sujeito a variação entre operadores. Em sementes de orquídea — que medem entre 0,2 e 2,0 mm — uma única placa pode conter centenas de unidades, e a avaliação de viabilidade depende de julgamento visual repetido milhares de vezes.

O Contador de Sementes reduz esse esforço mantendo o pesquisador no controle: a máquina propõe, o pesquisador confere.

## A solução

Uma aplicação web que roda **inteiramente no navegador**, sem servidor, sem envio de imagens e sem instalação. Funciona offline, no computador do laboratório ou no celular.

| | |
|---|---|
| **Aquisição** | Scanner de mesa, lupa, estereomicroscópio, celular ou tablet |
| **Calibração** | Quatro métodos, para que toda medida tenha unidade física real |
| **Contagem** | Manual assistida, segmentação por clique e detecção por modelo |
| **Análise** | Estatística de germinação, morfometria, cor e acompanhamento longitudinal |
| **Saída** | CSV por semente, banco SQL, PDF, imagem anotada e dataset YOLO |

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
- Atalhos: `V` viável · `I` inviável · `X` inverter · `E` borracha · `H` mover · `Alt` borracha temporária · `[ ]` tamanho

### Segmentação por clique

Clicar numa semente faz uma frente de onda crescer a partir daquele ponto, em CIELAB, até encontrar a borda. A região é o componente conexo do ponto dentro do conjunto de pixels cuja diferença de cor até a referência é menor que uma tolerância — e a tolerância **não é escolhida à mão**: a onda cresce até escapar e recua uma fração.

Por que isso importa: **não depende de espécie nem de modelo treinado**. Funciona em soja, orquídea e forrageira do mesmo jeito, porque é geometria e cor. E o clique é a própria curadoria — a pessoa escolhe onde, o algoritmo responde o quê.

O ponto clicado é a identidade e a localização da semente, não só o gatilho: ele permanece mesmo que a segmentação seja refeita.

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

> CUSTÓDIO, C.C.; HOSOMI, S.T.; MACHADO NETO, N.B. Teste de tetrazólio em sementes de orquídeas. **Boletim de Pesquisa PPGA/Unoeste**, v. 2, n. 2, p. 54–59, 2021.

Dele saem o pré-condicionamento em sacarose (necessário porque a semente de orquídea não tem o aparato para reativar sozinha o metabolismo respiratório), o clareamento e a escarificação com hipoclorito por gênero, e as condições fixas: **40 °C, 24 h, no escuro, 10 a 20 mg de semente por repetição** — que é a ordem de milhares de sementes por imagem, e a razão de existir da contagem assistida.

O padrão de calibração do aplicativo (HP Scanjet G2710) é o mesmo scanner do artigo.

Um levantamento das linhas de pesquisa do grupo, com o mapa entre o que os ensaios exigem e o que o aplicativo faz ou ainda não faz, está em [`docs/superpowers/specs/`](docs/superpowers/specs/).

## Versões

| Versão | Endereço | Conteúdo |
|---|---|---|
| **Produção** | https://seedcounter.vercel.app | Recursos validados para uso em pesquisa |
| **Teste** | https://seedcounter-teste.vercel.app | Recursos em avaliação, incluindo detecção automática |

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

Detalhes em [`docs/DOCKER.md`](docs/DOCKER.md).

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
├─ components/    interface (canvas, ferramentas, réguas, layout)
├─ features/      módulos independentes: câmera, calibração, detecção, IA, estatística
├─ hooks/         estado (marcações, ferramentas, zoom, sessões)
├─ context/       feature flags
└─ lib/           detecção, ONNX, calibração, PCA, exportadores
```

Cada recurso é um módulo isolado atrás de uma feature flag. O aplicativo funciona com todos desligados — nenhuma camada é obrigatória.

## Aplicação a outras culturas

A arquitetura é agnóstica à espécie, e em dois níveis diferentes.

**Sem modelo nenhum.** Marcação manual, segmentação por clique, calibração, morfometria, cor e exportação não sabem que espécie estão medindo. Funcionam em soja, forrageira e orquídea sem treinar nada — é por isso que a segmentação por clique veio antes do classificador.

**Com modelo.** A detecção por rede neural é a única parte que depende de espécie: o modelo embarcado foi treinado em semente de orquídea, com duas classes, e **não serve para outras culturas como está**. Trocar de cultura aqui significa treinar e trocar o `.onnx`.

O ciclo de exportação em formato YOLO existe justamente para fechar essa lacuna: cada contagem revisada vira dado anotado da cultura nova.

## O que falta, e por quê

Registrado aqui porque lacuna conhecida vale mais que lacuna esquecida. O levantamento completo, com a fundamentação de cada item, está em [`docs/superpowers/specs/`](docs/superpowers/specs/).

| Lacuna | Por que importa | Estado |
|---|---|---|
| **Registro de curadoria** | Hoje não há como responder "o modelo está ajudando ou criando retrabalho?". Cada objeto precisa carregar origem (manual, clássico, modelo, clique) e decisão (aceita, corrigida, rejeitada) | Desenhado |
| **Classificador calibrável** | Um limiar sobre o a\* que se recalibra com o que a pessoa curou — auditável, ao contrário de uma rede | Desenhado; depende do registro |
| **Regressão polinomial** | Os ensaios de estresse osmótico têm fator **quantitativo** (MPa), e a análise publicada é regressão com ponto de ótimo — não separação de médias por letras. Para esse ensaio o aplicativo entrega a análise errada | Lacuna aberta |
| **Blocos casualizados (DBC)** | Delineamento dos ensaios de campo de produção de sementes. A ANOVA atual é só de um fator | Lacuna aberta |
| **Classes dinâmicas** | Em forrageira, semente não germinada pode ser dormente, dura, vazia ou morta. A dicotomia viável/inviável não cobre, e contar espigueta vazia como semente produz porcentagem errada | Lacuna aberta |
| **Protocolo por espécie** | Pré-condicionamento, escarificação e clareamento variam por gênero — a Tabela 1 do boletim de 2021 é um catálogo pronto | Lacuna aberta |
| **Separação de sementes encostadas** | A onda usa vizinhança-4 e não junta sementes que se tocam numa quina, mas não separa as que se fundem. Watershed com marcadores é a resposta; a transformada de distância já existe | Lacuna aberta |
| **Textura (GLCM)** | As 28 características que faltam para completar as 54 do AIseed. Servem para pureza física e cariopse vazia, não para tetrazólio — por isso não são prioridade | Adiado com motivo |
| **Validação da morfometria** | Contra medição manual com paquímetro. Espera dados de outras culturas | Aguardando dados |
| **Verificação do pacote de produção** | O CI compila mas nunca **abre** a página compilada. Um ciclo entre pedaços do empacotamento derrubou o site em 2026-09-06 com todo o portão de qualidade verde — foi verificado que o empacotador não avisa desse caso | Risco conhecido |

## Equipe

| | |
|---|---|
| **Desenvolvimento** | Enrico S. Ambrosio — Matemático, graduando em Agronomia · [enrico.ambrosio@unesp.br](mailto:enrico.ambrosio@unesp.br) |
| **Orientação** | Prof. Dr. Nelson Barbosa Machado Neto |
| **Aplicação e validação** | Mayara de Oliveira Vidotto Figueiredo (doutoranda) |
| **Coorientação científica** | Profa. Dra. Ceci Castilho Custódio |

GPEOrq · GPSEM — Universidade do Oeste Paulista (Unoeste)
[@gpeorq](https://www.instagram.com/gpeorq) · [@gpsem_2000](https://www.instagram.com/gpsem_2000/)

## Contribuindo

Fluxo de branches e boas práticas em [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Como citar

> AMBROSIO, E. S.; FIGUEIREDO, M. O. V.; MACHADO NETO, N. B. *Contador de Sementes (SeedCounter): ferramenta client-side para contagem, classificação e morfometria de sementes*. GPEOrq/GPSEM — Laboratório de Sementes e Tecido Vegetal, Universidade do Oeste Paulista, 2026. Disponível em: https://seedcounter.vercel.app

## Licença

MIT — ver [`LICENSE`](LICENSE).
