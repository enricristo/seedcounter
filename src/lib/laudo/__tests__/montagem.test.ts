// =============================================================================
// Montagem do documento.
//
// O que estes testes protegem é a distinção entre um documento de PESQUISA e um
// BOLETIM DE ANÁLISE DE SEMENTES. "Laudo" tem significado legal; um PDF de
// pesquisa com essa palavra no topo pode acabar circulando como se fosse um
// BAS. Aqui se garante que o papel diz o que ele é, e que não existe caminho
// para imprimir "Boletim" sem os campos que o boletim exige.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { AUSENTE, dataBR, montarLaudo, nomeDoArquivo, porcentagem } from '../montagem';
import { capituloDaRas } from '../../normas/versao';
import type { IdentificacaoDoLaboratorio } from '../../normas/identificacao';
import type { Metadata } from '../../../types';

const LABORATORIO: IdentificacaoDoLaboratorio = {
  nome: 'Laboratório de Sementes e Tecido Vegetal — Unoeste',
  renasem: 'SP-00000/0000',
  portariaDeCredenciamento: 'Portaria nº 000/0000',
  endereco: 'Rod. Raposo Tavares, km 572 — Presidente Prudente, SP',
  responsavelTecnico: 'Nelson Barbosa Machado Neto',
};

const METADATA_BASE: Metadata = {
  researcher: 'Mayara',
  project: 'Orquídeas 2026',
  treatment: 'Controle KC',
  plate: 'P04',
  quadrant: 'Q2',
  notes: '',
};

const METADATA_COM_AMOSTRA: Metadata = {
  ...METADATA_BASE,
  amostra: {
    especieNomeComum: 'soja',
    especieNomeCientifico: 'Glycine max',
    lote: 'L-2026-014',
    categoria: 'C2',
    numeroDaAmostra: '0411',
    dataDeRecebimento: '2026-03-11',
  },
};

const entrada = (over: Partial<Parameters<typeof montarLaudo>[0]> = {}) =>
  montarLaudo({
    filename: 'amostra.jpg',
    metadata: METADATA_BASE,
    viableCount: 184,
    inviableCount: 16,
    emitidoEm: new Date('2026-03-12T10:00:00'),
    ...over,
  });

describe('que documento é este', () => {
  it('sem identificação normativa, é RELATÓRIO — não boletim', () => {
    const doc = entrada();
    expect(doc.especie).toBe('relatorio');
    expect(doc.titulo).toBe('Relatório de Contagem');
    expect(doc.titulo).not.toMatch(/Boletim/);
  });

  it('com laboratório e amostra completos, vira BOLETIM', () => {
    const doc = entrada({ laboratorio: LABORATORIO, metadata: METADATA_COM_AMOSTRA });
    expect(doc.especie).toBe('boletim');
    expect(doc.titulo).toBe('Boletim de Análise de Sementes');
  });

  it('identidade PELA METADE continua sendo relatório', () => {
    // O caminho perigoso seria "preencheu quase tudo, então vale". Não vale:
    // quem decide é conferirParaEmissao, a mesma função do painel de pendências.
    const doc = entrada({
      laboratorio: { ...LABORATORIO, renasem: '' },
      metadata: METADATA_COM_AMOSTRA,
    });
    expect(doc.especie).toBe('relatorio');
    expect(doc.pendencias.some((p) => /RENASEM/.test(p))).toBe(true);
  });

  it('o relatório IMPRIME a ressalva de que não é um BAS', () => {
    const doc = entrada();
    expect(doc.ressalva).toMatch(/NÃO é um Boletim/);
    expect(doc.ressalva).toMatch(/sem valor fiscal|não tem valor fiscal/i);
  });

  it('o boletim não carrega ressalva nem pendência', () => {
    const doc = entrada({ laboratorio: LABORATORIO, metadata: METADATA_COM_AMOSTRA });
    expect(doc.ressalva).toBe('');
    expect(doc.pendencias).toEqual([]);
  });
});

