# Auditoria de medida — C3.2 (régua) e C3.4 (leitura de código)

Fila de 15/09, item C3 (`docs/superpowers/specs/2026-09-15-fila-bancadas-lote-eixos.md`).
Pergunta: o DPI declarado do scanner é o DPI que a imagem realmente tem? E o
código de medição (`measurements.ts`, `calibration.ts`, `pca-utils.ts`) tem
algum furo de unidade/escala?

---

## C3.2 — Auditoria da régua

**Imagem usada:** `datasets/images/digitalizar_scan/digitalizar0001.jpg`
(13292 × 5765 px). Tem uma régua física digitalizada junto com a amostra —
o único tipo de arquivo em `digitalizar_scan/` com uma referência métrica de
verdade dentro do campo (a maioria das outras digitalizações do lote não
enquadra a régua). As marcações de milímetro ficam entre y≈700 e y≈1400 px
(faixa acima dos algarismos de centímetro).

**Como foi medido:** `scripts/auditar-regua.py` — perfil de contagem de
pixels escuros por coluna, na faixa onde só as marcas de mm aparecem;
agrupa colunas vizinhas em uma marca, e a mediana da distância entre marcas
consecutivas é o passo de 1 mm (ver docstring do script para o motivo do
método e as armadilhas — grão do papel/JPEG cria muito ruído para uma busca
de picos ingênua).

```
python scripts/auditar-regua.py datasets/images/digitalizar_scan/digitalizar0001.jpg --y0 700 --y1 1400 --x0 0 --x1 9000
```

**Resultado:**

| | |
|---|---|
| Marcas de 1 mm detectadas | 27 (26 intervalos) |
| Passo mediano | 186,40 px/mm |
| **10 mm medidos** | **1864,0 px** |
| DPI declarado (`DEFAULT_LAB_DPI`, `calibration.ts`) | 3600 → 1417,3 px esperados p/ 10 mm (7,0556 µm/px) |
| µm/px medido | 5,3648 |
| **DPI efetivo** | **≈ 4735** |
| **Desvio** | **+31,5%** |

**Conferência independente (à mão):** medindo os mesmos algarismos de
centímetro com a ferramenta de leitura de imagem (dois algarismos "0"
vizinhos, 10 marcas de distância) e recontando o espaçamento manualmente,
com o alinhamento entre marcas mais limpo (grupo de picos com folga de
agrupamento maior, reduzindo o efeito de bordas antisserrilhadas partindo uma
marca em duas): **1895,3 px para 10 mm → 5,2762 µm/px → DPI efetivo ≈ 4814,
desvio +33,7%**.

```
python scripts/auditar-regua.py datasets/images/digitalizar_scan/digitalizar0001.jpg --manual-px 1895.3
```

As duas medidas (automática e manual/conferência) concordam dentro de ~2
pontos percentuais — o desvio é real, não artefato do detector.

### Veredito

**Desvio > 1%: o DPI declarado (3600, `DEFAULT_LAB_SCANNER = 'HP Scanjet
G2710'`) NÃO é o DPI efetivo desta digitalização.** A imagem tem
significativamente MAIS pixels por milímetro do que 3600 DPI prevê — o
scanner (ou o software de aquisição) gravou numa resolução mais alta que a
configurada, ou reamostrou/interpolou a favor de mais pixels. Qualquer
medida em µm ou mm calculada com `dpiToUmPerPixel(3600)` sobre esta imagem
está superestimando o tamanho real da semente em ~30%: um objeto que
mede 1900 px na imagem seria relatado como se cada pixel valesse 7,06 µm
(13,4 mm), quando o valor medido pela régua é 5,28 µm/px (10,0 mm) — a
diferença certa entre "parece maior" e o tamanho real.

**O que o app deveria avisar (não implementado aqui — é UI, fora de
`src/lib/`):** quando o método de calibração é `'dpi'`
(`CalibrationData.method`, `calibration.ts`) e a digitalização tem uma régua
ou outra referência métrica visível, o app deveria oferecer conferir o DPI
declarado contra uma medida na própria imagem (o método `'reference'` já
existe e faz exatamente essa conta — `referenceToUmPerPixel` — falta ligar
os dois: propor automaticamente a pessoa clicar em duas marcas quando ela
usa o método DPI, e sinalizar quando a diferença passar de ~1-2%). Sem isso,
uma pasta inteira digitalizada "a 3600 DPI" pode estar sistematicamente
errada da mesma forma, e nada no app avisaria — o CSV sai com números
plausíveis e errados.

