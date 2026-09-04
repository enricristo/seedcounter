// =============================================================================
// Nome de exportação.
//
// Só as funções puras: baixarArquivo depende do DOM e o vitest roda em node.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { nomeDeExportacao, normalizarParaNome } from '../download';

const DATA = new Date(2026, 8, 4, 9, 7); // 04/09/2026 09:07

describe('normalizarParaNome', () => {
  it('remove acento sem perder a letra', () => {
    expect(normalizarParaNome('Germinação')).toBe('Germinacao');
    expect(normalizarParaNome('José Ângelo')).toBe('Jose-Angelo');
  });

  it('troca o que quebra nome de arquivo por hífen', () => {
    // Windows recusa \ / : * ? " < > | ; shell sofre com espaço e parêntese.
    expect(normalizarParaNome('Cattleya × Laelia (T1)')).toBe('Cattleya-Laelia-T1');
    expect(normalizarParaNome('a/b\\c:d*e?f')).toBe('a-b-c-d-e-f');
  });

  it('não deixa hífen sobrando nas pontas', () => {
    expect(normalizarParaNome('  (teste)  ')).toBe('teste');
  });

  it('limita o comprimento', () => {
    expect(normalizarParaNome('x'.repeat(200)).length).toBeLessThanOrEqual(40);
  });
});

describe('nomeDeExportacao', () => {
  it('compõe projeto, tratamento, placa, quadrante, amostra, tipo e data', () => {
    expect(
      nomeDeExportacao(
        {
          projeto: 'Viabilidade Cattleya',
          tratamento: 'T2 MS+AG3',
          placa: 'P04',
          quadrante: 'Q1',
          arquivo: 'digitalizar0004.jpg',
          tipo: 'medidas',
          data: DATA,
        },
        'csv'
      )
    ).toBe(
      'Viabilidade-Cattleya_T2-MS-AG3_placa-P04_q-Q1_digitalizar0004_medidas_20260904-0907.csv'
    );
  });

  it('a data ordena cronologicamente como texto', () => {
    // É o motivo de usar AAAAMMDD-HHMM em vez de DD-MM-AAAA.
    const jan = nomeDeExportacao({ tipo: 'a', data: new Date(2026, 0, 2, 3, 4) }, 'csv');
    const dez = nomeDeExportacao({ tipo: 'a', data: new Date(2026, 11, 2, 3, 4) }, 'csv');
    expect([dez, jan].sort()).toEqual([jan, dez]);
  });

  it('omite os campos vazios sem deixar separador solto', () => {
    const n = nomeDeExportacao({ arquivo: 'amostra.jpg', tipo: 'relatorio', data: DATA }, 'pdf');
    expect(n).toBe('amostra_relatorio_20260904-0907.pdf');
    expect(n).not.toMatch(/__/);
  });

  it('ainda produz nome identificável sem metadado nenhum', () => {
    expect(nomeDeExportacao({ data: DATA }, 'json')).toBe('seedcounter_20260904-0907.json');
  });

  it('nunca sai sem extensão — era o sintoma do bug de download', () => {
    for (const ext of ['csv', '.csv', 'pdf', 'zip']) {
      expect(nomeDeExportacao({ arquivo: 'a.jpg', data: DATA }, ext)).toMatch(/\.(csv|pdf|zip)$/);
    }
  });

  it('não duplica o ponto quando a extensão já vem com ponto', () => {
    expect(nomeDeExportacao({ arquivo: 'a.jpg', data: DATA }, '.csv')).not.toMatch(/\.\./);
  });

  it('descarta a extensão original da imagem', () => {
    expect(nomeDeExportacao({ arquivo: 'foto.jpeg', data: DATA }, 'png')).not.toMatch(/jpeg/);
  });
});
