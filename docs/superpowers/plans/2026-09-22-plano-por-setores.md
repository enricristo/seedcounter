# SeedCounter — plano por setores

> Levantado em 22/09/2026, com os números medidos no repositório naquele dia.
> É o mapa de quem cuida do quê, com o estado real, o alvo, as ferramentas
> (skills e agentes) de cada setor e a primeira tarefa. As decisões que só o
> dono toma estão reunidas no fim, em "Perguntas em aberto".

## O estado medido (22/09)

| Onde | Número | O que ele diz |
|---|---|---|
| `src/App.tsx` | **4 190 linhas** | O maior risco de manutenção do projeto: quatro agentes precisaram de "regiões" para não se pisarem nele |
| `src/lib` | 20 598 linhas, 15 módulos acima de 400 | O núcleo é grande e testável; `stats.ts` (994) e `novidades.ts` (841) são os maiores |
| Testes | **1 288** em 107 arquivos | Lógica coberta; nenhum teste de componente (decisão deliberada) |
| eslint | 0 erros, **85 avisos** | Avisos são dívida que esconde erro novo |
| `package.json` | 21 deps; **3 sem uso** (`@google/genai`, `express`, `dotenv`); `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@types/jszip` em `dependencies` | Instalação de produção carrega o que não precisa |
| Ajuda no app | `features/ajuda/` = só atalhos | Não há documentação de usuário dentro do produto |
| Backend | 4 872 linhas Python, 11 arquivos de teste, **sem remoto git** | Existe só no disco de uma máquina |
| Datasets | **17 GB, 26 pastas**, 1 README | Sem catálogo por licença, origem e formato; sem manifesto |
| Modelos | 2 × `.pt` (YOLO11m det/seg, 82 MB) + 2 × `.onnx` (v8m, 28 MB int8 e 109 MB fp32) | v11 não exportado; int8 degrada classificação |
| `python/` | `orchid_seed_analyzer.py` + `enterprise_analytics/` (377 linhas) | Script com a **classe invertida** em relação ao treino |
| Git | `main` 3.6.0; `develop` = #41 (enterprise sem verificação); **#42 aberto** com a correção | A `-teste` tem os dois defeitos da fila até o #42 entrar |

---

## Setor A — Núcleo (código do app)

**Cuida de:** `src/lib`, `src/hooks`, `src/components`, `src/features/*`,
qualidade, arquitetura, dependências.

**Estado:** núcleo forte e testado; casca (`App.tsx`) inchada; dívida de
avisos; dependências sujas.

**Alvo:** `App.tsx` abaixo de 1 500 linhas até a 3.9; zero avisos de eslint;
`package.json` limpo; toda fonte de verdade única (o teste estático de fonte
única já existe e vale como lei).

**Skills e agentes:** `code-review` (por PR), `simplify` (depois de cada
extração), `react-doctor`, `vercel:react-best-practices` (componentes),
`typescript-advanced-types` (tipos discriminados para `Metadata` e
`Session`), `tdd`, `security-review` (uma vez por release).

**Primeiras tarefas, em ordem:**
1. Remover `@google/genai`, `express`, `dotenv`; mover `vite`, plugins e
   `@types/*` para `devDependencies`. Uma linha de porquê no commit.
2. Extrair de `App.tsx` por **responsabilidade**, não por tamanho, e um
   arquivo por PR: (a) exportações (`handleExport*` → `features/exportar/`),
   (b) importação de JSON/sessão (`processJSONFile` → `features/importar/`),
   (c) o ensaio ao carregar (→ `features/ensaio/useEnsaio.ts`), (d) a fila
   com IA já saiu; (e) o carregamento de imagem já tem `features/carregar/`.
3. Zerar os 85 avisos — 32 estão em `App.tsx` e caem com a extração.
4. `Metadata` como união discriminada (`pesquisa` | `boletim`) em vez de
   campos opcionais que "às vezes" existem.