**Ressalva:** esta é UMA imagem de UM lote (`digitalizar_scan`, sementes de
orquídea) auditada manualmente; não dá para saber se o desvio de ~30% é do
scanner do laboratório (Scanjet G2710, sistemático em todo o lote) ou desta
digitalização específica sem repetir a régua nas outras ~30 imagens do
mesmo lote. Repetir em mais imagens é o próximo passo óbvio, fora do escopo
desta tarefa.

---

## C3.3 — Auditoria de medida contra a máscara (soja) — ADIADA

A spec pede comparar PCA e Feret contra a máscara de referência da soja
(erro mediano e p95 por método, para decidir qual medida vai para o CSV como
principal). **Não dá para fazer agora**: os fixtures reais da Tarefa A4
(`docs/superpowers/plans/2026-09-13-degrau-2-lote-a-progress.md`) ainda não
existem — são eles que trariam contorno IA + máscara de instância pareados
para a soja. Fica registrado aqui para quando A4 fechar.

---

## C3.4 — Furos de medição/calibração: leitura de código

Lido: `src/lib/measurements.ts`, `src/lib/calibration.ts`,
`src/lib/pca-utils.ts`, `src/lib/detect.ts`, e todo uso de
`calculateSeedDimensions` em `src/` (`grep -rn calculateSeedDimensions src/`).

Cada suspeita da spec, com veredito:

### 1. Área em px² convertida sem elevar µm/px ao quadrado — NÃO É FURO

`measurements.ts:302`:
```ts
const areaUm2 = area * umPerPixel * umPerPixel;
```
Já eleva ao quadrado corretamente (multiplica duas vezes, não uma). O mesmo
vale para `feretMaxMm`/`feretMinMm` (linha 265-266: `(f.maximo * umPerPixel) /
1000` — comprimento linear, uma potência, correto) e para
`formatAreaDual`/`formatArea` em `calibration.ts` (linha 145-157, mesma
multiplicação dupla). Não escrevi teste porque não há comportamento errado
para reproduzir — é leitura direta do código-fonte.

### 2. Contorno em coordenadas da imagem reduzida medido como se fosse da imagem cheia — NÃO É FURO

A suspeita é que `detectObjects` (`detect.ts`) roda a inferência numa cópia
reduzida (`maxProcessingSize`, linha 297: `scale = largest > maxProcessingSize
? maxProcessingSize/largest : 1`) e devolvesse contornos nessa escala
reduzida, que depois seriam medidos como se fossem da imagem original.

Não é o caso: `detect.ts` desfaz a escala ANTES de devolver o resultado.
Linha 513-514, para cada ponto do contorno:
```ts
x: Math.round(roiX + px / scale),
y: Math.round(roiY + py / scale),
```
e a caixa (linha 526-527): `width: Math.round((s.maxX - s.minX + 1) /
scale)`. `polygon_points` sai de `detectObjects` já em coordenadas da imagem
original (mais o deslocamento do ROI, `roiX`/`roiY`) — é isso que
`calculateSeedDimensions` recebe em `App.tsx:713`
(`polygon_points: r.contorno`). O campo `scale` que o resultado carrega
(linha 646) é informativo (para quem quiser saber a razão usada), não algo
que o chamador precise reaplicar.

### 3. `width`/`height` gravados no momento do contorno e não recalculados após edição de vértice — NÃO É FURO (já corrigido no código atual)

A suspeita é real em princípio — mover um vértice muda a forma, e se
`width`/`height` ficassem presos ao valor de quando o contorno foi criado, a
tabela de medidas mentiria depois de qualquer edição manual. Mas o código
atual já recalcula em TODOS os pontos onde a geometria muda, em `App.tsx`:
- `handleMoverVertice` (linha ~1451): `const { width, height } =
  calculateSeedDimensions(pontos);` antes de gravar o segmento editado.
- `handleInserirVertice` (linha ~1478) e `handleRemoverVertice` (linha
  ~1493): idem.
- O corte de contorno alongado (linha ~2132) também recalcula.

Além disso, `buildMeasurements` (`measurements.ts:238`) NUNCA lê o campo
`width`/`height` gravado no segmento — ele chama
`calculateSeedDimensions(poly)` de novo, a partir do `polygon_points` atual,
toda vez que monta a tabela. Os campos `width`/`height` em
`YoloSegmentation` (`types.ts:45-46`) só alimentam o tooltip de hover no
canvas (`MarkingCanvas.tsx`); o CSV/SQL exportado é sempre recalculado do
contorno vigente. Não há como o CSV ficar com uma medida obsoleta por essa
via. (Isto está em `App.tsx`, fora dos meus arquivos — só a leitura, sem
mudança.)

