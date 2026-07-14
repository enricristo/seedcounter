# ✅ Checklist: Implementação de Boas Práticas Docker & Git

Copie este checklist em um issue do GitHub ou mantenha localmente para rastrear progresso.

---

## 🔴 Crítico (Fazer Hoje)

- [ ] **Setup Local**
  - [ ] Criar `.env` local com `GEMINI_API_KEY`
  - [ ] Testar `docker compose --profile dev up` (http://localhost:3000)
  - [ ] Confirmar hot reload funciona (editar um `.tsx`, salvar, browser recarrega)

- [ ] **Git Setup**
  - [ ] Aplicar `git add --renormalize .` (fix line endings)
  - [ ] Fazer commit e push
  - [ ] Verificar que warnings de LF/CRLF sumiram

---

## 🟡 Importante (Esta Semana)

- [ ] **Code Quality**
  - [ ] Rodar `npm install` (instala ESLint, Prettier)
  - [ ] Rodar `npm run lint` (sem erros)
  - [ ] Rodar `npm run lint:fix` (auto-fix)
  - [ ] Rodar `npm run format` (prettier)
  - [ ] Fazer commit: `git add . && git commit -m "chore: lint and format"`

- [ ] **CI/CD**
  - [ ] Fazer push em `develop`
  - [ ] Ir em GitHub → **Actions**
  - [ ] Verificar se workflow `Lint, Build & Docker Validation` rodou
  - [ ] Confirmar que todos os jobs passaram ✅

- [ ] **GitHub Branch Protection**
  - [ ] Ir em Settings → Branches
  - [ ] Criar rule para `main`:
    - [ ] ✅ Require pull request reviews (1 approval)
    - [ ] ✅ Require status checks (GitHub Actions)
    - [ ] ✅ Dismiss stale approvals
  - [ ] Testar: tentar push direto em main → deve bloquear

---

## 🟢 Bom Ter (Próximas 2 Semanas)

- [ ] **Security**
  - [ ] Ler `SECURITY.md`
  - [ ] Configurar secret scanning no GitHub (Settings → Security → Secret scanning)

- [ ] **Documentation**
  - [ ] Ler `QUICKSTART.md`
  - [ ] Ler `AUDIT_DOCKER_PRACTICES.md`
  - [ ] Adicionar links aos READMEs do projeto

- [ ] **Versioning**
  - [ ] Criar primeira tag: `git tag -a v0.1.0 -m "Release: Inicial com Docker"`
  - [ ] Fazer push: `git push origin v0.1.0`
  - [ ] Atualizar `package.json` `version` → `"0.1.0"`

- [ ] **Testing com GitHub Actions**
  - [ ] Abrir PR de `develop` → `main`
  - [ ] Confirmar que Actions roda automaticamente
  - [ ] Confirmar que não deixa mergear sem passar em testes

---

## 📈 Futuro (Próximo Mês)

- [ ] **Otimização de Bundle**
  - [ ] Analisar tamanho do chunk (1.6MB warning)
  - [ ] Implementar dynamic import() para routes grandes
  - [ ] Re-rodar build e validar redução de tamanho

- [ ] **Testes Automatizados**
  - [ ] Instalar Vitest: `npm install -D vitest @testing-library/react`
  - [ ] Criar primeiro teste
  - [ ] Integrar ao CI/CD

- [ ] **Docker Registry**
  - [ ] Setup Docker Hub account (se quiser publicar)
  - [ ] Criar repo: `docker.io/seu-usuario/seedcounter`
  - [ ] Testar: `docker build -t seu-usuario/seedcounter:latest . && docker push ...`

- [ ] **Deploy Fora do Vercel**
  - [ ] Documentar setup em VPS (se necessário)
  - [ ] Testar em servidor de staging

---

## 🧪 Validações: Após Cada Mudança

Depois de implementar cada seção, validar:

```bash
# 1. Git status limpo
git status
# Output esperado: "On branch develop, nothing to commit"

# 2. Lint passa
npm run lint
# Output esperado: sem erros

# 3. Build passa
npm run build
# Output esperado: "✓ built in X.XXs"

# 4. Docker dev funciona
docker compose --profile dev up
# Output esperado: "Local: http://localhost:3000/"
# IMPORTANTE: editar um arquivo .tsx e verificar hot reload

# 5. Docker prod funciona
docker compose --profile prod up --build
# Output esperado: nginx serving, http://localhost:8080

# 6. Sem containers rodando depois
docker compose down
# Output esperado: "Container seedcounter-dev Stopped"
```

---

## 📝 Template: Commit para Cada Milestone

Quando completar uma seção, fazer commit documentado:

```bash
# Setup local
git add . && git commit -m "chore: add local .env and normalize line endings"

# Code quality
git add . && git commit -m "chore: add eslint and prettier configuration"

# GitHub Actions
git add . && git commit -m "ci: add GitHub Actions workflow for validation"

# Branch protection + Security
git add . && git commit -m "docs: add security policy and recommendations"
```

---

## 📊 Tracker Simples

**Week 1:**
```
[X] .env setup
[X] Line endings fix
[X] ESLint + Prettier install
[X] GitHub Actions triggered
[ ] Branch protection enabled
```

**Week 2:**
```
[ ] SECURITY.md reviewed
[ ] Tags versioning started
[ ] First PR merged with checks
```

**Week 3+:**
```
[ ] Bundle size optimized
[ ] Tests added
[ ] Docker Registry setup (if needed)
```

---

## 🎯 Success Criteria

Você pode considerar tudo implementado quando:

- ✅ Local dev: Hot reload funciona com `.env`
- ✅ Git: Line endings normalizados, sem avisos
- ✅ CI/CD: GitHub Actions passa em todos PRs
- ✅ Branches: `main` protegida, sem merge sem testes
- ✅ Code Quality: `npm run lint` e `npm run format` passam
- ✅ Docker: `dev` e `prod` profiles funcionam
- ✅ Security: `.env` no `.gitignore`, SECURITY.md presente
- ✅ Docs: QUICKSTART, AUDIT, RECOMMENDATIONS lidos

---

## 🚀 Próximo Passo

Comece por:
1. **Hoje**: Criar `.env` + testar hot reload
2. **Amanhã**: Aplicar `.gitattributes` + eslint
3. **Semana que vem**: GitHub Actions + branch protection

Bom trabalho! 🎉
