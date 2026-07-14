<div align="center">

# 🌱 Contador de Sementes (SeedCounter)

**Contagem manual-assistida e análise de viabilidade de sementes, direto no navegador.**

[![App ao vivo](https://img.shields.io/badge/app-ao%20vivo-10b981)](https://seedcounter.vercel.app)
[![Feito com Vite](https://img.shields.io/badge/Vite-React%2019-646cff)](https://vitejs.dev)
[![PWA](https://img.shields.io/badge/PWA-offline-5a0fc8)](#)
[![Licença: MIT](https://img.shields.io/badge/licença-MIT-blue.svg)](LICENSE)

[**▶ Abrir o app**](https://seedcounter.vercel.app) · [Como usar](#-como-usar) · [Rodar localmente](#-rodar-localmente) · [Como citar](#-como-citar)

</div>

---

Ferramenta desenvolvida para o **GPEOrq — Laboratório de Sementes e Tecido Vegetal da Unoeste**, voltada à contagem e à análise de viabilidade de sementes (incluindo sementes de orquídea, em escala milimétrica) a partir de imagens de placas. Tudo roda no navegador: **nenhum dado sai do seu computador**.

## ✨ Funcionalidades

- **Marcação manual-assistida** de sementes viáveis e inviáveis com cliques (teclas modificadoras para categorias).
- **Modo diferencial** para separar sementes de detritos/impurezas.
- **Modo longitudinal** para acompanhar experimentos de germinação ao longo do tempo.
- **Estatística embutida**: taxa de germinação, intervalo de confiança de Wilson e curvas de germinação (gráficos).
- **Exportação**: CSV, JSON, imagem anotada e PDF — além de **export no formato YOLO** para treinar modelos de detecção.
- **100% client-side**: os dados ficam no navegador (IndexedDB). Sem backend, sem nuvem.
- **PWA / offline**: pode ser instalado e usado sem internet nos computadores do laboratório.
- **Lotes e backup**: importação de múltiplas placas e exportação/importação do histórico em JSON.

## 🚀 Usar agora

Acesse a versão publicada: **https://seedcounter.vercel.app**

Não precisa instalar nada — abre no navegador e, por ser PWA, pode ser instalado como aplicativo.

## 🧭 Como usar

1. Abra a imagem da placa no aplicativo.
2. Marque sementes viáveis com **clique esquerdo**.
3. Marque detritos/inviáveis com **Shift + clique** (ou clique direito).
4. Acompanhe a contagem e a estatística no painel lateral.
5. Use **Exportar** para salvar CSV / JSON / imagem anotada / PDF.

## 💻 Rodar localmente

Requisitos: **Node.js 22+** e npm (ou apenas Docker).

```bash
git clone https://github.com/enricristo/seedcounter.git
cd seedcounter
npm install
cp .env.example .env      # opcional: preencha GEMINI_API_KEY para as funções de IA
npm run dev
```

Acesse **http://localhost:3000**.

Com **Docker** (ambiente padronizado, ideal para os computadores do laboratório):

```bash
docker compose --profile dev up          # desenvolvimento, http://localhost:3000
docker compose --profile prod up --build  # build de produção, http://localhost:8080
```

Guia completo de Docker e do fluxo de trabalho: [`docs/DOCKER.md`](docs/DOCKER.md).

## 🗂️ Estrutura

```
seedcounter/
├─ src/      