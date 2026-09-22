// =============================================================================
// perfis.ts — a tabela dos cinco perfis, a gravação e o diff.
//
// O que se protege:
//   - cada perfil que grava produz o conjunto COMPLETO de chaves, no formato
//     que o consumidor de cada uma já lê (nenhuma chave nova sem leitor);
//   - "apresentação" não grava preferência nenhuma;
//   - `aplicarPerfil` escreve só o que o perfil define — nada apagado, nada
//     fora da tabela;
//   - `oQueMuda` lista só o que difere do que está em vigor;
//   - os critérios de pronto da spec: analista sem ensaio ao carregar; aluno
//     em contagem com cronômetro manual.
//
// Sem jsdom: um `Storage` mínimo, como em `preferencias.test.ts`.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CAMPOS,
  CHAVES,
  CHAVE_PERFIL,
  PADRAO_SEM_PERFIL,
  PERFIS,
  PERFIS_IDS,
  aplicarPerfil,
  lerPerfilAtual,
  lerPreferenciasAtuais,
  oQueMuda,
  perfilDeOrigemDoModo,
  preferenciasDoPerfil,
  registrarSemPerfil,
  serializar,
  type PerfilId,
} from '../perfis';
import { RECEITAS } from '../../ensaio/receitas';
import { PARTES, visibilidadeEfetiva, lerSobrescritas } from '../../visualizacao/modo';
import { ESTILOS_DA_MARCA } from '../../../theme/specimen';
import { lerPreferencia, CHAVE_SUGESTOES } from '../../settings/preferencias';

function criarStorageFalso(): Storage & { chaves(): string[] } {
  const mapa = new Map<string, string>();
  return {
    getItem: (chave: string) => mapa.get(chave) ?? null,
    setItem: (chave: string, valor: string) => {
      mapa.set(chave, valor);
    },
    removeItem: (chave: string) => {
      mapa.delete(chave);
    },
    clear: () => mapa.clear(),
    key: () => null,
    get length() {
      return mapa.size;
    },
    chaves: () => [...mapa.keys()],
  } as Storage & { chaves(): string[] };
}

const QUE_GRAVAM: PerfilId[] = ['analista', 'orquidea', 'forrageira', 'aluno'];

/** Guarda real, sem `!`: o teste falha com mensagem se o perfil não gravar. */
function prefsDe(id: PerfilId) {
  const p = preferenciasDoPerfil(id);
  if (!p) throw new Error(`${id} precisa gravar preferências`);
  return p;
}

describe('a tabela dos perfis', () => {
  it('são cinco, na ordem dos cartões, e cada um tem título e voz', () => {
    expect(PERFIS_IDS).toEqual(['analista', 'orquidea', 'forrageira', 'aluno', 'apresentacao']);
    for (const id of PERFIS_IDS) {
      expect(PERFIS[id].id).toBe(id);
      expect(PERFIS[id].titulo.length).toBeGreaterThan(3);
      expect(PERFIS[id].voz.length).toBeGreaterThan(20);
      expect(PERFIS[id].aVista).toHaveLength(3);
    }
  });

  it('cada perfil que grava produz o conjunto COMPLETO de chaves', () => {
    const esperadas = CAMPOS.map((c) => CHAVES[c]).sort();
    for (const id of QUE_GRAVAM) {
      expect(Object.keys(serializar(prefsDe(id))).sort()).toEqual(esperadas);
    }
  });

  it('apresentação não define preferência nenhuma', () => {
    expect(preferenciasDoPerfil('apresentacao')).toBeNull();
  });

  it('só aponta para receitas, estilos e partes que existem', () => {
    const receitas = new Set(['nenhuma', ...RECEITAS.map((r) => r.id)]);
    const estilos = new Set(ESTILOS_DA_MARCA.map((e) => e.valor));
    for (const id of QUE_GRAVAM) {
      const p = prefsDe(id);
      expect(receitas.has(p.receitaPadrao), `${id}: receita ${p.receitaPadrao}`).toBe(true);
      expect(estilos.has(p.estiloDaMarca), `${id}: estilo ${p.estiloDaMarca}`).toBe(true);
      for (const parte of Object.keys(p.sobrescritas)) {
        expect(PARTES).toContain(parte);
      }
      // A serialização das sobrescritas tem que voltar igual pelo leitor real.
      expect(lerSobrescritas(serializar(p)[CHAVES.sobrescritas])).toEqual(p.sobrescritas);
    }
  });

  it('a opacidade fica na faixa que o canvas aceita', () => {
    for (const id of QUE_GRAVAM) {
      const p = prefsDe(id);
      expect(p.opacidadeDaMarca).toBeGreaterThanOrEqual(0.25);
      expect(p.opacidadeDaMarca).toBeLessThanOrEqual(1);
    }
  });
});

