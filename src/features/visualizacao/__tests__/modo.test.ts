// =============================================================================
// modo.ts — a tabela de modos e a leitura da URL.
//
// O teste mais importante aqui é o de 'apresentacao': ele fixa, chave por
// chave, o que `?mode=enterprise` escondia em 20/09/2026. É o modo usado para
// gravar vídeo; mudar a aparência dele sem querer é a regressão que este
// arquivo existe para impedir.
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  MODOS,
  PARTES,
  ROTULO_DA_PARTE,
  alternarParte,
  descricaoDoModo,
  ehModoDeVisualizacao,
  lerModoDaUrl,
  lerSobrescritas,
  serializarSobrescritas,
  visibilidadeEfetiva,
  visibilidadePadrao,
  type ParteDaInterface,
  type Visibilidade,
} from '../modo';

describe('a tabela modo → visibilidade', () => {
  it('tem os quatro modos, e cada um responde por todas as partes', () => {
    expect(MODOS).toEqual(['completo', 'contagem', 'laudo', 'apresentacao']);
    for (const modo of MODOS) {
      const v = visibilidadePadrao(modo);
      expect(Object.keys(v).sort()).toEqual([...PARTES].sort());
      for (const parte of PARTES) expect(typeof v[parte]).toBe('boolean');
    }
  });

  it('cada parte tem rótulo para o menu', () => {
    for (const parte of PARTES) expect(ROTULO_DA_PARTE[parte]).toBeTruthy();
  });

  it("'completo' mostra tudo, menos o selo (que é só de apresentação)", () => {
    const v = visibilidadePadrao('completo');
    for (const parte of PARTES) {
      expect(v[parte], parte).toBe(parte !== 'seloDoModo');
    }
  });

  it("'apresentacao' esconde EXATAMENTE o que ?mode=enterprise escondia", () => {
    // Header.tsx: `!isEnterpriseMode && <nav>` e `!isEnterpriseMode && onOpenFeatures`;
    // e `isEnterpriseMode && <span>Analytics</span>`.
    // Sidebar.tsx: trilho sem 'sec-preparar' e 'sec-amostra'; seções
    // "Preparar imagem" e "Identificar amostra" fora.
    const esperado: Visibilidade = {
      abasDeNavegacao: false,
      seloDoModo: true,
      chipDeEspecie: true,
      seletorDeBancadas: true,
      botaoDeRecursos: false,
      barraDeAcoes: true,
      botoesDeExportacao: true,
      lateralEsquerda: true,
      exemplos: true,
      calibrarEscala: true,
      encontrarObjetos: true,
      prepararImagem: false,
      identificarAmostra: false,
      lateralDireita: true,
      morfometria: true,
      rodape: true,
    };
    expect(visibilidadePadrao('apresentacao')).toEqual(esperado);
  });

  it("'contagem' deixa o canvas, o que encontra objetos e os totais", () => {
    const v = visibilidadePadrao('contagem');
    expect(v.lateralEsquerda).toBe(true);
    expect(v.encontrarObjetos).toBe(true);
    expect(v.lateralDireita).toBe(true);
    expect(v.calibrarEscala).toBe(false);
    expect(v.morfometria).toBe(false);
    expect(v.identificarAmostra).toBe(false);
    expect(v.prepararImagem).toBe(false);
  });

  it("'laudo' mantém metadados e morfometria", () => {
    const v = visibilidadePadrao('laudo');
    expect(v.identificarAmostra).toBe(true);
    expect(v.morfometria).toBe(true);
    expect(v.botoesDeExportacao).toBe(true);
    expect(v.exemplos).toBe(false);
  });

  it('devolve um objeto novo a cada chamada (ninguém altera a tabela por engano)', () => {
    const a = visibilidadePadrao('completo');
    a.rodape = false;
    expect(visibilidadePadrao('completo').rodape).toBe(true);
  });
});

describe('lerModoDaUrl', () => {
  it('aceita ?modo=<modo> para os quatro modos', () => {
    for (const modo of MODOS) expect(lerModoDaUrl(`?modo=${modo}`)).toBe(modo);
  });

  it('mapeia o antigo ?mode=enterprise para apresentação', () => {
    expect(lerModoDaUrl('?mode=enterprise')).toBe('apresentacao');
    expect(lerModoDaUrl('?foo=1&mode=enterprise&bar=2')).toBe('apresentacao');
  });

  it('sem parâmetro dá null', () => {
    expect(lerModoDaUrl('')).toBeNull();
    expect(lerModoDaUrl('?')).toBeNull();
    expect(lerModoDaUrl('?outra=coisa')).toBeNull();
  });

  it('parâmetro inválido dá null', () => {
    expect(lerModoDaUrl('?modo=enterprise')).toBeNull();
    expect(lerModoDaUrl('?modo=')).toBeNull();
    expect(lerModoDaUrl('?modo=Completo')).toBeNull();
    expect(lerModoDaUrl('?mode=analytics')).toBeNull();
    expect(lerModoDaUrl('?mode=')).toBeNull();
  });

  it('o parâmetro novo vence o antigo quando os dois existem', () => {
    expect(lerModoDaUrl('?mode=enterprise&modo=contagem')).toBe('contagem');
  });
});

describe('ehModoDeVisualizacao', () => {
  it('reconhece só os quatro nomes', () => {
    expect(ehModoDeVisualizacao('laudo')).toBe(true);
    expect(ehModoDeVisualizacao('enterprise')).toBe(false);
    expect(ehModoDeVisualizacao(null)).toBe(false);
    expect(ehModoDeVisualizacao(42)).toBe(false);
  });
});

describe('descricaoDoModo', () => {
  it('tem rótulo e frase para cada modo', () => {
    for (const modo of MODOS) {
      const d = descricaoDoModo(modo);
      expect(d.rotulo.length).toBeGreaterThan(0);
      expect(d.frase.length).toBeGreaterThan(0);
    }
  });
});

describe('sobrescritas', () => {
  it('lerSobrescritas aceita só chaves conhecidas com booleano, e nunca lança', () => {
    expect(lerSobrescritas(null)).toEqual({});
    expect(lerSobrescritas('')).toEqual({});
    expect(lerSobrescritas('não é json')).toEqual({});
    expect(lerSobrescritas('[1,2]')).toEqual({});
    expect(lerSobrescritas('"texto"')).toEqual({});
    expect(lerSobrescritas('{"rodape":false,"inventada":true,"exemplos":"sim"}')).toEqual({
      rodape: false,
    });
  });

  it('serializar e ler são inversos', () => {
    const s: Partial<Visibilidade> = { rodape: false, exemplos: true };
    expect(lerSobrescritas(serializarSobrescritas(s))).toEqual(s);
  });

  it('visibilidadeEfetiva põe as sobrescritas por cima do padrão do modo', () => {
    const v = visibilidadeEfetiva('apresentacao', { abasDeNavegacao: true });
    expect(v.abasDeNavegacao).toBe(true);
    expect(v.botaoDeRecursos).toBe(false);
  });

  it('alternarParte grava só o que difere do padrão, e some quando volta a coincidir', () => {
    const parte: ParteDaInterface = 'rodape';
    const ligada = alternarParte('completo', {}, parte);
    expect(ligada).toEqual({ rodape: false });
    const devolta = alternarParte('completo', ligada, parte);
    expect(devolta).toEqual({});
  });

  it('alternarParte não muda o mapa recebido', () => {
    const original: Partial<Visibilidade> = {};
    alternarParte('completo', original, 'rodape');
    expect(original).toEqual({});
  });
});
