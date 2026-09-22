import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { agruparPorCultura, metadadosDoExemplo, sufixoDaEscala, type CatalogoDeExemplos } from '../exemplos-reais';

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

  it('µm/px MEDIDO só na digitalização com régua auditada: 1864 px / 10 mm (DPI efetivo ≈ 4735), corrigido pela redução', () => {
    // A auditoria C3.2 (docs/datasets/auditoria-de-medida.md) mediu a régua do
    // próprio scanner e achou +31% sobre os 3600 DPI declarados. O valor
    // medido existe só onde foi medido, e o catálogo diz que é medido.
    const medidos = catalogo.exemplos.filter((e) => e.escalaDe === 'regua-medida');
    expect(medidos.length).toBeGreaterThan(0);
    for (const e of medidos) {
      const esperado = 10000 / 1864 / e.original.fatorDeReducao;
      expect(e.umPorPixel, e.slug).toBeCloseTo(esperado, 3);
      expect(e.conjunto, e.slug).toBe('gpeorq-scan');
    }
  });

  it('DPI declarado vira escala INICIAL só nas digitalizações do laboratório, e cada uma diz que é declaração', () => {
    // Todo exemplo com escala declara de onde ela veio; quem não tem escala
    // não tem origem de escala. O DPI declarado (cabeçalho do arquivo) é a
    // mesma postura do painel de calibração: parte do DPI, confere na régua.
    const declarados = catalogo.exemplos.filter((e) => e.escalaDe === 'dpi-declarado');
    expect(declarados.length).toBeGreaterThan(0);
    for (const e of declarados) {
      expect(e.dpiDeclarado, e.slug).toBeGreaterThan(0);
      expect(e.tipo, e.slug).toBe('digitalizacao');
      expect(e.umPorPixel, e.slug).toBeCloseTo(25400 / (e.dpiDeclarado ?? 1) / e.original.fatorDeReducao, 3);
      expect(e.notaEscala, e.slug).toMatch(/declara/i);
    }
    for (const e of catalogo.exemplos) {
      expect(e.umPorPixel != null, e.slug).toBe(e.escalaDe != null);
    }
    // Um PNG com "96 dpi" gravado por editor de imagem também declara DPI; isso NÃO vira escala.
    const tig = catalogo.exemplos.find((e) => e.conjunto === 'gpeorq-tig');
    expect(tig?.dpiDeclarado).toBe(96);
    expect(tig?.escalaDe).toBeNull();
    expect(sufixoDaEscala({ umPorPixel: 1, escalaDe: 'regua-medida' })).toBe(' · escala medida');
    expect(sufixoDaEscala({ umPorPixel: 1, escalaDe: 'dpi-declarado' })).toBe(' · DPI declarado');
    expect(sufixoDaEscala({ umPorPixel: null, escalaDe: null })).toBe('');
  });

  it('tem dezenas de casos de tetrazólio em orquídea, com legenda de uma linha e sem nome de gente nem de instituição', () => {
    const tz = catalogo.exemplos.filter((e) => e.cultura === 'orquidea');
    expect(tz.length).toBeGreaterThanOrEqual(40);
    const dezEspecies = catalogo.exemplos.filter((e) => e.conjunto === 'tz-10especies');
    expect(dezEspecies.map((e) => e.original.pagina)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const e of tz) {
      expect(e.dica.includes('\n'), e.slug).toBe(false);
      expect(e.dica.length, e.slug).toBeLessThanOrEqual(120);
      // Subpasta com nome de quem digitalizou não entra: só `subpasta-N` ou termo técnico.
      expect(e.original.arquivo, e.slug).not.toMatch(/(^|\/)tz [a-z]/i);
      expect(`${e.rotulo} ${e.dica} ${e.origem}`, e.slug).not.toMatch(/universidade|university|univ\./i);
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
