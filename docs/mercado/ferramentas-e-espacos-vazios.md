# Ferramentas de análise de imagem de sementes: o que existe e onde estão os espaços vazios

Pesquisa feita em 18/09/2026. Toda afirmação tem fonte. Onde não achei, está escrito "não achei".

Convenção usada no documento:

- **[C]** = confirmado, com fonte citada logo em seguida.
- **[I]** = inferência minha a partir do que confirmei. Não tem fonte direta; é raciocínio.

---

## 1. O cenário de ferramentas

### 1.1 ImageJ / Fiji — o padrão de fato

**O que é [C].** Plataforma aberta de análise de imagem biomédica e biológica, com ecossistema de plugins e macros. Os próprios autores a descrevem como "a platform for discovery" cuja popularidade vem dos ambientes de plugin e macro, "powerful yet approachable" (Schindelin et al., *The ImageJ ecosystem: An open platform for biomedical image analysis*, Molecular Reproduction and Development, 2015 — https://pubmed.ncbi.nlm.nih.gov/26153368/ ; Rueden et al., *ImageJ2: ImageJ for the next generation of scientific image data*, BMC Bioinformatics 2017 — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5708080/ ).

**Como se usa para semente [C].** O caminho normal é `Analyze Particles`, opcionalmente precedido de `Process › Binary › Watershed`. A documentação oficial é explícita quanto ao limite: a contagem automática de partículas "can be done if the image does not have too many individual particles touching" (https://imagej.net/imaging/particle-analysis ). O watershed "is able to split touching objects and it works particularly well for ellipsoid shapes" (https://imagej.net/imaging/watershed ) — ou seja, a própria documentação condiciona o sucesso à forma ser elipsoidal.

**A queixa recorrente [C].** Guias práticos de contagem de semente recomendam ao usuário *evitar o problema na bancada* em vez de resolvê-lo no software: "minimizing instances where two or more seeds are directly touching each other is recommended, as groups of seeds touching each other can get lumped as one object by the software" (Kandlikar Plant Ecology Lab, *Extracting seed counts from photographs* — https://labbook.gklab.org/techniques/seed-counting ). A recomendação operacional é conferir manualmente os aglomerados dando zoom.

**Por que as pessoas continuam usando [I].** Três razões que decorrem do que confirmei acima: (a) é gratuito e não tem fornecedor que possa descontinuar; (b) a macro é um artefato de texto que vai junto do artigo, o que dá reprodutibilidade metodológica que nenhum aparelho fechado dá — há literatura inteira dedicada a escrever macros justamente para "reproducibility and documentation" (por exemplo o pacote neuro-histológico de https://pubmed.ncbi.nlm.nih.gov/31063801/ e o pipeline de fenotipagem de Arabidopsis em https://plantmethods.biomedcentral.com/articles/10.1186/s13007-018-0331-6 ); (c) é revisor-à-prova: "usei ImageJ" não gera pergunta.

**O custo escondido [I].** O ImageJ não resolve semente encostada, não calibra escala sozinho, não classifica, não produz laudo. O que o usuário faz para contornar é trabalho humano (espalhar a amostra, conferir aglomerado no zoom) que não aparece no método publicado.

---

### 1.2 SmartGrain

**[C]** Software de fenotipagem de alto rendimento para forma de semente. Identifica sementes automaticamente e mede comprimento, largura, área e perímetro (Tanaka et al., *SmartGrain: High-Throughput Phenotyping Software for Measuring Seed Shape through Image Analysis*, Plant Physiology 160:1871-1880, 2012 — https://pubmed.ncbi.nlm.nih.gov/23054566/ ; ficha em https://quantitative-plant.org/software/smartgrain ).

**Limitações apontadas por terceiros [C].** Na revisão feita pelos autores do SeedExtractor: "SmartGrain only allows the user to determine the foreground and background colors", "does not extract seed color information", e roda "only on the Windows platform". Além disso, "these applications are not open-source and, therefore, cannot be further developed to improve based on user needs" (Wang et al., *SeedExtractor: An Open-Source GUI for Seed Image Analysis*, Frontiers in Plant Science 11:581546, 2020 — https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2020.581546/full ).

### 1.3 GrainScan

**[C]** Mesma revisão: "GrainScan can only allow the user to set the size parameters", também Windows-only e não aberto (Wang et al. 2020, fonte acima). Na comparação de acurácia contra medida manual de comprimento de semente, a correlação foi 0,84 para GrainScan, contra 0,92 do SmartGrain e 0,93 do SeedExtractor (mesma fonte).

### 1.4 SeedExtractor

**[C]** GUI aberta, feita como resposta explícita às limitações acima. Distribuída em duas formas: versão *standalone* com MATLAB Compiler Runtime (não exige licença MATLAB) e versão regular que exige licença MATLAB. Testado em arroz, trigo, sorgo, feijão comum e girassol. Captura: scanner de mesa Epson Expression 12000 XL a 600 dpi (Wang et al. 2020, fonte acima).

**A restrição que importa [C].** O próprio artigo declara: a aplicação exige que "seeds are not touching each other when imaged". Ou seja, a ferramenta aberta mais recente e mais acurada do grupo **empurra o problema da semente encostada de volta para a bancada**, exatamente como o ImageJ.

**[C]** Também da mesma introdução, sobre equipamento comercial: "Mechanized seed size measuring equipment is expensive, requires regular calibration, and often needs large amounts of seeds to run through the system."

### 1.5 seedQuant

**[C]** Ferramenta de aprendizado profundo (Faster R-CNN) para contar e discriminar sementes germinadas de não germinadas de plantas parasitas de raiz. Acurácia de 94% em *Striga hermonthica*; reduz o tempo de ~5 min para ~5 s por imagem. É aberta e pode ser retreinada para outras sementes (Braguy et al., *SeedQuant: a deep learning-based tool for assessing stimulant and inhibitor activity on root parasitic seeds*, Plant Physiology 186(3):1632-1644, 2021 — https://academic.oup.com/plphys/article/186/3/1632/6226524 ; PMC8260127).

**Ferramenta adjacente [C].** DiSCount, visão computacional para quantificação automatizada de germinação de *Striga* (Plant Methods 2020 — https://link.springer.com/article/10.1186/s13007-020-00602-8 ).

**Observação [I].** seedQuant e DiSCount são o precedente mais próximo de "semente minúscula, milhares por imagem" — e note que ambos vieram de um nicho de pesquisa (plantas parasitas), não da indústria de sementes. Isso é indício de que quem resolve semente pequena são grupos de pesquisa resolvendo o próprio problema, não fabricantes.

### 1.6 Tomato Analyzer

**[C]** Software Windows para analisar fatias de tomate, pimentão, folhas e sementes. Permite medidas "accurate and objective (...) of fruit shape attributes in a high-throughput manner and of traits that are nearly impossible to quantify manually", coletando dados morfológicos e colorimétricos de objetos 2D (van der Knaap Lab — https://vanderknaaplab.uga.edu/tomato-analyzer/ ; código em https://github.com/van-der-knaap-lab/tomato-analyzer ; ficha em https://www.quantitative-plant.org/software/tomato-analyser ).

**[I]** É a ferramenta desta lista conceitualmente mais próxima do SeedCounter em termos de *morfometria de forma* — e é instalável, Windows, e voltada a fruto antes de semente.

### 1.7 PhenoSeeder

**[C]** Plataforma robótica para imageamento de semente e análise morfológica 3D, do Forschungszentrum Jülich. A avaliação de terceiros é dura: "its applications are limited due to costs, availability, and automation level" (citado na revisão de Colmer et al., *SeedGerm*, New Phytologist 228:778-793, 2020 — https://nph.onlinelibrary.wiley.com/doi/10.1111/nph.16736 ; o acesso direto ao texto completo foi bloqueado com 403, a citação chegou por indexação secundária e está marcada como tal).

### 1.8 WinSEEDLE (Regent Instruments)

**[C]** Sistema de análise de imagem para morfologia e doença de acículas e sementes. Usa scanner óptico com sistema de iluminação especial em vez de câmera de vídeo; "scanners produce high resolution images free of illumination problems" (https://regent.qc.ca/assets/winseedle_system.html ; brochura https://regentinstruments.com/assets/images_winseedle/WinSEEDLE_Brochure.pdf ; ficha independente em https://www.quantitative-plant.org/software/winseedle ).

**Preço [C, negativo].** Não é publicado. A página diz que preços saem por download de lista de preços ou contato com o departamento de vendas (mesma fonte). **Não achei** valor.

**[I]** Regent vende o software *casado com um scanner calibrado por eles* (é o mesmo modelo comercial do WinRHIZO). O laboratório que já tem scanner não aproveita.

### 1.9 SeedCount (Next Instruments) — SC6000 / SC6000R

**[C]** Sistema de análise de imagem por reflectância que coleta imagens de alta resolução de sementes e grãos e processa com o pacote SeedCount para medir características físicas (https://nextinstruments.net/index.php/products/seedcount/seed-count-sc6000r-reflectance-image-analysis-system ; brochura 2021 https://www.nextinstruments.net/application/files/3716/3065/6974/SeedCount_SC6000__Brochure_2021.pdf ; ficha em https://www.quantitative-plant.org/software/seedcount ).

**Preço [C, negativo].** Não publicado. **Não achei**.

### 1.10 Vibe QM3i (Vibe Imaging Analytics)

**[C]** Analisador que mede, conta e classifica tamanho, forma e cor de grão. Analisa amostras de até 40 g em menos de 10 segundos, em processo de 3 passos. Reporta peso de mil grãos, uniformidade de cor, dimensões geométricas, fração de grãos quebrados, grãos com fusarium e contaminação (https://www.vibeia.com/seed-and-phenotyping-analyzer-instrument ; https://www.vibeia.com/qm3i-grain-analyzer ).

**[C]** Consta da lista de *nonavailability waivers* do programa Made in America dos EUA, o que confirma que é hardware importado e sem equivalente doméstico americano listado (https://www.madeinamerica.gov/waivers/nonavailability/64c8203b42ea4e198a1a809e ).

**Preço [C, negativo].** Não publicado. **Não achei**.

### 1.11 GroundEye (Tbit, Brasil) — a mais relevante para o mercado brasileiro

**O que é [C].** Equipamento fechado com câmeras acima e abaixo da amostra e software embarcado; o algoritmo extrai **mais de 300 variáveis por objeto analisado** em menos de um minuto, incluindo peso, formato, coloração, espessura, rugosidade e comprimento de plântula. Faz identificação de cultivar, peneiramento eletrônico, avaliação fisiológica de plântula, contagem, pesagem, identificação de defeitos e avaliação de qualidade de tratamento (https://www.tbit.com.br/en/s-series/ ).

**Linha de produtos [C].** S120, S400B, S400D, S800, S800D. O S400D é de câmera dupla "for smaller seeds needing greater precision"; o S800D, o topo de linha, tem 70 kg e oferece "almost 360º vision of each seed" (mesma fonte).

**Culturas declaradas [C].** Pequenas (fumo, trigo, chia, cebola, cenoura) e grandes (milho, soja, algodão, feijão). **Não há menção a forrageiras nem a sementes de orquídea** na documentação do fabricante (mesma fonte).

**Origem [C].** Desenvolvido na Inbatec, incubadora de base tecnológica da Universidade Federal de Lavras (https://alavoura.com.br/pesquisa-inovacao/agtechs/scanner-com-inteligencia-artificial-amplia-precisao-e-agilidade-na-analise-de-sementes/ ).

**Preço — este é o número duro que eu procurava [C].** Uma aquisição pública recente de um GroundEye pela Secretaria da Agricultura, Pecuária, Produção Sustentável e Irrigação do Rio Grande do Sul, para o Centro Estadual de Diagnóstico e Pesquisa Florestal em Santa Maria, foi de **aproximadamente R$ 177.000,00**. Duas fontes independentes dão o mesmo valor:

- https://souagro.net/noticia/2026/04/centro-de-pesquisa-recebe-scanner-de-sementes-com-inteligencia-artificial/ (03/04/2026)
- https://alavoura.com.br/pesquisa-inovacao/agtechs/scanner-com-inteligencia-artificial-amplia-precisao-e-agilidade-na-analise-de-sementes/ (10/04/2026)

**[C]** A mesma reportagem descreve a arquitetura: "as imagens são transferidas para um software instalado no computador acoplado ao equipamento". É um *appliance*: hardware + PC dedicado + software proprietário, comprados juntos.

**Uso em artigo revisado por pares [C].** O GroundEye foi usado com sistema de raios X (Faxitron, 26 kVp, 19 s) e microscopia eletrônica de varredura para caracterizar sementes de paricarana (*Bowdichia virgilioides* Kunth), medindo diâmetros máximo e mínimo e coloração de tegumento em HSB e RGB (Ciência Florestal — https://www.scielo.br/j/cflo/a/gFddwN5rMw7wCcQnJKw4qtS/?lang=pt ; espelho https://www.redalyc.org/journal/534/53458112027/html/ ).

**O que o GroundEye NÃO faz — com evidência [C/I].**

- Não roda sem o hardware. É appliance [C, arquitetura descrita acima].
- Não tem nenhuma menção a forrageira, orquídea ou semente de tamanho sub-milimétrico na documentação do fabricante [C, ausência verificada em https://www.tbit.com.br/en/s-series/ ].
- Não custa menos que R$ 177 mil na configuração adquirida [C].
- **Não achei** nada sobre correção manual do resultado pelo analista, nem sobre exportar a curadoria como dado de treino, nem sobre qual versão de software/modelo gerou cada laudo. Ausência de evidência, não evidência de ausência — mas é notável que o material de divulgação enfatize "eliminar a subjetividade humana" em vez de apoiá-la [I].

### 1.12 SVIS® — Seed Vigor Imaging System

**[C]** Desenvolvido na Ohio State University. Hoffmaster et al., *An automated system for vigour testing three-day-old soybean seedlings*, Seed Science and Technology 31(3):701-713, 2003 (https://www.semanticscholar.org/paper/fbe9eda1521151f3d855bd549d5753ecf2978744 ). Opera sobre imagens digitais de lotes de soja postos em papel toalha; extrai as plântulas do papel, segmenta em normais e anormais, e reduz a plântula normal a uma estrutura-resumo de um pixel de largura.

**O ponto central [C].** O objeto do SVIS é a **plântula**, não a semente seca. Os desenvolvimentos posteriores dos próprios inventores foram para imagens de plântula de soja, milho e melão (mesma fonte).

**Uso no Brasil [C].** Amplamente usado e publicado: cenoura (https://scielo.br/j/sa/a/cWVq5VRBfhQ4RRr6WF9VqsH/?lang=en ), feijão comum (https://www.scielo.br/j/asagr/a/WL6vbYQsnyVYxxbTZ9h6JYm/?lang=en ), crotalária/sun hemp (https://www.scielo.br/j/rbs/a/V7R98NSHRPXmcSYCP63wnyB/?lang=en ).

### 1.13 Vigor-S

**[C]** Sistema brasileiro para avaliação do potencial fisiológico com base no desempenho de plântulas, resultado de parceria entre USP/ESALQ e Embrapa Instrumentação, com financiamento FAPESP. Produz índices de vigor, uniformidade de desenvolvimento e comprimento médio de plântula.

- Soja: *Vigor-S: System for Automated Analysis of Soybean Seed Vigor*, Journal of Seed Science — http://www.scielo.br/j/jss/a/FLhQTxzf7vq3NsjCJRYLrHs/?lang=en
- Milho: *Vigor-S, a new system for evaluating the physiological potential of maize seeds* — https://www.researchgate.net/publication/322196417
- Feijão-caupi: *Assessing the vigor of cowpea seeds using the Vigor-S software*, Journal of Seed Science — http://www.scielo.br/j/jss/a/j5LLKL98JpMvRpMvCWr9VzR/?lang=en
- Validação para fitotoxicidade em plântulas de soja: Embrapa, documento da XIII Jornada Acadêmica — https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1096183/1/p130137Doc401XIIIJA.pdf

**O ponto central, de novo [C].** Vigor-S mede **plântula**. Todo o conjunto de validações publicadas é sobre desempenho de plântula.

### 1.14 O ecossistema brasileiro em volta dessas três

**[C]** O Laboratório de Análise de Imagens do Departamento de Produção Vegetal da ESALQ-USP, coordenado por Francisco Guilhien Gomes Junior, é descrito como pioneiro no uso de técnicas não destrutivas para avaliar qualidade de sementes e plântulas. Trabalha com fluorescência de clorofila, imagens multiespectrais e raios X, em "grandes culturas agrícolas, hortaliças, gramíneas forrageiras e florestais". Foram **quatro edições do curso sobre análise de imagens de sementes e plântulas**, as três últimas organizadas pela **ABRATES**, com cerca de 200 profissionais treinados (Agência FAPESP — https://agencia.fapesp.br/grupo-usa-tecnicas-de-analise-de-imagens-para-avaliar-a-qualidade-de-sementes-de-interesse-agricola/37387 ).

**[I]** Existe público treinado e demanda de treinamento no Brasil. Duzentos profissionais que já fizeram curso de análise de imagem de semente são exatamente quem entende o que um contador de sementes faz sem precisar ser convencido do conceito.

### 1.15 Aprendizado profundo recente para contagem/classificação de semente

**O achado mais útil da pesquisa inteira [C].** Zu, Q., Liu, T., Zhu, W., Pan, Y., Wang, J., Song, X., Yu, J., Dang, S., Yu, X., & Zhang, Z. (2025). *Automated seed counting using image processing and deep learning*. Frontiers in Plant Science 16:1659781. https://doi.org/10.3389/fpls.2025.1659781 (PMC12426890).

- 15 espécies, incluindo alfafa, capim-arroz, *Poa pratensis* (Kentucky bluegrass), caruru, grama-esmeralda (*zoysia*), milho, trigo, amendoim.
- 10, 70 e 100 sementes por imagem. Captura: **smartphone** Huawei Maimang 11 (3024 × 4032), sobre papel A4 branco ou acrílico.
- Compararam três métodos: manual, processamento de imagem clássico (IP, via app PhenoTyper®, em nuvem) e aprendizado profundo (YOLOv5 local via TensorFlow Lite).
- **Resultado:** manual e IP deram 100% de acurácia na maioria das espécies. O método de aprendizado profundo **desabou em sementes pequenas**: contou 27,33 de 100 em caruru-liso (*smooth pigweed*) e 39,83 de 70 em *Poa pratensis*.
- Limitações declaradas pelos autores: o IP "relies on controlled environmental conditions, such as uniform lighting"; o DL "excelled in speed and scalability... but its accuracy was inconsistent for visually complex or densely clustered seeds"; e "the accuracy of the DL model is influenced by the quality and diversity of the training data", com 900 imagens possivelmente insuficientes.

**[I]** Esta é a evidência mais forte que achei contra a ideia de que rede neural resolve semente pequena "de graça". O método simples ganhou do método caro no caso pequeno.

**Outros trabalhos recentes [C]:**

- Y-MFEP: YOLO com realce morfológico (dilatação, erosão, abertura, fechamento, top-hat) para classificação de semente de trigo — https://pmc.ncbi.nlm.nih.gov/articles/PMC13057161/
- Toda et al., *Training instance segmentation neural network with synthetic datasets for crop seed phenotyping*, Communications Biology 3:173, 2020 — https://www.nature.com/articles/s42003-020-0905-5 . Usa dado sintético justamente porque "manual data annotation... often becomes a limiting step".
- Segmentação e restauração de forma de sementes de hortaliça sobrepostas por sim2real — https://www.sciencedirect.com/science/article/abs/pii/S0263224122016116
- AIseed, software automatizado de análise de imagem para fenotipagem de alto rendimento e ensaio não destrutivo de sementes individuais — https://www.sciencedirect.com/science/article/abs/pii/S016816992300128X
- Samplify, ferramenta aberta de segmentação e classificação de aborto de semente em *Arabidopsis*. É **linha de comando**: "a command line tool designed for automated segmentation and classification of Arabidopsis seeds". A verificação de erro é manual e ad hoc: "prediction images were manually checked for misannotations". bioRxiv 2025.09.18.677122 — https://www.biorxiv.org/content/10.1101/2025.09.18.677122v1.full ; código em https://github.com/Ronja-Mueller/Samplify
- ARAMSAM, interface que orquestra SAM 1 e SAM 2 para pré-rotulagem em imagem agrícola. Com 14 especialistas agrícolas, o tempo de interação caiu para 2,1 s por máscara (SAM 1) e 1,6 s (SAM 2) contra 9,7 s desenhando polígono. Frontiers in Artificial Intelligence, 2025 — https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1748468/full (PMC12872900).

### 1.16 Ferramentas de navegador e celular — e uma colisão de nome

**PhenoSnap [C].** Aplicação web gratuita da University of Florida/IFAS para extração automatizada de características de culturas especiais. "No local installation or configuration is required." Mas **o processamento é no servidor**: roda na infraestrutura de computação de pesquisa da instituição (HiPerGator). Culturas: morango e tomate. URL: https://phenosnap.rc.ufl.edu . Publicação AE616, 2025 — https://ask.ifas.ufl.edu/publication/AE616

**Isto é importante [I].** PhenoSnap prova que "roda no navegador, sem instalar" já é reconhecido como diferencial publicável. E ao mesmo tempo delimita o espaço restante: PhenoSnap **sobe a imagem**. "Nada sobe para servidor" continua sendo um espaço não ocupado por ele.

**Colisão de nome — verifique isto antes de investir em marca [C].** Já existe um software chamado **SeedCounter**: aplicativo Android para fenotipagem de grão de trigo, com erro médio absoluto de ~1% na contagem de grãos. Komyshev, Genaev & Afonnikov, *Evaluation of the SeedCounter, A Mobile Application for Grain Phenotyping*, Frontiers in Plant Science 7:1990, 2017 — https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2016.01990/full (PMC5209368). Está no Google Play (`org.wheatdb.seedcounter`) e tem site próprio: http://wheatdb.org/seedcounter . Foi usado por terceiros para sementes de espécies silvestres (https://nstproceeding.com/index.php/nuscientech/article/download/301/295/948 ).

**OpenPheno [C].** Plataforma aberta baseada em smartphone com um módulo "SeedPheno" para tamanho e contagem de semente — https://pmc.ncbi.nlm.nih.gov/articles/PMC12131570/

**Plant Screen Mobile [C].** App móvel aberto para análise de características de planta — https://plantmethods.biomedcentral.com/articles/10.1186/s13007-019-0386-z

---

## 2. Como as pessoas usam de fato

### Equipamento de captura

**Scanner de mesa é o padrão para semente seca [C].**

- SeedExtractor: Epson Expression 12000 XL, 600 dpi (Wang et al. 2020).
- WinSEEDLE é construído em torno de scanner, por decisão de projeto: usa "an optical scanner with a special lighting system instead of a video camera" porque scanners dão imagens "free of illumination problems" (Regent).
- Protocolos de morfometria por scanner descrevem 600 dpi, 24 bits, ~100 sementes por amostra, sementes arranjadas **sem sobreposição**, fundo colorido, TIFF, calibração dimensional contra grade de dimensão conhecida (por exemplo 5 × 5 mm), e calibração de cor com calibrador antes da aquisição (protocolo de morfometria de semente de videira — https://www.researchgate.net/publication/381824049 ).

**[I] Isto é uma confirmação direta e forte de duas decisões do projeto:** a régua na própria imagem resolve o mesmo problema que a "grade de dimensão conhecida" dos protocolos de scanner, e resolve melhor, porque não exige que o laboratório imprima e mantenha um alvo de calibração.

**Celular também aparece [C].** Zu et al. 2025 usaram smartphone; Komyshev et al. 2017 fizeram um app inteiro em torno de celular em campo.

**Multiespectral e raios X é onde a indústria grande está [C].** VideometerLab (Videometer A/S) usado por DLF para contagem automatizada de emergência de radícula em azevém-perene; phenoTest (phenoLytics, Alemanha) faz tomografia 3D de raios X a 50-100 plântulas/2 min, com classificação automática segundo as ISTA Rules (ISTA Seed Symposium 2025 Abstracts, Christchurch, 05-06/05/2025 — https://www.seedtest.org/api/rm/D4XB83A4KVWK8W7/2025-seed-symposium-abstracts-book-final2.pdf ).

### Quantas sementes por imagem

- Zu et al. 2025: 10, 70, 100 por imagem [C].
- Protocolos de scanner: ~100 por amostra, sem encostar [C].
- Paricarana (*B. virgilioides*): 50 sementes por repetição para morfometria, 500 por classificação de cor [C].
- seedQuant/*Striga*: centenas a milhares por imagem — é a escala em que a contagem manual leva ~5 min por imagem [C].

**[I]** Há um vale entre "100 sementes de soja bem espalhadas" e "milhares de sementes de *Striga*". As ferramentas de grão vivem no primeiro; as de pesquisa em plantas parasitas no segundo. Forrageira e orquídea caem no vale.

### Sementes pequenas

**[C]** O caso mais duro documentado: o método de aprendizado profundo de Zu et al. 2025 acertou 27,33 de 100 sementes de caruru-liso e 39,83 de 70 de *Poa pratensis*. Na mesma bateria, o processamento de imagem clássico deu 100%.

**[C]** Para orquídea, o problema declarado na literatura não é a contagem e sim a *interpretação*: "the size of orchid seeds still makes it challenging and the test can be subject to different color interpretations by different people" (revisão de testes de viabilidade em orquídeas epífitas e terrestres, Botanical Studies 2022 — https://link.springer.com/article/10.1186/s40529-022-00333-0 , PMC8831675). Trabalhos de tetrazólio em orquídea relatam imagens digitalizadas a 1200 dpi (mesma revisão).

**[C]** Tetrazólio em orquídea tem protocolo próprio porque tegumento espesso ou escuro atrapalha: Hosomi et al. sobre *Cattleya* (http://www.cropj.com/hosomi_11_10_2017_1320_1326.pdf ) e o trabalho sobre *Dactylorhiza fuchsii* e *Vanda curvifolia* publicado em Seed Science and Technology 44(1), 2016 (https://www.ingentaconnect.com/content/ista/sst/2016/00000044/00000001/art00015 ).

**[C]** Há projeto ativo do Royal Botanic Gardens, Kew, para usar aprendizado de máquina em teste de viabilidade de semente de orquídea por tetrazólio, com construção de base de treino e modelo para isolar sementes individuais e classificá-las em vivas, mortas ou vazias (https://www.kew.org/science/our-science/projects/machine-learning-to-improve-orchid-viability-testing ; o acesso direto à página foi bloqueado com 403 e a descrição chegou por indexação de busca — marcada como tal).

**Forrageiras [C, parcial].** Achei que a descrição morfológica de semente é usada em análise de pureza para separar espécies de *Urochloa* e que há problema recorrente de identificação errada entre o que se compra e o que nasce no campo (livro *Gramíneas Forrageiras Tropicais*, cap. 15 sobre *Urochloa humidicola* — https://repositorio.ufmg.br/server/api/core/bitstreams/0987d250-d1d4-4f28-9d44-d48f16644e53/content ; Embrapa, identificação de forrageiras — https://www.embrapa.br/en/busca-de-noticias/-/noticia/47908809/identificacao-de-forrageiras ). **Não achei** nenhum software de análise de imagem calibrado e validado para morfometria de semente de *Urochloa*. Isso é uma ausência, não uma prova.

### Grãos

**[C]** É onde tudo está bem servido: SmartGrain (arroz), GrainScan, SeedExtractor (arroz, trigo, sorgo, feijão, girassol), SeedCount SC6000, Vibe QM3i (trigo, arroz, grão em geral), GroundEye (milho, soja, algodão, feijão), SeedCounter móvel (trigo). Cinco produtos comerciais e três acadêmicos disputando o mesmo objeto.

---

## 3. Os espaços vazios — teste das hipóteses

### H1. "Quase toda ferramenta boa exige instalar algo, e laboratório costuma ter máquina travada por TI."

**Primeira metade: CONFIRMADA [C].**

- SmartGrain e GrainScan: Windows-only, não abertos (Wang et al. 2020).
- SeedExtractor: MATLAB Runtime ou licença MATLAB (Wang et al. 2020).
- Tomato Analyzer: Windows (van der Knaap Lab).
- Samplify: linha de comando (bioRxiv 2025).
- GroundEye, SeedCount, Vibe, WinSEEDLE, phenoTest: appliance ou software+hardware.
- ImageJ: instalação de runtime Java.

**Exceções reais que você precisa conhecer [C]:** PhenoSnap roda em navegador sem instalação — mas processa no servidor da universidade. SeedCounter (Komyshev) e OpenPheno rodam em celular — instalam app.

**Segunda metade: NÃO CONFIRMADA. Não achei.** Não encontrei nenhuma fonte publicada que documente política de TI travando instalação em laboratório de análise de sementes. É plausível [I], mas não vou preencher com número que não existe.

**Reformulação que a evidência sustenta [I]:** o espaço não é "não precisa instalar". É "não precisa instalar **e** a imagem não sai da máquina". Nenhuma das ferramentas que achei entrega as duas coisas juntas. PhenoSnap entrega a primeira e falha na segunda. Todas as demais falham na primeira.

### H2. "As ferramentas caras vêm casadas com hardware proprietário, e o laboratório já tem um scanner de mesa."

**CONFIRMADA, e com preço [C].**

- GroundEye é appliance com PC acoplado; aquisição documentada de R$ 177 mil.
- WinSEEDLE é vendido como *system* com scanner e iluminação especial de fábrica.
- SeedCount SC6000R, Vibe QM3i, PhenoSeeder, phenoTest, VideometerLab: todos hardware dedicado.
- E o julgamento de terceiros: "Mechanized seed size measuring equipment is expensive, requires regular calibration, and often needs large amounts of seeds to run through the system" (Wang et al. 2020); sobre PhenoSeeder, "limited due to costs, availability, and automation level" (via Colmer et al. 2020).

**A outra metade também se sustenta [C]:** os trabalhos acadêmicos que não compram appliance usam scanner de mesa comum (Epson Expression 12000 XL, 600 dpi) ou celular.

### H3. "Plântula está bem servida no Brasil por SVIS/Vigor-S/GroundEye — mas semente seca talvez não."

**PARCIALMENTE DERRUBADA.**

**A primeira metade é fortíssima [C].** SVIS, Vigor-S e a literatura brasileira associada são todos sobre plântula: soja, milho, feijão, feijão-caupi, cenoura, crotalária, melão. O objeto declarado do SVIS desde 2003 é a plântula de três dias.

**A segunda metade não se sustenta como escrita [C].** O GroundEye faz semente seca: automatiza contagem e pureza, faz classificação de sementes, e mede formato, coloração, espessura e rugosidade de semente (Tbit). E foi usado em artigo revisado por pares para morfometria de semente seca de espécie florestal (paricarana).

**O que sobra depois de derrubar [C+I]:** o espaço não é "ninguém faz morfometria de semente seca no Brasil". É "**quem faz cobra R$ 177 mil e vem com o hardware junto**". A lacuna é de preço e de forma de entrega, não de função. Isso é mais estreito do que a hipótese sugeria, mas é mais defensável, porque tem um número.

### H4. "Semente pequena é mal atendida: as ferramentas são calibradas para grão."

**CONFIRMADA, e é a hipótese mais bem sustentada de todas [C].**

- Zu et al. 2025: aprendizado profundo contou 27,33/100 e 39,83/70 em sementes pequenas.
- ImageJ condiciona o sucesso a partículas que não se toquem e a formas elipsoidais.
- SeedExtractor **exige** sementes sem contato.
- GroundEye lista fumo, chia, cebola e cenoura como "pequenas" — nenhuma delas é sub-milimétrica; e nada de forrageira ou orquídea.
- A literatura de orquídea descreve o problema como interpretação subjetiva de cor em objeto minúsculo, com imagens a 1200 dpi; e há projeto de Kew montando base de treino do zero para isso.
- Para *Urochloa* especificamente: **não achei** software validado.

**[I]** Quando a única saída dos dois trabalhos acadêmicos de semente pequena que achei foi (a) dado sintético (Toda et al. 2020) ou (b) sim2real para sobreposição (hortaliça), isso diz que a comunidade considera a anotação manual de semente pequena cara demais para ser feita. É exatamente aí que segmentação por clique muda a economia.

### H5. "Ninguém entrega rastreabilidade/reprodutibilidade junto com o resultado."

**CONFIRMADA no nível do laudo; DERRUBADA no nível do conceito [C].**

O conceito existe e é maduro em outro nível de granularidade:

- MIAPPE 1.1 é o padrão mínimo de informação sobre experimento de fenotipagem, formalizado em OWL e alinhado a BrAPI (Papoutsoglou et al., New Phytologist 227:260-273, 2020 — https://nph.onlinelibrary.wiley.com/doi/full/10.1111/nph.16544 , PMC7317793).
- O diagnóstico do campo é explícito: "a recurring challenge has been the lack of coordinated data analytics, metadata management, and computational reproducibility, with many early phenotyping programs relying on project-specific analytical workflows, which limited reusability" (https://www.biorxiv.org/content/10.64898/2026.02.25.707797v1.full ).
- ISO/IEC 17025 exige validação de métodos não normalizados e desenvolvidos pelo laboratório, e rastreabilidade metrológica por cadeia ininterrupta de calibrações — sendo rastreabilidade de medição uma das dez não-conformidades mais citadas em auditorias (https://www.mdpi.com/2076-3417/14/10/4114 ; https://www.isobudgets.com/measurement-traceability-complying-iso-17025-requirements/ ).

**O que continua vazio [C, por ausência + I]:** MIAPPE descreve *o experimento*. A ISO 17025 exige rastreabilidade *do instrumento*. **Não achei nenhuma ferramenta de análise de imagem de semente que emita, junto do resultado, o registro de qual versão do software, quais parâmetros, qual calibração e qual imagem produziram aquele número.** Procurei em SmartGrain, GrainScan, SeedExtractor, Tomato Analyzer, GroundEye, SeedCount, Vibe, WinSEEDLE e Samplify e não achei menção. Ausência de evidência — mas se existisse, seria argumento de venda e estaria na primeira página.

**[I]** E há uma razão para ser assim: o appliance não tem incentivo em publicar seus parâmetros, porque o parâmetro é o produto.

### H6. "A curadoria humana (a máquina propõe, a pessoa corrige) é rara."

**DERRUBADA como afirmação sobre o estado da arte. CONFIRMADA como afirmação sobre ferramentas acessíveis.** Esta é a correção mais importante deste documento.

**A evidência que derruba [C], toda do ISTA Seed Symposium 2025:**

- **GEVES (França), Didier Demilly.** Já em rotina: "a pre-sorting strategy for the OSD sample has been implemented to reduce analysis time by decreasing the weight to be analysed manually. By using an automated system based on AI, coupled with a high-performance sorting system, it is possible to obtain two fractions from the OSD working sample: one safe fraction containing only pure seeds and one doubtful fraction. Only this doubtful fraction will be analysed manually by qualified analysts." E a justificativa é explicitamente humana: "this strategy enables human skills to be preserved and focused on what is [essencial]".
- **Projeto KIRa (Alemanha, financiado pelo Ministério Federal da Alimentação e Agricultura).** O objetivo declarado é "the automation and digitisation of technical seed purity analysis **as an interaction between users (= seed quality analysts) and artificial intelligence**". Construíram base de treino com **206.236 sementes de 34 espécies**, em RGB e hiperespectral 380-1000 nm, catalogadas com metadados, e criaram interface de usuário conectando usuário, sistema físico e IA. Usaram explicabilidade das redes "to make the risk of errors quantifiable".
- **ARAMSAM** (Frontiers in AI 2025): SAM propõe, humano corrige, 2,1 s por máscara contra 9,7 s de polígono.

Fonte do ISTA: https://www.seedtest.org/api/rm/D4XB83A4KVWK8W7/2025-seed-symposium-abstracts-book-final2.pdf

**O que sobra, e é melhor do que a hipótese original [I]:** a curadoria humana não é rara — é **a direção declarada dos laboratórios oficiais europeus e de um projeto de governo alemão**. Mas nas três implementações, ela vem acoplada a robô de separação, esteira, sensor hiperespectral e base de 200 mil sementes. **Não achei nenhuma ferramenta que entregue o padrão "máquina propõe, humano corrige" sem hardware.** Isso é melhor notícia do que a hipótese: não é preciso provar que o padrão é bom — GEVES e o governo alemão já provaram. É preciso provar que ele cabe num navegador.

### H7. "Não há caminho fácil de 'minha análise curada vira dataset de treino'."

**CONFIRMADA [C], e a evidência é indireta mas convergente.**

- Toda et al. 2020 recorreram a **dados sintéticos** explicitamente porque "manual data annotation... often becomes a limiting step" (Communications Biology 3:173).
- Zu et al. 2025 atribuem o fracasso do modelo em semente pequena à base de treino: 900 imagens, "may be insufficient for robust generalization".
- O KIRa teve que montar 206.236 sementes anotadas do zero como pré-requisito de um módulo inteiro.
- ARAMSAM existe justamente para acelerar anotação — mas é ferramenta **de anotação**, separada da ferramenta de análise. Quem anota no ARAMSAM não está produzindo laudo; quem produz laudo no GroundEye não está gerando anotação.

**[I]** A separação entre "ferramenta de trabalho" e "ferramenta de anotação" é a lacuna. Todo dia um analista de laboratório corrige mentalmente o que a máquina errou, e essa correção evapora.

---

### Lacunas que eu achei e que você não listou

**A. O nome já está tomado.** Existe um *SeedCounter* publicado em Frontiers, no Google Play e com site próprio desde 2017 (Komyshev et al.). Não é uma lacuna de mercado, é um risco de posicionamento — e é imediato, porque é a primeira coisa que qualquer revisor ou cliente vai encontrar ao buscar o nome. Ver 1.16.

**B. O gargalo declarado dos laboratórios não é acurácia — é falta de gente.** phenoLytics abre o resumo assim: "In an increasingly digitised and data-driven world where **labour shortages disrupt business-critical processes such as seed testing**, there is a pressing need for globally reproducible, automated and high-throughput phenotyping" (ISTA 2025). O GEVES justifica seu sistema por preservar a perícia humana escassa. Bayer Holland propõe imagem multiespectral "to eliminate subjectivity and ergonomic issues due to repetitive work". **[I]** Isto reposiciona o argumento de venda inteiro: a ferramenta não compete com "o analista faz melhor". Compete com "não tem analista", e com lesão por esforço repetitivo.

**C. "Só se pode otimizar o que se consegue medir com confiança."** Ainda phenoLytics: "Quantitative and objective data of the morphological phenotype of seeds and seedlings are especially required as the ground truth to optimise all processes in seed testing and production, breeding and research; we can only optimise what we can reliably measure. **Current methods for laboratory-based morphological seed/seedling phenotyping still largely rely on visual or 2D-imaging technologies, with many limitations in terms of labour, throughput, standardisation and data quality.**" **[I]** Note que a crítica ao 2D vem de quem vende tomografia 3D — é interessada. Mas a parte sobre *padronização* é verdadeira independentemente do vendedor, e é atacável por software: um laudo que declara parâmetros e calibração padroniza sem precisar de raios X.

**D. O mercado brasileiro tem público treinado e nenhuma ferramenta barata para ele usar.** Quatro edições de curso de análise de imagem de sementes e plântulas, três organizadas pela ABRATES, ~200 profissionais formados (Agência FAPESP). **[I]** Essas pessoas voltaram para laboratórios que, na maioria, não têm R$ 177 mil.

**E. A morfometria por scanner já tem protocolo estabelecido, e a calibração é o passo chato.** Os protocolos mandam calibrar contra grade de dimensão conhecida e calibrador de cor antes de cada aquisição. **[I]** A régua-na-imagem substitui um passo que o protocolo já exige e que hoje depende de o laboratório manter um alvo físico. Isso é vantagem, não gambiarra — e vale escrever assim no material técnico.

---

## 4. Demanda e norma

### ISTA

**Existe estrutura formal para imagem, e ela tem nome [C].** A ISTA tem 19 comitês técnicos, entre eles o **Advanced Technologies Committee (ATC)** (https://www.seedtest.org/en/technical-committees.html ).

**No programa de trabalho 2022-2025 do ATC constam, textualmente** (https://www.seedtest.org/api/rm/FHP4Y8J5Q752UKV/tcom-working-programme-2022-2025.pdf ):

- Publicações: "Overview of all image forming technologies and their application to seeds"; "Report on multi spectral seed imaging in OSD"; "Report on imaging technologies in seed testing".
- Workshops: "Seed Image analysis workshop (Italy)" e "Seed image analysis workshop (t.b.d.)".
- **Projeto especial 19-2:** "Assessment on available technologies of imaging and image analysis for other seeds determination (OSD), purity analysis and germination", em colaboração com PUR (Purity), GER (Germination), TEZ (Tetrazolium) e STA (Statistics).
- Também no ATC: "X-ray test Chapter 14" em desenvolvimento de método, e projeto sobre desenvolvimento de testes rápidos para predizer germinação e vigor "and their potential for automation using image analysis".

**No Purity Committee, projeto especial 1 [C]:** "**New technologies in purity testing (eg Image analysis) and how to validate them for doing purity analysis**", proposto para 2022. Esta é a frase mais importante deste documento do ponto de vista normativo: a ISTA está literalmente perguntando *como validar* análise de imagem para pureza.

**Workshop vindouro [C].** "ISTA Workshop: Imaging Technologies for Seed Testing", 20-22 de outubro de 2026, Buenos Aires. Cobre análise automatizada de imagem, imagem multiespectral e raios X, com foco em teste de pureza, teste de variedade e **considerações de validação**. Limitado a 20-30 participantes. €550 sócios / €825 não sócios. **[CORRIGIDO NA FONTE, 18/09]** A data de 21/09/2026 que constava aqui como "inscrições até" é, na página da ISTA, a fronteira da **política de cancelamento** (antes dela o reembolso é integral menos €50 de taxa; depois, não há reembolso). Não confirmei prazo de inscrição declarado. Como o workshop é limitado a 20-30 vagas, a data continua sendo o momento de decidir — mas por causa da vaga e do reembolso, não por um prazo que talvez não exista. Confirmar direto: ista.office@ista.ch. Menciona que "commercially available solutions" serão apresentadas (https://www.seedtest.org/en/workshops-and-webinars/ista-workshop-imaging-technologies-for-seed-testing-product-10102.html ).

**O que a ISTA exigiria para aceitar [C].** O caminho é o Method Validation Programme: antes de entrar nas ISTA Rules, a maioria dos métodos passa por estudo colaborativo entre laboratórios para garantir que o procedimento dê resultados confiáveis e reprodutíveis conforme as especificações dadas (https://www.seedtest.org/en/technical-committees/method-validation-programme.html ; documento TCOM-P-01, *ISTA Method Validation for Seed Testing* — https://www.seedtest.org/api/rm/GF7463ME47644HQ/tcom-p-01-ista-method-validation-for-seed-testing.pdf ).

**Onde a imagem já está sendo usada na prática por laboratórios oficiais [C].** GEVES em OSD por número; DLF com VideometerLab em contagem de emergência de radícula em azevém-perene; Bayer Holland propondo MSI para aparência física, pureza física e OSD. Todos no ISTA Seed Symposium 2025 (Christchurch, 05-06/05/2025). A keynote foi *Seeing the future – Harnessing machine learning for advanced seed testing through computer vision*, de David Rousseau (Université d'Angers).

**Também [C]:** há artigo em Seed Science and Technology 53(3), 2025, intitulado *Digital image analysis for automated seed germination assessment...* (https://www.ingentaconnect.com/content/ista/sst/2025/00000053/00000003/art00012 ). O acesso ao texto foi bloqueado (403); **não achei** o resumo completo nem a lista de autores. Vale comprar ou pedir.

### Brasil — RAS, MAPA, ABRATES

**A RAS 2025 está vigente e é publicada por capítulo, com número de revisão [C].** Confirmado navegando o WikiSDA do MAPA: "Cap. 01 'Amostragem' rev. 1.4", "Cap. 02 'Análise de Pureza' rev. 1.3", "Cap. 08 'Análise de sementes revestidas' rev. 1.3", "Cap. 10 'Análise de mistura de sementes' rev. 1.4" (https://wikisda.agricultura.gov.br/pt-br/Laborat%C3%B3rios/Metodologia/Sementes/RAS_2025/Pureza e páginas irmãs).

**A RAS não trata de análise de imagem — verificado, não suposto [C].** Baixei o HTML dos capítulos 02 (Pureza) e 10 (Mistura) e busquei os termos "imagem", "automatiz*", "scanner" e "software". **Zero ocorrências em ambos.** O capítulo de Pureza tem 15 ocorrências de "equipamento", nenhuma delas ligada a imagem. (Verificação feita em 18/09/2026 sobre o conteúdo servido pelas URLs acima. Não verifiquei todos os capítulos — só estes dois, que são os mais prováveis de mencionar o tema.)

**Mudanças da RAS 2025 [C].** Novos capítulos de Análise de Misturas, Análise de Sementes Florestais e tabelas de tolerância para uso em fiscalização. Os capítulos que mais receberam contribuições das Comissões Estaduais de Sementes e Mudas foram Amostragem, Análise de Pureza, Teste de Germinação, Análise de Sementes Revestidas e Análise de Sementes de Espécies Florestais (ABRATES — https://www.abrates.org.br/noticia/apos-15-anos-mapa-apresenta-mudancas-nas-regras-de-analises-de-sementes-no-cbsementes/ ; MAPA — https://www.gov.br/agricultura/pt-br/assuntos/noticias/sda-disponibiliza-nova-versao-das-regras-para-analise-de-sementes ).

**Credenciamento [C].** O credenciamento de laboratório de análise de sementes junto ao MAPA é feito pelo RENASEM, com três LASO regionais supervisionando (Centro-Oeste e Tocantins; Norte, Nordeste e Sudeste; Sul) — https://www.gov.br/agricultura/pt-br/assuntos/defesa-agropecuaria/laboratorios-credenciados/las . **Não achei** o número total de laboratórios credenciados; a página não publica contagem nem lista para download.

**ABRATES [C].** Organizou três das quatro edições do curso de análise de imagens de sementes e plântulas (Agência FAPESP). **Não achei** posição normativa ou documento de posição da ABRATES sobre aceitação de análise de imagem como método.

**Síntese normativa [I].** A situação brasileira e a internacional são assimétricas de um jeito que importa para o projeto. No Brasil, a RAS 2025 não menciona imagem: um resultado de imagem hoje é **dado auxiliar**, não método oficial. Na ISTA, há comitê, projetos especiais, workshops e a pergunta de validação em aberto. Portanto o caminho de aceitação passa por produzir exatamente o insumo que a pergunta do Purity Committee pede: um método descrito, parametrizado e reproduzível entre operadores. Uma ferramenta que emite os parâmetros e a calibração junto com o número é candidata a estudo colaborativo; um appliance que não os emite, não é.

---

## 5. Os espaços que eu ocuparia, em ordem

### 1º — Semente pequena, encostada e numerosa, com o humano corrigindo no clique

**(a) A lacuna.** Nenhuma ferramenta acessível resolve o caso em que a semente é sub-milimétrica, está encostada na vizinha e aparece às centenas ou milhares por imagem. As ferramentas de grão exigem que não se toquem; a rede neural erra feio; o appliance não fala dessas espécies.

**(b) A evidência.** SeedExtractor **exige** sementes sem contato (Wang et al. 2020). ImageJ condiciona o sucesso a partículas separadas e a forma elipsoidal (documentação oficial). Zu et al. 2025 mediram o fracasso: 27,33/100 e 39,83/70 em sementes pequenas, contra 100% do processamento clássico. GroundEye não lista forrageira nem orquídea. Para *Urochloa*, não achei software validado. Toda et al. 2020 recorreram a dado sintético porque anotar manualmente é proibitivo. Kew está montando base de treino do zero para orquídea.

**(c) O que o projeto já tem que o coloca perto.** Segmentação por clique; separação de encostadas por concavidade antes do watershed (que é justamente a decisão certa para o alongado, onde o watershed falha — e a documentação do ImageJ confirma que o watershed é feito para elipsoide); histórico por gesto para desfazer engano de clique; borracha e máscara para curadoria.

**(d) O que faltaria construir.** Provar em números que a curadoria por clique é mais rápida que a correção pós-automática nesse regime, com o mesmo tipo de medida que o ARAMSAM publicou (segundos por objeto, com N operadores). Sem esse número, é opinião. Com ele, é artigo.

### 2º — O laudo que se explica: versão, parâmetros, calibração e imagem junto do resultado

**(a) A lacuna.** Ninguém entrega, junto com o número, o registro que permite refazê-lo.

**(b) A evidência.** O Purity Committee da ISTA tem como projeto especial exatamente "New technologies in purity testing (eg Image analysis) **and how to validate them**". O ATC tem o projeto especial 19-2 de avaliação de tecnologias de imagem para OSD, pureza e germinação. A ISO 17025 exige validação de método desenvolvido pelo laboratório e rastreabilidade metrológica, sendo esta uma das dez não-conformidades mais citadas. MIAPPE cobre o experimento, não a análise individual. E a RAS 2025, verificada nos dois capítulos mais prováveis, não menciona imagem — então quem usar imagem no Brasil hoje precisa justificar sozinho. Não achei nenhuma ferramenta de semente que emita esse registro.

**(c) O que o projeto já tem que o coloca perto.** Calibração por régua na própria imagem (que é a mesma função da grade de dimensão conhecida dos protocolos de scanner, sem depender de alvo físico); classes definidas pelo usuário; laudo em PDF/CSV/SQL; laudo que declara o que é pelos campos preenchidos; tolerância que avisa e exige reconhecimento em Observações em vez de bloquear.

**(d) O que faltaria construir.** Fechar o bloco de proveniência: versão do aplicativo, hash da imagem de origem, parâmetros efetivos de cada etapa, fator de calibração e quem curou o quê — impresso no PDF e presente no CSV/SQL. E escrever o método em formato de protocolo, no vocabulário do TCOM-P-01, para que um estudo colaborativo seja possível sem reescrever nada.

### 3º — Morfometria de semente seca a custo quase zero no Brasil

**(a) A lacuna.** Não é que ninguém faça — é que quem faz cobra caro e vem com o hardware.

**(b) A evidência.** SVIS e Vigor-S, que dominam o discurso brasileiro, medem **plântula**: soja, milho, feijão, caupi, cenoura, crotalária, melão. Semente seca no Brasil é território do GroundEye, cuja aquisição documentada foi de **R$ 177 mil** (duas fontes independentes), em arquitetura de appliance com PC acoplado. Ao mesmo tempo, há ~200 profissionais formados em quatro edições de curso de análise de imagem, três organizadas pela ABRATES. E os trabalhos acadêmicos que não compram appliance usam scanner de mesa comum a 600 dpi.

**(c) O que o projeto já tem que o coloca perto.** Morfometria completa (área, comprimento × largura, Feret, solidez), calibração por régua, lote de imagens, CSV — ou seja, a função inteira, sobre o scanner que o laboratório já tem.

**(d) O que faltaria construir.** Um caderno de validação contra o método manual da RAS para duas ou três espécies de grão e uma pequena, com viés e limites de concordância, não só correlação. Correlação alta é o que SmartGrain, GrainScan e SeedExtractor reportaram (0,92; 0,84; 0,93) e é insuficiente para um laboratório decidir adotar.

### 4º — "Nada sobe para servidor" como argumento formal, não como detalhe técnico

**(a) A lacuna.** Rodar no navegador já existe. Rodar no navegador **sem a imagem sair da máquina** não achei em lugar nenhum.

**(b) A evidência.** PhenoSnap é a referência de "web app sem instalação" em fenotipagem e processa no HiPerGator da universidade — a imagem sobe. Todo o resto instala: SmartGrain e GrainScan (Windows), SeedExtractor (MATLAB Runtime), Tomato Analyzer (Windows), Samplify (linha de comando), ImageJ (Java), ou é appliance. O gargalo declarado pelos laboratórios, aliás, é falta de gente ("labour shortages disrupt business-critical processes such as seed testing", phenoLytics, ISTA 2025) — e o que trava adoção de ferramenta nova em laboratório com pouca gente é fricção de implantação, não teto de acurácia.

**(c) O que o projeto já tem que o coloca perto.** A arquitetura inteira. É o que ele é.

**(d) O que faltaria construir.** Transformar a propriedade em documento: uma página técnica que declare, de forma verificável, que nenhuma imagem trafega — e o teste que qualquer TI pode rodar para confirmar (abrir o app, cortar a rede, analisar uma imagem). Isso converte uma característica de engenharia em argumento de conformidade, que é a linguagem de quem autoriza o uso. Observação honesta: **não achei** evidência publicada de laboratório de sementes travado por política de TI, então este argumento deve ser vendido como confidencialidade de amostra de cliente e continuidade offline, não como "sua TI não deixa instalar" — essa segunda parte não consigo sustentar com fonte.

### 5º — A curadoria vira base de treino sem virar um segundo projeto

**(a) A lacuna.** A correção que o analista faz todo dia evapora. Ferramenta de trabalho e ferramenta de anotação são coisas separadas, e ninguém liga uma à outra.

**(b) A evidência.** O KIRa precisou montar do zero 206.236 sementes de 34 espécies em RGB e hiperespectral, com metadados, como pré-requisito de um módulo — financiado pelo Ministério Federal alemão. Zu et al. 2025 atribuem o fracasso em semente pequena a uma base de 900 imagens insuficiente. Toda et al. 2020 fugiram para dado sintético porque anotação manual é o passo limitante. Kew está construindo base de treino de orquídea do zero. ARAMSAM reduz anotação a 2,1 s/máscara — mas é ferramenta separada, de anotação, não de laudo. E o padrão "máquina propõe, humano corrige" já é rotina no GEVES (fração segura / fração duvidosa) e objetivo declarado do KIRa.

**(c) O que o projeto já tem que o coloca perto.** Toda a curadoria já acontece: clique, borracha, máscara, classes do usuário, histórico por gesto. O dado existe na sessão. Só não é colhido.

**(d) O que faltaria construir.** Um formato de exportação de máscaras + rótulos + metadados de captura a partir da sessão curada, com consentimento explícito e local (mesmo princípio de "nada sobe"), e uma convenção de nomes e estrutura que já sirva de entrada para treino. Nota de sobriedade: isto é o quinto da lista e não o primeiro justamente porque o valor só se realiza depois que houver volume de uso. Construir o cano antes da água é o erro clássico aqui.

---

## 6. O que eu não consegui confirmar (lista explícita)

Para não gastar tempo procurando de novo o que eu já não achei:

- Preço de WinSEEDLE, SeedCount SC6000/SC6000R, Vibe QM3i, PhenoSeeder, VideometerLab, phenoTest. Nenhum publica. **Não achei.**
- Número total de laboratórios de análise de sementes credenciados no RENASEM. **Não achei** (a página do MAPA não publica contagem nem lista).
- Qualquer software de análise de imagem validado especificamente para morfometria de semente de *Urochloa*/*Brachiaria*. **Não achei.**
- Evidência publicada de laboratório de sementes impedido por política de TI de instalar software. **Não achei.**
- Posição ou documento normativo da ABRATES sobre aceitação de análise de imagem como método. **Não achei.**
- Texto completo e autoria de *Digital image analysis for automated seed germination assessment*, Seed Science and Technology 53(3), 2025. Bloqueado (403). **Não achei.**
- Texto completo de Colmer et al. 2020 (SeedGerm), New Phytologist. Bloqueado (403); a citação sobre PhenoSeeder veio por indexação secundária e está marcada como tal.
- Página do projeto de aprendizado de máquina para viabilidade de orquídea do Royal Botanic Gardens, Kew. Bloqueada (403); a descrição veio por indexação de busca e está marcada como tal. Vale contato direto.
- Texto completo de *Evaluation and comparison of open source program solutions for automatic seed counting on digital images*, Computers and Electronics in Agriculture, 2015 (https://www.sciencedirect.com/science/article/abs/pii/S0168169915002367 ). Bloqueado (403). **Vale a pena obter** — pelo título, é a comparação mais direta que existe do que este projeto faz.
- Menção a correção manual do resultado, proveniência de versão/parâmetros, ou exportação de treino em qualquer ferramenta comercial pesquisada. **Não achei** — ausência de evidência, registrada como tal.
