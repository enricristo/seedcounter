# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento conforme [SemVer](https://semver.org/lang/pt-BR/).

## [3.0.0-beta] — 2026-08

Rodada de aquisição, calibração e análise automática.

### Adicionado
- **Captura por câmera** — lupa/estereomicroscópio no desktop (com seleção de dispositivo)
  e câmera traseira em celular/tablet, com prévia, recaptura e liberação do dispositivo.
- **Calibração espacial multi-método** — DPI de scanner (padrão do laboratório:
  HP Scanjet G2710 a 3600 DPI), objeto de referência medido na imagem, micrômetro
  de platina e µm/px manual; com predefinições de laboratório e verificação de sanidade.
- **Régua interativa** — dois cliques sobre um objeto de dimensão conhecida definem a escala.
- **Réguas nas bordas do canvas** — unidades reais (mm/µm) quando calibrado, adaptadas ao zoom.
- **Detecção por IA (experimental)** — YOLOv8m-seg treinado no dataset do laboratório,
  executado no navegador via ONNX Runtime Web (WebGPU com queda para WASM), com recorte
  em janelas e supressão de não-máximos entre janelas.
- **Morfometria** — reconstrução das máscaras de segmentação, extração de contorno e
  cálculo de comprimento, largura e área por PCA, convertidos pela calibração.
- **Detecção assistida (experimental)** — limiar de Otsu com polaridade automática,
  componentes conexos e separação de objetos encostados por transformada de distância.
- **Ferramentas de edição** — barra flutuante com marcar viável/inviável, borracha com
  raio ajustável, mover imagem; arrastar para reposicionar e clicar para inverter a classe.
- **Atalhos** — `V`, `I`, `X` (inverter), `E`, `H`, `Alt` (borracha temporária), `[` `]`.
- **Painel de Funcionalidades** — feature flags com interface visível no cabeçalho,
  separando recursos estáveis de experimentais.
- **Zoom com a roda do mouse**, ancorado na posição do cursor.

### Alterado
- Créditos e identidade visual: logos GPEOrq e GPSEM, autoria e contato.
- README, site do projeto (GitHub Pages) e documentação reescritos.
- Logos otimizados de 2000×2000 (2,8 MB) para 256×256 (88 KB), reduzindo o cache do PWA.

### Corrigido
- Conflito entre dois estados de "modo mão" que travava as ferramentas de marcação.
- Polaridade invertida na detecção assistida, que marcava o fundo como objeto.
- Travamento na separação de aglomerados (custo quadrático) em regiões muito grandes.
- Carregamento do ONNX Runtime Web sob Vite (import dinâmico por variável não resolvia).
- Normalização de quebras de linha (CRLF/LF) em todo o repositório.

### Infraestrutura
- Docker para desenvolvimento e produção, com healthchecks.
- Integração contínua no GitHub Actions: checagem de tipos bloqueante, lint informativo,
  build e validação das imagens Docker.
- ESLint e Prettier configurados.

## [2.0.0] — 2026

- Refatoração em módulos (`features/`), modo longitudinal, painel estatístico,
  exportação de dataset YOLO e integração PWA.
