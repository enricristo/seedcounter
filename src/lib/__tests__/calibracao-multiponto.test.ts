import { describe, it, expect } from 'vitest';
import { escalaDaLeitura, calibrarPorReferencia } from '../calibracao-multiponto';

describe('escalaDaLeitura', () => {
  it('converte milímetros e pixels em micrômetros por pixel', () => {
    // 10 mm em 1000 px = 10 µm/px.
    expect(escalaDaLeitura({ referenciaMm: 10, pixels: 1000 })).toBeCloseTo(10, 9);
  });

  it('recusa leitura sem tamanho ou sem pixels', () => {
    expect(escalaDaLeitura({ referenciaMm: 0, pixels: 1000 })).toBeNull();
    expect(escalaDaLeitura({ referenciaMm: 10, pixels: 0 })).toBeNull();
  });
});

describe('calibrarPorReferencia', () => {
  it('reencena a auditoria real: 10 mm em 1864 px dá ~4735 DPI, não os 3600 declarados', () => {
    const r = calibrarPorReferencia([{ referenciaMm: 10, pixels: 1864 }], 3600)!;
    expect(Math.round(r.dpiMedido)).toBe(4735);
    // O declarado é MENOR que o medido — por isso a diferença é negativa.
    expect(r.diferencaDoDeclaradoPercent!).toBeLessThan(0);
    // Uma leitura só nunca passa sem alerta, por mais certa que esteja.
    expect(r.alerta).toMatch(/uma leitura/i);
  });

  it('com leituras concordantes, aprova e calcula o CV', () => {
    const r = calibrarPorReferencia([
      { referenciaMm: 10, pixels: 1864 },
      { referenciaMm: 10, pixels: 1866 },
      { referenciaMm: 10, pixels: 1863 },
    ])!;
    expect(r.n).toBe(3);
    expect(r.cvPercent!).toBeLessThan(0.2);
    expect(r.alerta).toBeUndefined();
    expect(r.veredito).toMatch(/CV/);
  });

  it('reprova quando as leituras discordam entre si', () => {
    const r = calibrarPorReferencia([
      { referenciaMm: 10, pixels: 1800 },
      { referenciaMm: 10, pixels: 1900 },
      { referenciaMm: 10, pixels: 2000 },
    ])!;
    expect(r.cvPercent!).toBeGreaterThan(1);
    expect(r.alerta).toMatch(/discordam/i);
  });

  it('denuncia escala que muda ao longo do campo — o que um ponto só esconde', () => {
    // Escala crescendo monotonicamente com x: não é ruído, é tendência.
    const r = calibrarPorReferencia([
      { referenciaMm: 10, pixels: 1900, x: 100, y: 500 },
      { referenciaMm: 10, pixels: 1880, x: 2000, y: 500 },
      { referenciaMm: 10, pixels: 1860, x: 4000, y: 500 },
      { referenciaMm: 10, pixels: 1840, x: 6000, y: 500 },
    ])!;
    expect(Math.abs(r.tendenciaEmX!)).toBeGreaterThan(0.9);
    expect(r.alerta).toMatch(/horizontal/i);
  });

  it('não inventa tendência quando todas as leituras estão no mesmo ponto', () => {
    const r = calibrarPorReferencia([
      { referenciaMm: 10, pixels: 1864, x: 500, y: 500 },
      { referenciaMm: 10, pixels: 1865, x: 500, y: 500 },
      { referenciaMm: 10, pixels: 1863, x: 500, y: 500 },
    ])!;
    // Sem variação em x, a correlação não existe — e null é a verdade, não 0.
    expect(r.tendenciaEmX).toBeNull();
  });

  it('avisa quando o declarado diverge do medido, dizendo que o erro é sistemático', () => {
    // Medido ~4800 DPI; declarado 3200.
    const r = calibrarPorReferencia(
      [
        { referenciaMm: 10, pixels: 1890 },
        { referenciaMm: 10, pixels: 1889 },
        { referenciaMm: 10, pixels: 1891 },
      ],
      3200
    )!;
    expect(r.alerta).toMatch(/sistem[áa]tico/i);
    expect(r.alerta).toMatch(/MENOR/);
  });

  it('devolve null quando nenhuma leitura é aproveitável', () => {
    expect(calibrarPorReferencia([{ referenciaMm: 0, pixels: 0 }])).toBeNull();
    expect(calibrarPorReferencia([])).toBeNull();
  });
});