describe('cabeçalho', () => {
  it('o boletim é assinado pelo laboratório credenciado', () => {
    const doc = entrada({ laboratorio: LABORATORIO, metadata: METADATA_COM_AMOSTRA });
    expect(doc.cabecalho.instituicao).toBe(LABORATORIO.nome);
    expect(doc.cabecalho.linhas.join(' ')).toMatch(/RENASEM SP-00000/);
    expect(doc.cabecalho.linhas.join(' ')).toMatch(/Portaria/);
  });

  it('o relatório é assinado pelos grupos de pesquisa', () => {
    const doc = entrada();
    expect(doc.cabecalho.instituicao).toMatch(/GPEOrq/);
    expect(doc.cabecalho.instituicao).toMatch(/GPSEM/);
  });

  it('quem assina é uma PESSOA, nunca o software', () => {
    const boletim = entrada({ laboratorio: LABORATORIO, metadata: METADATA_COM_AMOSTRA });
    expect(boletim.assinatura.nome).toBe('Nelson Barbosa Machado Neto');
    expect(boletim.assinatura.cargo).toMatch(/Responsável Técnico/);

    const relatorio = entrada();
    expect(relatorio.assinatura.nome).toBe('Mayara');
  });

  it('o CREA entra no cargo quando existe', () => {
    const doc = entrada({
      laboratorio: { ...LABORATORIO, crea: '0000000000-SP' },
      metadata: METADATA_COM_AMOSTRA,
    });
    expect(doc.assinatura.cargo).toMatch(/CREA 0000000000-SP/);
  });
});

describe('nenhum campo em branco', () => {
  it('todo campo do boletim tem texto — travessão onde não há valor', () => {
    const doc = entrada({ laboratorio: LABORATORIO, metadata: METADATA_COM_AMOSTRA });
    for (const bloco of doc.blocos) {
      for (const campo of bloco.campos) {
        expect(campo.valor.trim().length, `${bloco.titulo} / ${campo.rotulo}`).toBeGreaterThan(0);
      }
    }
  });

  it('no BOLETIM o campo vazio aparece com travessão, porque a norma exige', () => {
    const doc = entrada({ laboratorio: LABORATORIO, metadata: METADATA_COM_AMOSTRA });
    const amostra = doc.blocos.find((b) => b.titulo === 'Identificação da amostra')!;
    const safra = amostra.campos.find((c) => c.rotulo === 'Safra')!;
    expect(safra.valor).toBe(AUSENTE);
  });

  it('no RELATÓRIO o campo vazio some, para não parecer formulário abandonado', () => {
    const doc = entrada();
    const amostra = doc.blocos.find((b) => b.titulo === 'Identificação da amostra')!;
    expect(amostra.campos.every((c) => c.valor !== AUSENTE)).toBe(true);
  });
});

describe('resultados', () => {
  it('conta e calcula a porcentagem com vírgula decimal', () => {
    const doc = entrada();
    expect(doc.resultados.map((r) => r.contagem)).toEqual([184, 16, 200]);
    expect(doc.resultados[0].porcentagem).toBe('92,0 %');
    expect(doc.resultados[1].porcentagem).toBe('8,0 %');
  });

  it('o total não carrega porcentagem — 100% de si mesmo não informa nada', () => {
    const doc = entrada();
    expect(doc.resultados[2].papel).toBe('total');
    expect(doc.resultados[2].porcentagem).toBeUndefined();
  });

  it('as duas porcentagens FECHAM 100,0 — sempre', () => {
    // Arredondar cada uma por conta própria imprimia 33,4 + 66,7 = 100,1.
    // A norma exige que feche, e um boletim que não fecha perde a confiança
    // do analista em trinta segundos.
    const casos: [number, number][] = [
      [1, 2],
      [2, 1],
      [1, 3],
      [2, 3],
      [667, 333],
      [1, 6],
      [5, 6],
      [184, 16],
      [7, 9],
    ];
    for (const [v, i] of casos) {
      const doc = entrada({ viableCount: v, inviableCount: i });
      const ler = (t: string) => Number(t.replace(' %', '').replace(',', '.'));
      const soma = ler(doc.resultados[0].porcentagem!) + ler(doc.resultados[1].porcentagem!);
      expect(soma, `${v}/${i}`).toBeCloseTo(100, 9);
    }
  });

  it('a fração PRINCIPAL mantém o próprio arredondamento', () => {
    // 1 de 3 = 33,333… → 33,3. É o complemento que absorve (66,7), não ela.
    const doc = entrada({ viableCount: 1, inviableCount: 2 });
    expect(doc.resultados[0].porcentagem).toBe('33,3 %');
    expect(doc.resultados[1].porcentagem).toBe('66,7 %');
  });

  it('amostra vazia não vira NaN', () => {
    const doc = entrada({ viableCount: 0, inviableCount: 0 });
    expect(doc.resultados[0].porcentagem).toBe(AUSENTE);
    expect(doc.resultados[2].contagem).toBe(0);
  });
});

