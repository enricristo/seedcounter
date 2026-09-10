// =============================================================================
// Classes de semente e o denominador.
//
// O teste que justifica o modulo: a espigueta VAZIA nao e semente, e sai do
// denominador. Contar a germinacao sobre as unidades examinadas subestima o
// lote — e numa forrageira com muita espigueta vazia isso e a diferenca entre
// reprovar e aprovar.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  CLASSES,
  LIMIAR_DE_DORMENCIA,
  PROTOCOLOS,
  consolidar,
  contarPorClasse,
  descreverEscarificacao,
  exigeTetrazolio,
  protocoloPorChave,
} from '../classes-de-semente';

describe('o denominador', () => {
  it('a espigueta VAZIA sai do denominador', () => {
    // 400 unidades, 80 vazias -> 320 sementes. 240 normais dao 75%, nao 60%.
    const r = consolidar(
      { normal: 240, anormal: 30, dormente: 20, morta: 30, vazia: 80 },
      PROTOCOLOS.forrageira
    );
    expect(r.unidadesExaminadas).toBe(400);
    expect(r.denominador).toBe(320);
    expect(r.germinacao).toBeCloseTo(75, 5);
    // Sobre o total examinado seria 60% — quinze pontos a menos.
    expect((240 / 400) * 100).toBeCloseTo(60, 5);
  });

  it('avisa que tirou as vazias, com o texto para Observacoes', () => {
    const r = consolidar(
      { normal: 240, anormal: 30, dormente: 20, morta: 30, vazia: 80 },
      PROTOCOLOS.forrageira
    );
    const aviso = r.avisos.find((a) => a.tipo === 'inerte-fora-do-denominador')!;
    expect(aviso).toBeDefined();
    expect(aviso.texto).toMatch(/320 sementes/);
    expect(aviso.texto).toMatch(/400 unidades/);
    expect(aviso.textoParaObservacoes).toMatch(/material inerte/);
  });

  it('sem vazias, denominador e o total', () => {
    const r = consolidar({ normal: 90, anormal: 5, morta: 5 }, PROTOCOLOS.germinacao);
    expect(r.denominador).toBe(100);
    expect(r.germinacao).toBeCloseTo(90, 5);
    expect(r.avisos.filter((a) => a.tipo === 'inerte-fora-do-denominador')).toEqual([]);
  });

  it('material 100% vazio nao produz porcentagem inventada', () => {
    const r = consolidar({ vazia: 50 }, PROTOCOLOS.forrageira);
    expect(r.denominador).toBe(0);
    expect(r.germinacao).toBe(0);
    expect(r.avisos.some((a) => a.tipo === 'sem-semente')).toBe(true);
  });

  it('ignora contagem negativa ou nao finita', () => {
    const r = consolidar({ normal: 90, morta: -5, anormal: NaN }, PROTOCOLOS.germinacao);
    expect(r.denominador).toBe(90);
  });
});

describe('dormencia dispara tetrazolio', () => {
  it('no limiar de 5% ja exige', () => {
    // A RAS pede confirmacao por tetrazolio a partir de 5%.
    expect(exigeTetrazolio({ normal: 90, dormente: 5, morta: 5 }, PROTOCOLOS.forrageira)).toBe(
      true
    );
  });

  it('abaixo do limiar nao exige', () => {
    expect(exigeTetrazolio({ normal: 95, dormente: 4, morta: 1 }, PROTOCOLOS.forrageira)).toBe(
      false
    );
  });

  it('o aviso carrega o texto que vai para Observacoes', () => {
    const r = consolidar({ normal: 80, dormente: 15, morta: 5 }, PROTOCOLOS.forrageira);
    const aviso = r.avisos.find((a) => a.tipo === 'tetrazolio-obrigatorio')!;
    expect(aviso.texto).toMatch(/15% de sementes dormentes/);
    expect(aviso.textoParaObservacoes).toMatch(/tetrazólio/i);
  });

  it('o protocolo simples nao dispara — orquideia nao tem dormencia tegumentar', () => {
    expect(PROTOCOLOS.simples.limiarDeTetrazolio).toBeNull();
    expect(exigeTetrazolio({ normal: 50, morta: 50 }, PROTOCOLOS.simples)).toBe(false);
  });

  it('o limiar e o da norma', () => {
    expect(LIMIAR_DE_DORMENCIA).toBe(5);
  });
});

