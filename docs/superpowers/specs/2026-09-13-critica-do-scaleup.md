# Crítica do plano de Scale-Up — o que fica, o que espera, o que contradiz o que medimos

**Data:** 2026-09-13
**Sobre:** os cinco documentos de 2026-09-13 (`visao-executiva`, `escala-industrial-arquitetura`, `performance-webgl-canvas`, `toupview-features-mapping`, `plans/scaleup-fase1`) e o código pendente (`priors-morfometricos.ts`, `SeedInspector.tsx`).

---

## 0. A regra que este documento aplica

O projeto tem uma memória explícita: **conferir relatório de agente contra o código, sempre**. Os cinco documentos foram gerados num brainstorm com um agente, e estão escritos no registro de "visão de produto" — *Padrão-Ouro*, *Salto Quântico*, *engole o mercado*, uma matriz competitiva que dá nota EXCELENTE a coisas que não existem.

Isso não é defeito do brainstorm; é o gênero. O defeito seria tratar o gênero como fato. Então a crítica abaixo separa cada proposta pelo único critério que importa aqui: **ela bate com o que este projeto já mediu?**

Três lições foram medidas, não opinadas, e valem como restrição:

1. **Limiar absoluto por espécie não funciona.** Os padrões de `aglomerado.ts` reprovam 78% das sementes de orquídea sadias (3530 contornos reais). A forma da semente muda o sinal — em três grandezas independentes.
2. **Watershed falha em objeto alongado** por motivo estrutural: o máximo do mapa de distância é uma crista, não um ponto. Foi por isso que o corte por concavidade foi escolhido e medido (95,8% dos pares reais, 5,8% de falso alarme).
3. **O critério do tetrazólio é topográfico.** A RAS 2025 decide por posição e extensão da necrose, não por intensidade de cor. O a\* é insumo, não veredito.

---

## 1. O que contradiz o que medimos — precisa ser reformulado antes de virar código

### 1.1 `priors-morfometricos.ts` reintroduz o limiar absoluto

O módulo guarda `solidezMinimaTipica` por espécie (0,93 soja, 0,92 feijão, 0,90 arroz…) e `diagnosticarContorno` compara a solidez do contorno com esse número para declarar *aglomerado*, *danificada* ou *sadia*.

É exatamente o padrão que a medição em orquídea derrubou. O autor sabia — há `contornoNaturalmenteIrregular` e um teste "deve respeitar a tolerância natural de solidez para orquídeas" — mas isso é **remendo por exceção**, o mesmo que `LIMIARES_DE_CONTORNO_IRREGULAR` já é. A próxima espécie de testa irregular vai precisar de outra exceção.

Agrava: os números vêm de conjuntos **de terceiros** (Koklu feijão/abóbora, Cinar arroz) medidos com **outra segmentação, outro scanner, outra resolução**. Solidez 0,987 para feijão é a solidez do contorno *deles*. A onda deste projeto, num scan deste laboratório, produz contornos com feitio próprio — e "3 sigma" de uma distribuição estrangeira não transfere.

**O que fazer:** manter a tabela como **referência**, no mesmo estatuto de `tamanhos-de-semente.ts` — orienta o olho, nunca decide. O veredito de aglomerado continua vindo de `aglomerado.ts`, cuja conclusão de projeto registrada é: *o limiar certo é relativo à população da própria imagem*. Isso ainda não foi implementado, e é a mudança de maior alcance que resta. Um módulo novo de priors absolutos anda na direção contrária.

### 1.2 Watershed como pipeline do "Oráculo"

A arquitetura propõe `watershed.worker.ts` como "fallback físico ideal para sementes minúsculas como *Urochloa* grudadas". *Urochloa* é espigueta **alongada** (razão 2,2–3,5) — é o caso em que o watershed fatia a semente sozinha ao meio. Está na memória e na medição.

**O que fazer:** retirar. O que separa encostadas neste projeto é o corte por concavidade, com limiar por forma. Se o objetivo é um segundo pipeline de hipótese, o candidato honesto é **a onda a partir de cada marca** (já existe: "contornar em lote"), não o watershed.

### 1.3 ΔE00 com ColorChecker como "objetividade" do tetrazólio

O documento executivo diz que o CIELAB ancorado por ColorChecker "garante objetividade no tecido morto/vivo do eixo embrionário". Isso é a premissa que o projeto **já corrigiu**: a norma não decide por cor. Um ColorChecker melhora a *reprodutibilidade da leitura de cor* — vale para isso — mas não transforma cor em veredito.

**O que fazer:** manter ColorChecker como calibração colorimétrica (é bom), tirar a frase que o vende como critério de viabilidade.

### 1.4 `handleProposeCut` aplica o corte no segundo clique

No `App.tsx` pendente:

```ts
if (corteProposto && contornoSelecionado === id) {
  handleAplicarCorte();
}
```

A regra de projeto do corte, registrada no commit que o ligou, é **mostrar a proposta e nunca aplicar direto** — porque cortar por engano vira duas sementes onde havia uma, e o número do laudo *sobe*. Este gancho aplica automaticamente quando a pessoa clica de novo no mesmo contorno. Um clique duplo acidental corta.

**O que fazer:** o botão do inspetor deve fazer o mesmo que o da barra: selecionar e mostrar a linha. Aplicar continua sendo o botão *Separar*.

---

