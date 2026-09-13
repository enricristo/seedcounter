# Degrau 1 — progresso

Rastreador vivo. Atualizado ao fim de cada tarefa, para uma sessao nova
retomar sem reconstruir contexto. Plano: `2026-09-13-degrau-1-fundacao-medida.md`.

| tarefa | estado | commit | quem | observacao |
|---|---|---|---|---|
| 1. handleProposeCut so seleciona | pendente | | | |
| 2. priors vira referencia + commit do inspetor | pendente | | | |
| 3. Feret | pendente | | | |
| 4. limiar relativo a populacao | pendente | | | |
| 5. criterio do modelo visivel | feito | 60a14ad | agente | 782 testes, tsc e eslint limpos nos 3 arquivos; commit MISTO com a Tarefa 1 por corrida de `git add` concorrente — outro agente rodou `git commit` enquanto meus 3 arquivos ja estavam staged; conteudo integro (ver `git show --stat 60a14ad`), so a mensagem do commit e a da Tarefa 1 |
| 6. taxonomia como caminho | feito | a5837ea | agente | 782 testes (isolado); suite completa teve 1 falha transitoria em challenger.test.ts (nao e meu arquivo, passou ao rodar isolado e ao repetir a suite completa) |
| 7. worker ONNX | pendente | | | precisa de teste manual |
| 8. spike do radial | pendente | | | precisa de cronometragem |

## Medicoes registradas

(preencher: falso alarme / deteccao dos limiares derivados em orquideia real; duracao da inferencia antes/depois do worker; tempo radial x tecla X)

## Bloqueios

- Tabela 4.1 de tolerancia nao conferida (humano) — nao afeta o Degrau 1.
