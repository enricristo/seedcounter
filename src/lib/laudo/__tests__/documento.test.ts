// =============================================================================
// Composição do PDF.
//
// Estes testes não julgam estética — julgam se o documento SAI. O gerador
// anterior era 500 linhas de aritmética de coordenada que nenhum teste tocava:
// um campo a mais deslocava tudo abaixo, e só se descobria abrindo o PDF.
//
// O que se verifica aqui é o que quebra na prática: o desenho executa sem
// lançar, o conteúdo cabe em página, e um laudo com muito conteúdo pagina em
// vez de escrever por cima do rodapé.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { adicionarLaudo, comporLaudo, desenharRodapes, novoDocumento } from '../documento';
import { montarLaudo } from '../montagem';
import type { IdentificacaoDoLaboratorio } from '../../normas/identificacao';
import type { Metadata } from '../../../types';

const LABORATORIO: IdentificacaoDoLaboratorio = {
  nome: 'Laboratório de Sementes e Tecido Vegetal — Unoeste',
  renasem: 'SP-00000/0000',
  portariaDeCredenciamento: 'Portaria nº 000/0000',
  endereco: 'Rod. Raposo Tavares, km 572 — Presidente Prudente, SP',
  responsavelTecnico: 'Nelson Barbosa Machado Neto',
  crea: '0000000000-SP',
};

const METADATA: Metadata = {
  researcher: 'Mayara',
  project: 'Orquídeas 2026',
  treatment: 'Controle KC',
  plate: 'P04',
  quadrant: 'Q2',
  notes: 'Placa com contaminação fúngica leve na borda.',
  umPerPixel: 21.2,
  amostra: {
    especieNomeComum: 'soja',
    especieNomeCientifico: 'Glycine max',
    cultivar: 'BRS 1010',
    lote: 'L-2026-014',
    categoria: 'C2',
    safra: '2025/2026',
    numeroDaAmostra: '0411',
    dataDeRecebimento: '2026-03-11',
    dataDaAmostragem: '2026-03-05',
    amostrador: 'João da Silva',
    renasemDoAmostrador: 'SP-11111/1111',
    procedencia: 'Fazenda Santa Rita — Presidente Prudente/SP',
    representatividadeKg: 25000,
    peneira: '5,5',
    requerente: 'Cooperativa Regional',
  },
};

const boletim = () =>
  montarLaudo({
    filename: 'amostra.jpg',
    metadata: METADATA,
    viableCount: 184,
    inviableCount: 16,
    laboratorio: LABORATORIO,
    numero: '0411/2026',
    emitidoEm: new Date('2026-03-12T10:00:00'),
    versaoDoApp: 'v3.1.0',
    commitDoBuild: 'abc1234',
    umPerPixel: 21.2,
    contornosDoModelo: 180,
    contornosDoClique: 20,
  });

const relatorio = () =>
  montarLaudo({
    filename: 'amostra.jpg',
    metadata: { ...METADATA, amostra: undefined },
    viableCount: 184,
    inviableCount: 16,
    emitidoEm: new Date('2026-03-12T10:00:00'),
  });

describe('o documento sai', () => {
  it('compõe um boletim completo sem lançar', () => {
    const doc = comporLaudo(boletim(), null, []);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('compõe um relatório de pesquisa sem lançar', () => {
    const doc = comporLaudo(relatorio(), null, []);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('produz um PDF de verdade, não uma string vazia', () => {
    const saida = comporLaudo(boletim(), null, []).output('arraybuffer');
    expect(saida.byteLength).toBeGreaterThan(1000);
    // Todo PDF começa com %PDF-.
    const cabecalho = new TextDecoder().decode(new Uint8Array(saida).slice(0, 5));
    expect(cabecalho).toBe('%PDF-');
  });

  it('um laudo comum cabe em uma folha', () => {
    // Se isto passar a falhar, alguma seção cresceu — e é melhor descobrir
    // aqui do que num boletim de duas folhas por acidente.
    expect(comporLaudo(boletim(), null, []).getNumberOfPages()).toBe(1);
  });
});

describe('campos longos', () => {
  it('valor que quebra em várias linhas EMPURRA o resto, não escreve por cima', () => {
    // A primeira versão dava 15 pt fixos por campo. Uma procedência longa
    // quebrava em duas linhas e a segunda linha caía sobre o campo seguinte —
    // no laudo de teste, o número da amostra ficou soterrado.
    //
    // Não dá para afirmar "não houve sobreposição" lendo o PDF, mas dá para
    // afirmar o que a corrige: altura derivada do conteúdo. Um bloco com
    // valores enormes precisa ocupar mais folha que o mesmo bloco com valores
    // curtos, a ponto de paginar.
    const longo = 'Fazenda Santa Rita do Alto Paranapanema, Rodovia Vicinal '.repeat(6);
    const inchado = montarLaudo({
      filename: 'amostra.jpg',
      metadata: {
        ...METADATA,
        amostra: {
          ...METADATA.amostra,
          procedencia: longo,
          requerente: longo,
          cultivar: longo,
          amostrador: longo,
        },
      },
      viableCount: 184,
      inviableCount: 16,
      laboratorio: LABORATORIO,
      emitidoEm: new Date('2026-03-12T10:00:00'),
    });

    expect(comporLaudo(inchado, null, []).getNumberOfPages()).toBeGreaterThan(
      comporLaudo(boletim(), null, []).getNumberOfPages()
    );
  });
});

describe('paginação', () => {
  it('observação enorme PAGINA em vez de escrever por cima do rodapé', () => {
    const gigante = montarLaudo({
      filename: 'amostra.jpg',
      metadata: { ...METADATA, notes: 'Observação longa. '.repeat(400) },
      viableCount: 184,
      inviableCount: 16,
      laboratorio: LABORATORIO,
      emitidoEm: new Date('2026-03-12T10:00:00'),
    });
    expect(comporLaudo(gigante, null, []).getNumberOfPages()).toBeGreaterThan(1);
  });
});

describe('lote', () => {
  it('cada laudo começa em folha nova', () => {
    const doc = novoDocumento();
    const a = adicionarLaudo(doc, boletim(), null, []);
    doc.addPage();
    const b = adicionarLaudo(doc, relatorio(), null, []);
    desenharRodapes(doc, [a, b]);

    expect(a.fim).toBeLessThan(b.inicio);
    expect(doc.getNumberOfPages()).toBe(b.fim);
  });

  it('o trecho registra as páginas que cada laudo ocupou', () => {
    const doc = novoDocumento();
    const trecho = adicionarLaudo(doc, boletim(), null, []);
    expect(trecho.inicio).toBe(1);
    expect(trecho.fim).toBe(doc.getNumberOfPages());
    expect(trecho.laudo.especie).toBe('boletim');
  });
});
