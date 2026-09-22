# AGENTS.md — o que um agente precisa saber antes de tocar no SeedCounter

Leia inteiro antes da primeira edição. Tem o tamanho de uma leitura de cinco
minutos de propósito: o que não cabe aqui está apontado no fim.

## O que é

Análise de imagem de sementes que roda **inteira no navegador** (React 19 +
Vite + TypeScript, Tailwind v4, Dexie/IndexedDB, ONNX Runtime Web para o
modelo). Conta, mede, classifica e emite laudo. **Nenhuma imagem sai da máquina
de quem usa** — isso é a vantagem competitiva, não uma limitação. Há um
backend FastAPI opcional, em repositório separado e privado, que o app não
precisa para funcionar.

A tese do produto, que decide empates de design: **a máquina propõe, a pessoa
confere.** Toda proposta aparece tracejada antes de virar dado; nada entra na
contagem sem alguém aceitar; todo número sai dizendo quem o produziu.

## As leis (não são preferências — há teste para a maioria)

1. **Uma fonte por verdade.** Contagem, índice e classe vêm de
   `src/lib/objetos.ts` (`enumerarObjetos`, `contarObjetos`); a tradução de
   classe do modelo vem de `src/lib/classe-do-modelo.ts` (`YOLO_CLASSES =
   ['inviavel','viavel']` — **0 é inviável**); medida vem de
   `src/lib/measurements.ts` (`buildMeasurements`). Nunca `marks.length`,
   nunca `classId === 1`, nunca área calculada à mão num componente.
   `src/__tests__/fonte-unica.test.ts` reprova. Três defeitos numa semana
   tiveram essa causa.
2. **Campo vazio em vez de número inventado.** `null`/`''` significa "não foi
   medido". Nunca preencher com o provável, nunca um valor padrão que pareça
   medida. Vale para CSV, laudo, calibração e volumes.
3. **Sugere, nunca preenche.** Metadado proposto (espécie pelo nome do
   arquivo, continuidade de experimento, receita) entra só por clique, e só em
   campo vazio. A proposta mostra o **trecho de origem** ("lido em: …").
4. **Forma além da cor.** Viável e inviável diferem também na FORMA em todo
   estilo de marca (`src/theme/specimen.ts`). Sobrevive a daltonismo e a
   impressão em preto e branco. Ciano e magenta são do espécime; nunca no cromo.
5. **Sistema de design "Bancada Óptica".** Raio só `rounded-control` (2 px),
   `rounded-panel` (6 px) ou `rounded-full`. Cor só por token (`bg-accent`,
   `text-accent-on`, `text-ink-2`, `border-line`, `bg-surface-2`…). **Nunca
   `text-white`, `rounded-xl`, `amber-500`** ou cor literal do Tailwind — o
   tema escuro redefine o token, não a utilitária.
   `src/theme/__tests__/design-tokens.test.ts` reprova tom inexistente e hex
   em gráfico; `divida-de-tokens.test.ts` é a **catraca** da dívida antiga
   (424 cores literais e 374 raios fora do sistema em 23/09, medidos em
   `divida-de-tokens.json`): reprova se subir e pede para baixar o teto se
   descer (`ATUALIZAR_DIVIDA=1 npx vitest run src/theme`).
6. **Nunca o nome da instituição.** Em nenhum arquivo, comentário, teste,
   e-mail de exemplo ou documento. Os grupos (GPEOrq, GPSEM) e as pessoas
   podem aparecer; a universidade, não. Varra o repositório inteiro antes de
   um PR: `grep -rniE "unoeste|universidade do oeste"`.
7. **Memória e desempenho.** Nunca guardar `ImageData` no estado ou na sessão
   (uma digitalização tem 132 Mpx). Cor (RGB/CIELAB) custa ~117 MB por imagem
   e só é extraída sob demanda — exportação e Analytics — via
   `lerPixelsDaImagem()` → `buildMeasurements()`. Bancada inativa libera o
   bitmap cheio. Só a bancada ativa monta overlays caros.
8. **O que o modo esconde também não custa.** Modo "contagem" não roda o
   ensaio ao carregar; `recharts` fica em chunk separado; nada pesado carrega
   até alguém abrir (`src/lib/sob-demanda.tsx`, `features/visualizacao/`).
9. **DPI declarado é declaração; a régua é a medida.** O driver do scanner
   informa um valor; a régua na imagem mede outro (já vimos 32 % de diferença).
   `lib/calibracao-multiponto.ts` confere em vários pontos. Nunca chamar o
   DPI do arquivo de "calibração".
10. **Sem som por padrão, nunca autoplay.** Opt-in.
11. **Comentários explicam POR QUE, em português.** Um cabeçalho curto por
    arquivo dizendo por que ele existe e qual decisão carrega. Nomes em
    português. Leia `src/lib/objetos.ts` para o tom antes de escrever.