describe('porcentagem', () => {
  it('arredonda meio-para-cima, onde toFixed erra', () => {
    // (99.85).toFixed(1) devolve '99.8'. Num laudo isso é um número diferente
    // do que o analista encontra na calculadora.
    expect(porcentagem(9985, 10000)).toBe('99,9 %');
  });

  it('total zero não produz NaN', () => {
    expect(porcentagem(0, 0)).toBe(AUSENTE);
  });
});

describe('observações', () => {
  it('declara a metodologia quando não há método na RAS', () => {
    // A IN 40/2010 manda declarar em Observações a metodologia de determinação
    // sem método na norma. Contagem por imagem é exatamente esse caso.
    const doc = entrada();
    expect(doc.observacoes).toMatch(/sem método correspondente na RAS/i);
    expect(doc.observacoes).toMatch(/contagem final é do operador/i);
  });

  it('não declara quando há capítulo aplicado', () => {
    const doc = entrada({
      laboratorio: LABORATORIO,
      metadata: METADATA_COM_AMOSTRA,
      norma: capituloDaRas('4'),
    });
    expect(doc.observacoes).not.toMatch(/sem método correspondente/i);
  });

  it('preserva a nota que a pessoa escreveu', () => {
    const doc = entrada({ metadata: { ...METADATA_BASE, notes: 'Placa com contaminação leve.' } });
    expect(doc.observacoes).toMatch(/contaminação leve/);
  });
});

describe('rastreabilidade', () => {
  it('registra a versão do código que produziu o número', () => {
    const doc = entrada({ versaoDoApp: 'v3.1.0', commitDoBuild: 'abc1234' });
    const versao = doc.rastreabilidade.find((c) => c.rotulo === 'Versão do software')!;
    expect(versao.valor).toBe('v3.1.0 • abc1234');
  });

  it('diz quando NÃO está calibrado, em vez de omitir', () => {
    const doc = entrada();
    const cal = doc.rastreabilidade.find((c) => c.rotulo === 'Calibração')!;
    expect(cal.valor).toMatch(/Não calibrado/);
  });

  it('registra a calibração quando existe', () => {
    const doc = entrada({ umPerPixel: 21.2 });
    const cal = doc.rastreabilidade.find((c) => c.rotulo === 'Calibração')!;
    expect(cal.valor).toBe('21,20 µm/px');
  });

  it('separa o que a máquina propôs do que a pessoa marcou', () => {
    // Dois laudos com o mesmo número e procedências diferentes não são a mesma
    // evidência.
    const doc = entrada({ contornosDoModelo: 180, contornosDoClique: 20 });
    const proc = doc.rastreabilidade.find((c) => c.rotulo === 'Procedência dos contornos')!;
    expect(proc.valor).toMatch(/180 por detecção automática/);
    expect(proc.valor).toMatch(/20 por marcação do operador/);
  });

  it('omite a procedência quando não houve contorno nenhum', () => {
    const doc = entrada();
    expect(doc.rastreabilidade.find((c) => c.rotulo === 'Procedência dos contornos')).toBeUndefined();
  });
});

describe('dataBR', () => {
  it('converte ISO para o formato brasileiro', () => {
    expect(dataBR('2026-03-11')).toBe('11/03/2026');
  });

  it('ausente vira travessão, não "Invalid Date"', () => {
    expect(dataBR(undefined)).toBe(AUSENTE);
    expect(dataBR('')).toBe(AUSENTE);
  });

  it('texto que não é data NÃO vira data inventada', () => {
    // A primeira versão só separava por hífen, então 'nao-e-data' saía do
    // conversor como "data/e/nao" — texto inventado num campo de data do laudo.
    expect(dataBR('nao-e-data')).toBe(AUSENTE);
    expect(dataBR('11/03/2026')).toBe(AUSENTE);
  });

  it('data que não existe no calendário é recusada', () => {
    expect(dataBR('2026-13-40')).toBe(AUSENTE);
    expect(dataBR('2026-02-30')).toBe(AUSENTE);
  });
});

