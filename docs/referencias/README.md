# Referências do projeto

O que sustenta as decisões do SeedCounter, num lugar só, para consulta depois.

## `seedcounter.bib` — para o Zotero

**Importar:** Zotero → Arquivo → Importar… → `seedcounter.bib`. Se ele
perguntar a codificação, **UTF-8** — em qualquer outra os acentos viram lixo.

Não há coleção dentro do `.bib` (o formato não tem esse conceito). O que há são
**etiquetas** no campo `keywords`, que o Zotero importa como tags, e com elas
você monta as coleções por filtro em dois cliques:

| Etiqueta | O que reúne |
|---|---|
| `grupo` | publicações de Custódio e Machado Neto |
| `tetrazolio` | o teste, o critério topográfico, o protocolo |
| `orquidea` | semente pequena, conservação, germinação |
| `forrageira` | *Urochloa*/*Brachiaria*, espigueta, dormência, armazenamento |
| `imagem` | análise de imagem de semente, morfometria |
| `ferramenta` | software e instrumento que existem no mercado |
| `norma` | RAS, ISTA, ABRATES |
| `estatistica` | desenho experimental e análise |
| `dataset` | conjuntos de imagens e dados públicos |

**A regra deste arquivo:** só entra o que foi conferido na fonte. Referência de
que alguém "se lembra" não entra, e campo não verificado fica **vazio** em vez
de preenchido com o provável. Um DOI errado numa citação custa mais caro que um
campo em branco — e é o modo de falha típico de pesquisa feita por agente, por
isso toda entrada vinda de pesquisa automática é conferida antes de entrar aqui.

A citação do **próprio SeedCounter** não está no `.bib`: está em
[`CITATION.cff`](../../CITATION.cff), na raiz, que é o que o GitHub e o Zotero
leem direto do repositório.

## Onde mora o resto

O `.bib` guarda a referência; o **argumento** que ela sustenta mora nos
documentos abaixo. Quando quiser saber *por que* algo foi decidido, é para cá
que se volta.

| Documento | O que sustenta |
|---|---|
| [`specs/2026-09-03-linhas-de-pesquisa-machado-neto-custodio.md`](../superpowers/specs/2026-09-03-linhas-de-pesquisa-machado-neto-custodio.md) | As linhas de pesquisa do grupo e o que cada uma exige do app — inclusive a lacuna estatística: os ensaios deles têm fator **quantitativo** (MPa, meses), e o app só faz análise de fator qualitativo |
| [`specs/2026-09-08-norma-e-pratica-de-laboratorio.md`](../superpowers/specs/2026-09-08-norma-e-pratica-de-laboratorio.md) | O que a RAS e a ISTA permitem, exigem e não dizem |
| [`specs/2026-09-09-plano-de-normatizacao.md`](../superpowers/specs/2026-09-09-plano-de-normatizacao.md) | Como a norma vira campo, aviso e laudo |
| [`datasets/README.md`](../datasets/README.md) | Os conjuntos de imagens usados, o que cada um tem e o que não tem |
| [`datasets/auditoria-de-medida.md`](../datasets/auditoria-de-medida.md) | Por que o padrão do scanner virou 4800 DPI: a régua da imagem mede ~4735 e ~4771, contra 3600 declarados pelo driver — **toda medida em mm feita com 3600 estava 32% maior** |
| [`mercado/`](../mercado/) | As ferramentas que existem, como as pessoas as usam, e os espaços vazios |
| [`backend/revisao-2026-09-18.md`](../backend/revisao-2026-09-18.md) | O estado real do backend, conferido contra o código |

## Como acrescentar

1. Confira a referência **na fonte** — abra o artigo, não o resultado de busca.
2. Acrescente a entrada em `seedcounter.bib` com as etiquetas certas.
3. Se ela mudar uma decisão do projeto, escreva o argumento no documento que
   trata do assunto e cite a chave BibTeX ali. Referência sem argumento
   associado é referência que ninguém vai usar.
