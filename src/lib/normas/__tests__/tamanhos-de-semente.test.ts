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
  conferirForma,
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
    expect(r.recado).toMatch(/5,00 a 11,0 mm/);
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
    // Soja: meio de 5 a 11 mm = 8 mm. Em 240 px dá 33,33 µm/px.
    expect(escalaSugerida(240, 'soja')).toBeCloseTo(33.333, 2);
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

describe('conferir a FORMA — sem calibração', () => {
  // Medido em 1200 sementes de soja isoladas: razão mediana 1,21, p99 1,36.
  const COMPRIMENTO = 285.5;
  const LARGURA = 236.3;

  it('a soja isolada passa', () => {
    const r = conferirForma(COMPRIMENTO, LARGURA, 'soja');
    expect(r.veredicto).toBe('plausivel');
    expect(r.razao).toBeCloseTo(1.208, 2);
    expect(r.recado).toBe('');
  });

  it('PEGA o contorno que engoliu a vizinha, SEM calibração', () => {
    // Duas encostadas: comprimento dobrado, largura igual. É o modo de falha
    // dominante da onda — 9 de 30 em forrageira — e este teste o pega sem
    // saber quantos µm tem o pixel.
    const r = conferirForma(COMPRIMENTO * 2, LARGURA, 'soja');
    expect(r.veredicto).toBe('alongado-demais');
    expect(r.recado).toMatch(/duas sementes encostadas/);
  });

  it('não depende da escala — o mesmo objeto em qualquer resolução', () => {
    // É a propriedade que torna esta checagem melhor que a de tamanho.
    for (const fator of [0.1, 1, 10, 1000]) {
      expect(conferirForma(COMPRIMENTO * fator, LARGURA * fator, 'soja').veredicto).toBe(
        'plausivel'
      );
    }
  });

  it('não se importa com qual lado veio primeiro', () => {
    const a = conferirForma(COMPRIMENTO, LARGURA, 'soja');
    const b = conferirForma(LARGURA, COMPRIMENTO, 'soja');
    expect(b.veredicto).toBe(a.veredicto);
    expect(b.razao).toBeCloseTo(a.razao!, 6);
  });

  it('avisa quando o contorno ficou redondo demais', () => {
    // Espécie alongada com contorno quase circular: provavelmente pegou só
    // parte da semente.
    const r = conferirForma(100, 98, 'urochloa');
    expect(r.veredicto).toBe('redondo-demais');
    expect(r.recado).toMatch(/semente inteira/);
  });

  it('a ORIENTAÇÃO não gera falso alarme em espécie alongada', () => {
    // Corrigido depois de medir: a razão da imagem é a PROJEÇÃO, não a da
    // semente. Um grão de trigo deitado mostra ~2:1 e o mesmo grão apoiado na
    // ponta mostra ~1:1 — quase metade dos 2222 blobs medidos ficou abaixo do
    // 1,8 que a literatura dá para o grão. Com o piso antigo, metade do lote
    // seria acusada por estar deitada de outro jeito.
    for (const razao of [1.1, 1.5, 1.87, 2.5, 3.0]) {
      expect(conferirForma(razao, 1, 'trigo').veredicto, `${razao}`).toBe('plausivel');
    }
  });

  it('mesmo com o piso baixo, o lado ALTO continua pegando o par', () => {
    // É o lado que importa: o contorno que engoliu a vizinha.
    const r = conferirForma(1.87 * 2, 1, 'trigo');
    expect(r.veredicto).toBe('alongado-demais');
  });

  it('a faixa da soja é ESTREITA e a do trigo é larga — é a orientação que decide', () => {
    // Soja é quase esférica: projeta igual de qualquer lado, então a faixa
    // observada é apertada (medida: 1,05 a 1,40). Trigo é um elipsoide: a
    // mesma semente mostra de ~1:1 a ~2:1 conforme caiu, e a faixa tem de
    // acomodar isso — senão metade do lote é acusada por estar deitada de
    // outro jeito.
    const largura = (c: string) => {
      const t = tamanhoDe(c)!;
      return t.razaoMaxima! - t.razaoMinima!;
    };
    expect(largura('soja')).toBeLessThan(largura('trigo') / 3);
  });

  it('a faixa da soja aceita a variação real medida', () => {
    // p1 = 1,054 e p99 = 1,364 das 1200 sementes.
    expect(conferirForma(1.054, 1, 'soja').veredicto).toBe('plausivel');
    expect(conferirForma(1.364, 1, 'soja').veredicto).toBe('plausivel');
  });

  it('cala quando não conhece a espécie', () => {
    expect(conferirForma(100, 50, 'quinoa').veredicto).toBe('sem-referencia');
    expect(conferirForma(100, 50, undefined).veredicto).toBe('sem-referencia');
  });

  it('cala com medida inválida em vez de dividir por zero', () => {
    expect(conferirForma(0, 50, 'soja').veredicto).toBe('sem-referencia');
    expect(conferirForma(100, 0, 'soja').veredicto).toBe('sem-referencia');
  });
});