## 2. O que é prematuro — não há problema medido que justifique

| proposta | o que ela resolve | evidência de que o problema existe | veredito |
|---|---|---|---|
| **DuckDB-Wasm** (25 MB) | consultas sobre "milhões de sementes" | nenhuma — sessões têm centenas de objetos; `summarize`/`resumir` respondem em ms | **adiar** até haver uma consulta que o Dexie não aguente |
| **Migração para Zustand** | "isolar inferência da UI" | nenhuma medição de jank; o histórico por gesto acabou de ser construído sobre os hooks atuais | **adiar**; reescrever estado de app com 766 testes sem problema medido é risco puro |
| **Três pipelines paralelos** (YOLO base, YOLO estrito, watershed) | "o técnico escolhe a hipótese certa" | o baseline mediu o oposto: humano localiza, máquina mede é o fluxo que funciona; int8 já degrada classificação; o doc reconhece risco de OOM em tablet | **adiar**; triplica custo para produzir três resultados que a pessoa tem de comparar |
| **Path2D + QuadTree** | hover em 3.000 polígonos | nenhuma imagem do projeto tem 3.000 objetos; a maior anotada tem 104 | **só quando medir** — e é barato quando precisar |
| **OffscreenCanvas nos workers** | thumbnails sem travar a UI | depende dos três pipelines existirem | cai junto |

Ponto comum: todos são **soluções de escala para um problema de escala que não foi observado**. O projeto está em centenas de objetos por imagem e dezenas de sessões. Construir para milhões antes de ter milhares é o erro que a Fase 1 inteira comete.

---

## 3. O que é bom e barato — fazer

| proposta | por que vale | tamanho |
|---|---|---|
| **Feret por Rotating Calipers** | medida padrão ImageJ, mapeia direto em **peneira comercial** (necessidade real de UBS e da RAS); a PCA atual aproxima, o Feret é o canônico; testes prescritos no doc (círculo → L_min = L_max; retângulo 10×20 → 10 e 22,36) são bons | pequeno, puro, testável |
| **Taxonomia hierárquica** | `classes-de-semente.ts` já tem 6 classes e protocolos; plântula anormal tem subcategorias reais na RAS Cap. 4 | médio — mas como `string[]` no esquema Dexie que existe, **não** L-Tree em DuckDB |
| **Menu radial** | classificar sem sair do canvas é bom; há tecla `X` e a galeria, mas o gesto é mais rápido | médio; **spike** primeiro |
| **Worker para inferência ONNX** | a inferência bloqueia a thread hoje; é engenharia legítima, independente do Oráculo | médio; um worker, não três |
| **UVC: travar exposição/balanço** | valor real na lupa; suporte de navegador é falho e o doc admite | pequeno, com fallback honesto |
| **Flat field ao vivo em WebGL** | é `achatar-fundo.ts` para vídeo — o núcleo existe para imagem estática | médio; só quando a captura ao vivo for fluxo principal |
| **Pedal HID** | rendimento por analista | pequeno, quando houver pedal para testar |

---

## 4. O que a Fase 1 deveria ser

A `plans/scaleup-fase1.md` propõe: orquestrador de workers → dois pipelines → store Zustand → galeria de hipóteses → menu radial → migração de esquema → DuckDB → painel de taxonomia. Sete frentes, nenhuma medida, uma contradizendo medição.

Proposta de substituição, em ordem, cada uma com critério de pronto:

| # | frente | pronto quando |
|---|---|---|
| 1 | **Consertar os dois pendentes** — `priors` vira referência (não veredito); `handleProposeCut` só seleciona | testes existentes passam; teste novo prova que clique duplo não corta |
| 2 | **Feret** em `lib/feret.ts` | os dois testes prescritos + comparação com PCA em 1200 sojas medidas (diferença mediana documentada) |
| 3 | **Limiar relativo à população** em `aglomerado.ts` | os presets por espécie somem; orquídea e soja passam com os mesmos padrões, medido nos conjuntos |
| 4 | **Um worker de ONNX** | inferência não bloqueia arraste; medido com `performance.now()` antes/depois |
| 5 | **Taxonomia como caminho** (`classe: string[]`) no esquema v5→v6 | migração testada; laudo continua fechando 100 |
| 6 | **Spike do menu radial** | 20 classificações em vídeo, tempo medido contra tecla `X` |

Notar o que **não** está na lista: DuckDB, Zustand, três pipelines, QuadTree. Eles voltam se alguma medição os pedir.

---

## 5. Sobre os documentos em si

Vale mantê-los — são um bom mapa de possibilidades. Mas precisam de duas edições para não enganar quem ler daqui a um mês:

- **Matriz competitiva:** trocar as notas de "o que seremos" por "o que somos"; ou rotular a coluna como *alvo*.
- **Três parágrafos** (watershed para *Urochloa*, ΔE como objetividade do TZ, priors absolutos) recebem uma nota remetendo às medições em `docs/datasets/README.md` §5 e às memórias `limiar-depende-da-forma`, `separar-encostadas-concavidade-antes-de-watershed`, `criterio-do-tetrazolio-e-topografico`.

O trabalho pendente (`priors`, `SeedInspector`, 44 linhas no `App.tsx`) compila e passa 766 testes. **Não deve ser commitado como está** por causa de 1.1 e 1.4 — mas está a duas edições de poder ser.
