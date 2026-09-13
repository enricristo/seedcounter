# Degrau 1 — progresso

Rastreador vivo. Atualizado ao fim de cada tarefa, para uma sessao nova
retomar sem reconstruir contexto. Plano: `2026-09-13-degrau-1-fundacao-medida.md`.

| tarefa | estado | commit | quem | observacao |
|---|---|---|---|---|
| 1. handleProposeCut so seleciona | pendente | | | |
| 2. priors vira referencia + commit do inspetor | pendente | | | |
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
