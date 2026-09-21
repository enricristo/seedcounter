// =============================================================================
// Continuidade — as três propostas e a heurística que escolhe o padrão.
//
// Cada `it` é um cenário de bancada real: a pessoa acabou de contar uma placa
// e carrega a próxima. O teste cobra três coisas: qual proposta vem
// pré-selecionada, de onde cada valor saiu (a origem é o produto), e que
// aplicar só escreve o que foi marcado.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { sugerirDoArquivo } from '../../../lib/sugestoes-do-arquivo';
import type { Metadata } from '../../../types';
import {
  acharTratamento,
  aplicarContinuidade,
  listarMudancas,
  proporContinuidade,
  type CenaAtual,
} from '../continuidade';

const cenaDeSoja: CenaAtual = {
  researcher: 'Ana',
  project: 'Vigor 2026',
  treatment: 'T1',
  plate: '1',
  especie: 'Glycine max',
};

function propor(nome: string, cena: CenaAtual = cenaDeSoja, pasta?: string) {
  return proporContinuidade(cena, sugerirDoArquivo({ nomeDoArquivo: nome, pasta }), nome);
}

function porTipo(c: ReturnType<typeof propor>, tipo: string) {
  const p = c.propostas.find((x) => x.tipo === tipo);
  if (!p) throw new Error(`proposta ${tipo} ausente`);
  return p;
}

describe('acharTratamento', () => {
  it('lê T8, trat 3 e tratamento-12 como código', () => {
    expect(acharTratamento('Glycine max T8 rep1.png')?.valor).toBe('T8');
    expect(acharTratamento('soja_trat 3.tif')?.valor).toBe('T3');
    expect(acharTratamento('tratamento-12_r2.jpg')?.valor).toBe('T12');
  });

  it('lê controle e testemunha', () => {
    expect(acharTratamento('Glycine max controle r2.png')?.valor).toBe('controle');
    expect(acharTratamento('testemunha_1.png')?.valor).toBe('testemunha');
  });

  it('não adivinha tratamento em texto livre', () => {
    expect(acharTratamento('Glycine max dose alta.png')).toBeNull();
    expect(acharTratamento('Tabela.png')).toBeNull();
  });
});

describe('proporContinuidade — sempre as três, com o porquê', () => {
  it('devolve as três propostas na mesma ordem', () => {
    const c = propor('Glycine max rep2.png');
    expect(c.propostas.map((p) => p.tipo)).toEqual([
      'proxima-repeticao',
      'outro-tratamento',
      'outro-experimento',
    ]);
  });

  it('cada proposta diz porque, citando o arquivo e a cena', () => {
    const c = propor('Glycine max rep2.png');
    for (const p of c.propostas) {
      expect(p.porque).toContain('"Glycine max rep2.png"');
      expect(p.porque).toContain('Vigor 2026');
    }
  });
});

describe('próxima repetição — mesma espécie, mesmo tratamento', () => {
  it('é o padrão quando o nome traz a mesma espécie e a repetição', () => {
    const c = propor('Glycine max rep2.png');
    expect(c.padrao).toBe('proxima-repeticao');
    const p = porTipo(c, 'proxima-repeticao');
    expect(p.campos.project?.valor).toBe('Vigor 2026');
    expect(p.campos.treatment?.valor).toBe('T1');
    expect(p.campos.plate).toEqual({ valor: '2', origem: '"rep2" no nome do arquivo' });
    expect(p.campos.especie?.valor).toBe('Glycine max');
  });

  it('é o padrão quando a espécie bate e o tratamento do nome é o mesmo da cena', () => {
    expect(propor('Glycine max T1 rep3.png').padrao).toBe('proxima-repeticao');
    expect(propor('Glycine max t01 rep3.png').padrao).toBe('proxima-repeticao');
  });

  it('incrementa a placa atual quando o nome não declara repetição', () => {
    const p = porTipo(propor('Glycine max.png'), 'proxima-repeticao');
    expect(p.campos.plate).toEqual({ valor: '2', origem: 'placa atual "1" + 1' });
  });

  it('deixa a placa em branco quando a atual não é número e o nome não diz', () => {
    const p = porTipo(
      propor('Glycine max.png', { ...cenaDeSoja, plate: 'A' }),
      'proxima-repeticao'
    );
    expect(p.campos.plate).toBeUndefined();
  });

  it('"rep 2" sem espécie no nome, com projeto aberto, ainda é a próxima repetição', () => {
    expect(propor('placa rep 2.png').padrao).toBe('proxima-repeticao');
  });
});

