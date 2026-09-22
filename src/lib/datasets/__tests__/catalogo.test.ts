import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerCatalogo, lerEntrada, entradaPorNome, resumirOrigem } from '../catalogo';

/**
 * Trecho REAL de `public/exemplos/catalogo-de-datasets.json` (gerado por
 * `scripts/gerar-catalogo-de-datasets.py`), copiado aqui para o teste não
 * depender de a pasta `datasets/` existir na máquina de quem roda.
 */
const TRECHO_REAL = {
  versao: 1,
  geradoPor: 'scripts/gerar-catalogo-de-datasets.py',
  raiz: 'datasets/',
  entradas: [
    {
      nome: 'Sementes de Orquideas',
      caminhoRelativo: 'Sementes de Orquideas',
      formatoDetectado: 'yolo',
      imagens: { total: 685, porExtensao: { '.jpg': 751, '.png': 21 } },
      outrosArquivos: { '.cache': 3, '.csv': 1, '.pt': 2, '.txt': 738, '.yaml': 3 },
      anotacoes: ['poligonos', 'classes (data.yaml)', 'planilha'],
      classes: ['inviavel', 'viavel'],
      cultura: 'Orquídeas (Epidendrum)',
      culturaChave: 'orquidea',
      origem: 'Roboflow Universe (sementes-de-orquideas/v8) / Projeto de Pesquisa (TCC).',
      url: 'https://universe.roboflow.com/sementes-de-orqudea/sementes-de-orquideas',
      licenca: 'CC BY 4.0',
      citacao: null,
      podeSerReferenciado: true,
      usoNoSeedCounter: 'Viabilidade por Tetrazólio (viavel vs inviavel). Detecção direta de embriões corados.',
      segundoReadme: { formato: 'YOLOv8 Bounding Boxes (data.yaml, labels .txt)', quantidade: '772 imagens / 738 labels' },
      tamanhoBytes: 288926692,
      dpiDeclarado: { amostradas: 5, valores: { sem: 5 } },
      formatoDaSubpasta: null,
      observacoes: ['YOLO: índice 0 = inviavel, 1 = viavel (ver src/lib/classe-do-modelo.ts)'],
      fonteDoCampo: { cultura: 'README', origem: 'README', licenca: 'pasta', citacao: 'heuristica', usoNoSeedCounter: 'README' },
    },
    {
      nome: 'Orq_lab_semente',
      caminhoRelativo: 'Orq_lab_semente',
      formatoDetectado: 'solto',
      imagens: { total: 98, porExtensao: { '.jpg': 94, '.tif': 4 } },
      outrosArquivos: {},
      anotacoes: [],
      classes: [],
      cultura: 'Orquídea',
      culturaChave: 'orquidea',
      origem: 'laboratório',
      url: null,
      licenca: 'desconhecida',
      citacao: null,
      podeSerReferenciado: false,
      usoNoSeedCounter: null,
      segundoReadme: null,
      tamanhoBytes: 5145727634,
      dpiDeclarado: { amostradas: 5, valores: { '4800': 5 } },
      formatoDaSubpasta: null,
      observacoes: ['nomes de subpasta omitidos de propósito (pasta do laboratório)'],
      fonteDoCampo: { cultura: 'heuristica', origem: 'heuristica', licenca: 'heuristica', citacao: 'heuristica', usoNoSeedCounter: 'heuristica' },
    },
    {
      nome: 'maize-seed-dataset',
      formatoDetectado: 'solto',
      licenca: 'desconhecida',
      podeSerReferenciado: false,
      origem: 'Kaggle (yungprof123/maize-seed-dataset).',
      formatoDaSubpasta: { subpasta: 'MaizeData', formato: 'pasta-por-classe', classes: ['Bhihilifa', 'SanzalSima', 'WangDataa'] },
      fonteDoCampo: { origem: 'README', licenca: 'heuristica' },
    },
  ],
};

