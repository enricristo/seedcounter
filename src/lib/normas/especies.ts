// =============================================================================
// SeedCounter — espécie conhecida como contexto de bancada
//
// A espécie é o que mais "configura" o app: priors morfométricos, tamanho
// típico, receita do ensaio, protocolo, tolerâncias, classes do dataset. Hoje
// ela vive espalhada em duas tabelas com estatutos parecidos mas formatos
// diferentes — `PERFIS_BIOMETRICOS` (solidez/circularidade de literatura) e
// `TAMANHOS` (faixa de comprimento e razão comprimento/largura). Este módulo
// não substitui nenhuma das duas: reúne o que elas já sabem numa lista só,
// para o chip do cabeçalho (C7) ter uma coisa para listar e buscar.
//
// POR QUE UNIR PELO NOME NORMALIZADO, E NÃO POR UM MAPA ESCRITO À MÃO.
//
// As duas tabelas nasceram em momentos diferentes do projeto e usam a mesma
// chave em minúsculas sem acento para as espécies que aparecem nas duas
// (soja, feijão, arroz, milho, orquídea) — mas nada garante que continue
// assim. Comparar pelo nome comum normalizado é o mesmo critério que
// `acharPorNome` já usa para achar uma espécie pelo texto livre do boletim, e
// erra do lado seguro: na pior hipótese, duas entradas quase iguais aparecem
// separadas na lista, nunca uma dupla exata escondendo a outra.
// =============================================================================

import { PERFIS_BIOMETRICOS, type PerfilBiometrico } from '../priors-morfometricos';
import { TAMANHOS, type TamanhoDeSemente } from './tamanhos-de-semente';
import { DEFAULT_LAB_DPI } from '../calibration';
import type { Metadata } from '../../types';

/** Um "jeito de digitalizar" que a espécie costuma ter, quando há um registrado. */
export interface AquisicaoTipica {
  /** `EquipamentoDoLaboratorio.id`, em `lib/calibration.ts`. */
  equipamentoId: string;
  /** Só faz sentido para equipamento com DPI fixo (scanner). */
  dpi?: number;
}

export interface EspecieConhecida {
  /** Chave estável, em minúsculas sem acento — vem de `TamanhoDeSemente.chave` ou de `PerfilBiometrico.id`. */
  id: string;
  nomeComum: string;
  nomeCientifico?: string;
  /** Chave de cultura para agrupar (mesmo vocabulário de `ExemploReal.cultura`, quando existe correspondência). */
  cultura: string;
  protocoloSugerido?: 'simples' | 'germinacao' | 'forrageira';
  aquisicaoTipica?: AquisicaoTipica;
}

/**
 * Uma espécie sabida, ou só o nome que a pessoa (ou uma sessão antiga)
 * escreveu, sem estar em nenhuma tabela. O chip precisa mostrar as duas
 * coisas do mesmo jeito — é por isso que `especieAtual` e `buscarEspecies`
 * devolvem esta união, não só `EspecieConhecida`.
 */
export type EspecieOuNomeLivre = EspecieConhecida | { nomeComum: string };

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Forrageiras conhecidas (gênero em `nomeCientifico`), para o protocolo sugerido. */
function ehForrageira(t: TamanhoDeSemente): boolean {
  return /^(urochloa|brachiaria|panicum|megathyrsus|stylosanthes)\b/i.test(t.nomeCientifico);
}

function especieDeTamanho(t: TamanhoDeSemente): EspecieConhecida {
  const especie: EspecieConhecida = {
    id: t.chave,
    nomeComum: t.nomeComum,
    nomeCientifico: t.nomeCientifico,
    cultura: t.chave,
  };
  if (t.chave === 'orquidea') {
    // C7: orquídea tem um "jeito de digitalizar" registrado — o scanner do
    // laboratório, no DPI padrão medido pela auditoria da régua (calibration.ts).
    especie.protocoloSugerido = 'germinacao';
    especie.aquisicaoTipica = { equipamentoId: 'scanjet-g2710', dpi: DEFAULT_LAB_DPI };
  } else if (ehForrageira(t)) {
    especie.protocoloSugerido = 'forrageira';
  }
  return especie;
}

function especieDePerfil(p: PerfilBiometrico): EspecieConhecida {
  const especie: EspecieConhecida = {
    id: p.id,
    nomeComum: p.nomePopular,
    nomeCientifico: p.nomeCientifico,
    cultura: p.id,
  };
  if (p.id === 'orquidea') {
    especie.protocoloSugerido = 'germinacao';
    especie.aquisicaoTipica = { equipamentoId: 'scanjet-g2710', dpi: DEFAULT_LAB_DPI };
  }
  return especie;
}

