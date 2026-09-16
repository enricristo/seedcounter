// =============================================================================
// O corte nunca e aplicado sem o botao Separar.
//
// Cortar por engano vira duas sementes onde havia uma, e o numero do laudo
// SOBE. Por isso a regra do corte e mostrar a proposta e esperar a pessoa.
// Um gancho que aplica no segundo clique viola isso — e foi exatamente o que
// uma versao pendente do App fez. Este teste e estatico porque o defeito e de
// estrutura: da para ler no codigo-fonte quem chama quem.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function corpoDaFuncao(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`const ${nome} = useCallback(`);
  if (inicio < 0) return '';
  // Ate o fechamento do useCallback: a linha "  );" seguinte no mesmo nivel.
  const fim = fonte.indexOf('\n  );', inicio);
  return fonte.slice(inicio, fim < 0 ? undefined : fim);
}

describe('o corte por concavidade', () => {
  it('handleProposeCut NAO chama handleAplicarCorte', () => {
    const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
    const corpo = corpoDaFuncao(app, 'handleProposeCut');
    expect(corpo.length, 'handleProposeCut existe').toBeGreaterThan(0);
    expect(corpo).not.toMatch(/handleAplicarCorte\s*\(/);
  });

  it('so o botao Separar aplica', () => {
    // Toda CHAMADA a handleAplicarCorte (com parenteses) fora da propria
    // definicao e proibida: aplicar so acontece pelo onClick do botao Separar,
    // que passa a referencia sem chamar.
    const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
    const definicao = app.indexOf('const handleAplicarCorte = useCallback(');
    const fimDaDefinicao = app.indexOf('\n  );', definicao);
    const foraDaDefinicao = app.slice(0, definicao) + app.slice(fimDaDefinicao);
    expect(foraDaDefinicao).not.toMatch(/handleAplicarCorte\s*\(/);
    expect(app).toMatch(/onClick=\{handleAplicarCorte\}/);
  });
});