### 4. TIFF com DPI no cabeçalho ignorado — É UMA LACUNA REAL (não é bug de cálculo; é funcionalidade ausente)

`src/lib/tiff.ts` (`decodificarTiff`) lê largura, altura e os pixels RGBA de
um TIFF via `utif`, mas não lê as tags `XResolution`/`YResolution`/
`ResolutionUnit` do IFD — que um scanner grava exatamente para dizer "isto
foi digitalizado a N DPI". Hoje quem abre um TIFF do scanner tem que digitar
o DPI de novo à mão (ou aceitar o padrão do laboratório), mesmo quando o
arquivo já carrega essa informação.

Isto não é um bug de conta (não há teste que "falhe" — não existe conversão
errada, existe uma conversão que poderia ser automática e não é). Consertar
exigiria: (a) em `tiff.ts`, ler as tags 282/283/296 do IFD (`ifd.t282`,
`ifd.t283`, `ifd.t296` na API do `utif`) e devolver um `dpiSugerido?: number`
opcional em `ImagemDecodificada`; (b) em algum lugar de `App.tsx` (fora
destes arquivos), usar esse valor para pré-preencher a calibração em vez do
`DEFAULT_LAB_DPI`. A parte (a) é `src/lib/` e caberia nesta tarefa, mas como
nada hoje CONSOME esse campo (a UI de calibração vive em `App.tsx`/
`features/`), adicioná-lo sem uso seria código morto — por isso fica só
descrito aqui, para quando alguém acoplar a UI. Sinal de que vale a pena: a
régua digitalizada (C3.2) mostrou que o DPI declarado erra por >30% — ler o
DPI do próprio arquivo, quando presente, é uma segunda fonte independente
para desconfiar do número digitado.

### 5. Unidade misturada (µm/px × mm) — NÃO ENCONTRADO

Toda conversão em `measurements.ts` e `calibration.ts` segue o mesmo
caminho: pixels → µm (multiplica por `umPerPixel`, que é µm/px) → mm
(divide por 1000). Não há ponto onde um valor em mm seja multiplicado de
novo por `umPerPixel` (o erro clássico de fator 1000/1000000). Os
comentários no próprio código (`measurements.ts:39-43`, `calibration.ts:139-
141`) documentam essa cadeia explicitamente — sinal de que já foi pensado,
não just aconteceu de estar certo.

### Resumo

| Suspeita | Veredito |
|---|---|
| Área px² sem elevar µm/px ao quadrado | Não é furo — já eleva (measurements.ts:302) |
| Contorno em escala reduzida medido como imagem cheia | Não é furo — detect.ts desfaz a escala antes de devolver (detect.ts:513-514, 526-527) |
| width/height não recalculados após editar vértice | Não é furo — App.tsx recalcula em todo handler de edição; measurements.ts nunca lê o campo gravado, sempre recalcula do polígono atual |
| TIFF: DPI do cabeçalho ignorado | Lacuna real, não implementada — descrita acima; exigiria tocar App.tsx para ter uso, por isso não foi implementada aqui |
| Unidade mm×µm/px misturada | Não encontrado |

Nenhuma correção foi feita em `src/lib/` porque nenhuma das suspeitas
provou um teste que falhasse — o código de medição atual está consistente
nos quatro primeiros pontos, e o quinto (TIFF) é ausência de recurso, não
erro de conta.

## Segunda digitalização (16/09) e a decisão

`digitalizar0002.jpg`, régua na faixa y 1500–2500, x 900–8500: **39 marcas, passo 187,83 px/mm → 1878,3 px por 10 mm → 5,324 µm/px → DPI efetivo 4771 (+32,5%)**.

Duas digitalizações independentes deram 4735 e 4771. A resolução óptica nominal do HP Scanjet G2710 é **4800 dpi**; o laboratório digitaliza a 4800, não a 3600 — o "3600" do app era uma declaração nunca conferida. **Decisão:** `DEFAULT_LAB_DPI` passa a 4800 (commit desta data); `UM_POR_PIXEL_MEDIDO_NA_REGUA` guarda a média medida (5,34 µm/px) para quem quiser o valor empírico; o painel de calibração passa a dizer que o DPI do driver é declaração e que a régua na imagem é a conferência. Toda medida em mm feita antes com 3600 estava **32% maior** que o real.