---

## Setor B — Produto e experiência

**Cuida de:** fluxos, modos, barra de menu, perfis e pré-definições, ajuda no
app, casos de uso.

**Estado:** modos de visualização existem (4 modos, 16 partes); carregar
amostra pergunta; ajuda no app inexistente além dos atalhos; nenhum perfil de
usuário.

**Alvo:** alguém que nunca viu o app faz uma análise de tetrazólio até o CSV
**sem** o roteiro em PDF ao lado.

**Casos de uso a nomear (cada um vira uma pré-definição):**

| Perfil | O que precisa ver | O que não precisa |
|---|---|---|
| **Analista de laboratório comercial** | contagem rápida, fila, laudo, tolerâncias da RAS | morfometria, easter eggs, analytics |
| **Pesquisador de orquídea** | TIFF por página, marcas vazadas, volumes, procedência, exportar dataset | protocolo forrageira |
| **Pesquisador de forrageira** | classes dinâmicas (dormente/dura/vazia), armazenamento em meses, Germinator | tetrazólio em orquídea |
| **Aluno em treinamento** | modo contagem, cronômetro em manual, ajuda passo a passo | fila com IA, analytics |
| **Apresentação** | já existe (`?modo=apresentacao`) | — |

**Skills:** `brainstorming` (antes de qualquer tela nova), `frontend-design`,
`building-components`, `to-prd` (um PRD por caso de uso), `web-design-guidelines`.

**Primeiras tarefas:**
1. Pré-definições = modo de visualização + espécie/protocolo + estilo de marca
   + receita padrão, salvas como preferência, escolhidas na primeira abertura
   (uma tela, quatro cartões, "posso mudar depois").
2. Ajuda no app: uma aba por tarefa (calibrar, contar, medir, exportar),
   gerada da mesma fonte do roteiro em PDF — para os dois nunca divergirem.
3. Barra de menu (Arquivo/Editar/Exibir/Ferramentas/Ajuda) só depois de as
   pré-definições terem sido usadas por alguém que não as escreveu.

---

## Setor C — Ciência (medida, estatística, referências)

**Cuida de:** morfometria, calibração, Germinator, estatística, normas,
bibliografia.

**Estado:** núcleo do Germinator validado contra 24 amostras; `stats.ts`
cobre fator qualitativo (ANOVA, Tukey, Scott-Knott, Kruskal-Wallis, Dunn) e
**não** cobre fator quantitativo (regressão polinomial, ponto de ótimo), que é
o desenho dos ensaios do grupo; `.bib` com 19 referências conferidas; normas
mapeadas (RAS 2025 por capítulo, ISTA Cap. 15).

**Alvo:** o que sai do app é publicável sem passar pelo Excel.

**Skills:** `zotero-paper-reader` (ler o que a Ceci e o Nelson mandam),
`literature-search-openalex` e o MCP do scite/Consensus (conferir referência
na fonte antes de entrar no `.bib`), `journal-abbrev`, `dataviz` (toda curva e
gráfico novos passam por ele antes de existir), `statsmodels`/`sympy` para
conferir fórmulas.

**Primeiras tarefas:**
1. Tela do Germinator: curva ajustada sobre os pontos, parâmetros na tabela,
   comparação entre tratamentos, exportar no formato `INPUT` da planilha.
2. Regressão polinomial + ponto de ótimo para fator quantitativo (MPa, horas,
   meses) — a lacuna registrada desde 03/09.
3. Alvo de resolução (padrão de linhas) além da régua — pega pixel
   interpolado, que a régua não pega.
4. Fechar a conferência das referências pendentes de `docs/mercado/` e
   entrar no `.bib` só as que abrirem na fonte.

---

## Setor D — Dados e modelos

**Cuida de:** os 17 GB de datasets, o catálogo, licenças, manifesto, os
modelos e o caminho "sessão curada → dataset → retreino".

