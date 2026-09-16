// =============================================================================
// Leitor mínimo do `data.yaml` do Roboflow — só o campo `names`.
//
// POR QUÊ.
//
// Não instalamos a dependência `yaml` para ler três linhas. O `data.yaml`
// desses conjuntos só varia em duas formas para `names`: lista inline
// (`names: ['a', 'b']` ou `["a","b"]`) ou lista em linhas (`- a` sob
// `names:`). Um regex resolve as duas sem trazer um parser YAML inteiro.
// =============================================================================

export function lerNamesDoDataYaml(texto: string): string[] {
  const inline = texto.match(/^\s*names:\s*\[(.*)\]\s*$/m);
  if (inline) {
    return inline[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s.length > 0);
  }

  const linhas = texto.split(/\r?\n/);
  const inicio = linhas.findIndex((l) => /^\s*names:\s*$/.test(l));
  if (inicio === -1) return [];

  const nomes: string[] = [];
  for (let i = inicio + 1; i < linhas.length; i++) {
    const l = linhas[i];
    const item = l.match(/^\s*-\s*(.+?)\s*$/);
    if (item) {
      nomes.push(item[1].replace(/^['"]|['"]$/g, ''));
      continue;
    }
    if (/^\s*\S/.test(l)) break; // próxima chave de nível 0: para
  }
  return nomes;
}
