// =============================================================================
// Leitor do `_classes.csv` multiclasse do Roboflow.
//
// POR QUÊ.
//
// Conjuntos de classificação (amendoim, arroz, trigo) trazem uma imagem por
// linha e uma coluna one-hot por classe. Uma imagem pode ter mais de uma
// classe marcada (ex.: "with mold" e outro defeito juntos) — devolvemos
// todas, não só a primeira.
// =============================================================================

export interface ClassesPorImagem {
  classes: string[];
  porImagem: Map<string, string[]>;
}

export function lerClassesCsv(texto: string): ClassesPorImagem {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return { classes: [], porImagem: new Map() };

  const cabecalho = linhas[0].split(',').map((s) => s.trim());
  const classes = cabecalho.slice(1);
  const porImagem = new Map<string, string[]>();

  for (const linha of linhas.slice(1)) {
    const colunas = linha.split(',').map((s) => s.trim());
    const filename = colunas[0];
    if (!filename) continue;
    const classesDaImagem: string[] = [];
    for (let i = 0; i < classes.length; i++) {
      if (colunas[i + 1] === '1') classesDaImagem.push(classes[i]);
    }
    porImagem.set(filename, classesDaImagem);
  }

  return { classes, porImagem };
}
