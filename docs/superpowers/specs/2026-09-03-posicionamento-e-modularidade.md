# Posicionamento e modularidade — para onde o SeedCounter vai

- **Data:** 2026-09-03
- **Status:** análise e proposta de arquitetura conceitual. **Nada implementado.**
- **Origem:** pedido de Enrico S. Ambrosio para organizar as ideias e buscar referências de mercado.

## 1. O que existe no mercado

Levantamento feito em setembro de 2026. Três categorias, e nenhuma ocupa o lugar que o SeedCounter ocupa.

### MachVision — Argentina, desde 1994

A referência que motivou este levantamento. Desenvolve hardware **e** software próprios, é a única empresa argentina que fabrica a própria linha de equipamentos de visão para inspeção agroindustrial, e tem presença na América, Europa, Ásia e África.

| Produto | O que faz |
|---|---|
| **MV 360** | 3 imagens por grão para cobrir toda a superfície; pureza física, material estranho, uniformidade de tamanho, granulometria, histogramas de dimensão, contagem por classificação |
| **Rice Analyzer** | defeitos de arroz: picado, riscado, mal polido, ardido, ambarino, panza blanca, gessado, mistura varietal, quebrado |
| **MV Espigas** | espigas de milho não destrutivo: contagem de grãos, dimensões, % de área granada, grão chato × redondo |

Números citados: amostra de ~500 g em **60 a 90 segundos**, contra 20 a 40 minutos manuais.

### MARVIN — GTA Sensorik / MARViTECH, Alemanha

Bandeja de amostra + medição óptica + pesagem. Tamanho, forma e peso; peso de mil sementes; fracionamento por comprimento, largura e área.

Números citados: medição em **menos de 3 segundos**, acurácia de contagem **≥ 99%**, sementes a partir de **0,2 mm**. Usado por empresas como a Hazera em rabanete, cebola, melancia, tomate e pepino.

### Pesquisa acadêmica

- **AIseed** (*Computers and Electronics in Agriculture*, 2023) — fenotipagem de alto rendimento com módulos de clareza, pureza, vigor e viabilidade por aprendizado de máquina.
- **Imagem multiespectral + ensemble** — viabilidade não destrutiva em *Allium ulleungense*: AUC 0,93, acurácia 90%.
- A literatura de revisão descreve 2021–2025 como fase particularmente fértil, e registra o problema que interessa aqui: os testes convencionais de vigor, **tetrazólio incluído, são destrutivos e exigem de 3 a 7 dias de trabalho intensivo** — gargalo para triagem em escala.

## 2. Onde o SeedCounter é diferente

Quatro diferenças, e nenhuma é "fazemos melhor". São mercados diferentes.

**Hardware.** MARVIN é um aparelho de bandeja. MachVision fabrica os próprios equipamentos. O SeedCounter roda **no navegador**, sobre um scanner de mesa comum ou um celular encostado na ocular de uma lupa. A diferença de custo é de duas a três ordens de grandeza — e é o que o torna usável por um laboratório universitário, não só por uma empresa de sementes.

**O que é medido.** MARVIN faz tamanho, forma e peso. MachVision faz defeito e pureza. **Nenhum dos dois lê viabilidade.** O SeedCounter ataca exatamente o gargalo que a literatura aponta: a leitura do tetrazólio, hoje manual, exaustiva e subjetiva.

**A escala do objeto.** Semente de orquídea tem ~1 mm e parece poeira. MARVIN atende a partir de 0,2 mm, mas como bandeja para peso de mil sementes — não segmenta indivíduo por indivíduo sob aumento. O caso difícil é o diferencial.

**Auditabilidade.** Os sistemas comerciais entregam um número. Para pesquisa, o que torna o resultado publicável é o rastro: qual imagem, qual critério, o que a IA propôs, o que o humano corrigiu. Isso não é acessório — é a condição de o dado entrar num artigo.

> Resumo: o SeedCounter não compete com MARVIN nem com MachVision em vazão de *commodity*. Ele ocupa o lugar que os dois não atendem — **semente microscópica, viabilidade por coloração, hardware barato e registro auditável de curadoria humana**.

## 3. Modularidade: o conceito de Protocolo de Análise

O pedido foi: "às vezes contar só embrião, às vezes só com TZ; o programa ser modular para várias situações; futuramente criar mais classes; algo dinâmico".

Isso pede **uma** abstração, não uma pilha de opções soltas. A proposta é o **Protocolo de Análise**: uma configuração nomeada e versionada que define, junta, tudo o que muda de um ensaio para outro.

Um protocolo declara:

| Campo | Exemplo — Tetrazólio Cattleya | Exemplo — Contagem de embrião |
|---|---|---|
| **Classes** | viável, inviável | com embrião, sem embrião |
| **Critério** | núcleo com qualquer grau de vermelho → viável; branco ou opaco → inviável; visivelmente vazia → não anotada | presença de embrião visível, sem julgar coloração |
| **Aquisição** | lupa, TZ 1%, 40 °C/12 h | scanner 3600 DPI |
| **Calibração** | micrômetro de platina | DPI do scanner |
| **Medidas** | comprimento, largura, área, razão C/L | contagem apenas |
| **Regras** | descartar objeto < 0,4 mm | idem |
| **Modelo** | pesos treinados para TZ | pesos para contraste claro |

Três consequências que valem o esforço:

