// =============================================================================
// O motor de sugestões contextuais.
//
// Sem imagem, silêncio sempre — nenhuma regra existe para incomodar quem
// ainda nem abriu uma digitalização. Com imagem, no máximo UMA sugestão por
// vez, e é sempre a de maior prioridade entre as que dispararam e não foram
// dispensadas. A regra de escala é testada contra `conferirEscala` de
// verdade, não contra uma cópia da lógica dela.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { REGRAS, sugerir, type EstadoParaSugestao } from '../regras';

function estadoBase(overrides: Partial<EstadoParaSugestao> = {}): EstadoParaSugestao {
  return {
    temImagem: true,
    chaveDaImagem: 'img-1',
    totalDeMarcas: 0,
    marcasSemContorno: 0,
    totalDeContornos: 0,
    umPerPixel: undefined,
    especie: undefined,
    comprimentoTipicoEmPixels: undefined,
    contornosComFormaSuspeita: 0,
    minutosDesdeUltimaGravacao: null,
    protocoloExigeTetrazolio: false,
    ...overrides,
  };
}

describe('sem imagem, silêncio sempre', () => {
  it('devolve null mesmo com todos os gatilhos ligados ao mesmo tempo', () => {
    const estadoCheio = estadoBase({
      temImagem: false,
      marcasSemContorno: 10,
      totalDeContornos: 20,
      contornosComFormaSuspeita: 5,
      totalDeMarcas: 100,
      protocoloExigeTetrazolio: true,
      especie: 'soja',
      comprimentoTipicoEmPixels: 240,
      umPerPixel: 2.5,
    });
    expect(sugerir(estadoCheio, new Set())).toBeNull();
  });

  it('nenhuma regra individual dispara sem imagem', () => {
    const estadoCheio = estadoBase({
      temImagem: false,
      marcasSemContorno: 10,
      totalDeContornos: 20,
      contornosComFormaSuspeita: 5,
      totalDeMarcas: 100,
      protocoloExigeTetrazolio: true,
      especie: 'soja',
      comprimentoTipicoEmPixels: 240,
      umPerPixel: 2.5,
    });
    for (const regra of REGRAS) {
      expect(regra(estadoCheio)).toBeNull();
    }
  });
});

describe('estado vazio: nenhuma regra dispara sozinha', () => {
  it('todas calam com o estado inicial (com imagem, mas nada aconteceu ainda)', () => {
    const vazio = estadoBase();
    for (const regra of REGRAS) {
      expect(regra(vazio)).toBeNull();
    }
    expect(sugerir(vazio, new Set())).toBeNull();
  });
});

describe('marcas-sem-contorno', () => {
  it('dispara com 5 ou mais marcações sem contorno', () => {
    const s = sugerir(estadoBase({ marcasSemContorno: 5 }), new Set());
    expect(s?.id).toBe('marcas-sem-contorno');
    expect(s?.acao?.id).toBe('abrir-galeria');
    expect(s?.escopoDaDispensa).toBe('imagem');
    expect(s?.texto).toContain('5');
  });

  it('cala com menos de 5', () => {
    const s = sugerir(estadoBase({ marcasSemContorno: 4 }), new Set());
    expect(s).toBeNull();
  });
});

describe('escala-suspeita — usa conferirEscala de verdade', () => {
  it('soja, 240 px e 2,5 µm/px: a escala implicaria ~0,6 mm — sugere', () => {
    const s = sugerir(
      estadoBase({ especie: 'soja', comprimentoTipicoEmPixels: 240, umPerPixel: 2.5 }),
      new Set()
    );
    expect(s?.id).toBe('escala-suspeita');
    expect(s?.acao?.id).toBe('abrir-calibracao');
    expect(s?.texto.length).toBeGreaterThan(0);
  });

  it('soja, 240 px e 25 µm/px: a escala implicaria 6 mm, dentro da faixa — não sugere', () => {
    const s = sugerir(
      estadoBase({ especie: 'soja', comprimentoTipicoEmPixels: 240, umPerPixel: 25 }),
      new Set()
    );
    expect(s).toBeNull();
  });

  it('sem espécie declarada, conferirEscala não tem referência — não sugere', () => {
    const s = sugerir(
      estadoBase({ comprimentoTipicoEmPixels: 240, umPerPixel: 2.5 }),
      new Set()
    );
    expect(s).toBeNull();
  });
});

describe('sem-calibracao', () => {
  it('dispara com 10 ou mais contornos e sem escala', () => {
    const s = sugerir(estadoBase({ totalDeContornos: 10 }), new Set());
    expect(s?.id).toBe('sem-calibracao');
    expect(s?.acao?.id).toBe('abrir-calibracao');
  });

  it('cala se já há calibração', () => {
    const s = sugerir(estadoBase({ totalDeContornos: 10, umPerPixel: 5 }), new Set());
    expect(s).toBeNull();
  });

  it('cala com menos de 10 contornos', () => {
    const s = sugerir(estadoBase({ totalDeContornos: 9 }), new Set());
    expect(s).toBeNull();
  });
});

describe('pares-suspeitos', () => {
  it('dispara com 2 ou mais contornos de forma suspeita', () => {
    const s = sugerir(estadoBase({ contornosComFormaSuspeita: 2 }), new Set());
    expect(s?.id).toBe('pares-suspeitos');
    expect(s?.acao?.id).toBe('ferramenta-contorno');
    expect(s?.texto).toContain('2');
  });

  it('cala com apenas 1 (pode ser variedade atípica, não padrão)', () => {
    const s = sugerir(estadoBase({ contornosComFormaSuspeita: 1 }), new Set());
    expect(s).toBeNull();
  });
});

