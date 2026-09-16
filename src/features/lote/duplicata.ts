// =============================================================================
// SeedCounter — duplicata ("lote redondo", item 3)
//
// Antes de aceitar uma linha do lote, checar se já existe sessão com o mesmo
// nome de arquivo. A função só INFORMA — nunca decide sozinha: duas
// contagens da mesma placa em dias diferentes são legítimas (o trabalho da
// Profa. Ceci e do Prof. Nelson depende disso). Quem decide é a pessoa, no
// painel: substituir, gravar assim mesmo (vira outra sessão), ou pular.
// =============================================================================

import type { Session } from '../../types';

/**
 * Sessões já gravadas com o mesmo nome de arquivo, mais recente primeiro.
 * Array vazio = sem duplicata.
 */
export function ehDuplicata(nomeDoArquivo: string, sessoes: Session[]): Session[] {
  return sessoes
    .filter((s) => s.filename === nomeDoArquivo)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