**Estado:** 26 pastas com um README; formatos reconhecidos pelo explorador
(YOLO, multiclasse CSV, pasta por classe, soltas); v11 em `.pt`; int8 degrada
a classificação; dois scripts Python com a classe invertida.

**Alvo:** cada pasta com origem, licença, formato, o que anota e o que não
anota; um manifesto lido pelo app; o dataset de orquídea com máscara publicado
com DOI.

**Skills:** `huggingface-skills:huggingface-datasets` (publicar), `roboflow:*`
(precisa de autorização OAuth — ver perguntas), `huggingface-vision-trainer`
(retreino quando houver anotação curada), `dak:schema-mapping` (o manifesto).

**Primeiras tarefas:**
1. `datasets/catalogo.json` gerado por script: pasta, formato detectado,
   n imagens, licença (campo obrigatório, "desconhecida" é valor válido),
   origem (URL/DOI), o que está anotado. O app lê o catálogo em vez de
   adivinhar.
2. Corrigir ou aposentar `python/orchid_seed_analyzer.py` e
   `hf_space/app/schemas/batch.py` (classe invertida).
3. Exportar YOLO11m-seg para ONNX e comparar com o v8m fp32 nas imagens da
   Mayara — decidir por número, não por versão.
4. O funil: "esta sessão curada vira exemplo de treino" em um clique, com o
   manifesto de reprodutibilidade dentro.

---

## Setor E — Plataforma (backend, deploy, observabilidade)

**Cuida de:** FastAPI, Space, Vercel, CI, Docker, erros em produção.

**Estado:** backend revisado em 18/09 — auth verifica de verdade; quatro furos
(`/telemetry/session` sem auth, mock-upload sem teto, `TESTING` padrão,
`ADMIN_EMAILS` vazio); SQLite efêmero; **sem remoto**. Frontend: Vercel
(main = produção, develop = `-teste`), CI com lint + build + Docker; Sentry
não ligado (o "Relatar problema" local existe).

**Alvo:** backend em repositório remoto, furos fechados, e uma decisão de
hospedagem com disco antes de qualquer promessa de "sessão na nuvem".

**Skills:** `vercel:deployments-cicd`, `vercel:vercel-functions`,
`vercel:env-vars`, `security-review`, `fastapi-pro`, `deploy-to-vercel`,
`agentic-workflows` (CI do backend).

**Primeiras tarefas:**
1. Backend para um repositório remoto (ver pergunta 2), com CI rodando os 97
   testes.
2. Fechar os quatro furos (todos localizados; um PR).
3. Sentry Developer no frontend, sem session replay.
4. Decidir hospedagem com disco → só então sessões na nuvem.

---

## Setor F — Documentação (técnica, de usuário, para agentes)

**Cuida de:** README, CONTRIBUTING, docs técnicos, ajuda no app, roteiros,
site, e o que os agentes leem ao entrar.

**Estado:** README profissional (3.5.0, precisa refletir 3.6/3.7); 43 `.md` em
`docs/`; **três memórias de agente** (`~/.claude/.../memory/`,
`seedcounter_git/MEMORY.md`, `docs/superpowers/`) que não se leem entre si;
site `docs/index.html` estático; sem `AGENTS.md`/`CLAUDE.md` no repo.

**Alvo:** um agente novo lê **um** arquivo e sabe as regras; um usuário novo
acha a resposta dentro do app; um pesquisador acha a citação e o método.

**Skills:** `ai-ready` (gera `AGENTS.md` e config de agentes a partir do
repo), `acquire-codebase-knowledge` (mapa da arquitetura, uma vez),
`documentation-writer`, `create-readme`, `creating-mermaid-diagrams` (os
fluxos de `docs/fluxos.md`), `claude-md-management:claude-md-improver`.