describe('os critérios de pronto da spec', () => {
  it('analista comercial: o ensaio ao carregar NÃO roda', () => {
    const p = prefsDe('analista');
    expect(p.modo).toBe('laudo');
    const v = visibilidadeEfetiva(p.modo, p.sobrescritas);
    expect(v.ensaioAoCarregar).toBe(false);
    expect(v.morfometria).toBe(false);
    // Fila e exportação continuam à vista.
    expect(v.botoesDeExportacao).toBe(true);
    expect(v.barraDeAcoes).toBe(true);
    expect(p.protocoloPadrao).toBe('germinacao');
    expect(p.modoDeAnalisePadrao).toBe('assistida');
    expect(p.sugestoes).toBe(true);
  });

  it('aluno: modo contagem, cronômetro manual, nenhuma receita automática', () => {
    const p = prefsDe('aluno');
    expect(p.modo).toBe('contagem');
    expect(p.modoDeAnalisePadrao).toBe('manual');
    expect(p.receitaPadrao).toBe('nenhuma');
    expect(visibilidadeEfetiva(p.modo, p.sobrescritas).ensaioAoCarregar).toBe(false);
  });

  it('orquídea: anel a 60 %, cronômetro manual, protocolo simples', () => {
    const p = prefsDe('orquidea');
    expect(p.modo).toBe('completo');
    expect(p.estiloDaMarca).toBe('anel');
    expect(p.opacidadeDaMarca).toBe(0.6);
    expect(p.modoDeAnalisePadrao).toBe('manual');
    expect(p.protocoloPadrao).toBe('simples');
  });

  it('forrageira: protocolo forrageira, tudo à vista', () => {
    const p = prefsDe('forrageira');
    expect(p.modo).toBe('completo');
    expect(p.protocoloPadrao).toBe('forrageira');
    expect(p.sobrescritas).toEqual({});
  });
});

