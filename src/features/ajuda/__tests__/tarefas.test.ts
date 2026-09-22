import { describe, it, expect } from 'vitest';
import { TAREFAS } from '../tarefas';

describe('ajuda por tarefa', () => {
  it('toda tarefa tem pergunta, porquê, passos e o que conferir', () => {
    expect(TAREFAS.length).toBeGreaterThanOrEqual(6);
    for (const t of TAREFAS) {
      expect(t.id).toMatch(/^[a-z-]+$/);
      expect(t.pergunta.trim().endsWith('?')).toBe(true);
      expect(t.porque.length).toBeGreaterThan(40);
      expect(t.passos.length).toBeGreaterThan(0);
      expect(t.confira.length).toBeGreaterThan(20);
    }
  });

  it('ids são únicos', () => {
    expect(new Set(TAREFAS.map((t) => t.id)).size).toBe(TAREFAS.length);
  });

  it('é conteúdo genérico: sem espécie de ninguém, sem nome de pessoa, sem instituição', () => {
    const texto = JSON.stringify(TAREFAS).toLowerCase();
    for (const proibido of ['cattleya', 'mayara', 'nelson', 'ceci', 'unoeste', 'universidade']) {
      expect(texto).not.toContain(proibido);
    }
  });

  it('a calibração conferida pede pelo menos três leituras — a regra do painel', () => {
    const calibrar = TAREFAS.find((t) => t.id === 'calibrar-conferido');
    expect(calibrar?.passos.some((p) => /três/.test(p.faca))).toBe(true);
  });
});
