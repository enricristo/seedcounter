# Dockerfile — imagem de PRODUCAO (multi-stage)
# Estagio 1: builda os arquivos estaticos com Vite.
# Estagio 2: serve a pasta dist/ com nginx (imagem final pequena, ~50MB).
#
# Nenhuma chave de API entra no build: o aplicativo roda inteiro no navegador
# e nao fala com nenhum servico de IA externo. Se um dia falar, a chave NAO
# pode ser injetada aqui — "define" do Vite a deixa visivel no JavaScript do
# cliente. O caminho e um backend que a guarde.

# ---- Estagio de build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# NAO use --omit=dev aqui: Vite, Tailwind, TypeScript e vite-plugin-pwa estao
# em devDependencies e sao necessarios para "npm run build". Como e multi-stage,
# o node_modules nao vai para a imagem final (so o dist/ vai pro nginx).
RUN npm ci

COPY . .

RUN npm run build

# ---- Estagio de runtime ----
FROM nginx:1.27-alpine AS runtime

LABEL maintainer="GPEOrq - Lab. de Sementes e Tecido Vegetal (Unoeste)"
LABEL description="Contador de Sementes - Vite + React servido por nginx"

# Config customizada com fallback de SPA e cache de assets.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia apenas os estaticos buildados.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Verifica se o nginx esta respondendo (wget do busybox suporta --spider).
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=2 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
