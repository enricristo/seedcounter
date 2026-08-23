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
| **Contagem** | Manual assistida, com ferramentas de edição e atalhos de teclado |
| **Análise** | Estatística de germinação, morfometria e acompanhamento longitudinal |
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
- Arrastar reposiciona uma marcação; clicar inverte a classe
- Atalhos: `V` viável · `I` inviável · `X` inverter · `E` borracha · `H` mover · `Alt` borracha temporária · `[ ]` tamanho

### Análise
- Taxa de germinação com intervalo de confiança de Wilson
- Curvas de germinação e comparação entre tratamentos
- Modo longitudinal para acompanhar experimentos ao longo do tempo
- Morfometria por semente: comprimento, largura, área, razão de aspecto e circularidade

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

A arquitetura é agnóstica à espécie. Trocar de cultura significa trocar o modelo (`.onnx`) e as classes; calibração, contagem, morfometria e exportação permanecem idênticas. O mesmo fluxo se aplica a sementes forrageiras, grandes culturas e ensaios de vigor.

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
