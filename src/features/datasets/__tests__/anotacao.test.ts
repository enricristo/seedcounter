import { describe, it, expect } from 'vitest';
import { lerAnotacaoDe } from '../anotacao';
import { reconhecerFormato } from '../../../lib/datasets/formato';
import type { ArquivoDoDataset } from '../fonte';

/**
 * Fonte falsa em memória: cada entrada vira um `File` de verdade (o Vitest
 * roda em jsdom/happy-dom, que tem `File`/`Blob`), então `arquivo.obterFile()`
 * e `file.text()` funcionam sem tocar disco.
 */
function fonteFalsa(arquivos: Record<string, string>): Map<string, ArquivoDoDataset> {
  const mapa = new Map<string, ArquivoDoDataset>();
  for (const [caminho, texto] of Object.entries(arquivos)) {
    const nome = caminho.split('/').pop() ?? caminho;
    mapa.set(caminho, { caminho, obterFile: () => Promise.resolve(new File([texto], nome)) });
  }
  return mapa;
}

describe('lerAnotacaoDe', () => {
  it('yolo caixa: rótulo de 5 valores vira marca no centro, com a classe do data.yaml', async () => {
    const arquivos = fonteFalsa({
      'data.yaml': "names: ['trigo']\n",
      'train/images/a.jpg': '',
      'train/labels/a.txt': '0 0.5 0.5 0.2 0.1\n',
    });
    const reconhecido = reconhecerFormato(['data.yaml', 'train/images/a.jpg', 'train/labels/a.txt']);
    const r = await lerAnotacaoDe(arquivos, reconhecido, 'train/images/a.jpg', 1000, 800);
    expect(r).not.toBeNull();
    expect(r!.contornos).toBeUndefined();
    expect(r!.marcas).toEqual([{ x: 500, y: 400, classe: 'trigo' }]);
    expect(r!.classes).toEqual(['trigo']);
  });

  it('yolo polígono: rótulo com 7+ valores ímpares vira contorno, com a classe do data.yaml (conjunto de orquídeas)', async () => {
    const linha =
      '1 0.5112431289640592 0.03574841437632135 0.5024027484143764 0.0765507399577167 0.5062463002114165 0.12884355179704016';
    const arquivos = fonteFalsa({
      'data.yaml': "names: ['inviavel', 'viavel']\n",
      'train/images/b.jpg': '',
      'train/labels/b.txt': linha,
    });
    const reconhecido = reconhecerFormato(['data.yaml', 'train/images/b.jpg', 'train/labels/b.txt']);
    const r = await lerAnotacaoDe(arquivos, reconhecido, 'train/images/b.jpg', 640, 640);
    expect(r).not.toBeNull();
    expect(r!.marcas).toBeUndefined();
    expect(r!.contornos).toHaveLength(1);
    expect(r!.contornos![0].classe).toBe('viavel');
    expect(r!.contornos![0].poligono).toHaveLength(3);
    expect(r!.classes).toEqual(['inviavel', 'viavel']);
  });

  it('yolo sem .txt pareado devolve null (nada para carregar)', async () => {
    const arquivos = fonteFalsa({ 'data.yaml': 'names: []\n', 'train/images/c.jpg': '' });
    const reconhecido = reconhecerFormato(['data.yaml', 'train/images/c.jpg']);
    const r = await lerAnotacaoDe(arquivos, reconhecido, 'train/images/c.jpg', 100, 100);
    expect(r).toBeNull();
  });

  it('multiclasse: classes da imagem vêm do _classes.csv da mesma pasta (conjunto de amendoim)', async () => {
    const arquivos = fonteFalsa({
      'train/_classes.csv': 'filename, with mold, without mold\nA.jpg, 0, 1\nB.jpg, 1, 0\n',
      'train/A.jpg': '',
      'train/B.jpg': '',
    });
    const reconhecido = reconhecerFormato(['train/_classes.csv', 'train/A.jpg', 'train/B.jpg']);
    const rA = await lerAnotacaoDe(arquivos, reconhecido, 'train/A.jpg', 100, 100);
    const rB = await lerAnotacaoDe(arquivos, reconhecido, 'train/B.jpg', 100, 100);
    expect(rA).toEqual({ classesDaImagem: ['without mold'], classes: ['with mold', 'without mold'] });
    expect(rB).toEqual({ classesDaImagem: ['with mold'], classes: ['with mold', 'without mold'] });
  });

  it('pasta-por-classe: a classe é o primeiro segmento do caminho, sem ler arquivo nenhum', async () => {
    const arquivos = fonteFalsa({});
    const reconhecido = reconhecerFormato(['sadia/1.jpg', 'mofada/2.jpg']);
    const r = await lerAnotacaoDe(arquivos, reconhecido, 'sadia/1.jpg', 100, 100);
    expect(r).toEqual({ classesDaImagem: ['sadia'], classes: ['mofada', 'sadia'] });
  });

  it('solto: sem anotação nenhuma, devolve null', async () => {
    const arquivos = fonteFalsa({});
    const reconhecido = reconhecerFormato(['1.jpg', '2.png']);
    const r = await lerAnotacaoDe(arquivos, reconhecido, '1.jpg', 100, 100);
    expect(r).toBeNull();
  });
});
