// =============================================================================
// SeedCounter — exemplos REAIS embutidos
//
// Recortes reduzidos de cada dataset da pasta `datasets/`, gerados por
// `scripts/gerar-exemplos-reais.py`, servidos de `public/exemplos/` e
// descritos em `public/exemplos/catalogo.json`.
//
// Por que buscar sob demanda, e não importar: são ~50 imagens e ~20 MB. No
// bundle, atrasariam toda abertura do app por causa de um botão.
//
// Por que os metadados vêm junto: um exemplo real só é útil se a pessoa não
// tiver de descobrir de onde ele veio, de que espécie é e em que escala está.
// O que se sabe fica preenchido (espécie, origem, classe, µm/px quando o
// scanner tem DPI declarado); o que não se sabe fica vazio e o app pede.
// =============================================================================
import type { Metadata } from '../../types';

export type TipoDeExemplo = 'digitalizacao' | 'foto' | 'foto-individual' | 'macro' | 'recorte';

export interface ExemploReal {
  slug: string;
  /** Conjunto de origem (slug do dataset). */
  conjunto: string;
  rotulo: string;
  /** Chave de cultura para agrupar na interface: 'orquidea', 'soja', 'trigo', 'arroz', 'milho', 'cafe', 'amendoim', 'varias'. */
  cultura: string;
  especie: string | null;
  tipo: TipoDeExemplo;
  /** Caminho relativo a `public/`. */
  imagem: string;
  largura: number;
  altura: number;
  original: { arquivo: string; largura: number; altura: number; fatorDeReducao: number; recorteEm: [number, number] };
  /** Já corrigido pelo fator de redução; null = sem escala conhecida. */
  umPorPixel: number | null;
  notaEscala: string;
  classesDaImagem: string[];
  origem: string;
  licenca: string;
  url: string | null;
  dica: string;
  bytes: number;
}

export interface CatalogoDeExemplos {
  geradoEm: string;
  regra: string;
  exemplos: ExemploReal[];
}

const ROTULOS_DE_CULTURA: Record<string, string> = {
  orquidea: 'Orquídea',
  soja: 'Soja',
  trigo: 'Trigo',
  arroz: 'Arroz',
  milho: 'Milho',
  cafe: 'Café',
  amendoim: 'Amendoim',
  varias: 'Várias espécies',
};

export function rotuloDaCultura(cultura: string): string {
  return ROTULOS_DE_CULTURA[cultura] ?? cultura;
}

function base(): string {
  const b = import.meta.env?.BASE_URL ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
}

let cache: Promise<CatalogoDeExemplos> | null = null;

/** Busca o catálogo uma vez por sessão. */
export function carregarCatalogo(): Promise<CatalogoDeExemplos> {
  if (!cache) {
    cache = fetch(`${base()}exemplos/catalogo.json`).then(async (r) => {
      if (!r.ok) throw new Error(`Catálogo de exemplos indisponível (${r.status}).`);
      return (await r.json()) as CatalogoDeExemplos;
    });
    cache.catch(() => {
      cache = null; // permite tentar de novo depois de uma falha de rede
    });
  }
  return cache;
}

/** Agrupa por cultura, na ordem em que aparecem no catálogo. */
export function agruparPorCultura(exemplos: ExemploReal[]): { cultura: string; rotulo: string; exemplos: ExemploReal[] }[] {
  const grupos = new Map<string, ExemploReal[]>();
  for (const e of exemplos) {
    if (!grupos.has(e.cultura)) grupos.set(e.cultura, []);
    grupos.get(e.cultura)!.push(e);
  }
  return [...grupos.entries()].map(([cultura, xs]) => ({ cultura, rotulo: rotuloDaCultura(cultura), exemplos: xs }));
}

/**
 * Os metadados que um exemplo propõe. Preenche o que se sabe e só isso.
 *
 * `treatment` recebe a classe do dataset quando há uma (ex.: "with mold"),
 * porque é o campo de pesquisa que agrupa repetições — e a classe é
 * exatamente o que a pessoa vai querer comparar entre exemplos.
 */
export function metadadosDoExemplo(e: ExemploReal): Partial<Metadata> {
  const licenca = e.licenca ? ` Licença: ${e.licenca}.` : '';
  const url = e.url ? ` ${e.url}` : '';
  return {
    project: e.origem,
    treatment: e.classesDaImagem[0] ?? '',
    notes: `Exemplo real: ${e.rotulo}. ${e.dica} Origem: ${e.origem}.${licenca}${url} Arquivo: ${e.original.arquivo}. Escala: ${e.notaEscala}.`,
    umPerPixel: e.umPorPixel ?? undefined,
    imageSource: e.tipo === 'digitalizacao' ? 'other' : 'manual_camera',
    amostra: {
      especieNomeComum: rotuloDaCultura(e.cultura),
      especieNomeCientifico: e.especie ?? undefined,
      procedencia: e.origem,
    },
  };
}

/** Busca a imagem como File PNG, pronto para a fila de imagens, com os metadados propostos. */
export async function carregarExemploReal(e: ExemploReal): Promise<{ arquivo: File; metadados: Partial<Metadata> }> {
  const r = await fetch(`${base()}${e.imagem}`);
  if (!r.ok) throw new Error(`Exemplo "${e.rotulo}" não encontrado (${r.status}).`);
  const blob = await r.blob();
  const arquivo = new File([blob], `${e.slug}.png`, { type: 'image/png' });
  return { arquivo, metadados: metadadosDoExemplo(e) };
}
