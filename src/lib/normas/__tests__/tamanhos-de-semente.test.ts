// =============================================================================
// Tamanhos típicos de semente.
//
// O teste que justifica o módulo é o do ERRO DE UNIDADE. `validateScale` só
// olha a faixa absoluta de µm/px, e por isso deixa passar o pior engano: quem
// informa centímetro onde era milímetro produz uma escala que cai dentro da
// faixa plausível, e o laudo sai com uma semente de soja de 0,6 mm sem ninguém
// estranhar.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  TAMANHOS,
  acharPorNome,
  conferirEscala,
  escalaSugerida,
  tamanhoDe,
} from '../tamanhos-de-semente';

describe('a tabela', () => {
  it('cobre as duas frentes do grupo e as forrageiras', () => {
    expect(tamanhoDe('orquidea')).toBeDefined();
    expect(tamanhoDe('soja')).toBeDefined();
    expect(tamanhoDe('urochloa')).toBeDefined();
  });

  it('toda faixa é coerente e positiva', () => {
    for (const t of TAMANHOS) {
      expect(t.minimo, t.chave).toBeGreaterThan(0);
      expect(t.maximo, t.chave).toBeGreaterThan(t.minimo);
      expect(t.origem.length, t.chave).toBeGreaterThan(0);
    }
  });

  it('nenhuma chave repetida', () => {
    const chaves = TAMANHOS.map((t) => t.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('a ordem de grandeza separa orquídea de soja', () => {
    // É a distinção que a ideia original invocava: orquídea é da casa do
    // décimo de milímetro, soja é da casa do centímetro.
    expect(tamanhoDe('orquidea')!.maximo).toBeLessThan(tamanhoDe('soja')!.minimo);
  });

  it('usa o gênero vigente da braquiária', () => {
    // Urochloa substituiu Brachiaria; um laudo com o nome revogado envelhece.
    expect(tamanhoDe('urochloa')!.nomeCientifico).toMatch(/Urochloa/);
  });
});

describe('achar pelo nome que a pessoa digitou', () => {
  it('acha pelo nome comum, em qualquer caixa', () => {
    expect(acharPorNome('soja')?.chave).toBe('soja');
    expect(acharPorNome('SOJA')?.chave).toBe('soja');
    expect(acharPorNome('  Soja  ')?.chave).toBe('soja');
  });

  it('acha pelo nome científico', () => {
    expect(acharPorNome('Glycine max')?.chave).toBe('soja');
    expect(acharPorNome('GLYCINE MAX')?.chave).toBe('soja');
  });

  it('acha ignorando acento — o campo do boletim é texto livre', () => {
    expect(acharPorNome('orquídea')?.chave).toBe('orquidea');
    expect(acharPorNome('orquidea')?.chave).toBe('orquidea');
    expect(acharPorNome('feijão')?.chave).toBe('feijao');
  });

  it('o GÊNERO basta, para não deixar sem referência quem tem outra espécie', () => {
    // Quem escreve "Urochloa decumbens" merece a referência de Urochloa.
    expect(acharPorNome('Urochloa decumbens')?.chave).toBe('urochloa');
    expect(acharPorNome('Eucalyptus grandis')?.chave).toBe('eucalipto');
  });

  it('devolve indefinido para o que não conhece, em vez de chutar', () => {
    expect(acharPorNome('quinoa')).toBeUndefined();
    expect(acharPorNome('')).toBeUndefined();
    expect(acharPorNome(undefined)).toBeUndefined();
  });
});

describe('conferir a escala', () => {
  // Uma soja de 6 mm ocupando 240 px dá 25 µm/px — escala correta.
  const PIXELS_DA_SOJA = 240;

  it('aceita a escala correta', () => {
    const r = conferirEscala(PIXELS_DA_SOJA, 25, 'soja');
    expect(r.veredicto).toBe('plausivel');
    expect(r.comprimentoImplicado).toBeCloseTo(6, 5);
    expect(r.recado).toBe('');
  });

  it('PEGA O ERRO DE UNIDADE que validateScale deixa passar', () => {
    // Quem informou cm onde era mm produz uma escala dez vezes menor. 2,5 µm/px
    // está dentro da faixa que validateScale considera aceitável (0,05 a 500),
    // então só a referência da espécie denuncia.
    const r = conferirEscala(PIXELS_DA_SOJA, 2.5, 'soja');
    expect(r.veredicto).toBe('suspeita');
    expect(r.comprimentoImplicado).toBeCloseTo(0.6, 5);
    expect(r.recado).toMatch(/dez vezes/);
    expect(r.recado).toMatch(/milímetro e não centímetro/);
  });

  it('pega o erro na direção oposta também', () => {
    const r = conferirEscala(PIXELS_DA_SOJA, 250, 'soja');
    expect(r.veredicto).toBe('suspeita');
    expect(r.comprimentoImplicado).toBeCloseTo(60, 5);
  });

  it('o recado diz o número medido E o esperado', () => {
    // Avisar "escala suspeita" sem dizer os dois números obriga a pessoa a
    // refazer a conta que o software já fez.
    const r = conferirEscala(PIXELS_DA_SOJA, 2.5, 'soja');
    expect(r.recado).toMatch(/0,60 mm/);
    expect(r.recado).toMatch(/5,00 a 9,00 mm/);
  });

  it('tolera variação real de cultivar sem reclamar', () => {
    // A tabela existe para pegar ordem de grandeza, não para reprovar lote
    // graúdo. Uma soja de 11 mm ainda passa.
    const r = conferirEscala(PIXELS_DA_SOJA, 45, 'soja');
    expect(r.comprimentoImplicado).toBeCloseTo(10.8, 5);
    expect(r.veredicto).toBe('plausivel');
  });

  it('cala quando não conhece a espécie', () => {
    // Silêncio é melhor que um aviso sobre uma referência que não existe.
    const r = conferirEscala(PIXELS_DA_SOJA, 2.5, 'quinoa');
    expect(r.veredicto).toBe('sem-referencia');
    expect(r.recado).toBe('');
  });

  it('cala quando não há calibração — não há o que conferir', () => {
    expect(conferirEscala(PIXELS_DA_SOJA, undefined, 'soja').veredicto).toBe('sem-referencia');
    expect(conferirEscala(PIXELS_DA_SOJA, 0, 'soja').veredicto).toBe('sem-referencia');
  });

  it('cala quando não há objeto medido', () => {
    expect(conferirEscala(0, 25, 'soja').veredicto).toBe('sem-referencia');
  });

  it('funciona para orquídea, que é a outra ponta da escala', () => {
    // Cattleya ~1,2 mm; a 7,06 µm/px isso dá ~170 px.
    const r = conferirEscala(170, 7.06, 'orquidea');
    expect(r.veredicto).toBe('plausivel');
    expect(r.comprimentoImplicado).toBeCloseTo(1.2, 1);
  });
});

describe('escala sugerida', () => {
  it('parte do meio da faixa da espécie', () => {
    // Soja: meio de 5 a 9 mm = 7 mm. Em 240 px dá 29,17 µm/px.
    expect(escalaSugerida(240, 'soja')).toBeCloseTo(29.166, 2);
  });

  it('a sugestão volta a bater com a conferência', () => {
    // Se o aplicativo sugere uma escala, ela não pode ser recusada pela sua
    // própria conferência no instante seguinte.
    for (const especie of ['soja', 'orquidea', 'urochloa', 'milho']) {
      const sugerida = escalaSugerida(240, especie)!;
      expect(conferirEscala(240, sugerida, especie).veredicto, especie).toBe('plausivel');
    }
  });

  it('não sugere o que não conhece', () => {
    expect(escalaSugerida(240, 'quinoa')).toBeNull();
    expect(escalaSugerida(0, 'soja')).toBeNull();
  });
});
