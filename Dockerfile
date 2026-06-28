# Dockerfile — imagem de PRODUCAO (multi-stage)
# Estagio 1: builda os arquivos estaticos com Vite.
# Estagio 2: serve a pasta dist/ com nginx (imagem final pequena, ~50MB).
#
# IMPORTANTE: a GEMINI_API_KEY e injetada no bundle em tempo de build
# (vite "define"). Isso significa que ela fica VISIVEL no JavaScript do
# cliente — mesmo comportamento que voce ja tem hoje no Vercel. Nao use
# uma chave sensivel sem restricoes de dominio/uso no Google AI Studio.

# ---- Estagio de build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Recebe a chave como build-arg e expoe como env para o vite build.
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

# ---- Estagio de runtime ----
FROM nginx:1.27-alpine AS runtime

# Config customizada com fallback de SPA e cache de assets.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia apenas os estaticos buildados.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
