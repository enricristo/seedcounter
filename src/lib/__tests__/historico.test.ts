import { describe, it, expect } from 'vitest';
import {
  abrirGesto,
  desfazer,
  fecharGesto,
  iniciar,
  LIMITE_DO_PASSADO,
  podeDesfazer,
  podeRefazer,
  recomecar,
  refazer,
  registrar,
} from '../historico';

describe('historico — registrar, desfazer, refazer', () => {
  it('desfaz na ordem inversa e refaz na ordem original', () => {
    let h = iniciar('a');
    h = registrar(h, 'b');
    h = registrar(h, 'c');
    expect(h.presente).toBe('c');

    h = desfazer(h);
    expect(h.presente).toBe('b');
    h = desfazer(h);
    expect(h.presente).toBe('a');
    expect(podeDesfazer(h)).toBe(false);

    h = refazer(h);
    expect(h.presente).toBe('b');
    h = refazer(h);
    expect(h.presente).toBe('c');
    expect(podeRefazer(h)).toBe(false);
  });

  it('desfazer e refazer sem nada a fazer devolvem o mesmo objeto', () => {
    const h = iniciar('a');
    expect(desfazer(h)).toBe(h);
    expect(refazer(h)).toBe(h);
  });

  it('um registro novo apaga o futuro — não existe refazer depois de divergir', () => {
    let h = registrar(registrar(iniciar('a'), 'b'), 'c');
    h = desfazer(h);
    h = registrar(h, 'd');
    expect(h.presente).toBe('d');
    expect(podeRefazer(h)).toBe(false);
    // Volta ao ponto de divergência, não ao começo.
    expect(desfazer(h).presente).toBe('b');
    expect(desfazer(desfazer(h)).presente).toBe('a');
  });

  it('registrar o mesmo estado (mesma referência) não cria entrada', () => {
    const estado = { n: 1 };
    const h = registrar(iniciar(estado), estado);
    expect(podeDesfazer(h)).toBe(false);
  });

  it('o passado respeita o limite, descartando o mais antigo', () => {
    let h = iniciar(0);
    for (let i = 1; i <= LIMITE_DO_PASSADO + 10; i++) h = registrar(h, i);
    expect(h.passado.length).toBe(LIMITE_DO_PASSADO);
    // Presente é 110; o passado guarda os cem anteriores: 10..109.
    expect(h.passado[0]).toBe(10);
  });
});

describe('historico — gesto', () => {
  it('um arraste inteiro vira UMA entrada: desfazer volta para antes do arraste', () => {
    let h = registrar(iniciar('inicio'), 'marca-colocada');
    h = abrirGesto(h);
    // Cada movimento do mouse é uma mudança contínua.
    h = registrar(h, 'arrastando-1', { continuo: true });
    h = registrar(h, 'arrastando-2', { continuo: true });
    h = registrar(h, 'arrastando-3', { continuo: true });
    h = fecharGesto(h);

    expect(h.presente).toBe('arrastando-3');
    expect(desfazer(h).presente).toBe('marca-colocada');
    expect(desfazer(desfazer(h)).presente).toBe('inicio');
  });

  it('gesto aberto sem nenhuma mudança não deixa entrada (clique sem arrastar)', () => {
    let h = registrar(iniciar('a'), 'b');
    h = fecharGesto(abrirGesto(h));
    expect(h.passado.length).toBe(1);
    expect(desfazer(h).presente).toBe('a');
  });

  it('dois arrastes separados são duas entradas', () => {
    let h = iniciar('a');
    h = abrirGesto(h);
    h = registrar(h, 'arraste-1', { continuo: true });
    h = fecharGesto(h);
    h = abrirGesto(h);
    h = registrar(h, 'arraste-2', { continuo: true });
    h = fecharGesto(h);

    expect(desfazer(h).presente).toBe('arraste-1');
    expect(desfazer(desfazer(h)).presente).toBe('a');
  });

  it('mudança contínua SEM gesto aberto registra como discreta', () => {
    let h = iniciar('a');
    h = registrar(h, 'b', { continuo: true });
    h = registrar(h, 'c', { continuo: true });
    expect(desfazer(h).presente).toBe('b');
  });

  it('desfazer no meio de um gesto fecha o gesto', () => {
    let h = abrirGesto(registrar(iniciar('a'), 'b'));
    h = registrar(h, 'c', { continuo: true });
    h = desfazer(h);
    expect(h.gesto).toBe('fechado');
    expect(h.presente).toBe('b');
  });
});

describe('historico — fundir', () => {
  it('a segunda metade de uma ação composta se junta à primeira', () => {
    let h = iniciar('vazio');
    h = registrar(h, 'com-marca');
    h = registrar(h, 'com-marca-e-contorno', { fundir: true });
    expect(h.presente).toBe('com-marca-e-contorno');
    // Um Ctrl+Z remove os dois.
    expect(desfazer(h).presente).toBe('vazio');
  });

  it('fundir sem passado registra normalmente', () => {
    const h = registrar(iniciar('a'), 'b', { fundir: true });
    expect(desfazer(h).presente).toBe('a');
  });
});

describe('historico — recomecar', () => {
  it('esquece passado e futuro', () => {
    let h = registrar(registrar(iniciar('a'), 'b'), 'c');
    h = desfazer(h);
    h = recomecar('sessao-nova');
    expect(h.presente).toBe('sessao-nova');
    expect(podeDesfazer(h)).toBe(false);
    expect(podeRefazer(h)).toBe(false);
  });
});
