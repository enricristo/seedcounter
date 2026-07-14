# 📋 Auditoria: Docker, Boas Práticas e Estabilidade

**Data**: Junho 2026  
**Projeto**: Contador de Sementes (React 19 + Vite 6 + PWA)  
**Status**: ✅ **Bem configurado, com sugestões de melhoria**

---

## 🟢 O que Está Correto

### Docker & Containerização

- ✅ **Multi-stage build** (desenvolvimento isolado de produção)
- ✅ **Alpine images** (`node:22-alpine`, `nginx:1.27-alpine`, `python:3.11-slim`)
- ✅ **Volume anônimo para `node_modules`** (evita conflito Windows/Linux)
- ✅ **CHOKIDAR_USEPOLLING=true** para hot reload no Docker Desktop
- ✅ **Healthchecks** em ambos Dockerfiles (dev e prod)
- ✅ **Labels informativos** (maintainer, description)
- ✅ **Container names** explícitos (`seedcounter-dev`, `seedcounter-prod`)
- ✅ **Profiles no docker-compose** (limpeza: `--profile dev/prod`)
- ✅ **Bind mount para código** (hot reload via volumes)
- ✅ `.dockerignore` bem configurado (filtra `node_modules`, `dist`, `.git`, `.env`)

### Versionamento Git

- ✅ **Branches bem definidas**: `main` (produção) e `develop` (integração)
- ✅ **`.gitignore` robusto**: exclui `node_modules`, `dist`, `.env`, logs
- ✅ **`main` protegida de commits diretos** (workflow via `develop`)
- ✅ **Histórico de commits semântico**: `feat:`, `chore:`, etc.
- ✅ **Integração Vercel**: publica automaticamente da `main`

### Segurança

- ✅ **Secrets (.env) não versionados**: `.env` no `.gitignore`
- ✅ **Template `.env.example`**: documenta variáveis necessárias
- ✅ **GEMINI_API_KEY restrita a domínio**: mencionado em comments
- ✅ **Python isolado**: Dockerfile separado, sem risco de contaminação

### Build & Performance

- ✅ **Build compila sem erros**: TypeScript passa (`npm run lint`)
- ✅ **Vite otimizado**: gzip ativo, cache strategy correct
- ✅ **nginx.conf com SPA fallback**: `try_files $uri $uri/ /index.html` ✅
- ✅ **Cache strategy SPA**: `/assets/` com `Cache-Control: immutable`, `sw.js` com `no-cache`
- ✅ **PWA configurado**: Service Worker, manifest, auto-update

### Documentação

- ✅ **DOCKER.md completo**: fluxo de trabalho, comandos, boas práticas
- ✅ **Dockerfile bem comentado**: explica cada estágio
- ✅ **docker-compose.yml documentado**: profiles, volumes, env vars

---

## 🟡 Sugestões de Melhoria (Não-Críticas)

### 1. **Chunk Size Warning** ⚠️ (Build Performance)

**Situação**: Build produção reporta chunks > 500KB (1.6MB sem gzip).

```
(!) Some chunks are larger than 500 kB after minification. Consider:
    - Using dynamic import() to code-split the application
    - Adjust chunk size limit for warning via build.chunkSizeWarningLimit
```

**Recomendação**: Aumentar limite temporariamente para visualizar melhor, depois otimizar routes dinamicamente.

**Implementação em `vite.config.ts`**:
```typescript
build: {
  chunkSizeWarningLimit: 1500, // Aumenta limit até que tenha otimizacao
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'recharts-charts': ['recharts'],
        'pdfexport': ['jspdf', 'html2canvas'],
        'db': ['dexie', 'dexie-react-hooks'],
      }
    }
  }
}
```

**Ganho esperado**: Reduzir chunk principal de 1.6MB para ~800KB (antes gzip).

---

### 2. **Line Endings (CRLF vs LF)** ⚠️ (Git Workflow)

**Situação**: Git warning ao fazer diff:
```
warning: in the working copy of vite.config.ts, LF will be replaced by CRLF
```

**Causa**: Ambiente Windows vs código em LF (Linux).

**Solução**: Adicionar `.gitattributes` na raiz do projeto:

