# Contribuindo com o Contador de Sementes

Obrigado pelo interesse em contribuir! Este guia resume o fluxo de trabalho e as boas práticas do projeto.

## Fluxo de branches

- **`main`** — produção. Publicada automaticamente no Vercel (https://seedcounter.vercel.app). Nunca desenvolva direto aqui.
- **`develop`** — integração/desenvolvimento. É a base para novas features.
- **`feature/<nome>`** — uma branch por feature ou correção.

```
feature/minha-feature  →  develop  →  main (produção)
```

## Passo a passo

1. Parta da `develop` atualizada:
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/minha-feature
   ```
2. Desenvolva e teste localmente:
   ```bash
   npm run dev                         # ou: docker compose --profile dev up
   ```
3. Antes de abrir o PR, verifique:
   ```bash
   npm run type-check                  # checagem de tipos (deve passar)
   npm run lint                        # lint (avisos são aceitáveis)
   npm run build                       # build de produção deve funcionar
   ```
4. Commit com mensagem clara (veja abaixo) e abra um **Pull Request** para `develop`.
5. Após revisão e testes, `develop` é mesclada em `main` — e o Vercel publica.

## Convenção de commits

Use prefixos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `chore:` manutenção/configuração
- `refactor:` refatoração sem mudança de comportamento

Exemplo: `feat: adiciona exportação no formato YOLO`

## Estilo de código

- O projeto usa **ESLint** e **Prettier**. Rode `npm run lint:fix` e `npm run format` antes de commitar.
- Componentes em React + TypeScript; funcionalidades novas vão em `src/features/`.

## Reportando problemas

Abra uma [issue](https://github.com/enricristo/seedcounter/issues) usando um dos templates disponíveis (bug ou sugestão de funcionalidade).

## Código de conduta

Seja respeitoso e colaborativo. Este é um projeto acadêmico voltado à comunidade de pesquisa.
