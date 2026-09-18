import { describe, it, expect } from 'vitest';
import {
  iniciarCronometro,
  registrarInteracao,
  pausar,
  retomar,
  declararModo,
  lerTempo,
  formatarTempo,
  segundosPorObjeto,
  OCIOSO_APOS_MS,
} from '../cronometro-de-analise';

const T0 = 1_000_000;
const s = (n: number) => T0 + n * 1000;

describe('cronômetro de análise', () => {
  it('conta o tempo entre interações seguidas', () => {
    let c = iniciarCronometro('manual');
    c = registrarInteracao(c, s(0));
    c = registrarInteracao(c, s(10));
    c = registrarInteracao(c, s(20));
    expect(lerTempo(c, s(20)).ativoMs).toBe(20_000);
  });

  it('para de contar quando a janela some', () => {
    let c = iniciarCronometro();
    c = registrarInteracao(c, s(0));
    c = pausar(c, s(30));
    // Trinta segundos depois de pausar, o tempo ativo não mudou.
    expect(lerTempo(c, s(60)).ativoMs).toBe(30_000);
  });

  it('voltar para a aba NÃO religa o relógio — presença não é trabalho', () => {
    let c = iniciarCronometro();
    c = registrarInteracao(c, s(0));
    c = pausar(c, s(10));
    c = retomar(c, s(600));
    // Só olhou a tela por dez minutos: continuam dez segundos de trabalho.
    expect(lerTempo(c, s(1200)).ativoMs).toBe(10_000);
  });

  it('apara o trecho no limite do ocioso: aba aberta a noite toda não vira análise', () => {
    let c = iniciarCronometro();
    c = registrarInteracao(c, s(0));
    // Ninguém mexe em nada por quatro horas, e só então a aba perde o foco.
    const quatroHoras = s(4 * 3600);
    c = pausar(c, quatroHoras);
    // Vale o minuto do ocioso, não as quatro horas.
    expect(lerTempo(c, quatroHoras).ativoMs).toBe(OCIOSO_APOS_MS);
  });

  it('religa na interação seguinte, sem cobrar o intervalo ocioso', () => {
    let c = iniciarCronometro();
    c = registrarInteracao(c, s(0));
    c = registrarInteracao(c, s(30)); // 30 s de trabalho
    c = registrarInteracao(c, s(30 + 600)); // dez minutos de café
    c = registrarInteracao(c, s(30 + 600 + 15)); // mais 15 s de trabalho

    const t = lerTempo(c, s(30 + 600 + 15));
    // 30 s + o minuto aparado do ocioso + 15 s. O café não entra.
    expect(t.ativoMs).toBe(30_000 + OCIOSO_APOS_MS + 15_000);
    // E o tempo de parede conta tudo, porque é outra pergunta.
    expect(t.paredeMs).toBe(645_000);
    expect(t.aproveitamento!).toBeLessThan(0.25);
  });

  it('o modo é declarado e viaja junto do tempo', () => {
    let c = iniciarCronometro('manual');
    c = registrarInteracao(c, s(0));
    expect(lerTempo(c, s(5)).modo).toBe('manual');
    c = declararModo(c, 'assistida');
    expect(lerTempo(c, s(5)).modo).toBe('assistida');
  });

  it('ler o tempo não altera o estado — pode ser chamado a cada quadro', () => {
    let c = iniciarCronometro();
    c = registrarInteracao(c, s(0));
    const antes = { ...c };
    lerTempo(c, s(999));
    expect(c).toEqual(antes);
  });

  it('cronômetro recém-criado não inventa tempo', () => {
    const t = lerTempo(iniciarCronometro(), s(5000));
    expect(t.ativoMs).toBe(0);
    expect(t.paredeMs).toBe(0);
    expect(t.aproveitamento).toBeNull();
  });
});

describe('formatarTempo', () => {
  it('usa m:ss abaixo de uma hora e h:mm:ss acima', () => {
    expect(formatarTempo(0)).toBe('0:00');
    expect(formatarTempo(65_000)).toBe('1:05');
    expect(formatarTempo(3_600_000)).toBe('1:00:00');
    expect(formatarTempo(3_725_000)).toBe('1:02:05');
  });
});

describe('segundosPorObjeto', () => {
  it('é o número que compara dois braços da validação', () => {
    // 47 min para 900 sementes contra 11 min para as mesmas 900.
    expect(segundosPorObjeto(47 * 60_000, 900)!).toBeCloseTo(3.13, 2);
    expect(segundosPorObjeto(11 * 60_000, 900)!).toBeCloseTo(0.73, 2);
  });

  it('recusa dividir por zero em vez de responder Infinity', () => {
    expect(segundosPorObjeto(60_000, 0)).toBeNull();
  });
});