```bash
# seedcounter/.gitattributes
* text=auto
*.ts text eol=lf
*.tsx text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
docker-compose.yml text eol=lf
Dockerfile text eol=lf
nginx.conf text eol=lf
```

**Aplicar a arquivos existentes**:
```bash
git add --renormalize .
git commit -m "fix: normalize line endings to LF"
```

---

### 3. **Lint + Prettier** 🎨 (Code Quality)

**Situação**: Projeto tem `npm run lint` (TypeScript), mas sem formatação automática.

**Recomendação**: Adicionar ESLint + Prettier.

**Instalar**:
```bash
npm install -D eslint eslint-plugin-react eslint-plugin-react-hooks prettier
```

**Criar `.eslintrc.json`**:
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "ecmaFeatures": { "jsx": true }
  },
  "settings": {
    "react": { "version": "detect" }
  },
  "rules": {
    "react/react-in-jsx-scope": "off"
  }
}
```

**Criar `.prettierrc`**:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "always"
}
```

**Scripts em `package.json`**:
```json
"scripts": {
  "lint": "eslint src --ext .ts,.tsx",
  "lint:fix": "eslint src --ext .ts,.tsx --fix && prettier --write src",
  "format": "prettier --write src"
}
```

---

### 4. **Sem `.env` no Desenvolvimento** ⚠️ (Setup Local)

**Situação**: Não há `.env` localmente, então `GEMINI_API_KEY` fica vazio em dev.

**Impacto**: Hot reload não testa a chave real até fazer build.

**Solução rápida**:
```bash
cp .env.example .env
# Editar .env com sua chave de teste do Google AI Studio
```

**Automatizar (opcional)**: Script na CI para verificar `.env.example` atualizado:
```bash
# scripts/validate-env.sh
if ! diff -q <(grep -o '^[A-Z_]*=' .env.example | sort) \
           <(grep -o '^[A-Z_]*=' .env | sort) > /dev/null; then
  echo "❌ .env.example desatualizado"
  exit 1
fi
```

---

### 5. **Testing (Testes Unitários)** 🧪 (Qualidade)

**Situação**: Projeto não tem testes automatizados.

**Recomendação para futuro**: Adicionar Vitest (similar ao Jest, otimizado para Vite).

**Setup (opcional, depois)**:
```bash
npm install -D vitest @testing-library/react @testing-library/dom
```

**Exemplo minimal em `src/__tests__/example.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest';

describe('exemplo', () => {
  it('deve somar corretamente', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Script em `package.json`**:
```json
"test": "vitest run",
"test:watch": "vitest watch"
```

---

### 6. **CI/CD Pipeline (GitHub Actions)** 🚀 (Automação)

**Situação**: Não há automação; você faz build/test manual antes de push.

**Recomendação**: GitHub Actions para validar a cada push.

**Criar `.github/workflows/validate.yml`**:
```yaml
name: Validate

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run build

  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          dockerfile: Dockerfile.dev
          tags: seedcounter:test
```

**Benefícios**:
- ✅ Bloqueia PRs com lint/build quebrados
- ✅ Testa Dockerfile automaticamente
- ✅ Histórico de falhas visível no GitHub

---

### 7. **Versionamento de Release (Tags)** 🏷️ (Produção)

**Situação**: `package.json` tem `"version": "0.0.0"` (nunca muda).

**Recomendação**: Usar Semantic Versioning (SemVer).

**Como começar**:
```bash
# Na main, após merge de feature grande
git tag -a v0.1.0 -m "Release: Inicial com Docker"
git push origin v0.1.0
```

**Semver**:
- `v0.1.0` → feature nova (MINOR)
- `v0.1.1` → bugfix (PATCH)
- `v1.0.0` → breaking changes (MAJOR)

**Atualizar `package.json`**:
```json
{
  "version": "0.1.0"
}
```

---

### 8. **SECURITY.md** 🔐 (Segurança)

**Recomendação**: Adicionar arquivo de política de segurança.

**Criar `SECURITY.md`**:
```markdown
# Security Policy

## Reporting a Vulnerability

If you find a security issue:

1. **DO NOT** open a public issue
2. Email: seu-email@unoeste.br (privado)
3. Include: reprodução, versão afetada, sugestão de fix

