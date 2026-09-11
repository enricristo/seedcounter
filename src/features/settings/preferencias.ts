// =============================================================================
// SeedCounter — preferências de interface, ligadas por chave
//
// POR QUE UM MÓDULO SÓ PARA ISTO.
//
// Duas frentes diferentes (este painel de Configurações e o easter egg do
// som) precisam ler e gravar a MESMA chave `sc:som` sem se coordenar em
// tempo de execução — cada uma só sabe que a chave existe. Um formato
// combinado evita a divergência: '1' significa ligado, qualquer outra coisa
// (incluindo ausência da chave) significa desligado. É o formato que
// `features/easter/som.ts` já usa; este módulo só o generaliza para outras
// chaves booleanas, sem reescrever o que já funciona.
//
// POR QUE GRAVAR '0' EM VEZ DE APAGAR A CHAVE.
//
// Se "desligado" fosse representado só pela ausência da chave, uma
// preferência com padrão LIGADO (como `sc:sugestoes`) não conseguiria
// registrar que a pessoa desligou de propósito — a leitura devolveria o
// padrão de novo, e o desligamento não sobreviveria a um F5. Gravar '0'
// explicitamente resolve isso, e continua compatível com quem só sabe
// testar `=== '1'`.
//
// Tudo em try/catch: modo privado, cota esgotada ou política do navegador
// não podem derrubar o aplicativo — só perdem a memória entre sessões.
// =============================================================================

/** "Sugestões contextuais" — ligado por padrão. */
export const CHAVE_SUGESTOES = 'sc:sugestoes';

/** "Som ao marcar" — a mesma chave que `features/easter/som.ts` lê e grava. */
export const CHAVE_SOM = 'sc:som';

/** Lê uma preferência booleana. Sem a chave, ou sem armazenamento, devolve o padrão. */
export function lerPreferencia(chave: string, padrao: boolean): boolean {
  try {
    const bruto = localStorage.getItem(chave);
    if (bruto === null) return padrao;
    return bruto === '1';
  } catch {
    return padrao;
  }
}

/** Grava uma preferência booleana. Sem armazenamento, a escolha não sobrevive a um F5. */
export function gravarPreferencia(chave: string, valor: boolean): void {
  try {
    localStorage.setItem(chave, valor ? '1' : '0');
  } catch {
    // Ignorado de propósito: não poder lembrar não pode impedir de usar.
  }
}
