// =============================================================================
// SeedCounter — abrir UMA imagem do lote num canvas
//
// O Lote e a fila com IA abrem o `File` de cada imagem para ler os pixels uma
// vez, rodar a localização (clássica ou modelo) e desenhar a prévia. Os dois
// faziam isso com `createImageBitmap(file)` direto — que FALHA em `.tif`
// (ver MEMORY.md: o navegador não decodifica TIFF nativamente), e uma
// digitalização de scanner de tetrazólio é quase sempre TIFF. O resultado era
// um lote inteiro de "erro" sem dizer o porquê.
//
// Este módulo é o único lugar que sabe decodificar: TIFF por `decodificarTiff`
// (utif2), o resto pelo navegador. Devolve um `<canvas>` — e só isso — porque
// é a forma que serve aos dois consumidores (`getImageData` para o modelo,
// `drawImage` reduzido para a prévia) sem cópia intermediária.
//
// CUIDADO DE MEMÓRIA: o `ImageBitmap` é fechado ANTES de devolver; o buffer do
// TIFF sai de escopo com a função. Quem recebe o canvas é dono dele e deve
// deixá-lo morrer no fim da iteração — um canvas de 7992×3672 são ~117 MB.
// =============================================================================

import { ehTiff } from '../../lib/image-crop';
import { decodificarTiff } from '../../lib/tiff';

/**
 * Decodifica `file` num canvas do tamanho da imagem.
 *
 * Lança com mensagem legível quando o arquivo não é imagem que este leitor
 * entenda — quem chama (o laço do lote) transforma em `erro` da linha.
 */
export async function decodificarParaCanvas(file: File): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');

  if (ehTiff(file)) {
    const buffer = await file.arrayBuffer();
    const dec = decodificarTiff(buffer, 0);
    if (!dec) throw new Error('TIFF que este leitor não entende (compressão ou profundidade não suportada).');
    canvas.width = dec.width;
    canvas.height = dec.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponível');
    // O RGBA já vem pronto do decodificador: vai direto para o canvas, sem
    // passar por Blob/PNG/bitmap como a fila fazia antes (três cópias inteiras
    // de uma digitalização, só para chegar no mesmo lugar).
    ctx.putImageData(new ImageData(dec.rgba, dec.width, dec.height), 0, 0);
    return canvas;
  }

  const bitmap = await createImageBitmap(file);
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponível');
    ctx.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}