describe('salvar', () => {
  it('dispara com 20+ marcações e nunca gravou nesta imagem', () => {
    const s = sugerir(
      estadoBase({ totalDeMarcas: 20, minutosDesdeUltimaGravacao: null }),
      new Set()
    );
    expect(s?.id).toBe('salvar');
    expect(s?.acao?.id).toBe('salvar-sessao');
  });

  it('dispara com 20+ marcações e 10+ minutos desde a última gravação', () => {
    const s = sugerir(
      estadoBase({ totalDeMarcas: 20, minutosDesdeUltimaGravacao: 10 }),
      new Set()
    );
    expect(s?.id).toBe('salvar');
  });

  it('cala se gravou há menos de 10 minutos', () => {
    const s = sugerir(
      estadoBase({ totalDeMarcas: 20, minutosDesdeUltimaGravacao: 5 }),
      new Set()
    );
    expect(s).toBeNull();
  });

  it('cala com menos de 20 marcações', () => {
    const s = sugerir(
      estadoBase({ totalDeMarcas: 19, minutosDesdeUltimaGravacao: null }),
      new Set()
    );
    expect(s).toBeNull();
  });
});

describe('tetrazolio', () => {
  it('dispara quando o protocolo exige — sem ação, é informativo', () => {
    const s = sugerir(estadoBase({ protocoloExigeTetrazolio: true }), new Set());
    expect(s?.id).toBe('tetrazolio');
    expect(s?.acao).toBeUndefined();
  });

  it('cala quando o protocolo não exige', () => {
    const s = sugerir(estadoBase({ protocoloExigeTetrazolio: false }), new Set());
    expect(s).toBeNull();
  });
});

describe('identificacao-para-laudo', () => {
  // minutosDesdeUltimaGravacao: 0 isola de 'salvar' — que também dispararia
  // com totalDeMarcas >= 20 e nunca gravado, e tem prioridade maior (50 > 30).
  it('dispara com 50+ marcações e espécie ainda não declarada', () => {
    const s = sugerir(
      estadoBase({ totalDeMarcas: 50, minutosDesdeUltimaGravacao: 0 }),
      new Set()
    );
    expect(s?.id).toBe('identificacao-para-laudo');
    expect(s?.acao?.id).toBe('abrir-identificacao');
    // Hábito de bancada, não pendência de uma imagem: vale para sempre.
    expect(s?.escopoDaDispensa).toBe('sempre');
  });

  it('cala se a espécie já foi declarada', () => {
    const s = sugerir(
      estadoBase({ totalDeMarcas: 50, especie: 'Soja', minutosDesdeUltimaGravacao: 0 }),
      new Set()
    );
    expect(s).toBeNull();
  });

  it('cala com menos de 50 marcações', () => {
    const s = sugerir(
      estadoBase({ totalDeMarcas: 49, minutosDesdeUltimaGravacao: 0 }),
      new Set()
    );
    expect(s).toBeNull();
  });
});

describe('sugerir — prioridade e dispensa', () => {
  it('com vários gatilhos ligados, devolve só a de maior prioridade', () => {
    // escala-suspeita (90) e tetrazolio (85) disparando junto: a de escala vence.
    const estado = estadoBase({
      especie: 'soja',
      comprimentoTipicoEmPixels: 240,
      umPerPixel: 2.5,
      protocoloExigeTetrazolio: true,
      marcasSemContorno: 10,
      contornosComFormaSuspeita: 5,
      totalDeMarcas: 100,
      minutosDesdeUltimaGravacao: null,
    });
    const s = sugerir(estado, new Set());
    expect(s?.id).toBe('escala-suspeita');
  });

  it('ignora a de maior prioridade se estiver dispensada, e cai para a próxima', () => {
    const estado = estadoBase({
      especie: 'soja',
      comprimentoTipicoEmPixels: 240,
      umPerPixel: 2.5,
      protocoloExigeTetrazolio: true,
    });
    const s = sugerir(estado, new Set(['escala-suspeita']));
    expect(s?.id).toBe('tetrazolio');
  });

  it('devolve null quando tudo que dispara está dispensado', () => {
    const estado = estadoBase({ marcasSemContorno: 5 });
    const s = sugerir(estado, new Set(['marcas-sem-contorno']));
    expect(s).toBeNull();
  });

  it('nunca devolve mais de uma sugestão, mesmo com todo gatilho ligado', () => {
    const estado = estadoBase({
      comprimentoTipicoEmPixels: 240,
      umPerPixel: 2.5,
      protocoloExigeTetrazolio: true,
      marcasSemContorno: 10,
      contornosComFormaSuspeita: 5,
      totalDeMarcas: 100,
      totalDeContornos: 20,
      minutosDesdeUltimaGravacao: null,
    });
    const s = sugerir(estado, new Set());
    expect(s).not.toBeNull();
    expect(Array.isArray(s)).toBe(false);
    // E é a de maior prioridade dentre as que de fato dispararam neste estado
    // (sem espécie, escala-suspeita não dispara — vira 'sem-referencia').
    expect(s?.id).toBe('tetrazolio');
  });

  it('o conjunto de regras não perdeu nenhuma das sete', () => {
    expect(REGRAS).toHaveLength(7);
  });
});
