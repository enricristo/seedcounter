// =============================================================================
// O relatório de diagnóstico.
//
// Dois grupos de teste: a FORMA (serializável, com os campos que quem recebe
// precisa) e a PROMESSA (nada de imagem atravessa, nem pelo contexto).
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  lerAmbiente,
  montarRelatorio,
  nomeDoArquivoDeRelatorio,
  relatorioComoTexto,
  resumoCurto,
} from '../relatorio';
import { limparTrilha, registrarErro, registrarEvento } from '../trilha';

const DATA = new Date('2026-09-18T14:32:05.123Z');

beforeEach(() => limparTrilha());

describe('nomeDoArquivoDeRelatorio', () => {
  it('põe a data no nome, sem caractere que o Windows recuse', () => {
    expect(nomeDoArquivoDeRelatorio(DATA)).toBe('seedcounter-diagnostico-2026-09-18T14-32-05.json');
  });

  it('ordena cronologicamente como texto', () => {
    const cedo = nomeDoArquivoDeRelatorio(new Date('2026-01-02T03:04:05Z'));
    const tarde = nomeDoArquivoDeRelatorio(new Date('2026-11-02T03:04:05Z'));
    expect([tarde, cedo].sort()).toEqual([cedo, tarde]);
  });
});

describe('montarRelatorio', () => {
  it('leva a trilha e os erros junto', () => {
    registrarEvento('abrir-imagem', { extensao: 'tif' });
    registrarErro(new Error('quebrou'), 'render');

    const r = montarRelatorio({}, DATA);
    expect(r.eventos.map((e) => e.tipo)).toEqual(['abrir-imagem', 'erro']);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0].origem).toBe('render');
  });

  it('carimba formato, versão do formato e data', () => {
    const r = montarRelatorio({}, DATA);
    expect(r.formato).toBe('seedcounter-diagnostico');
    expect(r.versaoDoFormato).toBe(1);
    expect(r.geradoEm).toBe('2026-09-18T14:32:05.123Z');
  });

  it('descreve o ambiente mesmo onde não há navegador', () => {
    // Os testes rodam em node: o relatório precisa sair inteiro assim mesmo,
    // porque é isso que garante que ele sai inteiro num navegador capenga.
    const a = lerAmbiente();
    expect(typeof a.userAgent).toBe('string');
    expect(typeof a.tela.largura).toBe('number');
    expect(a.memoriaGb === null || typeof a.memoriaGb === 'number').toBe(true);
  });

  it('guarda o contexto de medição que o chamador passou', () => {
    const r = montarRelatorio(
      {
        umPerPixel: 4.23,
        especie: 'Cattleya walkeriana',
        imagem: { largura: 7992, altura: 3672 },
        extensaoDaImagem: 'tif',
        contagem: { viaveis: 310, inviaveis: 44, total: 354 },
        receita: 'orquidea-densa',
        bancadas: { abertas: 2, ativa: 1 },
      },
      DATA
    );
    expect(r.contexto.umPerPixel).toBe(4.23);
    expect(r.contexto.especie).toBe('Cattleya walkeriana');
    expect(r.contexto.imagem).toEqual({ largura: 7992, altura: 3672 });
    expect(r.contexto.contagem).toEqual({ viaveis: 310, inviaveis: 44, total: 354 });
  });

  it('é serializável — é um .json que alguém vai abrir', () => {
    registrarEvento('exportar', { tipo: 'CSV' });
    const texto = relatorioComoTexto(montarRelatorio({ umPerPixel: 4.23 }, DATA));
    const devolta = JSON.parse(texto) as { contexto: { umPerPixel: number } };
    expect(devolta.contexto.umPerPixel).toBe(4.23);
    expect(texto).toContain('\n'); // indentado, para leitura humana
  });
});

describe('a promessa: nenhuma imagem atravessa', () => {
  it('barra dataURL passada no contexto', () => {
    const r = montarRelatorio(
      { extra: { miniatura: 'data:image/png;base64,iVBORw0KGgoAAAA' } },
      DATA
    );
    expect(relatorioComoTexto(r)).not.toContain('base64');
    expect((r.contexto.extra as Record<string, unknown>).miniatura).toBe('[omitido]');
  });

  it('barra texto enorme passado no contexto', () => {
    const r = montarRelatorio({ extra: { despejo: 'z'.repeat(5000) } }, DATA);
    expect((r.contexto.extra as Record<string, unknown>).despejo).toBe('[omitido]');
  });

  it('declara dentro do próprio arquivo o que não tem', () => {
    const r = montarRelatorio({}, DATA);
    expect(r.privacidade).toContain('não contém imagem');
  });
});

describe('resumoCurto', () => {
  it('traz versão, navegador e os três últimos erros', () => {
    for (let i = 1; i <= 5; i++) registrarErro(new Error(`falha ${i}`), 'window');

    const texto = resumoCurto(montarRelatorio({}, DATA));
    expect(texto).toContain('SeedCounter v');
    expect(texto).toContain('Navegador:');
    expect(texto).toContain('falha 3');
    expect(texto).toContain('falha 5');
    expect(texto).not.toContain('falha 2');
  });

  it('diz que não houve erro, em vez de deixar a linha vazia', () => {
    registrarEvento('calibrar', { metodo: 'dpi' });
    const texto = resumoCurto(montarRelatorio({}, DATA));
    expect(texto).toContain('nenhum registrado');
    expect(texto).toContain('Última ação registrada: calibrar');
  });

  it('não carrega pilha — é para caber numa mensagem', () => {
    registrarErro(new Error('quebrou'), 'render');
    const texto = resumoCurto(montarRelatorio({}, DATA));
    expect(texto.split('\n').length).toBeLessThan(12);
  });
});
