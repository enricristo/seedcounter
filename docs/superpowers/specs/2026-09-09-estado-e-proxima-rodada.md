# Estado do projeto e próxima rodada — 09/09/2026

Onde paramos, o que está pronto, o que está pronto **mas não ligado**, e o que
nem começou. Escrito para a próxima sessão começar sem reconstruir contexto.

---

## 1. A distinção que mais importa neste documento

Muita coisa foi construída hoje, e há **três estados diferentes**, não dois:

| estado | o que significa |
|---|---|
| ✅ **No ar** | funciona e a pessoa alcança pela interface |
| 🔌 **Pronto, sem tomada** | núcleo completo e testado, **nenhum botão chama** |
| ⬜ **Não começou** | — |

O 🔌 é a categoria perigosa: parece feito no repositório e não existe para quem
usa. Quatro módulos estão nela.

---

## 2. No ar ✅

| o que | onde | atalho |
|---|---|---|
| Máscara de anotação (3 estados) | `features/mascara/` | `M` |
| Galeria de objetos | `features/galeria/` | `G` |
| Ajustar contorno (vértices + borracha) | `lib/borracha.ts` + canvas | `C` |
| Laudo BAS/BASO com imagem original e analisada | `lib/laudo/` | exportar |
| Identificação normativa (BAS) | `features/normas/` | flag `modoLaudo` |
| Régua com duas escalas (mm + px) | `lib/regua.ts` | réguas |
| Tamanho da marca proporcional à imagem | `lib/escala-da-marca.ts` | barra |
| Conferência de escala por espécie | `lib/normas/tamanhos-de-semente.ts` | painel de calibração |
| Notas de versão | `features/novidades/` | clicar a versão no rodapé |
| Tela de abertura | `index.html` | — |

---

## 3. Pronto, sem tomada 🔌 — **começar por aqui**

Estes têm núcleo completo, testado, e **nenhuma forma de acionar**. É o maior
ganho por esforço da próxima rodada: o trabalho difícil já está feito.

### 3.1 Corte por concavidade — `lib/corte-por-concavidade.ts`
Separa duas sementes que o contorno engoliu. `proporCorte()` devolve as duas
metades e a linha de corte.
**Falta:** botão na célula da galeria e no contorno selecionado, mostrando a
linha proposta antes de aplicar. Usar `CORTE_PARA_SEMENTE_ALONGADA` quando a
espécie for alongada.

### 3.2 Achatar o fundo — `lib/achatar-fundo.ts`
Três modos: `corrigir`, `isolar`, `realcar`.
**Falta:** botão no painel de ajuste de imagem. **Regra a respeitar:** a imagem
achatada vai para a onda e para o olho; o YOLO continua recebendo a original, e
o laudo também.

### 3.3 Classes de forrageira — `lib/normas/classes-de-semente.ts`
Protocolos (simples / germinação / forrageira), denominador correto, aviso de
tetrazólio a partir de 5% de dormentes, escarificação.
**Falta:** seletor de protocolo, contadores por classe no lugar de
viável/inviável, e levar os `textoParaObservacoes` para o laudo.

### 3.4 Arredondamento e tolerância — `lib/normas/arredondamento.ts`, `tolerancias.ts`
**Falta:** ligar no laudo (o boletim ainda não usa `arredondarGerminacao`), e
a interface de reconhecimento do estouro de tolerância.

---

## 4. Bloqueio externo — precisa de decisão humana

**A Tabela 4.1 de tolerância não foi conferida.** `TABELA_4_1_NAO_CONFERIDA =
true` faz `verificarGerminacao` recusar-se a dar veredito: ela calcula a
amplitude e aponta quais repetições discordam, mas não diz "dentro da
tolerância", porque isso com número não conferido parece aprovação.

**Para destravar:** conferir a Tabela 4.1 no Wikisda (RAS 2025, Cap. 4), trocar
os valores em `TABELA_4_1` e derrubar a constante. Há teste que falha se alguém
derrubar a constante sem querer.

Mesma situação, menor: `PORTARIA_DA_RAS_2025_NAO_CONFIRMADA`.

---

## 5. Não começou ⬜

| item | esforço | observação |
|---|---|---|
| **F4** PMS completo (Cap. 9) | médio | 8×100, CV ≤4%/≤6%, descarte a 2σ |
| **F5** Emergência de radícula | médio | 2 mm, ISTA Rules 2026 para soja |
| **I4** Classes na galeria | médio | depende de 3.3; é a interface do TZ topográfico |
| **I6** Modo avançado de segmentação | médio | **só com medida de erro junto** |
| **I10** Alvos de calibração em cm/mm | baixo | a tabela de tamanhos já dá o alvo |
| **I11** Caixa lateral à imagem | baixo | só sobra espaço em imagem retrato |
| **I12** Afordância de borda | baixo | cromo neutro, nunca cor de espécime |

---

## 6. A lição que apareceu três vezes hoje

**Uma constante única não serve, porque a forma da semente muda o sinal.**

| grandeza | semente redonda | semente alongada |
|---|---|---|
| razão C/L de um par fundido | **sobe** (1,2 → 2,4) | **cai** (3,7 → 1,9) |
| profundidade de cintura | 0,248 (dois discos) | 0,852 (orquídea real) |
| solidez de semente isolada | ~0,99 | 0,942 (p5 0,695) |

Três grandezas independentes, mesma causa. Os limiares padrão de
`aglomerado.ts` reprovam **78% das sementes de orquídea sadias**.

**A conclusão de projeto, ainda não implementada:** o limiar certo é relativo à
**população da própria imagem**, como `medianaDaCena` já faz para a área. Isso
substituiria todos os presets por uma regra que funciona em qualquer espécie —
e é provavelmente a mudança de maior alcance que resta.

---

## 7. O que ainda falta medir

- **Par real de semente REDONDA.** O conjunto de soja não tem par nenhum, o de
  orquídea é alongado. A afirmação de que o par de soja aparece no lado alto da
  razão continua sendo aritmética, não medição.
- **Morfometria contra paquímetro.** Nenhum conjunto tem medição manual pareada.
- **Tetrazólio com leitura de referência por semente.**

Procedência de tudo que já foi medido: `docs/datasets/README.md` §5.
