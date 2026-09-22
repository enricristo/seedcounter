// =============================================================================
// Uma verdade, uma fonte.
//
// Três defeitos, a mesma causa: código que consultava a cena por conta própria
// em vez de perguntar ao módulo canônico.
//
//   1. A contagem incluía contornos do modelo; a tabela de medidas só percorria
//      marcações — semente detectada por IA era contada e não medida.
//      Canônico desde então: `lib/objetos.ts` (`enumerarObjetos`) e
//      `lib/contagem.ts` (`contarObjetos`).
//   2. A exportação de imagem contava sozinha: 2 no PNG, 1 no CSV.
//   3. A fila com IA traduzia `classId === 1` como inviável; em `YOLO_CLASSES`
//      (a tabela do treino, `names: [inviavel, viavel]`) 1 é VIÁVEL — tudo
//      saía inviável. Canônico desde então: `lib/classe-do-modelo.ts`.
//   4. O importador de JSON caía no mesmo `class === 1 → inviável`, e um
//      motor de regras traduzia `objectId - 1` para índice de `marks`,
//      ignorando em silêncio as sementes que só o modelo viu.
//
// Este teste é estático de propósito: o defeito é de ESTRUTURA — uma segunda
// implementação da mesma regra — e se lê no código-fonte. Um teste de
// comportamento só pegaria a divergência que alguém pensou em provocar.
//
// COMO LER UMA REPROVAÇÃO. Cada linha diz arquivo:linha, o padrão e o trecho.
// A saída certa é trocar o trecho pela função canônica. Se o trecho for
// legítimo (e há casos: um "tem alguma coisa?" não é uma contagem), a
// exceção entra na lista abaixo, com o motivo — uma linha, para que a próxima
// pessoa saiba por que aquilo pode.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function arquivosFonte(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === '__tests__') continue;
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosFonte(caminho));
    else if (/\.tsx?$/.test(entrada)) saida.push(caminho);
  }
  return saida;
}

/**
 * Onde a regra pode existir. Tudo o que está fora daqui é consumidor e tem de
 * perguntar. `lib/` inteira fica de fora da varredura porque é onde as
 * fontes canônicas moram — e onde `contagem.ts` legitimamente filtra por
 * categoria, `measurements.ts` legitimamente calcula área.
 */
const VARRIDOS = [join(SRC, 'components'), join(SRC, 'features'), join(SRC, 'App.tsx')];

interface Padrao {
  nome: string;
  regex: RegExp;
  canonico: string;
}

const PADROES: Padrao[] = [
  {
    nome: 'soma/diferença de marcas e contornos como contagem',
    // `marks.length + yoloSegmentations.length` dobra a semente clicada: o
    // clique cria marca E contorno para a mesma semente.
    regex:
      /\b\w*(marks|marcas|yoloSegmentations|segmentacoes|segmentations)\.length\s*[+-]\s*[\w.]*(marks|marcas|yoloSegmentations|segmentacoes|segmentations)\.length/,
    canonico: 'contarObjetos (lib/contagem.ts)',
  },
  {
    nome: 'contagem por filtro de categoria',
    regex: /\.filter\([^)]*\.(type|category|categoria|className|class_name)\s*===\s*'[^']+'\s*\)\.length/,
    canonico: 'contarObjetos (lib/contagem.ts)',
  },
  {
    nome: 'propriedade de contagem alimentada por .length de uma lista',
    // Um prop chamado `…Count=` ou `total…=` que recebe `algo.length` está
    // contando por conta própria. Contagem de objetos vem de `contarObjetos`.
    regex: /\b(\w*Count|total\w*)=\{[^}]*(marks|yoloSegmentations|segmentacoes|segmentations)\.length[^}]*\}/,
    canonico: 'contarObjetos (lib/contagem.ts)',
  },
  {
    nome: 'classe do modelo traduzida por índice',
    regex: /\b(classId|class|class_id|bestClass)\s*===?\s*\d/,
    canonico: 'categoriaDoIndice / categoriaImportada (lib/classe-do-modelo.ts)',
  },
  {
    nome: 'classe do modelo traduzida por nome',
    // `classe` (a coluna da tabela de medidas) fica de fora: já é o vocabulário
    // do app, produzido por `buildMeasurements` a partir da enumeração canônica.
    regex: /\b(className|class_name)\s*===?\s*'(in)?vi[aá]vel'/,
    canonico: 'categoriaDaDeteccao / categoriaDoNome (lib/classe-do-modelo.ts)',
  },
  {
    nome: 'comparação com nome de classe acentuado',
    // O app fala 'viavel'/'inviavel' (sem acento) por dentro; comparar com a
    // forma acentuada é sinal de que se está lendo um vocabulário externo à
    // mão em vez de normalizar por `categoriaDoNome`.
    regex: /===?\s*'(in)?viável'/,
    canonico: 'categoriaDoNome (lib/classe-do-modelo.ts)',
  },
  {
    nome: 'índice canônico convertido em posição de lista',
    // `objectId - 1` como índice de `marks` só funciona porque as marcas vêm
    // primeiro em `enumerarObjetos` — e ignora os contornos órfãos.
    regex: /\b(objectId|objeto_id|indice)\s*-\s*1\b/,
    canonico: 'enumerarObjetos (lib/objetos.ts) e procurar por `indice`',
  },
  {
    nome: 'número de semente fabricado por contador',
    regex: /\b(objectId|objeto_id|indice|numero)\s*:\s*(i|idx|index)\s*\+\s*1\b/,
    canonico: 'enumerarObjetos (lib/objetos.ts): o `indice` já vem de lá',
  },
  {
    nome: 'área de objeto calculada por produto de caixa',
    // Área de IMAGEM ou de região (`img.width * img.height`) não é medida de
    // semente; só o produto de uma caixa de detecção é.
    regex: /\barea\w*\s*[:=]\s*[^,;\n]*\b(bbox|box|caixa)\.(width|height)\s*\*/,
    canonico: 'buildMeasurements (lib/measurements.ts) / areaDoPoligono',
  },
];

