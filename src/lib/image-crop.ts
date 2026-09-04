// =============================================================================
// SeedCounter — recorte de imagem
// Requisitos: docs/superpowers/specs/2026-09-03-roi-e-divisao-de-scan.md
//
// Duas necessidades reais do laboratório, que compartilham o conceito de
// região de interesse:
//
//   DIVISÃO   O scanner entrega uma folha inteira (ex.: 7992×3672) com várias
//             amostras. Hoje o pesquisador recorta fora do app. O divisor
//             fatia e entrega os pedaços já na fila de imagens.
//
//   ROI       A foto pela ocular da lupa é retrato (ex.: 1880×4096) e ~65%
//             dela é o preto em volta do campo circular. Recortar ao campo
//             corta mais da metade dos pixels que o YOLO teria de percorrer.
//
// As funções puras ficam separadas das que dependem de canvas, para que a
// aritmética da grade e a detecção do campo sejam testáveis sem navegador.
// =============================================================================

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Circulo {
  cx: number;
  cy: number;
  r: number;
}

export interface Peca {
  retangulo: Retangulo;
  /** 1-indexado, para compor nome de arquivo e quadrante legíveis. */
  coluna: number;
  linha: number;
}

/** Qualquer fonte que o canvas saiba desenhar. */
export type FonteImagem = HTMLImageElement | HTMLCanvasElement;

// ---------------------------------------------------------------------------
// Grade — aritmética pura
// ---------------------------------------------------------------------------

/**
 * Divide uma região em colunas × linhas.
 *
 * A sobra da divisão inteira vai para a ÚLTIMA coluna e a última linha, em vez
 * de ser descartada: numa folha de scanner, jogar fora a borda direita pode
 * jogar fora sementes.
 */
export function calcularGrade(regiao: Retangulo, colunas: number, linhas: number): Peca[] {
  if (colunas < 1 || linhas < 1) return [];

  const largura = Math.floor(regiao.w / colunas);
  const altura = Math.floor(regiao.h / linhas);
  if (largura < 1 || altura < 1) return [];

  const pecas: Peca[] = [];
  for (let linha = 0; linha < linhas; linha++) {
    for (let coluna = 0; coluna < colunas; coluna++) {
      const ultimaColuna = coluna === colunas - 1;
      const ultimaLinha = linha === linhas - 1;
      pecas.push({
        coluna: coluna + 1,
        linha: linha + 1,
        retangulo: {
          x: regiao.x + coluna * largura,
          y: regiao.y + linha * altura,
          w: ultimaColuna ? regiao.w - coluna * largura : largura,
          h: ultimaLinha ? regiao.h - linha * altura : altura,
        },
      });
    }
  }
  return pecas;
}

/**
 * Grade a partir de um lado fixo — o modo do protótipo, que usava blocos de
 * 946 px. Importa para dataset: manter o mesmo lado entre digitalizações deixa
 * os recortes comparáveis para treino.
 */
export function gradePorLado(regiao: Retangulo, lado: number): { colunas: number; linhas: number } {
  if (lado < 1) return { colunas: 1, linhas: 1 };
  return {
    colunas: Math.max(1, Math.round(regiao.w / lado)),
    linhas: Math.max(1, Math.round(regiao.h / lado)),
  };
}

/**
 * Sugere colunas × linhas para um total desejado, escolhendo entre os pares de
 * fatores o que deixa o pedaço mais próximo do quadrado. Para 6754×2339 e
 * total 12, devolve 6×2 (pedaço 1125×1169) em vez de 12×1 ou 1×12.
 */
export function gradeParaTotal(
  regiao: Retangulo,
  total: number
): { colunas: number; linhas: number } {
  if (total < 1) return { colunas: 1, linhas: 1 };

  let melhor = { colunas: total, linhas: 1 };
  let melhorDesvio = Infinity;

  for (let colunas = 1; colunas <= total; colunas++) {
    if (total % colunas !== 0) continue;
    const linhas = total / colunas;
    const razao = regiao.w / colunas / (regiao.h / linhas);
    // Distância logarítmica do quadrado: penaliza 2:1 e 1:2 igualmente.
    const desvio = Math.abs(Math.log(razao));
    if (desvio < melhorDesvio) {
      melhorDesvio = desvio;
      melhor = { colunas, linhas };
    }
  }
  return melhor;
}

// ---------------------------------------------------------------------------
// Detecção do campo da ocular — pura, opera sobre ImageData
// ---------------------------------------------------------------------------

interface DadosImagem {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
}

