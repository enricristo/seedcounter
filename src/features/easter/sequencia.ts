// =============================================================================
// SeedCounter — detector de sequência de teclas
//
// POR QUE ISTO É PURO.
//
// Um easter egg que não se anuncia precisa, ainda assim, ser confiável: a
// regra "estas teclas, nesta ordem, viram aquilo" não depende de DOM, de
// React nem de tempo — só de uma lista de teclas e um dicionário de
// sequências-alvo. Separar essa regra do gancho que escuta o teclado é o que
// permite testá-la sem montar o app inteiro (o mesmo espírito de
// `src/features/mascara/mascara.ts`: a lógica fica pura e comparável por
// igualdade, quem lê o mundo real só a alimenta).
//
// O detector guarda só as últimas N teclas (N = o tamanho da maior
// sequência) e, a cada tecla nova, confere se o SUFIXO do buffer bate com
// alguma sequência — não precisa reconhecer onde a digitação começou.
// =============================================================================

export interface DetectorDeSequencias {
  /** Alimenta uma tecla; devolve o nome da sequência completada, ou null. */
  registrar(tecla: string): string | null;
  /** Zera o buffer acumulado (ex.: ao perder o foco da janela). */
  limpar(): void;
}

interface SequenciaAlvo {
  nome: string;
  teclas: string[];
}

/** As duas sequências batem tecla a tecla — comparar arrays evita a
 * ambiguidade de juntar tudo numa string só (ex.: teclas de mais de um
 * caractere, como "backspace", não podem se confundir com letras vizinhas). */
function combina(sufixo: string[], alvo: string[]): boolean {
  if (sufixo.length !== alvo.length) return false;
  return alvo.every((tecla, i) => tecla === sufixo[i]);
}

export function criarDetector(sequencias: Record<string, string>): DetectorDeSequencias {
  const alvos: SequenciaAlvo[] = Object.entries(sequencias).map(([nome, seq]) => ({
    nome,
    teclas: seq.toLowerCase().split(''),
  }));
  const maiorTamanho = Math.max(1, ...alvos.map((a) => a.teclas.length));

  let buffer: string[] = [];

  return {
    registrar(tecla: string): string | null {
      buffer.push(tecla.toLowerCase());
      if (buffer.length > maiorTamanho) {
        buffer = buffer.slice(-maiorTamanho);
      }

      for (const alvo of alvos) {
        const sufixo = buffer.slice(-alvo.teclas.length);
        if (combina(sufixo, alvo.teclas)) {
          buffer = [];
          return alvo.nome;
        }
      }
      return null;
    },
    limpar(): void {
      buffer = [];
    },
  };
}
