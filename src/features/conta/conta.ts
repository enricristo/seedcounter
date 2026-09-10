// =============================================================================
// SeedCounter — a conta, e o que ela sincroniza
//
// O QUE ESTE MÓDULO DECIDE.
//
// O cliente de autenticação (`lib/auth/gis-client.ts`) sabe conversar com o
// Google e com o servidor. O que ele NÃO sabe é o que o SeedCounter quer
// guardar na conta — e essa decisão mora aqui, num lugar só, porque é ela que
// define o vocabulário.
//
// A PREFERÊNCIA DE BANCADA FALA O MESMO VOCABULÁRIO DO BOLETIM.
//
// O servidor guarda um JSON livre. Poderíamos chamar a espécie de
// `default_species`, como o exemplo do backend faz. Não: ela se chama
// `especieNomeCientifico`, que é o nome que `IdentificacaoDaAmostra` já usa e
// que o laudo já lê. Um dado com dois nomes é um dado que vai divergir.
//
// O QUE NUNCA ENTRA AQUI.
//
// Sessão, marcação, imagem, laudo. Isto é preferência de BANCADA — a espécie
// que a pessoa costuma analisar, a resolução do scanner dela, o nome que ela
// assina. Dado sem sensibilidade, ganho real para quem usa todo dia. O dado do
// laboratório continua no IndexedDB da máquina, e subir é ação explícita da
// pessoa, nunca sincronização silenciosa.
//
// A CONTA É OPCIONAL, E ISSO NÃO É SÓ UMA FRASE.
//
// Sem `VITE_GOOGLE_CLIENT_ID`, o botão nem aparece. Sem servidor, o app
// funciona igual. Logar não desbloqueia nada que não existisse antes — só
// carrega a preferência e a guarda de volta.
// =============================================================================

import type { Metadata } from '../../types';
import type { BenchPreferences } from '../../lib/auth/gis-client';

/**
 * O que a conta lembra por você.
 *
 * Os campos são um SUBCONJUNTO de `Metadata`, com os mesmos nomes, de propósito:
 * hidratar e extrair viram um mapeamento trivial e sem tradução.
 */
export interface PreferenciaDeBancada {
  /** Nome científico, como `IdentificacaoDaAmostra.especieNomeCientifico`. */
  especieNomeCientifico?: string;
  especieNomeComum?: string;
  /** Escala do equipamento de costume, em µm/px. */
  umPerPixel?: number;
  /** Quem assina a contagem. */
  pesquisador?: string;
  /** Protocolo de germinação de costume. */
  protocolo?: Metadata['protocolo'];
}

/** As chaves que este módulo reconhece. Qualquer outra no JSON é ignorada. */
const CHAVES: (keyof PreferenciaDeBancada)[] = [
  'especieNomeCientifico',
  'especieNomeComum',
  'umPerPixel',
  'pesquisador',
  'protocolo',
];

/**
 * Lê o JSON do servidor no formato do aplicativo.
 *
 * Só aceita o que reconhece, e só com o tipo certo. O servidor guarda JSON
 * livre; confiar nele cegamente seria deixar um `umPerPixel: "abc"` chegar até
 * a calibração.
 */
export function lerPreferencia(bruto: BenchPreferences | null | undefined): PreferenciaDeBancada {
  if (!bruto || typeof bruto !== 'object') return {};

  const p: PreferenciaDeBancada = {};
  for (const chave of CHAVES) {
    const v = bruto[chave];
    if (v === undefined || v === null) continue;

    if (chave === 'umPerPixel') {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) p.umPerPixel = v;
    } else if (chave === 'protocolo') {
      if (v === 'simples' || v === 'germinacao' || v === 'forrageira') p.protocolo = v;
    } else if (typeof v === 'string' && v.trim()) {
      p[chave] = v.trim();
    }
  }
  return p;
}

/**
 * O que guardar, a partir do que a pessoa tem na bancada agora.
 *
 * Só o que está preenchido: um campo vazio não deve apagar no servidor o que
 * a pessoa tinha salvo de outra máquina.
 */
export function extrairPreferencia(metadata: Metadata): PreferenciaDeBancada {
  const p: PreferenciaDeBancada = {};
  const especie = metadata.amostra?.especieNomeCientifico?.trim();
  const comum = metadata.amostra?.especieNomeComum?.trim();
  const pesquisador = metadata.researcher?.trim();

  if (especie) p.especieNomeCientifico = especie;
  if (comum) p.especieNomeComum = comum;
  if (metadata.umPerPixel && metadata.umPerPixel > 0) p.umPerPixel = metadata.umPerPixel;
  if (pesquisador) p.pesquisador = pesquisador;
  if (metadata.protocolo) p.protocolo = metadata.protocolo;
  return p;
}

/**
 * Aplica a preferência sobre os metadados SEM apagar o que já está preenchido.
 *
 * A regra é "preenche o vazio": se a pessoa já digitou uma espécie nesta
 * sessão, a preferência da conta não a sobrescreve. Quem está na frente da
 * tela sabe mais que o servidor.
 */
export function aplicarPreferencia(metadata: Metadata, p: PreferenciaDeBancada): Metadata {
  const amostra = { ...(metadata.amostra ?? {}) };
  if (!amostra.especieNomeCientifico && p.especieNomeCientifico) {
    amostra.especieNomeCientifico = p.especieNomeCientifico;
  }
  if (!amostra.especieNomeComum && p.especieNomeComum) {
    amostra.especieNomeComum = p.especieNomeComum;
  }

  return {
    ...metadata,
    amostra: Object.keys(amostra).length > 0 ? amostra : metadata.amostra,
    umPerPixel: metadata.umPerPixel && metadata.umPerPixel > 0 ? metadata.umPerPixel : p.umPerPixel,
    researcher: metadata.researcher?.trim() ? metadata.researcher : (p.pesquisador ?? metadata.researcher),
    protocolo: metadata.protocolo ?? p.protocolo,
  };
}

/** Duas preferências dizem a mesma coisa? Evita gravar o que não mudou. */
export function mesmaPreferencia(a: PreferenciaDeBancada, b: PreferenciaDeBancada): boolean {
  return CHAVES.every((k) => a[k] === b[k]);
}

/** A conta está configurada nesta instalação? Sem client id, o botão nem aparece. */
export function contaDisponivel(): boolean {
  const id = import.meta.env?.VITE_GOOGLE_CLIENT_ID;
  return typeof id === 'string' && id.trim().length > 0;
}

/** Onde está o servidor. Vazio = mesma origem. */
export function urlDoServidor(): string {
  const u = import.meta.env?.VITE_BACKEND_URL;
  return typeof u === 'string' ? u.replace(/\/+$/, '') : '';
}
