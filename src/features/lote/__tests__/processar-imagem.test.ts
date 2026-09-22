// =============================================================================
// O desvio para o modelo em `processarImagemDoLote`, com o worker substituído
// por um dublê e o canvas por um objeto falso (node não tem DOM).
//
// O que se protege: o caminho da IA devolve o MESMO formato que o caminho
// clássico (a tabela, a miniatura e o CSV não sabem a diferença); a classe do
// modelo chega inteira até `viaveis`/`inviaveis`; modelo ausente é ERRO com
// frase clara, não "0 objetos"; e a máscara é pedida (`withMasks`), porque
// sem ela não há contorno.
// =============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  processarImagemDoLote,
  propostosDeDeteccoes,
  categoriaDaDeteccao,
  descreverFalhaDoModelo,
  type Detector,
} from '../processar-imagem';
import type { Receita } from '../../ensaio/receitas';
import type { ItemDoLote } from '../lote';
import type { YoloDetection, InferenceOptions } from '../../../lib/yolo-onnx';

const RECEITA_IA: Receita = {
  id: 'ia',
  nome: 'IA (YOLO)',
  quando: 'teste',
  localizacao: { usaModeloDeIA: true, sensitivity: 70 },
  onda: {},
};

/** Canvas falso: só o que `processarImagemDoLote` e a prévia tocam. */
function canvasFalso(width = 200, height = 100): HTMLCanvasElement {
  const ctx = {
    drawImage: () => undefined,
    putImageData: () => undefined,
    getImageData: () => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    setLineDash: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    stroke: () => undefined,
    strokeStyle: '',
    lineWidth: 1,
  };
  const canvas = {
    width,
    height,
    getContext: () => ctx,
    toDataURL: () => 'data:image/jpeg;base64,previa',
  };
  return canvas as unknown as HTMLCanvasElement;
}

function quadrado(cx: number, cy: number, lado: number): [number, number][] {
  const r = lado / 2;
  return [
    [cx - r, cy - r],
    [cx + r, cy - r],
    [cx + r, cy + r],
    [cx - r, cy + r],
  ];
}

function deteccao(cx: number, cy: number, className: 'viavel' | 'inviavel', polygon?: [number, number][]): YoloDetection {
  return {
    x: cx,
    y: cy,
    bbox: { x: cx - 5, y: cy - 5, width: 10, height: 10 },
    confidence: 0.8,
    classId: className === 'viavel' ? 1 : 0,
    className,
    polygon,
  };
}

