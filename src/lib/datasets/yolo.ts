// =============================================================================
// Leitor de labels YOLO (caixa e polígono).
//
// POR QUÊ.
//
// Os conjuntos de treino trazem `labels/*.txt` com uma anotação por linha,
// coordenadas normalizadas (0..1). Uma linha com 5 números é caixa
// (classe, cx, cy, w, h); uma linha com 7+ números ímpares é polígono
// (classe, x1, y1, x2, y2, ...) — é o formato do conjunto de orquídeas
// (YOLO-seg). Nunca lançamos em linha malformada: um `.txt` ruim não pode
// derrubar a leitura do conjunto inteiro.
// =============================================================================

export interface AnotacaoYolo {
  classe: number;
  /** Caixa em px quando a linha tem 5 valores. */
  caixa?: { x: number; y: number; largura: number; altura: number };
  /** Polígono em px quando a linha tem ≥ 7 valores (ímpar: classe + pares). */
  poligono?: [number, number][];
}

export function lerLabelYolo(texto: string, largura: number, altura: number): AnotacaoYolo[] {
  const resultado: AnotacaoYolo[] = [];
  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith('#')) continue;

    const tokens = linha.split(/\s+/);
    const valores = tokens.map(Number);
    if (valores.some((v) => Number.isNaN(v))) continue;

    const classe = valores[0];
    const resto = valores.slice(1);

    if (resto.length === 4) {
      const [cx, cy, w, h] = resto;
      const larguraPx = w * largura;
      const alturaPx = h * altura;
      resultado.push({
        classe,
        caixa: {
          x: cx * largura - larguraPx / 2,
          y: cy * altura - alturaPx / 2,
          largura: larguraPx,
          altura: alturaPx,
        },
      });
      continue;
    }

    if (resto.length >= 6 && resto.length % 2 === 0) {
      const poligono: [number, number][] = [];
      for (let i = 0; i < resto.length; i += 2) {
        poligono.push([resto[i] * largura, resto[i + 1] * altura]);
      }
      resultado.push({ classe, poligono });
      continue;
    }

    // Nem 5 valores (caixa) nem 7+ ímpares (polígono): descarta sem lançar.
  }
  return resultado;
}

export function centroDaAnotacao(a: AnotacaoYolo): [number, number] {
  if (a.caixa) {
    return [a.caixa.x + a.caixa.largura / 2, a.caixa.y + a.caixa.altura / 2];
  }
  if (a.poligono && a.poligono.length > 0) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of a.poligono) {
      sx += x;
      sy += y;
    }
    return [sx / a.poligono.length, sy / a.poligono.length];
  }
  return [0, 0];
}
