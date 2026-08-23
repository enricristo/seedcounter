# Contribuindo com o Contador de Sementes

## Ambientes

| Branch | Endereço | Papel |
|---|---|---|
| `stable-v2` | https://seedcounter-old.vercel.app | Versão congelada, para quem não pode ser interrompido |
| `main` | https://seedcounter.vercel.app | Produção — apenas recursos validados |
| `docs-upgrade` | https://seedcounter-teste.vercel.app | Teste — recursos em avaliação |
| `feature/*` | preview automático | Trabalho em andamento |

## Fluxo

```
feature/*  →  docs-upgrade (teste)  →  main (produção)
```

1. Parta da branch de teste atualizada.
2. Desenvolva e valide localmente.
3. Publique no teste: `git push origin sua-branch:docs-upgrade`
4. Depois de validado, promova: `git push origin sua-branch:main`

Trocar de branch localmente com o servidor de desenvolvimento rodando costuma falhar no Windows (arquivos em uso). Prefira empurrar direto para a branch de destino.

## Antes de publicar

```bash
npm run type-check   # bloqueante — precisa passar
npm run build        # precisa concluir
npm run lint         # informativo
```

## Critério para promover à produção

Um recurso só vai para `main` quando:

- Não produz números usados em pesquisa **ou** foi validado contra medição de referência
- Foi testado com imagens reais do laboratório
- Degrada graciosamente: o aplicativo continua funcionando com ele desligado

Recursos que geram medidas (morfometria, detecção automática) exigem validação contra método manual antes da promoção.

## Feature flags

Todo recurso novo entra atrás de uma flag em `src/features/flags.ts`:

- `stable: true` — pode vir ligado por padrão
- `stable: false` — desligado por padrão, visível no painel de Funcionalidades

Isso permite publicar código sem expor recursos imaturos.

## Convenções

- Commits no estilo [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- Recursos novos em `src/features/<nome>/`, com `index.ts` exportando a interface pública
- Lógica sem React em `src/lib/`, testável de forma isolada
- Comentários explicam **por que**, não o que o código faz

## Boas práticas

- Nunca exponha segredos no frontend; chaves embutidas no bundle são públicas
- Não documente recursos experimentais como se estivessem prontos
- Arquivos acima de 2 MiB em `public/` quebram o build do PWA — use o prefixo `_` para ignorá-los
- Atualize README e `CHANGELOG.md` quando o comportamento público mudar
