import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ReceitaSalva } from '../lib/db';

/**
 * Chave estável de espécie para filtrar receitas salvas: minúsculo, sem
 * acento, e `'generica'` quando não há espécie declarada — essas aparecem
 * para qualquer imagem, porque não têm com quem discordar.
 */
export function chaveDeEspecie(nome: string | undefined): string {
  const normalizado = nome
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return normalizado || 'generica';
}

/**
 * Receitas salvas pela pessoa no painel "Encontrar" (C5), para uma espécie.
 *
 * Inclui as genéricas (salvas sem espécie declarada) além das da espécie
 * pedida — uma receita boa para "sementes claras sobre fundo escuro" não
 * precisa ser reaprendida cultura a cultura.
 */
export function useReceitasSalvas(especie: string | undefined) {
  const chave = chaveDeEspecie(especie);
  // `criadaEm` não é campo indexado (o store só indexa `especie` e `nome`,
  // que é por onde se filtra) — ordenar em JS evita depender de índice extra
  // para uma tabela que nunca deve crescer além de algumas dezenas de linhas.
  const todas =
    useLiveQuery(
      () => db.receitas.toArray().then((rs) => rs.sort((a, b) => b.criadaEm - a.criadaEm)),
      []
    ) ?? [];

  const receitas = todas.filter((r) => r.especie === chave || r.especie === 'generica');

  const salvar = useCallback(
    async (dados: { nome: string; quando: string; localizacao: ReceitaSalva['localizacao']; onda: ReceitaSalva['onda'] }) => {
      const registro: ReceitaSalva = {
        ...dados,
        especie: chave,
        criadaEm: Date.now(),
      };
      return db.receitas.add(registro);
    },
    [chave]
  );

  const remover = useCallback((id: number) => db.receitas.delete(id), []);

  return { receitas, salvar, remover };
}
