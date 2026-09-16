# Marca do SeedCounter — três propostas (16/09/2026)

> **Decidido em 16/09: a proposta 2 (semente contornada) foi aprovada e aplicada** — `public/mark.svg` (favicon) e `MarcaSemente` em `src/components/layout/Header.tsx`. O texto abaixo fica como registro do porquê, e as outras duas ficam disponíveis caso a escolha mude.

A marca atual (`public/mark.svg`, `MarcaReticulo` no cabeçalho) é um retículo com uma semente dentro. Funciona, mas diz "isto observa" — e o que o app faz é **contar e medir**. As três propostas abaixo partem do mesmo par de cores (instrumento frio `#0d8ea1`, espécime quente `#e0651f`, escolhido por contraste em fundo claro *e* escuro) e mudam o que a forma **afirma**. Nenhuma foi aplicada: escolha uma (ou peça ajustes) e eu troco marca, favicon e a tela de abertura de uma vez.

| | proposta | o que ela afirma | leitura a 24 px |
|---|---|---|---|
| 1 | [Retículo-calibre](proposta-1-reticulo-semente.svg) | a mudança mínima: as hastes horizontais do retículo encostam na semente como um paquímetro fecha sobre o grão — de "observa" para **"mede"** | boa; é a silhueta que o app já tem, então ninguém estranha |
| 2 | [Semente contornada](proposta-2-semente-contornada.svg) | o gesto central do produto desenhado: a semente com o **contorno tracejado** que a onda propõe em volta — o mesmo vocabulário do canvas ("proposta ainda não aceita") | média; precisou de traço grosso e poucos tracinhos para não virar mingau |
| 3 | [Três sementes](proposta-3-tres-sementes.svg) | **contar**, que é o nome do produto: duas sementes já contadas (cheias) e uma por contar (vazada), sobre a linha da bandeja | boa nos blocos, mas o vazado some primeiro |

## Minha recomendação

**A 2**, com a ressalva do tamanho pequeno. Motivo: é a única que mostra o que só este app faz. O retículo é vocabulário de qualquer ferramenta de visão; "três sementes" é vocabulário de qualquer contador; o **contorno tracejado em volta da semente** é a assinatura da onda — e o tracejado significa a mesma coisa dentro do app (proposta pendente de aceite). Uma marca que ensina uma convenção da interface vale mais que uma marca bonita.

Se a leitura a 16 px (favicon) incomodar, a saída é a de sempre em identidade visual: **duas versões do mesmo desenho** — a completa para cabeçalho e abertura, e uma reduzida para favicon (semente + quatro tracinhos, sem o miolo).

## O que muda junto com a marca

- `public/mark.svg` (favicon) e `MarcaReticulo` em `src/components/layout/Header.tsx` — o mesmo desenho, um com cores fixas (favicon não herda tema), outro com `var(--color-accent)`.
- A tela de abertura (`index.html`), que hoje repete o logotipo.
- O canto superior esquerdo: "Edição Acadêmica" sai (não diz nada a quem usa); no lugar, o nome do produto e o contexto da bancada — a espécie já está no chip ao lado das abas.

## Como olhar

No GitHub, os três SVG abrem direto pelos links da tabela. Localmente: `docs/marca/*.svg` em qualquer navegador. Para ver no app antes de decidir, peça — dá para ligar a proposta escolhida atrás da flag de funcionalidades por uma sessão.
