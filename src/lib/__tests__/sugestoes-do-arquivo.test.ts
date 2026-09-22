import { describe, it, expect } from 'vitest';
import { sugerirDoArquivo, acharBinomio, quantasSugestoes } from '../sugestoes-do-arquivo';

describe('acharBinomio', () => {
  it('acha o nome científico no meio de texto em português', () => {
    // O nome real de um arquivo do laboratório.
    expect(acharBinomio('Repetição Cattleya rupestris')?.binomio).toBe('Cattleya rupestris');
  });

  it('não confunde palavra portuguesa capitalizada com gênero', () => {
    expect(acharBinomio('Repetição da placa')).toBeNull();
    // "Projeto Mayara" tem a MESMA forma de um binômio com epíteto maiúsculo;
    // é a lista de primeiras palavras proibidas que o barra.
    expect(acharBinomio('Projeto Mayara 1')).toBeNull();
  });

  it('não inventa binômio onde não há dois termos', () => {
    expect(acharBinomio('Cattleya')).toBeNull();
    expect(acharBinomio('10 espécies')).toBeNull();
  });
});

describe('sugerirDoArquivo', () => {
  it('lê espécie e repetição do nome real do arquivo dela', () => {
    const s = sugerirDoArquivo({
      nomeDoArquivo: 'Repetição Cattleya Ruspestris.tif',
      pasta: 'Mayara_DOC_Qualificacao_TZ_ORQ',
    });
    // Grafia do arquivo preservada: corrigir não é tarefa deste módulo, a
    // pessoa confere — e o trecho de origem está ali para isso.
    expect(s.especieNomeCientifico?.valor).toBe('Cattleya Ruspestris');
    // Epíteto maiúsculo foge da convenção do binômio: propõe, mas rebaixado.
    expect(s.especieNomeCientifico?.confianca).toBe('deduzido');
    expect(s.projeto?.valor).toContain('Mayara');
    expect(s.projeto?.confianca).toBe('deduzido');
  });

  it('toda sugestão carrega o trecho que a originou', () => {
    const s = sugerirDoArquivo({ nomeDoArquivo: 'Cattleya labiata rep 3 20260918.tif' });
    expect(s.especieNomeCientifico?.origem).toMatch(/Cattleya labiata/);
    expect(s.repeticao?.valor).toBe(3);
    expect(s.repeticao?.origem).toMatch(/rep 3/i);
    expect(s.data?.valor).toBe('2026-09-18');
  });

  it('sugere a página só quando há mais de uma — senão é ruído com cara de dado', () => {
    const uma = sugerirDoArquivo({ nomeDoArquivo: 'x.tif', pagina: 0, totalDePaginas: 1 });
    expect(uma.pagina).toBeUndefined();

    const varias = sugerirDoArquivo({ nomeDoArquivo: 'x.tif', pagina: 7, totalDePaginas: 10 });
    expect(varias.pagina?.valor).toBe(8);
    expect(varias.pagina?.origem).toBe('página 8 de 10');
  });

  it('o arquivo vence a pasta, porque é mais específico', () => {
    const s = sugerirDoArquivo({
      nomeDoArquivo: 'Cattleya rupestris.tif',
      pasta: 'Cattleya labiata',
    });
    expect(s.especieNomeCientifico?.valor).toBe('Cattleya rupestris');
  });

  it('não inventa nada a partir de nome sem informação', () => {
    const s = sugerirDoArquivo({ nomeDoArquivo: 'digitalizar0001.jpg' });
    expect(s.especieNomeCientifico).toBeUndefined();
    expect(s.repeticao).toBeUndefined();
    expect(quantasSugestoes(s)).toBe(0);
  });
});