describe('outro tratamento — mesma espécie, tratamento diferente', () => {
  it('é o padrão quando o nome traz T8 e a cena está em T1', () => {
    const c = propor('Glycine max T8 rep1.png');
    expect(c.padrao).toBe('outro-tratamento');
    const p = porTipo(c, 'outro-tratamento');
    expect(p.campos.project?.valor).toBe('Vigor 2026');
    expect(p.campos.treatment).toEqual({ valor: 'T8', origem: '"T8" no nome do arquivo' });
    expect(p.campos.plate?.valor).toBe('1');
  });

  it('"controle" é tratamento', () => {
    expect(propor('Glycine max controle.png').padrao).toBe('outro-tratamento');
  });

  it('sem tratamento no nome, a proposta deixa o tratamento em branco (nunca copia o da cena)', () => {
    const p = porTipo(propor('Glycine max rep2.png'), 'outro-tratamento');
    expect(p.campos.treatment).toBeUndefined();
  });
});

describe('outro experimento — espécie diferente ou sem sugestão', () => {
  it('é o padrão com espécie diferente, herdando só o pesquisador', () => {
    const c = propor('Cattleya rupestris rep1.png');
    expect(c.padrao).toBe('outro-experimento');
    const p = porTipo(c, 'outro-experimento');
    expect(p.campos.researcher?.valor).toBe('Ana');
    expect(p.campos.project).toBeUndefined();
    expect(p.campos.treatment).toBeUndefined();
    expect(p.campos.especie).toEqual({
      valor: 'Cattleya rupestris',
      origem: '"Cattleya rupestris" no nome do arquivo',
    });
  });

  it('é o padrão sem sugestão nenhuma no nome', () => {
    const c = propor('IMG_0001.png');
    expect(c.padrao).toBe('outro-experimento');
    const p = porTipo(c, 'outro-experimento');
    expect(Object.keys(p.campos)).toEqual(['researcher']);
  });

  it('propõe a pasta como projeto', () => {
    const p = porTipo(
      propor('Cattleya rupestris.png', cenaDeSoja, 'Orquideas 2026'),
      'outro-experimento'
    );
    expect(p.campos.project).toEqual({ valor: 'Orquideas 2026', origem: 'pasta "Orquideas 2026"' });
  });

  it('cena vazia (sem projeto) com arquivo sem sugestão: outro experimento, e nada a herdar', () => {
    const c = propor('IMG_0001.png', { researcher: '', project: '', treatment: '', plate: '' });
    expect(c.padrao).toBe('outro-experimento');
    expect(porTipo(c, 'outro-experimento').campos).toEqual({});
    expect(c.propostas[0].porque).toContain('não tem projeto nem tratamento preenchido');
  });
});

describe('listarMudancas e aplicarContinuidade — sugere, nunca preenche', () => {
  const meta: Metadata = {
    researcher: 'Ana',
    project: 'Vigor 2026',
    treatment: 'T1',
    plate: '1',
    quadrant: '',
    notes: 'mantidas',
    amostra: { especieNomeCientifico: 'Glycine max', lote: 'L7' },
  };

  it('lista só o que mudaria, e pré-marca só campo vazio', () => {
    const p = porTipo(propor('Glycine max T8 rep1.png'), 'outro-tratamento');
    const mudancas = listarMudancas(meta, p);
    // researcher, project, plate e especie já estão iguais — não aparecem.
    expect(mudancas).toEqual([
      {
        campo: 'treatment',
        de: 'T1',
        para: 'T8',
        origem: '"T8" no nome do arquivo',
        preencheria: false,
      },
    ]);
  });

  it('campo vazio na cena é pré-marcado', () => {
    const p = porTipo(propor('Glycine max T8 rep1.png'), 'outro-tratamento');
    const mudancas = listarMudancas({ ...meta, treatment: '' }, p);
    expect(mudancas[0].preencheria).toBe(true);
  });

  it('aplica só os campos marcados e preserva o resto do metadado', () => {
    const p = porTipo(propor('Cattleya rupestris rep1.png'), 'outro-experimento');
    const saida = aplicarContinuidade(meta, p, new Set(['especie']));
    expect(saida.amostra?.especieNomeCientifico).toBe('Cattleya rupestris');
    expect(saida.amostra?.lote).toBe('L7');
    expect(saida.project).toBe('Vigor 2026');
    expect(saida.notes).toBe('mantidas');
  });

  it('nada marcado = nada muda (mesma referência)', () => {
    const p = porTipo(propor('Glycine max T8.png'), 'outro-tratamento');
    expect(aplicarContinuidade(meta, p, new Set())).toBe(meta);
  });

  it('marcar um campo que a proposta não tem não escreve nada', () => {
    const p = porTipo(propor('Glycine max rep2.png'), 'outro-tratamento');
    expect(aplicarContinuidade(meta, p, new Set(['treatment']))).toBe(meta);
  });
});
