import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { agruparPorCultura, metadadosDoExemplo, type CatalogoDeExemplos } from '../exemplos-reais';

const PUBLIC = join(__dirname, '..', '..', '..', '..', 'public');
const catalogo = JSON.parse(readFileSync(join(PUBLIC, 'exemplos', 'catalogo.json'), 'utf8')) as CatalogoDeExemplos;

/** Lê largura e altura do cabeçalho PNG (assinatura + IHDR), sem decodificar. */
function dimensoesPng(caminho: string): [number, number] {
  const b = readFileSync(caminho);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('catálogo de exemplos reais', () => {
  it('tem dezenas de exemplos, de várias culturas', () => {
    expect(catalogo.exemplos.length).toBeGreaterThanOrEqual(40);
    const culturas = new Set(catalogo.exemplos.map((e) => e.cultura));
    expect(culturas.size).toBeGreaterThanOrEqual(6);
  });

  it('todo exemplo aponta para um PNG que existe, com as dimensões declaradas, ≤ 1,5 MB e lado ≤ 1024', () => {
    for (const e of catalogo.exemplos) {
      const caminho = join(PUBLIC, e.imagem);
      expect(existsSync(caminho), e.slug).toBe(true);
      expect(statSync(caminho).size, e.slug).toBeLessThanOrEqual(1_500_000);
      const [w, h] = dimensoesPng(caminho);
      expect([w, h], e.slug).toEqual([e.largura, e.altura]);
      expect(Math.max(w, h), e.slug).toBeLessThanOrEqual(1024);
    }
  });

  it('slugs são únicos e toda entrada declara origem e licença (texto, não vazio)', () => {
    const slugs = catalogo.exemplos.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const e of catalogo.exemplos) {
      expect(e.origem.length, e.slug).toBeGreaterThan(3);
      expect(e.licenca.length, e.slug).toBeGreaterThan(3);
    }
  });

  it('só a digitalização com régua auditada tem µm/px: 1864 px / 10 mm (DPI efetivo ≈ 4735), corrigido pela redução', () => {
    // A auditoria C3.2 (docs/datasets/auditoria-de-medida.md) mediu a régua do
    // próprio scanner e achou +31% sobre os 3600 DPI declarados. O catálogo
    // NÃO usa o DPI declarado; usa o medido — e só onde foi medido.
    const comEscala = catalogo.exemplos.filter((e) => e.umPorPixel != null);
    expect(comEscala.length).toBeGreaterThan(0);
    for (const e of comEscala) {
      const esperado = 10000 / 1864 / e.original.fatorDeReducao;
      expect(e.umPorPixel, e.slug).toBeCloseTo(esperado, 3);
      expect(e.conjunto, e.slug).toBe('gpeorq-scan');
    }
  });

  it('os metadados propostos preenchem espécie, origem e escala só quando conhecida', () => {
    const scan = catalogo.exemplos.find((e) => e.conjunto === 'gpeorq-scan')!;
    const m = metadadosDoExemplo(scan);
    expect(m.umPerPixel).toBeGreaterThan(0);
    expect(m.amostra?.especieNomeComum).toBe('Orquídea');
    expect(m.notes).toContain('Origem');
    const semEscala = catalogo.exemplos.find((e) => e.umPorPixel == null)!;
    expect(metadadosDoExemplo(semEscala).umPerPixel).toBeUndefined();
  });

  it('agrupa por cultura mantendo a ordem do catálogo', () => {
    const grupos = agruparPorCultura(catalogo.exemplos);
    expect(grupos[0].cultura).toBe('orquidea');
    expect(grupos.reduce((n, g) => n + g.exemplos.length, 0)).toBe(catalogo.exemplos.length);
  });
});