/**
 * Encontra o campo circular claro sobre o entorno escuro de uma foto tirada
 * pela ocular.
 *
 * O limiar é o ponto médio entre os percentis 5 e 95 da luminância, não um
 * valor fixo: nas amostras reais o entorno varia de preto puro a azul-acinzentado,
 * e um limiar fixo falharia numa das duas.
 *
 * Devolve null quando não há separação clara — imagem de scanner, por exemplo,
 * que é clara de ponta a ponta e não tem campo a recortar.
 */
export function detectarCampoCircular(img: DadosImagem, amostragem = 4): Circulo | null {
  const { data, width, height } = img;
  if (width < 8 || height < 8) return null;

  const lum: number[] = [];
  for (let y = 0; y < height; y += amostragem) {
    for (let x = 0; x < width; x += amostragem) {
      const i = (y * width + x) * 4;
      lum.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    }
  }
  if (lum.length === 0) return null;

  const ordenado = [...lum].sort((a, b) => a - b);
  const p = (q: number) => ordenado[Math.min(ordenado.length - 1, Math.floor(q * ordenado.length))];
  const escuro = p(0.05);
  const claro = p(0.95);

  // Sem contraste suficiente não há campo: provavelmente é um scanner.
  if (claro - escuro < 40) return null;

  const limiar = (escuro + claro) / 2;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  let claros = 0;

  let k = 0;
  for (let y = 0; y < height; y += amostragem) {
    for (let x = 0; x < width; x += amostragem) {
      if (lum[k++] > limiar) {
        claros++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Campo pequeno demais ou grande demais não é um círculo de ocular.
  const fracao = claros / lum.length;
  if (fracao < 0.05 || fracao > 0.92) return null;
  if (maxX <= minX || maxY <= minY) return null;

  const larguraCampo = maxX - minX;
  const alturaCampo = maxY - minY;

  return {
    cx: minX + larguraCampo / 2,
    cy: minY + alturaCampo / 2,
    // O menor eixo: o campo pode estar cortado pela borda da foto, e usar o
    // maior faria o circulo vazar para fora da imagem.
    r: Math.min(larguraCampo, alturaCampo) / 2,
  };
}

// ---------------------------------------------------------------------------
// Formato de arquivo
// ---------------------------------------------------------------------------

/**
 * TIFF passa no filtro `type.startsWith('image/')` do carregador, mas nenhum
 * navegador o decodifica: o `img.onload` nunca dispara e a interface fica em
 * silêncio, sem carregar e sem erro. Precisa ser barrado com mensagem.
 */
export function ehTiff(file: File): boolean {
  return /^image\/tiff$/i.test(file.type) || /\.tiff?$/i.test(file.name);
}

// ---------------------------------------------------------------------------
// Recorte — depende de canvas
// ---------------------------------------------------------------------------

function paraArquivo(canvas: HTMLCanvasElement, nome: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar o recorte.'));
        return;
      }
      resolve(new File([blob], nome, { type: 'image/png' }));
    }, 'image/png');
  });
}

/** Recorta um retângulo e devolve um File PNG, pronto para a fila de imagens. */
export function recortarRetangulo(fonte: FonteImagem, ret: Retangulo, nome: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(ret.w));
  canvas.height = Math.max(1, Math.round(ret.h));

  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas indisponível.'));

  ctx.drawImage(fonte, ret.x, ret.y, ret.w, ret.h, 0, 0, canvas.width, canvas.height);
  return paraArquivo(canvas, nome);
}

/**
 * Recorta o quadrado que contém o círculo e apaga o que fica fora dele.
 *
 * O fora vira transparente, não preto: assim a marca de espécime continua
 * legível na borda, e a imagem exportada não ganha uma moldura falsa.
 *
 * A calibração µm/px NÃO muda com isto — recorte é translação, não escala.
 */
export function recortarCirculo(fonte: FonteImagem, circ: Circulo, nome: string): Promise<File> {
  const lado = Math.max(1, Math.round(circ.r * 2));
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;

  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas indisponível.'));

  ctx.save();
  ctx.beginPath();
  ctx.arc(lado / 2, lado / 2, circ.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(fonte, circ.cx - circ.r, circ.cy - circ.r, lado, lado, 0, 0, lado, lado);
  ctx.restore();

  return paraArquivo(canvas, nome);
}

/** Nome estável e ordenável para cada pedaço: base_L1C03.png. */
export function nomeDaPeca(base: string, peca: Peca): string {
  const semExtensao = base.replace(/\.[^.]+$/, '');
  const c = String(peca.coluna).padStart(2, '0');
  return `${semExtensao}_L${peca.linha}C${c}.png`;
}