/**
 * A união de `PERFIS_BIOMETRICOS` e `TAMANHOS`, sem duplicar a espécie que
 * está nas duas. `TAMANHOS` entra primeiro porque é a tabela mais nova e mais
 * larga (inclui forrageiras que `PERFIS_BIOMETRICOS` não tem); o que
 * `PERFIS_BIOMETRICOS` tem de exclusivo (hoje, só abóbora) entra depois.
 */
export const ESPECIES_CONHECIDAS: EspecieConhecida[] = (() => {
  const lista = TAMANHOS.map(especieDeTamanho);
  const jaTem = new Set(lista.map((e) => normalizar(e.nomeComum)));
  for (const perfil of Object.values(PERFIS_BIOMETRICOS)) {
    const chave = normalizar(perfil.nomePopular);
    if (jaTem.has(chave)) continue;
    jaTem.add(chave);
    lista.push(especieDePerfil(perfil));
  }
  return lista;
})();

function bate(alvo: string, especie: EspecieConhecida): boolean {
  return (
    normalizar(especie.nomeComum).includes(alvo) ||
    (!!especie.nomeCientifico && normalizar(especie.nomeCientifico).includes(alvo)) ||
    normalizar(especie.cultura).includes(alvo) ||
    normalizar(especie.id).includes(alvo)
  );
}

/**
 * Busca por texto livre, sem acento e sem caixa, nas espécies conhecidas e
 * nas `extras` — nomes que não vêm de tabela nenhuma, e sim das sessões
 * salvas e das classes do dataset aberto (B3). É o que popula a lista do
 * popover do chip (C7): conhecidas primeiro, depois as extras que ainda não
 * batem com uma conhecida.
 *
 * Texto vazio devolve tudo — é a lista inicial do popover, antes de a pessoa
 * digitar.
 */
export function buscarEspecies(texto: string, extras: string[] = []): EspecieOuNomeLivre[] {
  const alvo = normalizar(texto ?? '');

  const conhecidas = alvo ? ESPECIES_CONHECIDAS.filter((e) => bate(alvo, e)) : ESPECIES_CONHECIDAS;

  const nomesConhecidos = new Set(ESPECIES_CONHECIDAS.map((e) => normalizar(e.nomeComum)));
  const extrasVistas = new Set<string>();
  const extrasFiltradas: EspecieOuNomeLivre[] = [];
  for (const nome of extras) {
    const texto2 = nome?.trim();
    if (!texto2) continue;
    const chave = normalizar(texto2);
    // Extra que já é uma espécie conhecida não duplica a lista.
    if (nomesConhecidos.has(chave) || extrasVistas.has(chave)) continue;
    if (alvo && !chave.includes(alvo)) continue;
    extrasVistas.add(chave);
    extrasFiltradas.push({ nomeComum: texto2 });
  }

  return [...conhecidas, ...extrasFiltradas];
}

/**
 * A espécie declarada em `metadata.amostra`, resolvida contra a tabela.
 *
 * `null` quando nada foi declarado ainda — é o "sem espécie" do chip. Quando
 * há nome declarado mas ele não bate com nenhuma `EspecieConhecida` (espécie
 * digitada à mão, fora das tabelas), devolve só o nome: o chip mostra o que a
 * pessoa escreveu, sem fingir que sabe mais do que sabe.
 */
export function especieAtual(metadata: Pick<Metadata, 'amostra'>): EspecieOuNomeLivre | null {
  const nomeComum = metadata.amostra?.especieNomeComum?.trim();
  const nomeCientifico = metadata.amostra?.especieNomeCientifico?.trim();
  const declarado = nomeComum || nomeCientifico;
  if (!declarado) return null;

  const alvoComum = nomeComum ? normalizar(nomeComum) : null;
  const alvoCientifico = nomeCientifico ? normalizar(nomeCientifico) : null;
  const conhecida = ESPECIES_CONHECIDAS.find(
    (e) =>
      (alvoComum && normalizar(e.nomeComum) === alvoComum) ||
      (alvoCientifico && e.nomeCientifico && normalizar(e.nomeCientifico) === alvoCientifico)
  );
  if (conhecida) return conhecida;

  return { nomeComum: declarado };
}