const ITEM: ItemDoLote = {
  id: 'i1',
  rotulo: 'placa.png',
  obterFile: () => Promise.resolve(new File(['x'], 'placa.png')),
};

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => canvasFalso(), documentElement: {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('categoriaDaDeteccao', () => {
  it('só className decide — classId 1 é viável em YOLO_CLASSES', () => {
    expect(categoriaDaDeteccao({ className: 'viavel' })).toBe('viable');
    expect(categoriaDaDeteccao({ className: 'inviavel' })).toBe('inviable');
  });
});

describe('propostosDeDeteccoes', () => {
  it('só detecção com máscara vira proposta; sem máscara é escape', () => {
    const r = propostosDeDeteccoes([
      deteccao(20, 20, 'viavel', quadrado(20, 20, 10)),
      deteccao(60, 20, 'inviavel', quadrado(60, 20, 10)),
      deteccao(90, 20, 'viavel'),
    ]);
    expect(r.propostos).toHaveLength(2);
    expect(r.escapes).toBe(1);
    expect(r.resumo.contagem).toBe(2);
    expect(r.propostos.map((p) => p.categoria)).toEqual(['viable', 'inviable']);
    expect(r.propostos[0].areaPx).toBe(100);
    // mediana de verdade, não "mock"
    expect(r.resumo.medianaDaAreaPx).toBe(100);
  });
});

describe('processarImagemDoLote com receita de IA', () => {
  it('devolve o mesmo formato do caminho clássico, com a classe preservada', async () => {
    const opcoesRecebidas: InferenceOptions[] = [];
    const detectar: Detector = async (_img, opcoes) => {
      opcoesRecebidas.push(opcoes);
      return [
        deteccao(20, 20, 'viavel', quadrado(20, 20, 10)),
        deteccao(60, 20, 'viavel', quadrado(60, 20, 10)),
        deteccao(100, 20, 'inviavel', quadrado(100, 20, 10)),
      ];
    };

    const { resultado, propostos } = await processarImagemDoLote(ITEM, RECEITA_IA, {
      abrirImagem: async () => canvasFalso(),
      detectar,
    });

    expect(resultado.id).toBe('i1');
    expect(resultado.rotulo).toBe('placa.png');
    expect(resultado.erro).toBeUndefined();
    expect(resultado.contagem).toBe(3);
    expect(resultado.viaveis).toBe(2);
    expect(resultado.inviaveis).toBe(1);
    expect(resultado.escapes).toBe(0);
    expect(typeof resultado.duracaoMs).toBe('number');
    expect(resultado.miniatura).toMatch(/^data:image\/jpeg/);
    expect(resultado.imagemGrande).toMatch(/^data:image\/jpeg/);
    expect(propostos).toHaveLength(3);
    expect(propostos?.[2].categoria).toBe('inviable');

    // a máscara é pedida, e a sensibilidade da receita vira o limiar
    expect(opcoesRecebidas[0].withMasks).toBe(true);
    expect(opcoesRecebidas[0].confThreshold).toBeCloseTo(0.7);
  });

  it('modelo ausente é erro com frase clara — nunca zero objetos', async () => {
    const detectar: Detector = async () => {
      throw new Error('protobuf parsing failed');
    };
    await expect(
      processarImagemDoLote(ITEM, RECEITA_IA, { abrirImagem: async () => canvasFalso(), detectar })
    ).rejects.toThrow(/Modelo de IA não encontrado/);
  });

  it('zero detecções é resultado legítimo, não erro', async () => {
    const { resultado, propostos } = await processarImagemDoLote(ITEM, RECEITA_IA, {
      abrirImagem: async () => canvasFalso(),
      detectar: async () => [],
    });
    expect(resultado.erro).toBeUndefined();
    expect(resultado.contagem).toBe(0);
    expect(propostos).toEqual([]);
  });

  it('cancelado enquanto o worker calculava: "Interrompida.", nada proposto', async () => {
    let cancelado = false;
    const { resultado, propostos } = await processarImagemDoLote(ITEM, RECEITA_IA, {
      abrirImagem: async () => canvasFalso(),
      detectar: async () => {
        cancelado = true;
        return [deteccao(20, 20, 'viavel', quadrado(20, 20, 10))];
      },
      cancelado: () => cancelado,
    });
    expect(resultado.erro).toBe('Interrompida.');
    expect(propostos).toBeUndefined();
  });

  it('imagem que não abre propaga (é `executarLote` quem isola por linha)', async () => {
    await expect(
      processarImagemDoLote(ITEM, RECEITA_IA, {
        abrirImagem: async () => {
          throw new Error('TIFF que este leitor não entende');
        },
        detectar: async () => [],
      })
    ).rejects.toThrow(/TIFF/);
  });
});

describe('descreverFalhaDoModelo', () => {
  it('traduz o erro cru do runtime para o que fazer', () => {
    expect(descreverFalhaDoModelo(new Error('Failed to fetch'))).toMatch(/não encontrado/);
    expect(descreverFalhaDoModelo(new Error('no available backend found'))).toMatch(/WASM/);
    expect(descreverFalhaDoModelo(new Error('Detecção cancelada: outra começou'))).toMatch(/interrompida/);
    expect(descreverFalhaDoModelo('x'.repeat(500))).toHaveLength('Falha ao executar o modelo: '.length + 120);
  });
});