describe('nome do arquivo', () => {
  it('o boletim sai como BAS com o número', () => {
    const doc = entrada({
      laboratorio: LABORATORIO,
      metadata: METADATA_COM_AMOSTRA,
      numero: '0411/2026',
    });
    expect(nomeDoArquivo(doc, 'amostra.jpg')).toBe('BAS_0411-2026_amostra.pdf');
  });

  it('o relatório sai como relatório', () => {
    const doc = entrada();
    expect(nomeDoArquivo(doc, 'amostra.jpg')).toBe('relatorio_amostra.pdf');
  });

  it('nome vindo do arquivo do usuário não carrega caminho', () => {
    // O que importa é a propriedade, não a string exata: nada de separador nem
    // de ".." pode sobreviver até o nome que vai para o disco.
    const doc = entrada();
    for (const sujo of ['../etc/passwd.jpg', 'a/../b.jpg', 'C:\\Windows\\x.jpg']) {
      const nome = nomeDoArquivo(doc, sujo);
      expect(nome, sujo).not.toMatch(/[/\\]/);
      expect(nome, sujo).not.toMatch(/\.\./);
      expect(nome, sujo).toMatch(/\.pdf$/);
    }
  });
});

describe('protocolo de germinacao no laudo', () => {
  const marcasForrageira = [
    ...Array.from({ length: 240 }, () => ({ type: 'viable' as const })),
    ...Array.from({ length: 80 }, () => ({ type: 'inviable' as const, subclasse: 'vazia' as const })),
    ...Array.from({ length: 20 }, () => ({ type: 'inviable' as const, subclasse: 'dormente' as const })),
    ...Array.from({ length: 60 }, () => ({ type: 'inviable' as const, subclasse: 'morta' as const })),
  ];

  it('no protocolo simples NAO ha bloco de germinacao — repetiria os cartoes', () => {
    const doc = entrada({ marcas: marcasForrageira });
    expect(doc.blocos.find((b) => b.titulo === 'Teste de germinacao')).toBeUndefined();
  });

  it('na forrageira o bloco sai com o DENOMINADOR certo', () => {
    // 400 unidades, 80 vazias -> 320 sementes. 240 normais = 75%, nao 60%.
    const doc = entrada({
      metadata: { ...METADATA_BASE, protocolo: 'forrageira' },
      marcas: marcasForrageira,
    });
    const bloco = doc.blocos.find((b) => b.titulo === 'Teste de germinacao')!;
    expect(bloco).toBeDefined();
    expect(bloco.campos.find((c) => c.rotulo === 'Sementes examinadas')!.valor).toBe('320');
    expect(bloco.campos.find((c) => c.rotulo === 'Unidades vazias')!.valor).toMatch(/^80/);
    expect(bloco.campos.find((c) => c.rotulo === 'Plântula normal')!.valor).toMatch(/75%$/);
  });

  it('as porcentagens do bloco SOMAM 100', () => {
    const doc = entrada({
      metadata: { ...METADATA_BASE, protocolo: 'forrageira' },
      marcas: marcasForrageira,
    });
    const bloco = doc.blocos.find((b) => b.titulo === 'Teste de germinacao')!;
    const soma = bloco.campos
      .map((c) => /—\s+(\d+)%$/.exec(c.valor))
      .filter(Boolean)
      .reduce((t, m) => t + Number(m![1]), 0);
    expect(soma).toBe(100);
  });

  it('leva para Observacoes o que a IN 40/2010 manda declarar', () => {
    const doc = entrada({
      metadata: {
        ...METADATA_BASE,
        protocolo: 'forrageira',
        escarificacao: { metodo: 'acido-sulfurico', duracaoMin: 15 },
      },
      marcas: marcasForrageira,
    });
    expect(doc.observacoes).toMatch(/material inerte/);
    expect(doc.observacoes).toMatch(/tetrazólio/i); // 20/320 = 6,25% >= 5%
    expect(doc.observacoes).toMatch(/Ácido sulfúrico/);
  });

  it('diz quantas ficaram sem classificar', () => {
    const doc = entrada({
      metadata: { ...METADATA_BASE, protocolo: 'forrageira' },
      marcas: [{ type: 'inviable' }, { type: 'inviable', subclasse: 'dura' }],
    });
    expect(doc.observacoes).toMatch(/1 semente contada pela classe implicita/);
  });
});