1. **O critério de anotação deixa de ser folclore.** Hoje ele existe só na cabeça de quem anotou — e a decisão metodológica de que semente vazia *não* é anotada não aparece em lugar nenhum da interface. No protocolo, ela é texto exibido e exportado com o resultado.
2. **Classes deixam de ser fixas em `'viable' | 'inviable'`.** Hoje o tipo está gravado em `src/types.ts`. Um protocolo com N classes é o que permite acrescentar "incerto", "contaminada" ou "duro" sem reescrever o app.
3. **O relatório passa a dizer sob qual protocolo o número foi produzido.** Dois laboratórios com critérios diferentes deixam de produzir números que parecem comparáveis e não são.

### Custo honesto

Não é pequeno. `Mark.type` e `YoloSegmentation.category` são literais de união usados em toda a árvore — contadores, estatística, exportação, PDF, YOLO. Trocar por classes dinâmicas toca praticamente tudo. **Isto é uma reescrita de modelo de dados, não uma funcionalidade.** Merece um ciclo próprio, com plano e migração dos dados já gravados no IndexedDB.

## 4. Os três modos de trabalho, combinados

O pedido foi "manual, semiautomático e automático, tudo combinado". Eles já existem parcialmente e o que falta é a costura.

| Modo | Hoje | O que falta |
|---|---|---|
| **Manual** | completo — clicar, arrastar, apagar, borracha | nada |
| **Automático** | YOLO no navegador propõe tudo | confiança: morfometria não validada, modelo servido é int8 |
| **Semiautomático** | não existe | **é a lacuna** |

O semiautomático é a ideia do mouse que Enrico descreveu: *marcar a região onde está a semente e o app identificar ali*. Vale notar que ele é o **mais barato dos três** e provavelmente o de maior retorno:

- Não precisa de modelo novo: roda o YOLO **só dentro da região apontada**, o que já reduz falso positivo e custo de inferência.
- O recorte de ROI implementado em 2026-09-03 já entrega metade da mecânica.
- Cada aceitação e recusa vira dado de curadoria — que é o insumo do retreino.

## 5. Regras lógicas — três níveis

Ordenados por custo, e o primeiro entrega valor sem modelo nenhum.

**Nível 1 · Registrar.** Toda correção humana grava origem e motivo. Não precisa de aprendizado; já produz o dado de retreino e aproveita o `yoloExport` existente.

**Nível 2 · Regras sobre medida.** Com o PCA já calculado e agora exposto em milímetros, dá para escrever regra na unidade que o agrônomo entende: *"descartar objeto com comprimento < 0,4 mm"*, *"marcar como suspeito o que tiver razão C/L fora de 2:1 a 5:1"*. O lote de referência do protótipo dá os limites: 1,17 × 0,34 mm de média, razão ≈ 3,4.

São **auditáveis e explicáveis**, ao contrário de um limiar de confiança. Numa banca, "descartei objetos menores que 0,4 mm porque semente de *Cattleya* não tem esse tamanho" se defende; "o modelo deu 0,43 de confiança" não.

**Nível 3 · Aprender na sessão.** Ajustar limiar ou reordenar propostas a partir das aceitações e recusas, dentro daquela sessão. É o mais próximo do que foi pedido e o mais caro — precisa de desenho cuidadoso para não virar caixa-preta que o pesquisador não consegue justificar.

## 6. Ordem sugerida

1. **Registro de curadoria** (nível 1). Barato, sem modelo, e é pré-requisito de tudo que vem depois.
2. **Detecção dentro da ROI** — o semiautomático. Reaproveita o que já existe.
3. **Regras sobre medida** (nível 2). Agora possível porque as medidas saem em mm.
4. **Validar a morfometria** contra medição manual. Experimento, não opinião: é o que destrava a flag `aiPointer`.
5. **Protocolo de Análise.** Ciclo próprio, com plano de migração.
6. **Aprendizado na sessão** (nível 3), se a prática mostrar que os níveis 1 e 2 não bastam.

## Fontes

- [MachVision — LinkedIn](https://ar.linkedin.com/company/machvision)
- [MachVision — controle de qualidade de grãos (Agromay)](https://agromay.es/producto/machvision-control-de-calidad-de-granos/)
- [MachVision, inovação argentina (Sin Libreto)](https://sinlibretoproducciones.com.ar/tecnologia/machvision-innovacion-argentina-que-acelera-el-control-de-calidad-de-granos/)
- [Inteligência artificial para qualidade de commodities agrícolas (Engormix)](https://www.engormix.com/agricultura/calidad-semillas/argentina-inteligencia-artificial-determinar_n26670/)
- [MARViTECH — sistemas de análise de sementes](https://www.marvitech.de/en/products-for-seed-analysis/)
- [MARVIN Seed Analyser — GTA Sensorik](http://jainsonsindia.com/marvin-seed-analyser-from-gta-sensors-gmbh-germany.html)
- [AIseed — análise automatizada de imagem para fenotipagem de sementes](https://www.sciencedirect.com/science/article/abs/pii/S016816992300128X)
- [Detecção inteligente não destrutiva de sementes — revisão](https://www.sciencedirect.com/science/article/pii/S0889157526004436)
- [Viabilidade não destrutiva por imagem multiespectral e ensemble](https://www.mdpi.com/2077-0472/14/10/1679)
- [Ferramentas de IA para análise de qualidade de sementes](https://www.sciencedirect.com/science/article/pii/S2772899424000430)
