# Cenas compostas — sementes reais soltas numa cena, com verdade exata

Gerador: `scripts/gerar-cenas-compostas.py`. Saída: `public/exemplos/composto-*.png` + `composto-*.verdade.json`, e as entradas correspondentes no `public/exemplos/catalogo.json`.

## O que é

Os datasets de classificação têm **uma semente por foto**: café por nível de torra, arroz por cultivar, milho por variedade, soja por classe de defeito, LZUPSD por espécie. Uma foto dessas não exercita contagem, separação nem morfometria populacional — só classificação.

O script recorta a semente de cada foto (estimativa do fundo pela moldura, limiar sobre a distância de cor, maior componente conexo, preenchimento de buracos, contorno por Moore, duas erosões para não sobrar halo do fundo original) e **solta várias numa cena**: posição por rejeição de colisão, rotação livre, espelho horizontal em metade delas, escala normalizada para 90–130 px no maior lado, sobre fundo claro ou escuro com ruído. É o "tetris" de sementes conhecidas — e cada uma vem com **classe e contorno**.

## As seis cenas

| slug | o que tem |
|---|---|
| `composto-misto-claro-24` / `composto-misto-escuro-24` | um pouco de cada conjunto, nos dois fundos |
| `composto-arroz-claro-30` | 5 cultivares de arroz |
| `composto-cafe-claro-20` | 4 níveis de torra |
| `composto-soja-defeitos-claro-25` | 5 classes de integridade |
| `composto-lzupsd-escuro-24` | várias espécies do LZUPSD |

## Como regenerar

```bash
python scripts/gerar-exemplos-reais.py   # PRIMEIRO: reescreve o catálogo inteiro
python scripts/gerar-cenas-compostas.py  # DEPOIS: acrescenta as cenas ao catálogo
```

A ordem importa: o primeiro script **reescreve** `catalogo.json`; o segundo é idempotente (remove as entradas `conjunto: "composto"` antes de acrescentar as novas), mas se rodar antes, some.

Tamanho: cada PNG é reduzido até caber em 1,45 MB (o teste do catálogo exige ≤ 1,5 MB e lado ≤ 1024). Quando isso acontece, os polígonos da verdade são reescalados junto — a verdade está sempre em px do PNG salvo.

## O que a cena prova, e o que não prova

**Prova:** reconhecimento por classe com verdade exata; invariância a posição, rotação e espelho; contagem numa cena de N objetos conhecidos; morfometria comparável entre classes (o mesmo objeto aparece em escalas diferentes).

**Não prova:** sombra real (a que existe veio da foto original, não da cena), encosto físico entre sementes (elas são coladas sem se tocar), desfoque e profundidade de campo, nem iluminação de bancada. Para isso continuam valendo os datasets reais — a memória do projeto registra dois critérios que passaram no sintético e caíram na soja real.

## Como a verdade se liga ao app

`composto-<nome>.verdade.json`:

```json
{ "origem": "composta", "fundo": "claro",
  "objetos": [{ "id": 1, "classe": "Dark", "conjunto": "cafe-torra",
                "arquivoDeOrigem": "...", "poligono": [[x,y]],
                "caixa": {...}, "flipado": true, "rotacaoGraus": 137.4 }] }
```

O campo `poligono` usa o mesmo formato de `ContornoDeReferencia` em `src/features/datasets/anotacao.ts` (`poligono: [number, number][]`, `classe?: string`) — o que "Carregar referência" já consome na aba Datasets. O que falta para o botão aparecer nas cenas: o carregador de **exemplos reais** (`features/demo/exemplos-reais.ts`) ainda não busca o `.verdade.json` ao lado do PNG; quando buscar, basta mapear `objetos[].poligono/classe` para `contornos[]` e a comparação fica igual à de um dataset anotado. Está anotado na fila como parte do C10.