describe('lerCatalogo — trecho do JSON real', () => {
  const catalogo = lerCatalogo(TRECHO_REAL);

  it('lê as três entradas com os campos que o script grava', () => {
    expect(catalogo.versao).toBe(1);
    expect(catalogo.entradas.map((e) => e.nome)).toEqual(['Sementes de Orquideas', 'Orq_lab_semente', 'maize-seed-dataset']);
    const orq = catalogo.entradas[0];
    expect(orq.formatoDetectado).toBe('yolo');
    expect(orq.classes).toEqual(['inviavel', 'viavel']);
    expect(orq.imagens).toEqual({ total: 685, porExtensao: { '.jpg': 751, '.png': 21 } });
    expect(orq.licenca).toBe('CC BY 4.0');
    expect(orq.podeSerReferenciado).toBe(true);
    expect(orq.fonteDoCampo).toEqual({ cultura: 'README', origem: 'README', licenca: 'pasta', citacao: 'heuristica', usoNoSeedCounter: 'README' });
    expect(orq.dpiDeclarado).toEqual({ amostradas: 5, valores: { sem: 5 } });
  });

  it('null no JSON vira undefined, não string "null"', () => {
    const lab = catalogo.entradas[1];
    expect(lab.citacao).toBeUndefined();
    expect(lab.url).toBeUndefined();
    expect(lab.usoNoSeedCounter).toBeUndefined();
    expect(lab.segundoReadme).toBeUndefined();
    expect(lab.formatoDaSubpasta).toBeUndefined();
    expect(lab.licenca).toBe('desconhecida');
    expect(lab.podeSerReferenciado).toBe(false);
    expect(lab.origem).toBe('laboratório');
  });

  it('lê a subpasta que muda o formato (milho: raiz solta, MaizeData por classe)', () => {
    const milho = catalogo.entradas[2];
    expect(milho.formatoDaSubpasta).toEqual({ subpasta: 'MaizeData', formato: 'pasta-por-classe', classes: ['Bhihilifa', 'SanzalSima', 'WangDataa'] });
    // Campos ausentes na entrada ganham o valor "não sei", não derrubam a leitura.
    expect(milho.imagens).toEqual({ total: 0, porExtensao: {} });
    expect(milho.anotacoes).toEqual([]);
    expect(milho.caminhoRelativo).toBe('maize-seed-dataset');
  });

  it('campo inesperado é ignorado; tipo errado vira undefined ou o valor "não sei"', () => {
    const e = lerEntrada({
      nome: 'x',
      campoQueOScriptAindaNaoGrava: 42,
      formatoDetectado: 'formato-inventado',
      imagens: 'muitas',
      classes: 'a,b',
      tamanhoBytes: '1 GB',
      licenca: 7,
      origem: ['url'],
      dpiDeclarado: { valores: { '4800': 1 } },
      fonteDoCampo: { origem: 'chute', licenca: 'pasta', outro: 'README' },
      podeSerReferenciado: 'sim',
    });
    expect(e).not.toBeNull();
    if (!e) return;
    expect('campoQueOScriptAindaNaoGrava' in e).toBe(false);
    expect(e.formatoDetectado).toBe('desconhecido');
    expect(e.imagens).toEqual({ total: 0, porExtensao: {} });
    expect(e.classes).toEqual([]);
    expect(e.tamanhoBytes).toBeUndefined();
    expect(e.licenca).toBe('desconhecida');
    expect(e.origem).toBeUndefined();
    expect(e.dpiDeclarado).toBeUndefined(); // sem `amostradas` não se sabe quantos arquivos foram lidos
    expect(e.fonteDoCampo).toEqual({ licenca: 'pasta' });
    expect(e.podeSerReferenciado).toBe(false);
  });

  it('não aceita "referenciável" com licença desconhecida ou origem deduzida, mesmo que o JSON diga que sim', () => {
    const base = { nome: 'y', origem: 'https://exemplo.org/x', fonteDoCampo: { origem: 'pasta' } };
    expect(lerEntrada({ ...base, licenca: 'CC BY 4.0', podeSerReferenciado: true })?.podeSerReferenciado).toBe(true);
    expect(lerEntrada({ ...base, licenca: 'desconhecida', podeSerReferenciado: true })?.podeSerReferenciado).toBe(false);
    expect(
      lerEntrada({ ...base, licenca: 'CC BY 4.0', podeSerReferenciado: true, fonteDoCampo: { origem: 'heuristica' } })?.podeSerReferenciado
    ).toBe(false);
  });

  it('entrada sem nome é descartada; JSON que não é catálogo vira catálogo vazio', () => {
    expect(lerCatalogo({ versao: 1, entradas: [{ formatoDetectado: 'yolo' }, { nome: '' }, null, 'x'] }).entradas).toEqual([]);
    expect(lerCatalogo(null)).toEqual({ versao: 0, entradas: [] });
    expect(lerCatalogo('texto')).toEqual({ versao: 0, entradas: [] });
    expect(lerCatalogo({ entradas: 'não é lista' })).toEqual({ versao: 0, entradas: [] });
  });

  it('entradaPorNome: exato primeiro, depois sem diferenciar caixa nem espaço nas pontas', () => {
    expect(entradaPorNome(catalogo, 'Orq_lab_semente')?.nome).toBe('Orq_lab_semente');
    expect(entradaPorNome(catalogo, ' orq_LAB_semente ')?.nome).toBe('Orq_lab_semente');
    expect(entradaPorNome(catalogo, 'nao-existe')).toBeUndefined();
  });

  it('resumirOrigem: URL vira domínio, texto curto passa, texto longo é cortado', () => {
    expect(resumirOrigem({ origem: 'https://www.kaggle.com/datasets/lucasiturriago/seeds', url: undefined })).toBe('kaggle.com');
    expect(resumirOrigem({ origem: undefined, url: 'https://doi.org/10.1038/x' })).toBe('doi.org');
    expect(resumirOrigem({ origem: 'laboratório', url: undefined })).toBe('laboratório');
    expect(resumirOrigem({ origem: undefined, url: undefined })).toBe('origem desconhecida');
    const longa = resumirOrigem({ origem: 'Roboflow Universe (sementes-de-orquideas/v8) / Projeto de Pesquisa (TCC).', url: undefined });
    expect(longa.length).toBeLessThanOrEqual(48);
    expect(longa.endsWith('…')).toBe(true);
  });
});

