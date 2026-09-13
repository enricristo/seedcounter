# Degrau 1 — progresso

Rastreador vivo. Atualizado ao fim de cada tarefa, para uma sessao nova
retomar sem reconstruir contexto. Plano: `2026-09-13-degrau-1-fundacao-medida.md`.

| tarefa | estado | commit | quem | observacao |
|---|---|---|---|---|
| 1. handleProposeCut so seleciona | feito | 60a14ad | agente | 781 testes, tsc e eslint limpos (0 erros, so 3 warnings pre-existentes em App.tsx sem relacao); commit MISTO com a Tarefa 5 por corrida de `git add` concorrente — meu `git add` so tinha `src/App.tsx` e o teste novo, mas outro agente ja tinha `src/features/ai-pointer/AiPointerPanel.tsx` e `src/lib/criterio-do-modelo.ts`/teste staged quando rodei `git commit` (sem pathspec, na epoca); conteudo integro (ver `git show --stat 60a14ad`), so a mensagem do commit e a da Tarefa 1 |
| 2. priors vira referencia + commit do inspetor | feito | 2741889 | agente | 780 testes, tsc e eslint limpos nos 2 arquivos tocados; commit feito com pathspec explicito (`git commit -m ... -- <arquivos>`) apos a correcao de protocolo, entao ficou limpo — so os 4 arquivos da Tarefa 2 (`src/lib/priors-morfometricos.ts`, seu teste, `SeedInspector.tsx`, `docs/datasets/README.md`); `src/App.tsx` nao teve diff no commit porque ja tinha sido commitado inteiro na Tarefa 1. Adaptacao: `MetricasContorno` foi mantida (nao pedida para remover, so os tipos/funcoes de veredito); `especieId.toLowerCase()` mantido em `compararComPerfil` como no `diagnosticarContorno` original |
| 3. Feret | feito | 1584bf5 | agente | 782 testes (feret.test.ts 6/6, elipse bateu com a PCA de primeira — indicesDoFechoConvexo ja devolve ordem correta, sem precisar investigar); tsc e eslint limpos nos 4 arquivos; measurements.test.ts nao existia (so measurements-mm.test.ts) — criado do zero com o teste do CSV, adaptando measurementsToCSV(rows, ctx) pois a assinatura real exige ctx; commit MISTO com a Tarefa 6 por corrida de `git add` concorrente — outro agente commitou enquanto meus 4 arquivos ja estavam staged; conteudo integro (ver `git show --stat 1584bf5`), so a mensagem do commit e a da Tarefa 6 |
| 4. limiar relativo a populacao | pendente | | | |
| 5. criterio do modelo visivel | feito | 60a14ad | agente | 782 testes, tsc e eslint limpos nos 3 arquivos; commit MISTO com a Tarefa 1 por corrida de `git add` concorrente — outro agente rodou `git commit` enquanto meus 3 arquivos ja estavam staged; conteudo integro (ver `git show --stat 60a14ad`), so a mensagem do commit e a da Tarefa 1 |
| 6. taxonomia como caminho | feito | a5837ea (feature); 1584bf5 (docs) | agente | 782 testes (isolado); suite completa teve 1 falha transitoria em challenger.test.ts (nao e meu arquivo, passou ao rodar isolado e ao repetir a suite completa). O commit de docs 1584bf5 saiu MISTO com `src/lib/feret.ts`, `src/lib/measurements.ts` e seus testes (Tarefa 3) por corrida de `git add` concorrente — eu so tinha adicionado o progress.md, mas outro agente ja tinha esses arquivos staged quando rodei `git commit`; conteudo integro (ver `git show --stat 1584bf5`), so a mensagem/atribuicao do commit e a de docs da Tarefa 6, nao a de feat da Tarefa 3 |
| 7. worker ONNX | pendente | | | precisa de teste manual |
| 8. spike do radial | pendente | | | precisa de cronometragem |

## Medicoes registradas

(preencher: falso alarme / deteccao dos limiares derivados em orquideia real; duracao da inferencia antes/depois do worker; tempo radial x tecla X)

## Bloqueios

- Tabela 4.1 de tolerancia nao conferida (humano) — nao afeta o Degrau 1.
