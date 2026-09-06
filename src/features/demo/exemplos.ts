// =============================================================================
// SeedCounter — cenas de exemplo entregues à fila de imagens
//
// Ponte entre o gerador puro (`synthetic-scene.ts`, que roda no vitest) e o
// app, que trabalha com `File`. A conversão para PNG acontece aqui, e só aqui,
// porque depende de canvas.
//
// O nome do arquivo carrega "simulado" de propósito: a imagem sai da fila para
// exportação, relatório e dataset como qualquer outra, e em nenhum desses
// lugares pode passar por digitalização real.
// =============================================================================

import {
  gerarCenaSintetica,
  resumirCena,
  type CenaSintetica,
  type OpcoesDaCena,
  type PresetDeCena,
} from '../../lib/synthetic-scene';

export interface ExemploCarregado {
  arquivo: File;
  cena: CenaSintetica;
  /** Nome de projeto sugerido para os metadados. */
  projeto: string;
}

/** Rótulos curtos para os botões. */
export const EXEMPLOS: { preset: PresetDeCena; rotulo: string; dica: string }[] = [
  {
    preset: 'soja',
    rotulo: 'Soja',
    dica: 'Semente grande sobre bandeja, bem separada — o caso fácil',
  },
  {
    preset: 'orquidea-tz',
    rotulo: 'Orquídea TZ',
    dica: 'Semente de 1 mm com embrião corado — quem decide é a cor, não a forma',
  },
  {
    preset: 'forrageira',
    rotulo: 'Forrageira',
    dica: 'Espigueta cheia contra espigueta vazia — o caso que a dicotomia atual não cobre',
  },
];

/**
 * Gera uma cena e devolve como arquivo PNG, pronto para a fila.
 *
 * PNG, não JPEG: a compressão com perda mexeria nas cores exatamente na borda
 * das sementes, que é onde a segmentação decide. Medir sobre artefato de
 * compressão daria um erro que não é do algoritmo.
 */
export async function carregarExemplo(
  preset: PresetDeCena,
  opcoes: OpcoesDaCena = {}
): Promise<ExemploCarregado> {
  const cena = gerarCenaSintetica(preset, opcoes);
  const { imagem } = cena;

  const canvas = document.createElement('canvas');
  canvas.width = imagem.width;
  canvas.height = imagem.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para gerar a cena de exemplo.');

  const dados = new ImageData(
    imagem.data instanceof Uint8ClampedArray
      ? imagem.data
      : new Uint8ClampedArray(imagem.data as number[]),
    imagem.width,
    imagem.height
  );
  ctx.putImageData(dados, 0, 0);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('Não foi possível converter a cena em imagem.');

  const resumo = resumirCena(cena);
  const arquivo = new File([blob], `exemplo-${preset}-simulado.png`, { type: 'image/png' });

  return {
    arquivo,
    cena,
    projeto: `[DEMO] ${cena.descricao} · ${resumo.total} sementes, ${resumo.percentualViavel}% viáveis`,
  };
}