describe('as razões da tabela', () => {
  it('toda faixa de razão é coerente e nunca menor que 1', () => {
    // Razão é sempre maior lado sobre menor lado: abaixo de 1 é impossível.
    for (const t of TAMANHOS) {
      if (t.razaoMinima === undefined) continue;
      expect(t.razaoMinima, t.chave).toBeGreaterThanOrEqual(1);
      expect(t.razaoMaxima!, t.chave).toBeGreaterThan(t.razaoMinima);
    }
  });

  it('a orquídea admite forma muito mais alongada que a soja', () => {
    // Cattleya ~1,17 x 0,34 mm contra soja ~1,2:1. Comparar pelo TETO, e não
    // pelo piso: o piso da orquídea é baixo de propósito, porque uma semente
    // alongada apoiada na ponta projeta redonda.
    expect(tamanhoDe('orquidea')!.razaoMaxima!).toBeGreaterThan(
      tamanhoDe('soja')!.razaoMaxima! * 2
    );
  });
});

describe('qual lado denuncia o par — depende da espécie', () => {
  // Corrigido depois de medir 1728 pares que REALMENTE se encostam no conjunto
  // de orquídea. A primeira versão afirmava que o par sempre aparece no lado
  // alto; isso vale para semente redonda e é falso para semente alongada.

  it('semente REDONDA: o par aparece no lado ALTO', () => {
    // Soja 1,2:1 — fundir só pode alongar.
    const r = conferirForma(1.208 * 2, 1, 'soja');
    expect(r.veredicto).toBe('alongado-demais');
    expect(r.recado).toMatch(/duas sementes encostadas/);
  });

  it('semente ALONGADA: o par aparece no lado BAIXO', () => {
    // Orquídea 3,70:1. Duas encostadas lado a lado ficam L x 2W, e a razão CAI
    // pela metade — medido: fundidas ficaram em 1,90 contra 3,70 das isoladas.
    const r = conferirForma(1.9, 1, 'orquidea');
    expect(r.veredicto).toBe('redondo-demais');
    expect(r.recado).toMatch(/duas encostadas lado a lado/);
  });

  it('a orquídea isolada medida continua passando', () => {
    // Mediana 3,70; viável 3,84; inviável 3,56.
    for (const razao of [2.2, 3.56, 3.7, 3.84, 6.03, 7.4]) {
      expect(conferirForma(razao, 1, 'orquidea').veredicto, `${razao}`).toBe('plausivel');
    }
  });

  it('o piso da orquídea fica ACIMA do p1 medido, de propósito', () => {
    // p1 das isoladas = 1,73, mas o piso é 2,0: é ele que denuncia o par lado a
    // lado, e 3,3% de falso alarme foi o preço aceito por 54% de deteccao.
    expect(tamanhoDe('orquidea')!.razaoMinima!).toBeGreaterThan(1.73);
    expect(conferirForma(1.9, 1, 'orquidea').veredicto).not.toBe('plausivel');
  });

  it('o texto do aviso NUNCA promete o mecanismo errado', () => {
    // Dizer "duas encostadas" no lado alto de uma espécie alongada mandaria a
    // pessoa procurar o erro errado.
    const alongadaNoAlto = conferirForma(9, 1, 'orquidea');
    expect(alongadaNoAlto.recado).not.toMatch(/duas encostadas lado a lado/);
    const redondaNoBaixo = conferirForma(1.01, 1, 'soja');
    expect(redondaNoBaixo.recado).not.toMatch(/lado a lado/);
  });
});
