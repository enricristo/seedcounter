// =============================================================================
// Gerador de dados de demonstração.
//
// O que estes testes protegem não é "o número está certo" — é simulação, não
// existe número certo. É que a simulação não produza coisa IMPOSSÍVEL (curva
// de germinação acumulada que desce, tetrazólio acusando menos vivas do que
// germinaram, contagem negativa) e que nada saia sem a marca de simulado.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  AVISO_DEMO,
  PREFIXO_DEMO,
  criarRng,
  ehDemonstracao,
  gerarDadosDeDemonstracao,
  germinacaoLogistica,
  phi,
  respostaAoPotencial,
  resumirDemonstracao,
  viabilidadeNoArmazenamento,
} from '../synthetic-data';

const AGORA = new Date(2026, 8, 3, 10, 0);
const conjunto = gerarDadosDeDemonstracao({ semente: 42, agora: AGORA });

describe('reprodutibilidade', () => {
  it('a mesma semente devolve o mesmo conjunto', () => {
    const a = gerarDadosDeDemonstracao({ semente: 7, agora: AGORA });
    const b = gerarDadosDeDemonstracao({ semente: 7, agora: AGORA });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('sementes diferentes devolvem conjuntos diferentes', () => {
    const a = gerarDadosDeDemonstracao({ semente: 7, agora: AGORA });
    const b = gerarDadosDeDemonstracao({ semente: 8, agora: AGORA });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('carregar duas vezes sobrescreve em vez de duplicar', () => {
    // Os ids são estáveis, então bulkPut atualiza os mesmos registros.
    const a = gerarDadosDeDemonstracao({ semente: 7, agora: AGORA });
    const b = gerarDadosDeDemonstracao({ semente: 7, agora: AGORA });
    expect(a.sessoes.map((s) => s.id)).toEqual(b.sessoes.map((s) => s.id));
    expect(new Set(a.sessoes.map((s) => s.id)).size).toBe(a.sessoes.length);
  });

  it('o rng é determinístico e fica em [0, 1)', () => {
    const r1 = criarRng(123);
    const r2 = criarRng(123);
    for (let i = 0; i < 200; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('nada de simulado passa por medição', () => {
  it('todo id carrega o prefixo de demonstração', () => {
    for (const s of conjunto.sessoes) expect(ehDemonstracao(s.id)).toBe(true);
    for (const e of conjunto.experimentos) expect(ehDemonstracao(e.id)).toBe(true);
    // O prefixo é o que torna a remoção exata; sem ele, apagar viraria adivinhação.
    expect(ehDemonstracao('sessao-real-123')).toBe(false);
  });

  it('todo registro traz o aviso de dado simulado', () => {
    for (const s of conjunto.sessoes) expect(s.metadata.notes).toContain(AVISO_DEMO);
    for (const e of conjunto.experimentos) expect(e.notes).toContain(AVISO_DEMO);
  });

  it('o nome do projeto e do experimento é marcado como DEMO', () => {
    for (const s of conjunto.sessoes) expect(s.metadata.project).toMatch(/^\[DEMO\]/);
    for (const e of conjunto.experimentos) expect(e.name).toMatch(/^\[DEMO\]/);
  });

  it('o prefixo e o aviso são exportados para quem for remover', () => {
    expect(PREFIXO_DEMO).toBe('demo-');
    expect(AVISO_DEMO).toMatch(/SIMULADOS/);
  });
});

describe('contagens coerentes', () => {
  it('nenhuma contagem é negativa', () => {
    for (const s of conjunto.sessoes) {
      expect(s.viableCount).toBeGreaterThanOrEqual(0);
      expect(s.inviableCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('nenhuma placa germina mais sementes do que tem', () => {
    for (const e of conjunto.experimentos) {
      for (const t of e.treatments) {
        for (const p of t.plates) {
          expect(p.germinatedSeeds).toBeLessThanOrEqual(p.totalSeeds);
          expect(p.germinatedSeeds).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('a distribuição de estágios soma o total da placa', () => {
    for (const e of conjunto.experimentos) {
      for (const t of e.treatments) {
        for (const p of t.plates) {
          const soma = Object.values(p.stageDistribution).reduce((a, b) => a + (b ?? 0), 0);
          expect(soma).toBe(p.totalSeeds);
        }
      }
    }
  });

  it('o estágio 0 corresponde às não germinadas', () => {
    for (const e of conjunto.experimentos) {
      for (const t of e.treatments) {
        for (const p of t.plates) {
          expect(p.stageDistribution[0]).toBe(p.totalSeeds - p.germinatedSeeds);
        }
      }
    }
  });
});

describe('nada de biologicamente impossível', () => {
  it('germinação acumulada nunca cai ao longo do DAP', () => {
    // É a mesma placa reavaliada: semente não desgermina. Sortear cada data de
    // forma independente fazia a curva descer, e era visível no gráfico.
    const invitro = conjunto.experimentos.find((e) => e.id.includes('invitro'))!;
    for (const t of invitro.treatments) {
      const ordenadas = [...t.plates].sort((a, b) => a.dayIndex - b.dayIndex);
      for (let i = 1; i < ordenadas.length; i++) {
        expect(ordenadas[i].germinatedSeeds).toBeGreaterThanOrEqual(
          ordenadas[i - 1].germinatedSeeds
        );
      }
    }
  });

  it('no armazenamento, o tetrazólio nunca acusa menos vivas do que germinaram', () => {
    // O TZ vê a dormente como viável; a germinação não. A diferença é sempre
    // no mesmo sentido — o contrário seria leitura impossível.
    const arm = conjunto.experimentos.find((e) => e.id.includes('armazenamento'))!;
    const porId = new Map(conjunto.sessoes.map((s) => [s.id, s]));
    for (const t of arm.treatments) {
      for (const p of t.plates) {
        const sessao = porId.get(p.sessionId!)!;
        expect(sessao.viableCount).toBeGreaterThanOrEqual(p.germinatedSeeds);
      }
    }
  });

  it('no dia 0 nada germinou', () => {
    const invitro = conjunto.experimentos.find((e) => e.id.includes('invitro'))!;
    for (const t of invitro.treatments) {
      expect(t.plates.find((p) => p.dayIndex === 0)!.germinatedSeeds).toBe(0);
    }
  });
});

describe('modelos', () => {
  it('phi é a acumulada da normal padrão', () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
    expect(phi(-1.96)).toBeCloseTo(0.025, 3);
    expect(phi(2)).toBeCloseTo(0.9772, 3);
  });

  it('a viabilidade no armazenamento só cai', () => {
    let anterior = 1;
    for (const dias of [0, 90, 180, 360, 720, 1080, 1800]) {
      const v = viabilidadeNoArmazenamento(dias, 2.0, 500);
      expect(v).toBeLessThanOrEqual(anterior);
      anterior = v;
    }
    // Ki = 2,0 probitos é um lote partindo de ~97,7%.
    expect(viabilidadeNoArmazenamento(0, 2.0, 500)).toBeCloseTo(0.977, 2);
  });

  it('umidade relativa mais baixa conserva mais', () => {
    // sigma maior = mais dias para perder um probito.
    expect(viabilidadeNoArmazenamento(720, 2.0, 980)).toBeGreaterThan(
      viabilidadeNoArmazenamento(720, 2.0, 430)
    );
  });

  it('a resposta ao potencial osmótico tem máximo fora da água', () => {
    // MACHADO NETO, COSTA & CUSTÓDIO (2004): a germinação máxima da soja foi
    // calculada em -0,52 e -0,49 MPa, não em 0. É o achado que a regressão
    // polinomial detecta e a separação de médias por letras esconde.
    const emAgua = respostaAoPotencial(0, 0.94, -0.5, 0.8);
    const noOtimo = respostaAoPotencial(-0.5, 0.94, -0.5, 0.8);
    const noExtremo = respostaAoPotencial(-1.2, 0.94, -0.5, 0.8);
    expect(noOtimo).toBeGreaterThan(emAgua);
    expect(noOtimo).toBeGreaterThan(noExtremo);
    expect(emAgua).toBeGreaterThan(noExtremo);
  });

  it('a resposta ao potencial fica em proporção válida', () => {
    for (const psi of [0, -0.5, -1.2, -3, -10]) {
      const g = respostaAoPotencial(psi, 0.94, -0.5, 0.8);
      expect(g).toBeGreaterThan(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it('a logística cresce e satura no máximo', () => {
    expect(germinacaoLogistica(0, 0.9, 30, 0.13)).toBeLessThan(0.1);
    expect(germinacaoLogistica(30, 0.9, 30, 0.13)).toBeCloseTo(0.45, 2);
    expect(germinacaoLogistica(200, 0.9, 30, 0.13)).toBeCloseTo(0.9, 3);
  });
});

describe('o conjunto cabe no que a interface sabe desenhar', () => {
  it('nenhum ensaio passa das 8 séries da paleta', () => {
    // Acima de 8 a paleta não tem cor, e ciclar com índice % tamanho repetiria
    // a cor da 1ª série — o defeito que o teste de design já proíbe no código.
    const porProjeto = new Map<string, Set<string>>();
    for (const s of conjunto.sessoes) {
      const p = s.metadata.project;
      if (!porProjeto.has(p)) porProjeto.set(p, new Set());
      porProjeto.get(p)!.add(s.metadata.treatment);
    }
    for (const [projeto, tratamentos] of porProjeto) {
      expect(tratamentos.size, `${projeto} tem ${tratamentos.size} tratamentos`).toBeLessThanOrEqual(
        8
      );
    }
    for (const e of conjunto.experimentos) {
      expect(e.treatments.length).toBeLessThanOrEqual(8);
    }
  });

  it('todo tratamento tem mais de uma repetição onde a estatística exige', () => {
    // ANOVA sem repetição não tem quadrado médio do resíduo.
    const porTratamento = new Map<string, number>();
    for (const s of conjunto.sessoes) {
      if (s.experimentId) continue; // longitudinal é uma leitura por data
      const chave = `${s.metadata.project}|${s.metadata.treatment}`;
      porTratamento.set(chave, (porTratamento.get(chave) ?? 0) + 1);
    }
    expect(porTratamento.size).toBeGreaterThan(0);
    for (const [chave, n] of porTratamento) {
      expect(n, `${chave} tem ${n} repetição(ões)`).toBeGreaterThanOrEqual(3);
    }
  });

  it('cada placa longitudinal aponta para a sessão que a originou', () => {
    const ids = new Set(conjunto.sessoes.map((s) => s.id));
    for (const e of conjunto.experimentos) {
      for (const t of e.treatments) {
        for (const p of t.plates) {
          expect(p.sessionId).toBeDefined();
          expect(ids.has(p.sessionId!)).toBe(true);
        }
      }
    }
  });

  it('o resumo diz o tamanho do conjunto', () => {
    expect(resumirDemonstracao(conjunto)).toMatch(/\d+ ensaios · \d+ contagens/);
  });
});