describe('gravação', () => {
  let storage: ReturnType<typeof criarStorageFalso>;
  beforeEach(() => {
    storage = criarStorageFalso();
    globalThis.localStorage = storage;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('sem nada gravado, o perfil é undefined (é o que dispara a tela)', () => {
    expect(lerPerfilAtual()).toBeUndefined();
  });

  it('fechar sem escolher grava só sc:perfil = nenhum', () => {
    registrarSemPerfil();
    expect(lerPerfilAtual()).toBe('nenhum');
    expect(storage.chaves()).toEqual([CHAVE_PERFIL]);
  });

  it('aplicarPerfil escreve sc:perfil e SÓ as chaves do perfil', () => {
    const escrito = aplicarPerfil('aluno');
    expect(escrito).not.toBeNull();
    expect(lerPerfilAtual()).toBe('aluno');
    const esperadas = [CHAVE_PERFIL, ...CAMPOS.map((c) => CHAVES[c])].sort();
    expect(storage.chaves().sort()).toEqual(esperadas);
  });

  it('aplicarPerfil não apaga o que não é dele', () => {
    storage.setItem('sc:som', '1');
    storage.setItem('sc:escalaGrafica', '0');
    aplicarPerfil('analista');
    expect(storage.getItem('sc:som')).toBe('1');
    expect(storage.getItem('sc:escalaGrafica')).toBe('0');
  });

  it('apresentação grava só o perfil, nunca preferência', () => {
    expect(aplicarPerfil('apresentacao')).toBeNull();
    expect(storage.chaves()).toEqual([CHAVE_PERFIL]);
    expect(lerPerfilAtual()).toBe('apresentacao');
  });

  it('o que foi gravado volta igual pelos leitores de cada consumidor', () => {
    aplicarPerfil('orquidea');
    // `lerPreferencia` é o leitor de `sc:sugestoes` no App e no painel.
    expect(lerPreferencia(CHAVE_SUGESTOES, false)).toBe(true);
    expect(storage.getItem('sc:modo-de-visualizacao')).toBe('completo');
    expect(storage.getItem('sc:estiloDaMarca')).toBe('anel');
    expect(storage.getItem('sc:opacidadeDaMarca')).toBe('0.6');
    expect(storage.getItem('sc:receitaPadrao')).toBe('sensivel');
    expect(storage.getItem('sc:protocoloPadrao')).toBe('simples');
    expect(storage.getItem('sc:modoDeAnalisePadrao')).toBe('manual');
    // E o leitor genérico devolve exatamente a tabela do perfil.
    expect(lerPreferenciasAtuais()).toEqual(prefsDe('orquidea'));
  });

  it('lerPreferenciasAtuais cai no padrão do consumidor quando a chave está corrompida', () => {
    storage.setItem('sc:estiloDaMarca', 'hexagono');
    storage.setItem('sc:opacidadeDaMarca', 'abc');
    storage.setItem('sc:visibilidade', '{nao e json');
    storage.setItem('sc:modoDeAnalisePadrao', 'telepatica');
    expect(lerPreferenciasAtuais()).toEqual(PADRAO_SEM_PERFIL);
  });

  it('sc:perfil com lixo vale como não perguntado', () => {
    storage.setItem(CHAVE_PERFIL, 'gerente');
    expect(lerPerfilAtual()).toBeUndefined();
  });
});

describe('oQueMuda', () => {
  it('lista só o que difere', () => {
    // Aluno → Orquídea: modo, estilo, opacidade e receita mudam; cronômetro
    // (manual → manual), protocolo (simples → simples) e sugestões (ligadas →
    // ligadas) não — e por isso não aparecem.
    const mudancas = oQueMuda(prefsDe('aluno'), 'orquidea');
    expect(mudancas.map((m) => m.campo)).toEqual([
      'modo',
      'estiloDaMarca',
      'opacidadeDaMarca',
      'receitaPadrao',
    ]);
    expect(mudancas[0]).toEqual({
      campo: 'modo',
      rotulo: 'Modo de visualização',
      de: 'Contagem',
      para: 'Completo',
    });
  });

  it('o mesmo perfil de novo não muda nada', () => {
    for (const id of QUE_GRAVAM) {
      expect(oQueMuda(prefsDe(id), id)).toEqual([]);
    }
  });

  it('apresentação nunca muda nada', () => {
    expect(oQueMuda(PADRAO_SEM_PERFIL, 'apresentacao')).toEqual([]);
  });

  it('vê o ajuste manual por cima do perfil antigo', () => {
    // A pessoa escolheu Analista e depois pôs a opacidade em 40 % à mão.
    const ajustado = { ...prefsDe('analista'), opacidadeDaMarca: 0.4 };
    expect(oQueMuda(ajustado, 'analista')).toEqual([
      { campo: 'opacidadeDaMarca', rotulo: 'Opacidade da marca', de: '40 %', para: '100 %' },
    ]);
  });

  it('descreve as sobrescritas com o rótulo do menu Exibir', () => {
    const m = oQueMuda(PADRAO_SEM_PERFIL, 'analista').find((x) => x.campo === 'sobrescritas');
    expect(m?.de).toBe('as do modo');
    expect(m?.para).toBe('Morfometria desligado, Ensaio ao carregar a imagem desligado');
  });
});

describe('perfilDeOrigemDoModo', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('sem perfil gravado, não há origem', () => {
    globalThis.localStorage = criarStorageFalso();
    expect(perfilDeOrigemDoModo('completo')).toBeNull();
    registrarSemPerfil();
    expect(perfilDeOrigemDoModo('completo')).toBeNull();
  });

  it('só quando o modo em vigor é o do perfil', () => {
    globalThis.localStorage = criarStorageFalso();
    aplicarPerfil('aluno');
    expect(perfilDeOrigemDoModo('contagem')?.id).toBe('aluno');
    // A pessoa trocou para laudo à mão: a origem já não é o perfil.
    expect(perfilDeOrigemDoModo('laudo')).toBeNull();
  });

  it('apresentação é origem do modo apresentação', () => {
    globalThis.localStorage = criarStorageFalso();
    aplicarPerfil('apresentacao');
    expect(perfilDeOrigemDoModo('apresentacao')?.id).toBe('apresentacao');
    expect(perfilDeOrigemDoModo('completo')).toBeNull();
  });
});
