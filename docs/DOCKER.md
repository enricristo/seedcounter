# Guia de Desenvolvimento, Docker e Deploy — Contador de Sementes

Este documento descreve como desenvolver, testar e publicar o app de forma
organizada, usando Docker para padronizar o ambiente e branches git para
controlar o que vai pra produção.

---

## 1. Visão geral da arquitetura

O app é um **frontend 100% estático** (Vite + React + TypeScript + Tailwind +
PWA). Não tem backend: os dados ficam no navegador (IndexedDB via Dexie) e a IA
é chamada direto no cliente (Gemini). Por isso o **Vercel publica o site sozinho**
a cada push na branch `main` — não é preciso Docker para o deploy no Vercel.

O Docker entra aqui para dois objetivos:

1. **Desenvolvimento local padronizado** — rodar o app igual em qualquer
   máquina (sua ou dos computadores do laboratório), sem brigar com versão de
   Node instalada.
2. **Imagem de produção pronta** — caso um dia você queira hospedar fora do
   Vercel (um servidor próprio/VPS, Cloud Run, ou uso offline no laboratório).

O pipeline **Python (YOLO)** fica em `../python` e tem o próprio `Dockerfile`,
mas **ainda não está integrado** ao frontend (roda isolado, via CLI).

---

## 2. Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado.
- Opcionalmente, um arquivo `.env` na pasta `seedcounter/` (copie de
  `.env.example`) — só é preciso para ligar a conta Google ou apontar um
  backend. **Sem ele o aplicativo roda inteiro**, anônimo e offline.

---

## 3. Rodando com Docker

Todos os comandos abaixo são executados dentro da pasta `seedcounter/`.

### Desenvolvimento (com hot reload)

```bash
docker compose --profile dev up
```

Abre em **http://localhost:3000**. O código-fonte é montado por volume, então
qualquer alteração que você salvar reflete na hora no navegador.

Para parar: `Ctrl+C` (ou `docker compose --profile dev down`).

### Testar o build de produção localmente

Antes de publicar uma feature, vale conferir como ela se comporta no build
otimizado (igual ao que vai pro ar):

```bash
docker compose --profile prod up --build
```

Abre em **http://localhost:8080** (nginx servindo a pasta `dist`).

### Sem Docker (alternativa)

Se preferir rodar direto na máquina: `npm install` e depois `npm run dev`.

---

## 4. Pipeline Python (YOLO) — isolado

```bash
# na raiz do projeto (pasta seedcounter_git)
docker build -t seedcounter-yolo ./python

# rode apontando para uma pasta com suas imagens/modelos:
docker run --rm -v "$PWD/dados:/data" seedcounter-yolo \
  --image /data/placa.jpg --model /data/best.onnx --output /data/resultado.json
```

---

## 5. Fluxo de trabalho git (desenvolver → testar → publicar)

A ideia é **nunca desenvolver direto na `main`**. A `main` é sagrada: tudo que
entra nela vai automaticamente pro ar pelo Vercel.

```
  develop  ──(features do dia a dia, testa no Docker)──┐
                                                        │  merge quando estável
                                                        ▼
  main  ──────────────────────────────────────►  Vercel (produção)
```

### Branches

- **`main`** → produção. O Vercel observa essa branch e publica cada push.
- **`develop`** → sua área de trabalho/integração. Pode quebrar sem afetar o ar.
- **`feature/<nome>`** (opcional) → para uma feature maior e isolada.

### Ciclo de uma feature

```bash
# 1. parte sempre da develop atualizada
git checkout develop
git pull

# 2. (opcional, p/ features grandes) crie uma branch dedicada
git checkout -b feature/exportar-yolo

# 3. desenvolva e teste localmente
docker compose --profile dev up        # http://localhost:3000

# 4. quando funcionar, commite
git add .
git commit -m "feat: exportador YOLO"

# 5. junte na develop
git checkout develop
git merge feature/exportar-yolo
git push                                # sobe a develop pro GitHub

# 6. teste o build de produção
docker compose --profile prod up --build  # http://localhost:8080

# 7. quando estiver redondo, publique: develop -> main
git checkout main
git pull
git merge develop
git push                                # ✅ Vercel publica automaticamente
```

### Previews automáticos do Vercel

O Vercel cria um **preview com URL própria para cada branch/PR** que você
empurrar pro GitHub. Ou seja, ao dar `git push` na `develop`, você ganha um link
de teste online sem mexer na produção. É a forma recomendada de validar uma
feature "no ar" antes de mergear na `main`.

> Dica: você pode abrir um **Pull Request** de `develop` → `main` no GitHub em
> vez do merge manual. O Vercel comenta o link de preview no PR, e o merge do PR
> dispara o deploy de produção.

---

## 6. Publicar a imagem no Docker Hub (opcional / futuro)

Só é necessário se um dia você quiser rodar fora do Vercel (VPS, outro servidor,
laboratório offline). O Vercel **não** usa essa imagem — ele continua publicando
a `main` por conta própria.

```bash
# 1. login no Docker Hub (uma vez)
docker login

# 2. buildar a imagem de produção já com a tag do Docker Hub
docker build -t docker.io/enricristo/seedcounter:latest .

# 3. enviar para o Docker Hub
docker push docker.io/enricristo/seedcounter:latest

# 4. em qualquer servidor com Docker, rodar:
docker run -d -p 80:80 docker.io/enricristo/seedcounter:latest
```

> A imagem não contém nenhuma chave: o aplicativo não fala com serviço de IA
> externo. Se um dia falar, a chave vai num backend, nunca no build — o
> `define` do Vite a deixaria visível no JavaScript do cliente.

---

## 7. Resumo rápido (cola)

| Ação                                  | Comando                                         |
| ------------------------------------- | ----------------------------------------------- |
| Subir dev (hot reload)                | `docker compose --profile dev up`               |
| Testar build de produção              | `docker compose --profile prod up --build`      |
| Derrubar containers                   | `docker compose down`                           |
| Buildar imagem do Python              | `docker build -t seedcounter-yolo ./python`     |
| Nova feature                          | `git checkout develop && git checkout -b feature/x` |
| Publicar em produção                  | `git checkout main && git merge develop && git push` |
