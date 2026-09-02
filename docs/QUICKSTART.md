# 🚀 Quick Start: Docker + Boas Práticas

Este documento resume as ações **imediatas** para usar seu setup Docker e melhorar a qualidade do código.

---

## ✅ Hoje: Setup Local + Protege Branches

### 1. Criar arquivo `.env` local

```bash
cd seedcounter
cp .env.example .env
```

Edite `.env` com sua chave do Google Gemini:
```
GEMINI_API_KEY=sk-seu-valor-aqui
APP_URL=http://localhost:3000
```

✅ Agora hot reload vai rodar com a chave real.

---

### 2. Aplicar normalização de line endings

Git avisa: "LF will be replaced by CRLF". Fixar:

```bash
# Na pasta seedcounter/
git add --renormalize .
git commit -m "fix: normalize line endings to LF"
git push
```

✅ Avisos desaparecem.

---

### 3. Proteger branches no GitHub

Vá para `Settings → Branches → Add rule`:

- Branch: `main`
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass (GitHub Actions)
- ✅ Dismiss stale pull request approvals

✅ Ninguém quebra produção com push direto.

---

## 📦 Esta Semana: Qualidade de Código

### 1. Instalar ESLint + Prettier

```bash
cd seedcounter
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-react eslint-plugin-react-hooks prettier
```

✅ Dependências adicionadas (já no package.json).

---

### 2. Rodar lint + format

```bash
# Verificar problemas
npm run lint

# Corrigir automaticamente
npm run lint:fix

# Formatar código
npm run format
```

✅ Seu código fica limpo e consistente.

---

### 3. Commitar as mudanças

```bash
git add .
git commit -m "chore: add eslint, prettier and code quality tools"
git push origin develop
```

✅ Mudanças estão em `develop` para testar.

---

## 🔄 Próximos Passos: CI/CD Automático

### 1. GitHub Actions vai rodar automaticamente

No próximo push, GitHub Actions vai:
- ✅ Verificar TypeScript
- ✅ Rodar lint
- ✅ Fazer build
- ✅ Testar Docker (dev e prod)

Ver status: **Actions** no GitHub.

---

### 2. PRs agora precisam passar nos testes

Ao abrir PR `develop` → `main`:
- ❌ Se lint falhar → não deixa mergear
- ❌ Se build falhar → não deixa mergear
- ✅ Só após tudo passar: libera merge

---

## 🐳 Docker: Dia a Dia

### Desenvolvimento (hot reload)

```bash
cd seedcounter

# Subir aplicação
docker compose --profile dev up

# Em outro terminal, editar código
# Abrir http://localhost:3000
# Editar um arquivo .tsx → recarrega em ~1s
```

Parar: `Ctrl+C`

---

### Testar produção antes de publicar

```bash
# Rebuild a imagem final
docker compose --profile prod up --build

# Testar em http://localhost:8080
# Verificar: performance, styling, assets carregam

# Se OK:
docker compose down
```

---

### Limpar containers/imagens

```bash
# Parar todos
docker compose down

# Remover imagens
docker image rm seedcounter-dev seedcounter-prod

# Limpeza profunda (cuidado!)
docker system prune -a --volumes
```

---

## 📝 Workflow Git (dia a dia)

```bash
# 1. Começar novo trabalho
git checkout develop
git pull

# 2. Criar branch de feature (opcional, para coisas maiores)
git checkout -b feature/novo-recurso

# 3. Editar, testar
docker compose --profile dev up
# Desenvolver...

# 4. Commitar
git add .
git commit -m "feat: novo recurso"

# 5. Jogar pra develop
git checkout develop
git merge feature/novo-recurso
git push

# 6. Testar build final
docker compose --profile prod up --build
# Conferir tudo...

# 7. Pronto? Manda pra main (ou abre PR)
git checkout main
git pull
git merge develop
git push
# ✅ Vercel publica automaticamente
```

---

## 🎯 Checklist: Você Está Pronto?

- [ ] `.env` criado com GEMINI_API_KEY
- [ ] `git add --renormalize .` aplicado (line endings)
- [ ] `npm install` rodado (eslint + prettier instalados)
- [ ] `npm run lint:fix` passou
- [ ] `docker compose --profile dev up` funciona (hot reload)
- [ ] `docker compose --profile prod up --build` funciona
- [ ] GitHub Actions rodou com sucesso (check no Actions tab)
- [ ] `main` protegida no GitHub (requer PR review)

---

## 📞 Dúvidas Comuns

**P: Onde vejo os erros do linter?**  
R: `npm run lint` no terminal. Ou no VS Code com extensão ESLint.

**P: Hot reload não está funcionando?**  
R: Verificar: `docker compose --profile dev logs` (deve estar rodando).

**P: Como publico em produção?**  
R: `git push` na `main` → Vercel publica automaticamente.

**P: Posso mergear em main direto?**  
R: Não — GitHub vai bloquear sem passar nos testes (GitHub Actions).

**P: Docker está muito lento?**  
R: Comum no Windows. Se persistir: Docker Desktop → Settings → Resources → aumentar CPU/RAM.

---

## 🚀 Próximas Melhorias (futuro)

1. **Testes unitários** (Vitest) — quando projeto crescer
2. **Code-split do bundle** — reduzir tamanho da aplicação
3. **Semantic versioning** — tags (v0.1.0, v0.2.0, etc.)
4. **Deploy automático** — beyond Vercel (VPS, Cloud Run)

---

Parabéns! Seu projeto agora está com Docker, CI/CD e boas práticas ✅