interface Excecao {
  arquivo: string;
  /** Trecho que TEM de aparecer na linha reprovada. */
  trecho: string;
  motivo: string;
}

/**
 * Cada exceção é uma linha, com motivo. Uma exceção que não casa com nenhuma
 * reprovação também reprova o teste: a lista não pode acumular perdão para
 * código que já foi corrigido.
 */
const EXCECOES: Excecao[] = [
  {
    arquivo: 'features/lote/fila-ia.ts',
    trecho: 'marks.length - yoloSegmentations.length',
    motivo: 'não é contagem de sementes: é quantas detecções vieram sem máscara (marcas são 1:1 com detecções)',
  },
  {
    arquivo: 'features/ai-pointer/AiPointerPanel.tsx',
    trecho: 'area: d.bbox.width * d.bbox.height',
    motivo: 'área da CAIXA para dimensionar o círculo da prévia no canvas; não é medida exportada',
  },
];

interface Reprovacao {
  arquivo: string;
  linha: number;
  padrao: Padrao;
  trecho: string;
}

function varrer(): Reprovacao[] {
  const reprovacoes: Reprovacao[] = [];
  const arquivos = VARRIDOS.flatMap((alvo) => (statSync(alvo).isDirectory() ? arquivosFonte(alvo) : [alvo]));
  for (const arquivo of arquivos) {
    // `\r?\n`: com CRLF o `\r` sobra no fim da linha e `.` não o cobre — o
    // comentário deixaria de ser removido e reprovaria por texto explicativo.
    const linhas = readFileSync(arquivo, 'utf8').split(/\r?\n/);
    linhas.forEach((linha, i) => {
      // Só código: fora comentário de linha, linha de bloco (` * …`) e `/** … */`.
      const semComentario = linha
        .replace(/\/\*.*?\*\//g, '')
        .replace(/\/\/.*$/, '')
        .replace(/^\s*\*.*$/, '');
      for (const padrao of PADROES) {
        if (padrao.regex.test(semComentario)) {
          reprovacoes.push({
            arquivo: relative(SRC, arquivo).replace(/\\/g, '/'),
            linha: i + 1,
            padrao,
            trecho: linha.trim(),
          });
        }
      }
    });
  }
  return reprovacoes;
}

function ehExcecao(r: Reprovacao): Excecao | undefined {
  return EXCECOES.find((e) => e.arquivo === r.arquivo && r.trecho.includes(e.trecho));
}

describe('fonte única', () => {
  const reprovacoes = varrer();

  it('components/, features/ e App.tsx não contam, traduzem classe nem enumeram por conta própria', () => {
    const semPerdao = reprovacoes
      .filter((r) => !ehExcecao(r))
      .map((r) => `${r.arquivo}:${r.linha} [${r.padrao.nome}] → use ${r.padrao.canonico}\n    ${r.trecho}`);
    expect(semPerdao).toEqual([]);
  });

  it('toda exceção da lista ainda corresponde a uma linha do código', () => {
    const orfas = EXCECOES.filter((e) => !reprovacoes.some((r) => ehExcecao(r) === e)).map(
      (e) => `${e.arquivo}: "${e.trecho}" não existe mais — remova a exceção`
    );
    expect(orfas).toEqual([]);
  });

  it('as fontes canônicas existem e exportam o que este teste promete', () => {
    // Se alguém renomear, o teste acima passaria a apontar para funções que
    // não existem — e o próximo defeito voltaria a ser corrigido "no lugar".
    const objetos = readFileSync(join(SRC, 'lib', 'objetos.ts'), 'utf8');
    expect(objetos).toMatch(/export function enumerarObjetos/);
    const contagem = readFileSync(join(SRC, 'lib', 'contagem.ts'), 'utf8');
    expect(contagem).toMatch(/export function contarObjetos/);
    const classe = readFileSync(join(SRC, 'lib', 'classe-do-modelo.ts'), 'utf8');
    expect(classe).toMatch(/export function categoriaDaDeteccao/);
    expect(classe).toMatch(/export function categoriaDoIndice/);
    expect(classe).toMatch(/export function categoriaDoNome/);
    expect(classe).toMatch(/export function categoriaImportada/);
  });
});
