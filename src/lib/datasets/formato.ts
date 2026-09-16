// =============================================================================
// Detecção de formato de dataset a partir da lista de caminhos.
//
// POR QUÊ.
//
// Os 14 conjuntos do levantamento não seguem uma convenção única. Em vez de
// pedir para renomear pastas, o app olha para o que existe — `data.yaml` e
// `labels/`, `_classes.csv`, `Scanned_*`/`Segmented_*/seed`, subpastas por
// classe — e escolhe o primeiro formato que casa, na ordem declarada no
// plano: yolo → roboflow-multiclass → mascara-de-instancia →
// mascara-binaria → pasta-por-classe → solto.
//
// Só recebe strings (caminhos relativos à raiz do conjunto). Nunca `File`
// nem handle — é isso que permite testar em node com listas copiadas das
// pastas reais, sem tocar disco.
// =============================================================================

import { classesPorPasta } from './pasta-por-classe';

export type FormatoDeDataset =
  | 'yolo'
  | 'roboflow-multiclass'
  | 'mascara-de-instancia'
  | 'mascara-binaria'
  | 'pasta-por-classe'
  | 'solto';

export interface DatasetReconhecido {
  formato: FormatoDeDataset;
  /** Caminhos (relativos à raiz do conjunto) das imagens que o formato considera "imagens de trabalho". */
  imagens: string[];
  /** Arquivos que carregam a anotação, quando o formato tem: data.yaml, _classes.csv, labels/*.txt … */
  anotacao: string[];
  /** Classes declaradas, quando o formato as declara (yolo: data.yaml; multiclass: cabeçalho do CSV; pasta-por-classe: nomes das pastas). */
  classes: string[];
  /** Uma frase para o painel: o que este formato permite carregar. */
  descricao: string;
}

const EXTENSOES_DE_IMAGEM = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'bmp', 'webp'];

export function ehImagem(caminho: string): boolean {
  const m = caminho.match(/\.([a-z0-9]+)$/i);
  if (!m) return false;
  return EXTENSOES_DE_IMAGEM.includes(m[1].toLowerCase());
}

/** `.../images/x.jpg` → `.../labels/x.txt` (convenção YOLO/Roboflow). */
export function parDeLabelYolo(caminhoDaImagem: string): string {
  const normalizado = caminhoDaImagem.replace(/\\/g, '/');
  const comLabels = normalizado.replace(/\/images\//, '/labels/');
  return comLabels.replace(/\.[^./]+$/, '.txt');
}

function normalizarTodos(caminhos: string[]): string[] {
  return caminhos.map((c) => c.replace(/\\/g, '/'));
}

export function reconhecerFormato(caminhosBrutos: string[]): DatasetReconhecido {
  const caminhos = normalizarTodos(caminhosBrutos);

  // yolo: presença de data.yaml (Roboflow exporta um por conjunto), imagens
  // de trabalho são as que estão sob uma pasta `images/`.
  const dataYaml = caminhos.filter((c) => /(^|\/)data\.ya?ml$/i.test(c));
  if (dataYaml.length > 0) {
    const imagens = caminhos.filter((c) => /\/images\//.test(c) && ehImagem(c)).sort();
    const labels = caminhos.filter((c) => /\/labels\//.test(c) && /\.txt$/i.test(c));
    return {
      formato: 'yolo',
      imagens,
      anotacao: [...dataYaml, ...labels],
      classes: [],
      descricao: 'Caixas ou polígonos por imagem (YOLO), classes em data.yaml.',
    };
  }

  // roboflow-multiclass: `_classes.csv` em uma ou mais pastas (train/valid/test).
  const classesCsv = caminhos.filter((c) => /(^|\/)_classes\.csv$/i.test(c));
  if (classesCsv.length > 0) {
    const imagens = caminhos.filter((c) => ehImagem(c)).sort();
    return {
      formato: 'roboflow-multiclass',
      imagens,
      anotacao: [...classesCsv].sort(),
      classes: [],
      descricao: 'Uma ou mais classes por imagem (CSV one-hot do Roboflow).',
    };
  }

  // mascara-de-instancia: digitalização em `Scanned_*` e recortes de
  // instância (sem posição) em `Segmented_*/seed/*`.
  const temScanned = caminhos.some((c) => /(^|\/)Scanned_[^/]*\//i.test(c));
  const temSegmentedSeed = caminhos.some((c) => /(^|\/)Segmented_[^/]*\/seed\//i.test(c));
  if (temScanned && temSegmentedSeed) {
    const imagens = caminhos
      .filter((c) => /(^|\/)Scanned_[^/]*\//i.test(c) && ehImagem(c))
      .sort();
    const anotacao = caminhos
      .filter((c) => /(^|\/)Segmented_[^/]*\/seed\//i.test(c) && ehImagem(c))
      .sort();
    return {
      formato: 'mascara-de-instancia',
      imagens,
      anotacao,
      classes: [],
      descricao: 'Digitalização solta + recortes de instância como galeria com verdade de forma.',
    };
  }

  // mascara-binaria: pasta de imagens e pasta de máscaras em paralelo
  // (semântica, não instância). Convenção assumida (images/ + masks/); os
  // nomes reais de `lucasiturriago-seeds` ficam "a conferir" (ver plano).
  const temImages = caminhos.some((c) => /(^|\/)images\//i.test(c));
  const temMasks = caminhos.some((c) => /(^|\/)masks?\//i.test(c));
  if (temImages && temMasks) {
    const imagens = caminhos.filter((c) => /(^|\/)images\//i.test(c) && ehImagem(c)).sort();
    const anotacao = caminhos.filter((c) => /(^|\/)masks?\//i.test(c) && ehImagem(c)).sort();
    return {
      formato: 'mascara-binaria',
      imagens,
      anotacao,
      classes: [],
      descricao: 'Máscara binária por imagem — referência de segmentação semântica.',
    };
  }

  // pasta-por-classe: raiz/<classe>/<img>, ≥ 2 subpastas, sem imagem solta.
  const porClasse = classesPorPasta(caminhos);
  if (porClasse) {
    const imagens = [...porClasse.values()].flat().sort();
    return {
      formato: 'pasta-por-classe',
      imagens,
      anotacao: [],
      classes: [...porClasse.keys()].sort(),
      descricao: 'Uma classe por subpasta — nenhuma outra anotação.',
    };
  }

  // solto: sobra tudo que é imagem, sem estrutura reconhecida.
  const imagens = caminhos.filter((c) => ehImagem(c)).sort();
  return {
    formato: 'solto',
    imagens,
    anotacao: [],
    classes: [],
    descricao: 'Imagens sem anotação — carregam soltas, sem referência.',
  };
}