12. **TypeScript estrito.** `strictNullChecks` e `noImplicitAny` ligados. Nada
    de `any`, nada de `!` — guardas reais.

## Como se trabalha

- **Testes:** vitest, em `__tests__/` ao lado do módulo. **Não há biblioteca
  de teste de componente, de propósito** — teste a lógica pura; extraia-a do
  componente se precisar. Testes estáticos (leem os fontes com `node:fs`)
  vigiam as leis: `fonte-unica`, `design-tokens`, `registro-de-atalhos`,
  `atalhos-prometidos`, `sob-demanda`, `dependencias`.
- **Verificação antes de qualquer commit:** `npx tsc --noEmit` limpo,
  `npx vitest run` verde (≈1 300 testes), `npx eslint src --ext .ts,.tsx` sem
  aviso novo, `npm run build` ok. **O CI é o árbitro, não a máquina local** —
  já houve build que passava local e falhava no CI por um `node_modules`
  perdido acima da pasta.
- **Git:** `main` é produção (Vercel); `develop` é a preview `-teste`.
  Release por PR `develop → main`, **nunca push direto na `main`**. Um PR por
  tema; `git add` sempre com pathspec explícito, nunca `-A`/`.`. Mensagem de
  commit em português, contando o porquê.
- **Worktrees:** o dono usa o checkout principal (`seedcounter/`) como
  localhost — não troque de branch lá. Trabalhe em worktrees irmãos
  (`seedcounter-*`), que compartilham `node_modules` por junction: **nunca
  `npm ci`/`npm install`/`rm -rf node_modules`** num worktree.
- **Agentes em paralelo:** no máximo dois, com propriedade disjunta de
  arquivos, e `App.tsx` dividido por região explícita. Antes de relançar um
  agente que morreu, olhe o disco — o trabalho costuma estar quase pronto.
- **Perfis consultivos:** antes de desenhar uma tela, escreva uma linha na voz
  de cada perfil — analista de laboratório comercial, pesquisador de orquídea,
  pesquisador de forrageira, aluno em treinamento, apresentação. A spec
  `docs/superpowers/specs/2026-09-22-predefinicoes-por-perfil-design.md`
  tem as vozes.
- **Nada de Playwright/browser para testar:** o dono testa clicando; peça o
  teste manual no relatório, com roteiro.

## Mapa

```
src/
  App.tsx                  ← a casca; ainda grande (3,8k linhas), em extração por tema
  lib/                     ← o núcleo puro e testado (60 módulos)
    objetos.ts             enumeração canônica          classe-do-modelo.ts  tradução de classe
    measurements.ts        medidas e CSV                calibration.ts / calibracao-multiponto.ts
    detect.ts / region-growing.ts / borracha.ts         segmentação clássica e a "onda" por clique
    yolo-onnx.ts / yolo-worker-client.ts                modelo (fp32 local, int8 na web — int8 erra classe)
    germinacao/            Germinator (Hill de 4 parâmetros), validado contra a planilha do laboratório
    stats.ts               ANOVA, Tukey, Scott-Knott, Kruskal-Wallis, IVG, MGT (fator qualitativo)
    laudo/                 PDF                          diagnostico/         trilha + "Relatar problema"
    tiff.ts                TIFF por página              sugestoes-do-arquivo.ts  espécie/repetição pelo nome
    normas/                RAS 2025 por capítulo, tolerâncias, tamanhos por espécie
  features/                ← uma pasta por funcionalidade; a de nome mais óbvio é a certa
    visualizacao/          modos e partes ligáveis      carregar/            substituir ou enfileirar
    lote/                  fila com IA (cancelável)     exportar/            todas as exportações
    bancadas/              até 4 cenas                  ensaio/              receitas ao carregar
    datasets/              explorador de pastas         analytics/           4 cases (sob demanda)
    morfometria/           painel + volumes             longitudinal/        experimento por dias
  hooks/                   useBancada (a cena), useBancadas, useCronometro, useImageQueue, useMetadata
  theme/specimen.ts        cores e formas das marcas    index.css            tokens (light/dark)
docs/
  superpowers/specs/       decisões de design           superpowers/plans/   planos de implementação
  referencias/             .bib + índice                datasets/            auditoria de medida, cenas
  PRIVADO.md               o que vive no repositório privado, e por quê
```

## Onde está o resto

- Notas de versão para quem usa: `src/lib/novidades.ts`. Técnico: `CHANGELOG.md`.
- Citação: `CITATION.cff` (quatro autores, ordem oficial).
- Bibliografia: `docs/referencias/seedcounter.bib` — só entra o que foi
  conferido na fonte; campo não verificado fica vazio.
- Modelos: `public/models/seeds-yolov8m-seg.onnx` (int8, web) e
  `_heavy-…` (fp32, só local, ignorado pelo git). **Para viável/inviável, o
  quantizado erra; use o local.**
- O que é privado (segurança, pesquisa não publicada, estratégia): ver
  `docs/PRIVADO.md`.
