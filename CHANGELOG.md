# Changelog — Contador de Sementes

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
e este projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- GitHub Actions CI/CD pipeline (lint, build, Docker validation)
- ESLint + Prettier for code quality and formatting
- `.gitattributes` for consistent line endings (LF)
- SECURITY.md policy
- AUDIT_DOCKER_PRACTICES.md for documentation

### Changed
- `vite.config.ts`: Added manual chunk splitting for better build optimization
- `package.json`: Bumped version to 0.1.0 (Semantic Versioning)

---

## [0.1.0] — 2026-06-28

### Added
- Docker setup: `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`
- Hot reload in dev environment (CHOKIDAR_USEPOLLING for Windows)
- Multi-stage build for production (Node + Nginx)
- Healthchecks for both dev and prod containers
- nginx.conf with SPA fallback and smart caching
- Docker guide: DOCKER.md

### Fixed
- Fixed hot reload watch configuration in `vite.config.ts`

---

## [0.0.0] — 2026-05-26

### Added
- Initial project setup: React 19 + Vite 6 + TypeScript + Tailwind CSS 4
- PWA integration (service worker, manifest, offline support)
- IndexedDB database (Dexie) for local data persistence
- Gemini AI API integration for seed analysis
- UI components: experiments, sessions, plate analysis, charts
- Export to PDF and ZIP
