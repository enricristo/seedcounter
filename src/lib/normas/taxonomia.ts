// =============================================================================
// SeedCounter — taxonomia como caminho
//
// A classe de uma semente vira uma lista: ['anormal', 'danificada']. A raiz e
// sempre uma das seis classes de germinacao — e o que o denominador e o laudo
// usam — e os niveis abaixo refinam sem mudar a conta.
//
// POR QUE `string[]`, E NAO L-TREE NEM JSONB.
//
// O esquema e Dexie no navegador. Um array de strings e indexavel, e
// serializavel, cabe no JSON da sessao e no CSV. L-Tree e recurso de banco de
// servidor para consultas por prefixo em milhoes de linhas — o projeto tem
// centenas por imagem. Quando houver a consulta que o array nao aguente, ai se
// discute.
//
// AS SUBCATEGORIAS SAO AS DA NORMA, NAO INVENTADAS.
//
// Plantula anormal: danificada, deformada, deteriorada — as tres categorias
// que a RAS e a ISTA reconhecem. Nada abaixo disso entra sem referencia ao
// capitulo.
// =============================================================================

import { CLASSES, type ClasseDeSemente } from './classes-de-semente';

export interface NoDaTaxonomia {
  chave: string;
  rotulo: string;
  filhos?: NoDaTaxonomia[];
}

export const TAXONOMIA: NoDaTaxonomia[] = (Object.keys(CLASSES) as ClasseDeSemente[]).map(
  (chave) => {
    const no: NoDaTaxonomia = { chave, rotulo: CLASSES[chave].rotulo };
    if (chave === 'anormal') {
      no.filhos = [
        { chave: 'danificada', rotulo: 'Danificada' },
        { chave: 'deformada', rotulo: 'Deformada' },
        { chave: 'deteriorada', rotulo: 'Deteriorada' },
      ];
    }
    return no;
  }
);

export function caminhoValido(caminho: string[]): boolean {
  if (caminho.length === 0) return false;
  let nivel: NoDaTaxonomia[] | undefined = TAXONOMIA;
  for (const chave of caminho) {
    const no = nivel?.find((n) => n.chave === chave);
    if (!no) return false;
    nivel = no.filhos;
  }
  return true;
}

export function rotuloDoCaminho(caminho: string[]): string {
  const rotulos: string[] = [];
  let nivel: NoDaTaxonomia[] | undefined = TAXONOMIA;
  for (const chave of caminho) {
    const no = nivel?.find((n) => n.chave === chave);
    if (!no) break;
    rotulos.push(no.rotulo);
    nivel = no.filhos;
  }
  return rotulos.join(' › ');
}

export function classeRaiz(caminho: string[]): ClasseDeSemente | null {
  const raiz = caminho[0];
  return raiz && raiz in CLASSES ? (raiz as ClasseDeSemente) : null;
}
