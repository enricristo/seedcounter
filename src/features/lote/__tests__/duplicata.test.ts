import { describe, it, expect } from 'vitest';
import { ehDuplicata } from '../duplicata';
import type { Session, Metadata } from '../../../types';

const metadataVazia: Metadata = {
  researcher: '',
  project: '',
  treatment: '',
  plate: '',
  quadrant: '',
  notes: '',
};

function sessao(id: string, filename: string, date: string): Session {
  return { id, date, filename, viableCount: 0, inviableCount: 0, metadata: metadataVazia };
}

describe('ehDuplicata', () => {
  it('sem sessões: nunca é duplicata', () => {
    expect(ehDuplicata('placa1.jpg', [])).toEqual([]);
  });

  it('nome de arquivo diferente: não é duplicata', () => {
    const sessoes = [sessao('1', 'placa2.jpg', '2026-09-01T10:00:00.000Z')];
    expect(ehDuplicata('placa1.jpg', sessoes)).toEqual([]);
  });

  it('mesmo nome de arquivo: acha a sessão existente', () => {
    const existente = sessao('1', 'placa1.jpg', '2026-09-01T10:00:00.000Z');
    expect(ehDuplicata('placa1.jpg', [existente])).toEqual([existente]);
  });

  it('duas sessões legítimas com o mesmo nome (contagens em dias diferentes): as duas voltam, mais recente primeiro', () => {
    const antiga = sessao('1', 'placa1.jpg', '2026-09-10T10:00:00.000Z');
    const recente = sessao('2', 'placa1.jpg', '2026-09-15T10:00:00.000Z');
    expect(ehDuplicata('placa1.jpg', [antiga, recente])).toEqual([recente, antiga]);
  });

  it('não confunde nomes parecidos (comparação é exata)', () => {
    const sessoes = [sessao('1', 'placa1.jpg.bak', '2026-09-01T10:00:00.000Z')];
    expect(ehDuplicata('placa1.jpg', sessoes)).toEqual([]);
  });
});
