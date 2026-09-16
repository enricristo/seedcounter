import { describe, it, expect } from 'vitest';
import { lerClassesCsv } from '../roboflow-multiclass';

describe('lerClassesCsv', () => {
  it('cabeçalho com espaços e one-hot (formato do conjunto de amendoim)', () => {
    const csv = 'filename, with mold, without mold\nA.jpg, 0, 1\nB.jpg, 1, 0\n';
    const r = lerClassesCsv(csv);
    expect(r.classes).toEqual(['with mold', 'without mold']);
    expect(r.porImagem.get('A.jpg')).toEqual(['without mold']);
    expect(r.porImagem.get('B.jpg')).toEqual(['with mold']);
  });
  it('imagem com duas classes marcadas devolve as duas', () => {
    const r = lerClassesCsv('filename,a,b\nX.png,1,1\n');
    expect(r.porImagem.get('X.png')).toEqual(['a', 'b']);
  });
});
