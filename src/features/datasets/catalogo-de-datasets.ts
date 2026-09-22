/**
 * Busca do catálogo de datasets (`public/exemplos/catalogo-de-datasets.json`).
 *
 * Fica em `features/` porque toca `fetch`; a leitura validada é
 * `lib/datasets/catalogo.ts`, pura. Buscado sob demanda — só quando alguém
 * abre uma pasta no explorador — e uma vez por sessão: o arquivo é pequeno
 * (dezenas de KB), mas não há motivo para custar a abertura do app por causa
 * de um chip que só aparece numa aba.
 *
 * Falha de rede não é erro para a pessoa: o painel apenas não mostra o chip,
 * e a próxima chamada tenta de novo.
 */
import { lerCatalogo, type CatalogoDeDatasets } from '../../lib/datasets/catalogo';

function base(): string {
  const b = import.meta.env?.BASE_URL ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
}

let cache: Promise<CatalogoDeDatasets> | null = null;

export function carregarCatalogoDeDatasets(): Promise<CatalogoDeDatasets> {
  if (!cache) {
    cache = fetch(`${base()}exemplos/catalogo-de-datasets.json`).then(async (r) => {
      if (!r.ok) throw new Error(`Catálogo de datasets indisponível (${r.status}).`);
      return lerCatalogo(await r.json());
    });
    cache.catch(() => {
      cache = null; // permite tentar de novo depois de uma falha de rede
    });
  }
  return cache;
}