describe('os protocolos', () => {
  it('so a forrageira tem classe que NAO e semente', () => {
    for (const p of Object.values(PROTOCOLOS)) {
      const temVazia = p.classes.some((c) => !CLASSES[c].ehSemente);
      expect(temVazia, p.chave).toBe(p.chave === 'forrageira');
    }
  });

  it('so a plantula NORMAL conta como germinada', () => {
    const germinadas = Object.entries(CLASSES).filter(([, d]) => d.germinou);
    expect(germinadas.map(([k]) => k)).toEqual(['normal']);
  });

  it('toda classe se explica', () => {
    for (const [chave, d] of Object.entries(CLASSES)) {
      expect(d.rotulo.length, chave).toBeGreaterThan(0);
      expect(d.explicacao.length, chave).toBeGreaterThan(0);
    }
  });

  it('a porcentagem das classes de semente soma 100', () => {
    const r = consolidar(
      { normal: 240, anormal: 30, dormente: 20, morta: 30, vazia: 80 },
      PROTOCOLOS.forrageira
    );
    const soma = Object.values(r.porcentagens).reduce((t, v) => t + v, 0);
    expect(soma).toBeCloseTo(100, 5);
  });
});

describe('escarificacao', () => {
  it('descreve o metodo para Observacoes', () => {
    // Precisa constar: um lote escarificado teve a dormencia superada
    // artificialmente, e a germinacao declarada nao e a que o comprador obteria.
    const t = descreverEscarificacao({ metodo: 'acido-sulfurico', duracaoMin: 15 });
    expect(t).toMatch(/Ácido sulfúrico/);
    expect(t).toMatch(/15 min/);
  });

  it('sem escarificacao nao gera texto', () => {
    expect(descreverEscarificacao(undefined)).toBe('');
    expect(descreverEscarificacao({ metodo: 'nenhuma' })).toBe('');
  });
});

describe('contarPorClasse — das marcas para o protocolo', () => {
  it('marca sem subclasse cai na classe que o tipo implica', () => {
    // Viavel -> normal, inviavel -> morta. E o que faz o protocolo simples
    // funcionar sem ninguem classificar nada.
    const r = contarPorClasse(
      [{ type: 'viable' }, { type: 'viable' }, { type: 'inviable' }],
      PROTOCOLOS.simples
    );
    expect(r.contagens).toEqual({ normal: 2, morta: 1 });
    expect(r.naoClassificadas).toBe(0);
  });

  it('subclasse atribuida vence o tipo', () => {
    const r = contarPorClasse(
      [
        { type: 'inviable', subclasse: 'dormente' },
        { type: 'inviable', subclasse: 'vazia' },
        { type: 'viable', subclasse: 'anormal' },
      ],
      PROTOCOLOS.forrageira
    );
    expect(r.contagens).toEqual({ dormente: 1, vazia: 1, anormal: 1 });
  });

  it('DIZ quantas ficaram sem classificar num protocolo fino', () => {
    // Quem ve "40 nao classificadas" sabe que 40 inviaveis viraram mortas por
    // falta de classificacao, nao por decisao.
    const r = contarPorClasse(
      [{ type: 'inviable' }, { type: 'inviable', subclasse: 'dura' }],
      PROTOCOLOS.forrageira
    );
    expect(r.naoClassificadas).toBe(1);
    expect(r.contagens.morta).toBe(1);
    expect(r.contagens.dura).toBe(1);
  });

  it('subclasse que o protocolo nao tem e tratada como nao classificada', () => {
    // 'vazia' nao existe no protocolo de germinacao comum.
    const r = contarPorClasse([{ type: 'inviable', subclasse: 'vazia' }], PROTOCOLOS.germinacao);
    expect(r.contagens.morta).toBe(1);
    expect(r.naoClassificadas).toBe(1);
  });

  it('fecha o circuito: marcas -> contagens -> consolidar', () => {
    const marcas = [
      ...Array.from({ length: 240 }, () => ({ type: 'viable' as const })),
      ...Array.from({ length: 80 }, () => ({ type: 'inviable' as const, subclasse: 'vazia' as const })),
      ...Array.from({ length: 30 }, () => ({ type: 'inviable' as const, subclasse: 'morta' as const })),
    ];
    const { contagens } = contarPorClasse(marcas, PROTOCOLOS.forrageira);
    const c = consolidar(contagens, PROTOCOLOS.forrageira);
    expect(c.denominador).toBe(270);
    expect(c.germinacao).toBeCloseTo((240 / 270) * 100, 5);
  });

  it('chave desconhecida cai no simples', () => {
    expect(protocoloPorChave('invent').chave).toBe('simples');
    expect(protocoloPorChave(undefined).chave).toBe('simples');
    expect(protocoloPorChave('forrageira').chave).toBe('forrageira');
  });
});
