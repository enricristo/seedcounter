import { describe, it, expect } from 'vitest';
import { classesPorPasta } from '../pasta-por-classe';

describe('classesPorPasta', () => {
  it('raiz/<classe>/<img> vira classe → imagens', () => {
    const m = classesPorPasta(['sadia/1.jpg', 'sadia/2.jpg', 'mofada/3.jpg', 'README.md']);
    expect([...m!.keys()].sort()).toEqual(['mofada', 'sadia']);
    expect(m!.get('sadia')).toHaveLength(2);
  });
  it('só uma subpasta, ou imagens soltas na raiz, não é pasta-por-classe', () => {
    expect(classesPorPasta(['a/1.jpg', 'a/2.jpg'])).toBeNull();
    expect(classesPorPasta(['a/1.jpg', 'b/2.jpg', '3.jpg'])).toBeNull();
  });
});
