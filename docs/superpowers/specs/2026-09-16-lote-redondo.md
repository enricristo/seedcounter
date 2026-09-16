# O lote, redondo — cenários, buracos e o que fazer

**Data:** 2026-09-16. **Sobre:** `src/features/lote/` (C1, entregue hoje) — o que falta para ele aguentar o uso real.

O lote hoje: escolhe fonte (fila · regiões · pasta), escolhe receita, roda em sequência, mostra uma tabela de números, e cada linha vira sessão quando a pessoa aceita. Funciona — e é cego: **a pessoa aceita sem ver o que foi encontrado**. "Conferir antes de aceitar" sem nada para olhar é fé, não conferência.

## Os cenários que o laboratório traz

| # | cenário | o que acontece hoje |
|---|---|---|
| 1 | 12 folhas de scanner digitalizadas de manhã, mesma receita | funciona; mas conferir 12 resultados é olhar 12 números |
| 2 | uma digitalização com 4 placas → dividir em regiões e contar cada uma | a fonte existe; falta ver o recorte de cada região no resultado |
| 3 | pasta de dataset inteira, para ver se o app reconhece | funciona; sem comparação com a anotação do dataset |
| 4 | a **mesma placa em datas diferentes** (o trabalho da Profa. Ceci e do Prof. Nelson) | roda, mas nada liga os resultados entre si |
| 5 | aceitar só as boas | possível linha a linha, às cegas |
| 6 | fechou a aba no meio / travou | **perde tudo**: o resultado só vive na memória do painel |
| 7 | uma imagem corrompida, TIFF estranho, foto gigante | isolado, já funciona (erro por linha, não derruba o lote) |
| 8 | a mesma imagem já foi contada antes | **grava sessão duplicada em silêncio** |
| 9 | "a receita Sensível é melhor que a Padrão aqui?" | precisa rodar duas vezes e comparar de cabeça |
| 10 | aceitou, quer abrir e corrigir | a sessão existe; o caminho até ela não é dito |
| 11 | 12 digitalizações de 6800×9359 | uma imagem decodificada por vez — resolvido |
| 12 | "essa receita é estável?" | sem resumo: nem total, nem dispersão entre imagens |

## O que fazer (nesta ordem)

### 1. Ver antes de aceitar — miniatura com os contornos
Cada linha da tabela ganha uma miniatura (~72 px) com os contornos propostos desenhados por cima, e um clique abre a imagem grande com a proposta sobreposta. Gerar no fim de cada imagem, enquanto ela ainda está decodificada — depois seria decodificar de novo. Guardar como data URL pequena; o polígono cheio já é guardado à parte.
**Sem isto o resto não importa:** é o que transforma "aceitar" em decisão.

### 2. Resumo do lote — a receita é estável?
Acima da tabela: total de objetos, **mediana por imagem** e a **dispersão** (p5–p95 ou mín–máx), imagens com erro, tempo total e por imagem. Uma receita que dá 120, 118, 121 e 4 objetos avisa sozinha onde olhar — é a mesma lógica do limiar da população: a dispersão dentro do lote é o sinal.

### 3. Duplicata — avisar antes de gravar
Antes de aceitar, checar se já existe sessão com o mesmo nome de arquivo (e data próxima). Se existir: marcar a linha e perguntar — **substituir**, **gravar assim mesmo** (vira outra sessão) ou **pular**. Nunca decidir sozinho: duas sessões da mesma placa podem ser legítimas (contagens em dias diferentes).

### 4. Rodar de novo, só o que falhou / só uma linha
Botão por linha (**repetir**) e um **repetir as que falharam**. Erro de decodificação e imagem que escapou merecem segunda chance sem refazer o lote inteiro.

### 5. Sobreviver a fechar a aba
O resultado do lote (sem as imagens: números, contornos, miniaturas) vai para o Dexie (`version(10)`, store `lotes`), e o painel reabre o último lote não aceito com um aviso "resultado de 16/09, 3 de 12 aceitos". Quem fecha o navegador no meio de 40 imagens não perde 40 minutos.

### 6. Comparar duas receitas na mesma fonte
Rodar a mesma fonte com a receita B mantém o resultado de A: a tabela ganha colunas lado a lado (A · B · diferença) e o resumo compara as duas. É o que responde "qual receita usar nesta bancada" com número em vez de opinião — e alimenta a receita salva por espécie (C5).

### Fora de escopo agora
Comparar com a anotação do dataset (isso é o B3/B4 do explorador); ligar lote e longitudinal (cenário 4) — depende das bancadas (C2); paralelizar com workers (uma imagem por vez é o que protege a memória).

## Restrições que continuam valendo

- Nada vira sessão sem aceite explícito.
- Erro numa imagem não derruba o lote.
- Uma imagem decodificada por vez.
- `inviaveis` segue 0: a onda não distingue viável de inviável — isso é leitura de tetrazólio, feita por pessoa.
- A receita usada vai gravada em `metadata.receita`; sem isso o lote não é auditável.
