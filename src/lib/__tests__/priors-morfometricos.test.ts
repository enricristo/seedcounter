import { describe, it, expect } from 'vitest';
import { PERFIS_BIOMETRICOS, compararComPerfil } from '../priors-morfometricos';
import { agregarPerfil, type MedidaDeUmObjeto } from '../perfil-medido';

describe('Priors Morfométricos e Gatilhos Lógicos', () => {
  it('deve conter as espécies catalogadas dos datasets tabulares', () => {
    expect(PERFIS_BIOMETRICOS).toHaveProperty('soja');
    expect(PERFIS_BIOMETRICOS).toHaveProperty('feijao');
    expect(PERFIS_BIOMETRICOS).toHaveProperty('arroz');
    expect(PERFIS_BIOMETRICOS).toHaveProperty('milho');
    expect(PERFIS_BIOMETRICOS).toHaveProperty('abobora');
    expect(PERFIS_BIOMETRICOS).toHaveProperty('orquidea');

    expect(PERFIS_BIOMETRICOS.feijao.solidezMedia).toBeGreaterThan(0.95);
    expect(PERFIS_BIOMETRICOS.arroz.aspectRatioMedio).toBeGreaterThan(2.5);
  });
});

describe('comparar com perfil de literatura — referencia, nao veredito', () => {
  it('dentro da faixa: sem nota', () => {
    const r = compararComPerfil({ solidez: 0.97, circularidade: 0.85 }, 'soja');
    expect(r.perfil?.id).toBe('soja');
    expect(r.solidezForaDaFaixa).toBe(false);
    expect(r.nota).toBe('');
  });

  it('fora da faixa: nota que NAO afirma aglomerado nem dano', () => {
    // A tabela vem de outro scanner e outra segmentacao. Ela orienta o olho;
    // quem decide aglomerado e o detector relativo a populacao da imagem.
    const r = compararComPerfil({ solidez: 0.7, circularidade: 0.85 }, 'soja');
    expect(r.solidezForaDaFaixa).toBe(true);
    expect(r.nota).toMatch(/literatura/i);
    expect(r.nota).not.toMatch(/aglomerado|quebrad|danific|impureza/i);
  });

  it('orquideia tem faixa larga por ter testa irregular', () => {
    const r = compararComPerfil({ solidez: 0.7, circularidade: 0.3 }, 'orquidea');
    expect(r.perfil?.contornoNaturalmenteIrregular).toBe(true);
    expect(r.solidezForaDaFaixa).toBe(false);
  });

  it('sem especie, sem perfil, sem nota', () => {
    const r = compararComPerfil({ solidez: 0.5, circularidade: 0.5 });
    expect(r.perfil).toBeNull();
    expect(r.nota).toBe('');
  });

  it('nao existe mais um "diagnostico" com veredito', async () => {
    const mod = await import('../priors-morfometricos');
    expect('diagnosticarContorno' in mod).toBe(false);
  });
});

describe('compararComPerfil prefere o perfil MEDIDO quando presente', () => {
  const medidas30 = (solidez: number): MedidaDeUmObjeto[] =>
    Array.from({ length: 30 }, () => ({
      caminho: 'x.jpg',
      classe: 'viavel',
      areaPx: 100,
      feretMaxPx: 12,
      feretMinPx: 8,
      solidez,
      razaoDeAspecto: 1.5,
    }));

  it('com perfil medido, ignora a espécie de literatura e usa a faixa medida', () => {
    const perfilMedido = agregarPerfil(medidas30(0.95));
    // 0,7 é normal para soja de literatura só se dentro da faixa; aqui a
    // faixa medida é bem mais estreita (tudo 0,95) — deve acusar fora.
    const r = compararComPerfil({ solidez: 0.7, circularidade: 0.85 }, 'soja', perfilMedido);
    expect(r.perfil).toBeNull();
    expect(r.perfilMedido).toBe(perfilMedido);
    expect(r.solidezForaDaFaixa).toBe(true);
    expect(r.nota).toMatch(/faixa medida/i);
  });

  it('sem perfil medido (undefined) continua caindo na literatura — chamada antiga não quebra', () => {
    const r = compararComPerfil({ solidez: 0.97, circularidade: 0.85 }, 'soja');
    expect(r.perfil?.id).toBe('soja');
    expect(r.perfilMedido).toBeUndefined();
  });

  it('perfil medido com n=0 não é usado — cai na literatura', () => {
    const vazio = agregarPerfil([]);
    const r = compararComPerfil({ solidez: 0.97, circularidade: 0.85 }, 'soja', vazio);
    expect(r.perfil?.id).toBe('soja');
  });
});
