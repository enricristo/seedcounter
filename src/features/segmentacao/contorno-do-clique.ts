// =============================================================================
// SeedCounter — o contorno que a onda produz por um clique
//
// POR QUE EXISTE. Três lugares do App montavam o MESMO objeto
// `YoloSegmentation` depois de `segmentarNoCanvas` devolver um contorno: o
// clique avulso (`segmentarComOnda`), "contornar esta" na galeria
// (`handleSegmentarUma`) e o lote de pendentes (`handleSegmentarPendentes`).
// Os três tinham a forma idêntica — muda só de onde vem a categoria, a
// classe externa e o `id` (a fórmula do id depende do relógio, por isso mora
// no HOOK — ver o cabeçalho de `useOnda.ts`). Aqui fica a tradução pura:
// monta o objeto, formata os recados, nada mais — dá para provar contra o
// formato antigo com `toEqual`/`JSON.stringify`.
//
// A TAXONOMIA VEM DE `lib/classe-do-modelo.ts` (Lei 1). `nomeDaCategoria`
// substitui o `tipo === 'viable' ? 'viavel' : 'inviavel'` que os três
// handlers repetiam — produz a MESMA string, uma fonte só.
//
// DOIS RECADOS DE "SEM CONTORNO", NÃO UM. `recadoDoContorno` (clique avulso)
// e `recadoDeUma` ("contornar esta" da galeria) tratam o mesmo caso —
// `segmentarNoCanvas` devolveu `null` ou `tocouBorda` — com textos
// DIFERENTES: o clique avulso distingue "não deu para ler os pixels" de "a
// onda escapou" e mostra área e tempo no sucesso; "uma" junta os dois erros
// numa frase só e não mostra área nem tempo. Isso já era assim no App;
// reproduzido aqui, não unificado.
// =============================================================================

import type { YoloSegmentation } from '../../types';
import type { ResultadoDaOnda } from '../../lib/region-growing';
import { nomeDaCategoria, type Categoria } from '../../lib/classe-do-modelo';
import { calculateSeedDimensions } from '../../lib/pca-utils';

export interface EntradaDoContorno {
  /** Já pronto — ver `useOnda.ts` sobre as três fórmulas de id. */
  id: number;
  contorno: [number, number][];
  tipo: Categoria;
  classeExterna?: string;
  marcaId: number;
}

/**
 * O `YoloSegmentation` que os três handlers da onda montavam depois de um
 * contorno confiável. Mesmas chaves, mesma ordem — o teste compara por
 * `JSON.stringify`.
 */
export function contornoDoClique(entrada: EntradaDoContorno): YoloSegmentation {
  const { width, height } = calculateSeedDimensions(entrada.contorno);
  return {
    id: entrada.id,
    category: entrada.tipo,
    class_name: nomeDaCategoria(entrada.tipo),
    classeExterna: entrada.classeExterna,
    // Não é probabilidade de modelo: foi a pessoa que apontou a semente.
    confidence: 1,
    polygon_points: entrada.contorno,
    visible: true,
    width,
    height,
    // A marcação criada pelo mesmo clique é quem conta a semente.
    origem: 'clique',
    marcaId: entrada.marcaId,
  };
}

/** `areaPx` formatada como o inspetor mostra: mm² calibrado, ou px cru. */
export function areaFormatada(areaPx: number, umPerPixel: number | undefined): string {
  return umPerPixel ? `${((areaPx * umPerPixel ** 2) / 1e6).toFixed(3)} mm²` : `${areaPx} px`;
}

/**
 * Os recados do clique avulso (`segmentarComOnda`): sem pixels, onda que
 * escapou, ou sucesso com área e tempo.
 */
export function recadoDoContorno(
  r: ResultadoDaOnda | null,
  umPerPixel: number | undefined,
  ms: number
): { tom: 'ok' | 'aviso'; texto: string } {
  if (!r) {
    return { tom: 'aviso', texto: 'Não foi possível ler os pixels desta imagem.' };
  }
  if (r.tocouBorda) {
    return {
      tom: 'aviso',
      texto: 'Contagem registrada, sem contorno: a onda escapou. Clique mais para dentro da semente.', // prettier-ignore
    };
  }
  return { tom: 'ok', texto: `Contorno medido — ${areaFormatada(r.areaPx, umPerPixel)} · ${ms} ms` };
}

/** O recado de "contornar esta" (`handleSegmentarUma`) — ver o cabeçalho. */
export function recadoDeUma(r: ResultadoDaOnda | null): { tom: 'ok' | 'aviso'; texto: string } {
  if (!r || r.tocouBorda) {
    return {
      tom: 'aviso',
      texto: 'A onda escapou nesta marcação — sem contorno. Tente ajustar o fundo ou o ponto.',
    };
  }
  return { tom: 'ok', texto: 'Contorno medido.' };
}

/** O recado final do lote (`handleSegmentarPendentes`). */
export function recadoDoLote(
  medidas: number,
  total: number,
  escaparam: number
): { tom: 'ok' | 'aviso'; texto: string } {
  return {
    tom: escaparam > 0 ? 'aviso' : 'ok',
    texto:
      `${medidas} de ${total} contornos medidos.` +
      (escaparam > 0
        ? ` ${escaparam} ${escaparam === 1 ? 'ficou' : 'ficaram'} sem contorno — a onda escapou. A contagem não mudou.`
        : ' A contagem não mudou.'),
  };
}

/**
 * Nome de classe do dataset ativo, na forma que a onda anexa a marca e
 * contorno — `classeExternaDaImagem` no App. Só existe quando a imagem
 * carregou do explorador de datasets com classes conhecidas; `undefined`
 * fora daí, ou com lista vazia.
 *
 * `propostosParaSegmentacoes` (outro tema, permanece no App) derivava esta
 * MESMA conta separadamente; agora chama esta função — fonte única, mesma
 * junção `' + '`. Recebe `classesDaImagem` já desembrulhado (não o
 * `metadata` inteiro): o chamador em `propostosParaSegmentacoes` guarda
 * `metadata.dataset?.classesDaImagem` como dependência ESTREITA do seu
 * `useCallback` — aceitar `metadata` aqui obrigaria a listar o objeto
 * inteiro como dependência e mudaria quando aquele callback se renova.
 */
export function classeExternaDe(classesDaImagem: string[] | undefined): string | undefined {
  return classesDaImagem && classesDaImagem.length > 0 ? classesDaImagem.join(' + ') : undefined;
}