**Primeiras tarefas:**
1. `AGENTS.md` na raiz consolidando `seedcounter_git/MEMORY.md` (as regras de
   RAM e cor sob demanda), as leis do projeto (fonte única, campo vazio em vez
   de inventado, sugere-nunca-preenche, forma além da cor, nome de instituição
   nunca) e o mapa de pastas. `MEMORY.md` da raiz vira um ponteiro.
2. `docs/ARQUITETURA.md` gerado do código (features, libs, fluxo de dados,
   onde cada verdade mora).
3. Ajuda no app e roteiro em PDF a partir da mesma fonte (Setor B, tarefa 2).
4. README para 3.7.0; site `docs/index.html` a partir do README.

---

## Setor G — Demonstrações, treinamento e mercado

**Cuida de:** vídeos, treinamento, ISTA, nome, domínio, canal.

**Estado:** roteiros de demonstração escritos
(`docs/visao/demonstracoes-ideias-e-expansao.md`); roteiro de bancada em PDF;
pesquisa de mercado com cinco lacunas e o nome já tomado desde 2017.

**Alvo:** um treinamento dado, um vídeo por tese, e a decisão do nome tomada
antes de gastar com identidade.

**Primeiras tarefas:** o treinamento da Mayara (semana de 22/09) como piloto
do produto "app grátis + implantação"; o vídeo §1.1 ("a máquina propõe, a
pessoa confere"); decidir nome e domínio.

---

## Como os setores trabalham juntos

- **Um PR por setor por vez**, com `code-review` antes de mesclar. Nunca
  quatro agentes no mesmo arquivo — a extração de `App.tsx` (Setor A) é
  pré-requisito para o resto andar em paralelo sem "regiões".
- **Máximo dois agentes simultâneos** enquanto o crédito for a restrição
  (lição de 21/09: quatro em paralelo morreram duas vezes no limite).
- **Antes de relançar um agente que morreu, olhar o disco** — duas vezes o
  trabalho estava a uma verificação de terminar.
- Cada setor mantém a própria seção neste arquivo; a data no topo diz quando
  os números foram medidos pela última vez.

---

## Perguntas em aberto (só o dono responde)

1. **#42**: mesclar agora? A `-teste` está com a fila com IA marcando tudo
   inviável até isso entrar.
2. **Backend sem remoto**: criar `seedcounter-backend` no GitHub (privado ou
   público?) e subir com CI. Hoje ele existe só no seu disco.
3. **Nome**: SeedCounter existe desde 2017 (Android, trigo, publicado). Manter
   e conviver, ou renomear antes do domínio e da identidade?
4. **Datasets**: quais das 26 pastas podem ir para um catálogo público
   (licença conhecida)? Os de orquídea (Nelson, Mayara, laboratório) podem ser
   publicados com DOI, e quem assina?
5. **Pré-definições**: os quatro perfis da tabela do Setor B estão certos?
   Falta algum (ex.: fiscal do MAPA, indústria de beneficiamento)?
6. **Scripts Python com a classe invertida**
   (`python/orchid_seed_analyzer.py`, `hf_space/.../batch.py`): ainda são
   usados? Corrigir, ou aposentar e documentar que os dados antigos deles
   estão trocados?
7. **hf_space**: continua no ar? Vale manter, ou concentrar tudo no backend
   com disco?
8. **`@google/genai`**: havia uma funcionalidade planejada com Gemini? Se não,
   sai.
9. **Roboflow e Hugging Face**: os MCPs precisam de autorização OAuth sua para
   eu usar (publicar dataset, treinar). Quer autorizar, ou seguimos com `.bib`
   e scripts locais?
10. **Vercel Hobby é não-comercial**: no dia em que houver cobrança (mesmo
    "implantação paga"), precisa de Pro. Isso está no horizonte deste ano?
11. **Zotero**: não há MCP disponível nesta sessão; o fluxo é `.bib` +
    importação manual. Serve, ou quer que eu procure outro caminho?
