// =============================================================================
// A trilha: o anel, o filtro de privacidade e a promessa de nunca lançar.
//
// O teste do filtro é o mais importante daqui. Ele é a única coisa que separa
// "um relatório de diagnóstico" de "uma imagem de pesquisa não publicada saindo
// do computador de quem confiou no programa".
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LIMITE_DE_EVENTOS,
  extensaoDe,
  lerErros,
  lerTrilha,
  limparTrilha,
  registrarErro,
  registrarEvento,
  sanitizar,
} from '../trilha';

beforeEach(() => limparTrilha());

describe('anel de eventos', () => {
  it('guarda na ordem em que aconteceu', () => {
    registrarEvento('abrir-imagem');
    registrarEvento('calibrar');
    registrarEvento('exportar');
    expect(lerTrilha().map((e) => e.tipo)).toEqual(['abrir-imagem', 'calibrar', 'exportar']);
  });

  it('descarta o mais antigo quando enche', () => {
    for (let i = 0; i < LIMITE_DE_EVENTOS + 25; i++) registrarEvento(`ev-${i}`);

    const trilha = lerTrilha();
    expect(trilha).toHaveLength(LIMITE_DE_EVENTOS);
    // O primeiro que sobrou é o de índice 25: os 25 primeiros saíram.
    expect(trilha[0].tipo).toBe('ev-25');
    expect(trilha[trilha.length - 1].tipo).toBe(`ev-${LIMITE_DE_EVENTOS + 24}`);
  });

  it('devolve cópia: mexer no que saiu não mexe no anel', () => {
    registrarEvento('abrir-imagem', { largura: 100 });
    const copia = lerTrilha();
    copia[0].tipo = 'adulterado';
    if (copia[0].detalhe) copia[0].detalhe.largura = 999;

    const original = lerTrilha();
    expect(original[0].tipo).toBe('abrir-imagem');
    expect(original[0].detalhe?.largura).toBe(100);
  });

  it('marca o tempo desde o início da sessão, sem andar para trás', () => {
    registrarEvento('a');
    registrarEvento('b');
    const [a, b] = lerTrilha();
    expect(a.t).toBeGreaterThanOrEqual(0);
    expect(b.t).toBeGreaterThanOrEqual(a.t);
  });
});

describe('sanitizar — a regra de privacidade', () => {
  it('joga fora qualquer coisa que comece com data:', () => {
    const limpo = sanitizar({ miniatura: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(limpo.miniatura).toBe('[omitido]');
  });

  it('joga fora data: mesmo quando é curta', () => {
    // Uma dataURL de um pixel cabe em 40 caracteres e continua sendo imagem.
    expect(sanitizar({ x: 'data:,' }).x).toBe('[omitido]');
  });

  it('joga fora string com mais de 300 caracteres', () => {
    expect(sanitizar({ texto: 'x'.repeat(301) }).texto).toBe('[omitido]');
    expect(sanitizar({ texto: 'x'.repeat(300) }).texto).toBe('x'.repeat(300));
  });

  it('deixa passar o que explica um defeito', () => {
    const limpo = sanitizar({ extensao: 'tif', bytes: 5_400_000, umPerPixel: 4.23, ok: false });
    expect(limpo).toEqual({ extensao: 'tif', bytes: 5_400_000, umPerPixel: 4.23, ok: false });
  });

  it('desce em objeto e lista aninhados', () => {
    const limpo = sanitizar({
      imagem: { largura: 800, src: 'data:image/jpeg;base64,AAAA' },
      lista: ['ok', 'y'.repeat(400)],
    });
    expect(limpo.imagem).toEqual({ largura: 800, src: '[omitido]' });
    expect(limpo.lista).toEqual(['ok', '[omitido]']);
  });

  it('recusa o que não é dado simples — é por onde uma imagem entraria', () => {
    class Cena {
      pixels = new Uint8Array(4);
    }
    const limpo = sanitizar({
      cena: new Cena(),
      desenhar: () => 'nada',
      quando: new Date(0),
    });
    expect(limpo.cena).toBe('[ignorado]');
    expect(limpo.desenhar).toBe('[ignorado]');
    expect(limpo.quando).toBe('[ignorado]');
  });

  it('troca número que não sobrevive a JSON por nulo', () => {
    expect(sanitizar({ a: NaN, b: Infinity }).a).toBeNull();
    expect(sanitizar({ a: NaN, b: Infinity }).b).toBeNull();
  });

  it('o que foi registrado já sai sanitizado da trilha', () => {
    registrarEvento('abrir-imagem', { preview: 'data:image/png;base64,AAAA', extensao: 'png' });
    const [evento] = lerTrilha();
    expect(evento.detalhe).toEqual({ preview: '[omitido]', extensao: 'png' });
  });
});

describe('registrarErro', () => {
  it('guarda mensagem, pilha e origem', () => {
    registrarErro(new TypeError('não dá para ler width de null'), 'render');
    const [erro] = lerErros();
    expect(erro.origem).toBe('render');
    expect(erro.mensagem).toContain('TypeError');
    expect(erro.mensagem).toContain('width');
    expect(erro.pilha).toBeTypeOf('string');
  });

  it('corta a pilha para não inflar o arquivo', () => {
    const gordo = new Error('estouro');
    gordo.stack = 'x'.repeat(10_000);
    registrarErro(gordo, 'promise');
    const [erro] = lerErros();
    expect(erro.pilha?.length).toBeLessThan(4200);
    expect(erro.pilha?.endsWith('[cortado]')).toBe(true);
  });

  it('aceita o que não é Error — promessa rejeita com qualquer coisa', () => {
    registrarErro('falhou feio', 'promise');
    registrarErro({ codigo: 42 }, 'window');
    registrarErro(undefined, 'manual');
    expect(lerErros().map((e) => e.origem)).toEqual(['promise', 'window', 'manual']);
    expect(lerErros()[2].mensagem).toBe('Erro sem descrição.');
  });

  it('também entra no anel, para manter a ordem junto das ações', () => {
    registrarEvento('calibrar');
    registrarErro(new Error('x'), 'render');
    registrarEvento('exportar');
    expect(lerTrilha().map((e) => e.tipo)).toEqual(['calibrar', 'erro', 'exportar']);
  });
});

describe('o instrumento nunca é a causa', () => {
  it('não lança com detalhe cíclico', () => {
    const ciclico: Record<string, unknown> = { a: 1 };
    ciclico.eu = ciclico;
    // Sem o limite de profundidade isto seria recursão infinita.
    expect(() => registrarEvento('ciclo', ciclico)).not.toThrow();
    expect(lerTrilha()).toHaveLength(1);
  });

  it('não lança com erro que mente sobre a própria pilha', () => {
    const esquisito = {
      get message() {
        throw new Error('nem isso funciona');
      },
    };
    expect(() => registrarErro(esquisito, 'manual')).not.toThrow();
  });
});

describe('extensaoDe', () => {
  it('devolve só a extensão, nunca o nome', () => {
    expect(extensaoDe('Tese_Maria_placa3.TIF')).toBe('tif');
    expect(extensaoDe('C:/Fotos/2026/amostra.jpeg')).toBe('jpeg');
  });

  it('aguenta nome sem extensão e ausência de nome', () => {
    expect(extensaoDe('digitalizacao')).toBe('sem-extensao');
    expect(extensaoDe('acaba-no-ponto.')).toBe('sem-extensao');
    expect(extensaoDe(undefined)).toBe('sem-extensao');
  });
});