describe('o catálogo publicado em public/exemplos', () => {
  const caminho = join(__dirname, '..', '..', '..', '..', 'public', 'exemplos', 'catalogo-de-datasets.json');
  const catalogo = lerCatalogo(JSON.parse(readFileSync(caminho, 'utf8')));

  it('lê todas as pastas catalogadas, e toda "referenciável" tem origem lida e licença escrita', () => {
    expect(catalogo.entradas.length).toBeGreaterThanOrEqual(20);
    const referenciaveis = catalogo.entradas.filter((e) => e.podeSerReferenciado);
    expect(referenciaveis.length).toBeGreaterThanOrEqual(1);
    for (const e of referenciaveis) {
      expect(e.licenca, e.nome).not.toBe('desconhecida');
      expect(['README', 'pasta']).toContain(e.fonteDoCampo.origem);
    }
    // O conjunto que treinou o modelo embarcado precisa continuar referenciável.
    expect(entradaPorNome(catalogo, 'Sementes de Orquideas')?.podeSerReferenciado).toBe(true);
  });

  it('as pastas do laboratório não expõem nomes de subpasta', () => {
    for (const nome of ['Orq_lab_semente', 'nelson_phd_images_orquid_enrico', 'images']) {
      const e = entradaPorNome(catalogo, nome);
      expect(e, nome).toBeDefined();
      expect(e?.classes, nome).toEqual([]);
      expect(e?.formatoDaSubpasta?.subpasta, nome).toBeUndefined();
    }
  });
});
