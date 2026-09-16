# Degrau 2 — Lote B (explorador de datasets) — progresso

Plano: `2026-09-13-degrau-2-lote-b-explorador-de-datasets.md`. Cada agente acrescenta a sua linha ao terminar (commit com pathspec).

| task | commit | status | nota |
|---|---|---|---|
| B1 leitores puros | (ver commit) | feito | 5 módulos, 16 testes; mascara-binaria implementada por convenção images/+masks/, "a conferir" (nomes reais de lucasiturriago-seeds não confirmados) |
| B2 fonte local + Dexie v7 | (ver commit) | feito | handle + Dexie v7 (`pastasDeDatasets`), `agruparPorConjunto` puro com 5 testes; `entries()`/`PermissionState` redeclarados em `src/types/file-system-access.d.ts` porque `tsconfig.json` não podia mudar; B2 — verificação no navegador fica para a B3 (não há botão ainda) |
| B3 painel + referência | — | pendente | espera A3 (App.tsx), B1, B2 |
| B4 medir por classe | — | pendente | espera B3 |

## Roteiros para o Enrico

(preenchidos por B2/B3/B4)