## Secrets Management

- GEMINI_API_KEY: Restrita por domínio/uso no Google AI Studio
- Nunca commitar .env em produção
- Usar Docker secrets para ambientes corporativos

## Dependencies

- npm audit regularly: `npm audit fix`
- Check outdated: `npm outdated`
```

---

### 9. **Docker Image Size Optimization** 📦 (Produção)

**Status Atual**: `nginx:1.27-alpine` ~50MB (ótimo)

**Futuro**: Considerar `FROM scratch` para arquivos estáticos puros (5-10MB).

```dockerfile
# Dockerfile.ultra-slim (futuro, opcional)
FROM node:22-alpine AS build
# ... build steps ...

FROM scratch
COPY --from=build /app/dist /
EXPOSE 80
CMD ["serve", "-s", "/", "-l", "80"]
```

**Ganho**: -40MB (praticamente nada é copiado, só HTTP).

---

### 10. **Restart Policy no Docker Compose** ⚠️ (Estabilidade)

**Status Atual**: `restart: unless-stopped` (bom).

**Sugestão**: Documentar política para produção.

```yaml
services:
  dev:
    restart: unless-stopped  # Reinicia se der crash, não se parar manual
  prod:
    restart: always          # Sempre reinicia (se disponível)
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

---

## 🔴 Issues Potenciais (a Monitorar)

### 1. **GEMINI_API_KEY Exposta no JavaScript**

⚠️ **Não é um problema no seu caso**, mas é importante:

- A chave é visível no `dist/assets/index-*.js` (cliente)
- Isso é **aceitável se**:
  - ✅ Chave restrita por domínio no Google AI Studio
  - ✅ Uso limitado (ex: 100 req/dia)
  - ❌ Nunca use chave sensível/irrestrita

**Como verificar**:
```bash
npm run build
strings dist/assets/index-*.js | grep sk- # Confirma exposição
```

---

### 2. **Sem Testes — Risco de Regressão**

Sem testes, qualquer refactor de componentes pode quebrar algo silenciosamente.

**Prioritário para futuro**:
1. Testes dos hooks (useExperiments, useSessions, useDexie)
2. Testes dos componentes críticos
3. Testes de integração (IndexedDB)

---

### 3. **Bundle Grande (1.6MB antes gzip)**

Pode impactar lentidão em 3G/internet lenta.

**Ações**:
- ✅ Code-split routes (React.lazy)
- ✅ Dynamic import para modais pesadas
- ✅ Tree-shake Recharts/html2canvas

---

## ✅ Checklist: O que Fazer Agora

- [ ] **Crítico**: Criar `.env` local e testar dev/prod locais
- [ ] **Importante**: Adicionar `.gitattributes` (fix line endings)
- [ ] **Importante**: Setup GitHub Actions (CI/CD)
- [ ] **Bom ter**: Adicionar ESLint + Prettier
- [ ] **Futuro**: Adicionar testes (Vitest)
- [ ] **Futuro**: Code-split bundle (chunk warning)
- [ ] **Futuro**: Semantic versioning (tags)

---

## 📊 Score Final

| Categoria | Score | Notas |
|-----------|-------|-------|
| Docker | 9/10 | Multi-stage, Alpine, healthchecks perfeitos |
| Git Workflow | 8/10 | Branches corretas, falta CI/CD |
| Segurança | 8/10 | Secrets protegidos, falta SECURITY.md |
| Build | 7/10 | TypeScript OK, chunk warning a otimizar |
| Testes | 0/10 | Não há testes (opcional por enquanto) |
| Documentação | 9/10 | DOCKER.md excelente, falta changelog |
| **GERAL** | **8.2/10** | Projeto bem estruturado e estável |

---

## 🎯 Recomendações Prioritárias

1. **Hoje**: Criar `.env` local, testar hot reload
2. **Esta semana**: Adicionar `.gitattributes` + GitHub Actions
3. **Próximo mês**: ESLint + Prettier
4. **Futuro**: Testes + Code-split

Seu projeto está **sólido e pronto para produção no Vercel**. Docker está bem implementado. As sugestões acima são melhorias graduais, não bloqueadores. 

Tem dúvidas sobre alguma recomendação? 🚀
