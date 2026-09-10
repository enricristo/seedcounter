// =============================================================================
// Atividade em curso.
//
// O defeito que este modulo mais precisa evitar: uma operacao que comeca a
// avisar e nunca para. O rodape ficaria dizendo "carregando" para sempre — e
// um aviso que nao some e um aviso que ninguem mais acredita.
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  atualizarProgresso,
  comAtividade,
  iniciarAtividade,
  limparAtividades,
  ouvirAtividades,
  type Atividade,
} from '../atividade';

beforeEach(() => limparAtividades());

function ultimoEstado(): { lista: Atividade[]; parar: () => void } {
  const ref = { lista: [] as Atividade[], parar: () => {} };
  ref.parar = ouvirAtividades((l) => {
    ref.lista = l;
  });
  return ref;
}

describe('iniciar e encerrar', () => {
  it('anuncia e depois some', () => {
    const e = ultimoEstado();
    const encerrar = iniciarAtividade('x', 'Fazendo algo…');
    expect(e.lista.map((a) => a.chave)).toEqual(['x']);
    encerrar();
    expect(e.lista).toEqual([]);
    e.parar();
  });

  it('a mesma chave nao aparece duas vezes', () => {
    // Uma operacao reiniciada substitui a anterior em vez de empilhar.
    const e = ultimoEstado();
    iniciarAtividade('x', 'primeira');
    iniciarAtividade('x', 'segunda');
    expect(e.lista).toHaveLength(1);
    expect(e.lista[0].rotulo).toBe('segunda');
    e.parar();
  });

  it('duas atividades diferentes convivem', () => {
    const e = ultimoEstado();
    const a = iniciarAtividade('a', 'A');
    iniciarAtividade('b', 'B');
    expect(e.lista).toHaveLength(2);
    a();
    expect(e.lista.map((x) => x.chave)).toEqual(['b']);
    e.parar();
  });
});

describe('comAtividade', () => {
  it('ENCERRA mesmo quando a operacao lanca', async () => {
    // E o teste que justifica a funcao: sem o finally, um erro deixaria o
    // rodape dizendo "carregando" para sempre.
    const e = ultimoEstado();
    await expect(
      comAtividade('x', 'vai falhar', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(e.lista).toEqual([]);
    e.parar();
  });

  it('devolve o resultado da operacao', async () => {
    const r = await comAtividade('x', 'ok', async () => 42);
    expect(r).toBe(42);
  });

  it('esta anunciada DURANTE a operacao', async () => {
    const e = ultimoEstado();
    let vistoDurante = false;
    await comAtividade('x', 'durante', async () => {
      vistoDurante = e.lista.some((a) => a.chave === 'x');
    });
    expect(vistoDurante).toBe(true);
    e.parar();
  });
});

describe('progresso', () => {
  it('atualiza e prende entre 0 e 1', () => {
    const e = ultimoEstado();
    iniciarAtividade('x', 'lote');
    atualizarProgresso('x', 0.5);
    expect(e.lista[0].progresso).toBe(0.5);
    atualizarProgresso('x', 7);
    expect(e.lista[0].progresso).toBe(1);
    atualizarProgresso('x', -1);
    expect(e.lista[0].progresso).toBe(0);
    e.parar();
  });

  it('ignora progresso de atividade que nao existe', () => {
    const e = ultimoEstado();
    atualizarProgresso('fantasma', 0.5);
    expect(e.lista).toEqual([]);
    e.parar();
  });

  it('pode trocar o rotulo junto com o progresso', () => {
    const e = ultimoEstado();
    iniciarAtividade('x', 'antes');
    atualizarProgresso('x', 0.3, 'depois');
    expect(e.lista[0].rotulo).toBe('depois');
    e.parar();
  });
});

describe('ouvintes', () => {
  it('recebe o estado atual ao se inscrever', () => {
    iniciarAtividade('x', 'ja em curso');
    let recebido: Atividade[] = [];
    const parar = ouvirAtividades((l) => {
      recebido = l;
    });
    expect(recebido).toHaveLength(1);
    parar();
  });

  it('deixa de receber depois de parar', () => {
    let chamadas = 0;
    const parar = ouvirAtividades(() => {
      chamadas++;
    });
    parar();
    iniciarAtividade('x', 'depois de parar');
    expect(chamadas).toBe(1); // so a chamada inicial
  });
});
