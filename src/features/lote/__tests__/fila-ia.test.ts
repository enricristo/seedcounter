// =============================================================================
// Testa o LAÇO de `processarFilaComIA` com `analisar` e `gravar` dublês — a
// parte real (`analisarComModelo`) toca canvas e worker, que não existem em
// node. O que se protege aqui são as regras do cabeçalho de `fila-ia.ts`:
// uma fila por vez, cancelamento que não grava o que chegou depois, erro
// isolado por imagem, duplicata pulada, procedência declarada e a contagem
// da sessão igual à que a Galeria vai recontar.
// =============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  processarFilaComIA,
  cancelarFilaIA,
  filaIAEmAndamento,
  sessaoDeDeteccoes,
  descreverRelato,
  DeteccaoTomadaPorOutra,
  type AnaliseDeUmaImagem,
} from '../fila-ia';
import { contarObjetos } from '../../../lib/contagem';
import { lerErros, lerTrilha, limparTrilha } from '../../../lib/diagnostico/trilha';
import type { YoloDetection } from '../../../lib/yolo-onnx';
import type { Metadata, Session } from '../../../types';

const METADATA: Metadata = {
  researcher: 'Mayara',
  project: 'Orquídeas',
  treatment: 'KC',
  plate: 'P1',
  quadrant: 'Q1',
  notes: '',
  umPerPixel: 10,
};

/** Uma detecção com máscara quadrada de lado 10 em (x, y). */
function deteccao(x: number, y: number, className: 'viavel' | 'inviavel', comMascara = true): YoloDetection {
  return {
    x,
    y,
    bbox: { x: x - 5, y: y - 5, width: 10, height: 10 },
    confidence: 0.9,
    classId: className === 'viavel' ? 1 : 0,
    className,
    polygon: comMascara
      ? [
          [x - 5, y - 5],
          [x + 5, y - 5],
          [x + 5, y + 5],
          [x - 5, y + 5],
        ]
      : undefined,
  };
}

function arquivos(nomes: string[]): File[] {
  return nomes.map((n) => new File(['x'], n));
}

/** Um `analisar` que devolve `porNome[file.name]`, ou lança quando o valor é um Error. */
function analisadorDe(porNome: Record<string, YoloDetection[] | Error>) {
  const chamados: string[] = [];
  const analisar = async (file: File): Promise<AnaliseDeUmaImagem> => {
    chamados.push(file.name);
    const v = porNome[file.name];
    if (v instanceof Error) throw v;
    return { deteccoes: v ?? [], imagemJpeg: 'data:image/jpeg;base64,x' };
  };
  return { analisar, chamados };
}

function gravadorEmMemoria() {
  const sessoes: Session[] = [];
  return { sessoes, gravar: async (s: Session) => void sessoes.push(s) };
}

beforeEach(() => {
  limparTrilha();
});

describe('sessaoDeDeteccoes', () => {
  it('cada detecção vira marcação; as com máscara ganham contorno ligado por marcaId', () => {
    const { sessao, semContorno } = sessaoDeDeteccoes(
      {
        filename: 'placa.png',
        deteccoes: [deteccao(10, 10, 'viavel'), deteccao(40, 40, 'inviavel'), deteccao(70, 70, 'viavel', false)],
        metadataBase: METADATA,
      },
      1000
    );
    expect(sessao.marks).toHaveLength(3);
    expect(sessao.yoloSegmentations).toHaveLength(2);
    expect(semContorno).toBe(1);
    const seg = sessao.yoloSegmentations?.[0];
    expect(seg?.marcaId).toBe(sessao.marks?.[0].id);
    expect(seg?.origem).toBe('modelo');
    expect(seg?.polygon_points).toHaveLength(4);
  });

  it('a classe do modelo é preservada: classId 1 é VIÁVEL, não inviável', () => {
    const { sessao } = sessaoDeDeteccoes(
      { filename: 'a.png', deteccoes: [deteccao(10, 10, 'viavel'), deteccao(40, 40, 'inviavel')], metadataBase: METADATA },
      1
    );
    expect(sessao.viableCount).toBe(1);
    expect(sessao.inviableCount).toBe(1);
    expect(sessao.marks?.map((m) => m.type)).toEqual(['viable', 'inviable']);
    expect(sessao.yoloSegmentations?.map((s) => s.category)).toEqual(['viable', 'inviable']);
  });

  it('a contagem gravada é a que a Galeria reconta — marcação + contorno não somam duas vezes', () => {
    const { sessao } = sessaoDeDeteccoes(
      {
        filename: 'a.png',
        deteccoes: [deteccao(10, 10, 'viavel'), deteccao(40, 40, 'viavel'), deteccao(70, 70, 'inviavel', false)],
        metadataBase: METADATA,
      },
      1
    );
    const recontagem = contarObjetos(sessao.marks ?? [], sessao.yoloSegmentations ?? []);
    expect(recontagem.viaveis).toBe(sessao.viableCount);
    expect(recontagem.inviaveis).toBe(sessao.inviableCount);
    expect(recontagem.total).toBe(3);
  });

  it('declara a procedência: modo automático, versão, e a receita de IA', () => {
    const { sessao } = sessaoDeDeteccoes(
      { filename: 'a.png', deteccoes: [], metadataBase: METADATA, versaoDoApp: '3.4.0', commit: 'abc123' },
      1
    );
    expect(sessao.metadata.procedencia?.modo).toBe('automatica');
    expect(sessao.metadata.procedencia?.versaoDoApp).toBe('3.4.0');
    expect(sessao.metadata.procedencia?.commit).toBe('abc123');
    expect(sessao.metadata.receita?.id).toBe('ia');
    expect(sessao.metadata.receita?.parametros.localizacao.usaModeloDeIA).toBe(true);
    // os metadados da bancada continuam lá — é a procedência certa
    expect(sessao.metadata.researcher).toBe('Mayara');
    expect(sessao.metadata.umPerPixel).toBe(10);
  });

  it('não guarda pixels: a sessão leva marcas, polígonos e o JPEG, nada mais', () => {
    const { sessao } = sessaoDeDeteccoes(
      { filename: 'a.png', deteccoes: [deteccao(10, 10, 'viavel')], metadataBase: METADATA, imagemJpeg: 'data:x' },
      1
    );
    expect(Object.keys(sessao).sort()).toEqual(
      ['date', 'filename', 'id', 'imageData', 'inviableCount', 'marks', 'metadata', 'viableCount', 'yoloSegmentations'].sort()
    );
    expect(typeof sessao.imageData).toBe('string');
  });
});

describe('processarFilaComIA', () => {
  it('grava uma sessão por imagem, na ordem, e o relato fecha', async () => {
    const files = arquivos(['a.png', 'b.png', 'c.png']);
    const { analisar } = analisadorDe({
      'a.png': [deteccao(10, 10, 'viavel')],
      'b.png': [deteccao(10, 10, 'inviavel'), deteccao(30, 30, 'viavel')],
      'c.png': [],
    });
    const { sessoes, gravar } = gravadorEmMemoria();
    const progresso: string[] = [];

    const relato = await processarFilaComIA(files, {
      metadataBase: METADATA,
      sessoesExistentes: [],
      analisar,
      gravar,
      progresso: (feito, total, rotulo) => progresso.push(`${feito}/${total} ${rotulo}`),
      agora: (() => {
        let t = 1000;
        return () => (t += 1);
      })(),
    });

    expect(relato).toEqual({
      total: 3,
      gravadas: 3,
      puladas: [],
      falhas: [],
      semContorno: 0,
      interrompidaEm: null,
    });
    expect(sessoes.map((s) => s.filename)).toEqual(['a.png', 'b.png', 'c.png']);
    expect(sessoes[1].viableCount).toBe(1);
    expect(sessoes[1].inviableCount).toBe(1);
    // ids distintos mesmo com relógio de 1 ms
    expect(new Set(sessoes.map((s) => s.id)).size).toBe(3);
    expect(progresso).toEqual(['0/3 a.png', '1/3 b.png', '2/3 c.png']);
    expect(filaIAEmAndamento()).toBe(false);
    expect(lerTrilha().some((e) => e.tipo === 'fila-ia:rodar')).toBe(true);
  });

  it('cancelar no meio: a imagem em andamento termina, mas NÃO é gravada, e as seguintes não rodam', async () => {
    const files = arquivos(['a.png', 'b.png', 'c.png', 'd.png']);
    const { sessoes, gravar } = gravadorEmMemoria();
    const chamados: string[] = [];
    const analisar = async (file: File): Promise<AnaliseDeUmaImagem> => {
      chamados.push(file.name);
      // A pessoa clica em "cancelar" enquanto o worker calcula a segunda.
      if (file.name === 'b.png') {
        expect(filaIAEmAndamento()).toBe(true);
        cancelarFilaIA();
      }
      return { deteccoes: [deteccao(10, 10, 'viavel')] };
    };

    const relato = await processarFilaComIA(files, { metadataBase: METADATA, sessoesExistentes: [], analisar, gravar });

    expect(chamados).toEqual(['a.png', 'b.png']);
    expect(sessoes.map((s) => s.filename)).toEqual(['a.png']); // b chegou depois do cancelamento: descartada
    expect(relato.gravadas).toBe(1);
    expect(relato.interrompidaEm).toBe(1);
    expect(filaIAEmAndamento()).toBe(false);
  });

  it('uma segunda fila enquanto a primeira roda é recusada — há um worker só', async () => {
    let soltar: () => void = () => {};
    const segura = new Promise<void>((r) => {
      soltar = r;
    });
    const analisar = async (): Promise<AnaliseDeUmaImagem> => {
      await segura;
      return { deteccoes: [] };
    };
    const { gravar } = gravadorEmMemoria();
    const primeira = processarFilaComIA(arquivos(['a.png']), { metadataBase: METADATA, sessoesExistentes: [], analisar, gravar });

    expect(filaIAEmAndamento()).toBe(true);
    await expect(
      processarFilaComIA(arquivos(['b.png']), { metadataBase: METADATA, sessoesExistentes: [], analisar, gravar })
    ).rejects.toThrow(/já há uma fila/i);

    soltar();
    await primeira;
    expect(filaIAEmAndamento()).toBe(false);
  });

  it('uma imagem que falha entra no relato e na trilha; a fila segue', async () => {
    const files = arquivos(['a.tif', 'b.png', 'c.png']);
    const { analisar } = analisadorDe({
      'a.tif': new Error('TIFF que este leitor não entende'),
      'b.png': [deteccao(10, 10, 'viavel')],
      'c.png': [deteccao(10, 10, 'viavel')],
    });
    const { sessoes, gravar } = gravadorEmMemoria();

    const relato = await processarFilaComIA(files, { metadataBase: METADATA, sessoesExistentes: [], analisar, gravar });

    expect(relato.gravadas).toBe(2);
    expect(relato.falhas).toEqual([{ rotulo: 'a.tif', erro: 'TIFF que este leitor não entende' }]);
    expect(relato.interrompidaEm).toBeNull();
    expect(sessoes.map((s) => s.filename)).toEqual(['b.png', 'c.png']);

    const erros = lerErros();
    expect(erros).toHaveLength(1);
    expect(erros[0].mensagem).toMatch(/TIFF/);
    // a trilha registra extensão e tamanho — nunca o nome do arquivo
    const falha = lerTrilha().find((e) => e.tipo === 'fila-ia:falha');
    expect(falha?.detalhe).toEqual({ indice: 0, extensao: 'tif', bytes: 1 });
    expect(JSON.stringify(lerTrilha())).not.toContain('a.tif');
  });

  it('gravar que falha vira falha daquela imagem, não da fila', async () => {
    const files = arquivos(['a.png', 'b.png']);
    const { analisar } = analisadorDe({ 'a.png': [], 'b.png': [] });
    const gravar = async (s: Session) => {
      if (s.filename === 'a.png') throw new Error('QuotaExceededError');
    };
    const relato = await processarFilaComIA(files, { metadataBase: METADATA, sessoesExistentes: [], analisar, gravar });
    expect(relato.gravadas).toBe(1);
    expect(relato.falhas[0].rotulo).toBe('a.png');
    expect(relato.falhas[0].erro).toMatch(/gravar.*QuotaExceededError/);
  });

  it('outra detecção tomando o worker PARA a fila em vez de disputar', async () => {
    const files = arquivos(['a.png', 'b.png', 'c.png']);
    const { analisar, chamados } = analisadorDe({
      'a.png': [],
      'b.png': new DeteccaoTomadaPorOutra(),
      'c.png': [],
    });
    const { gravar } = gravadorEmMemoria();
    const relato = await processarFilaComIA(files, { metadataBase: METADATA, sessoesExistentes: [], analisar, gravar });
    expect(chamados).toEqual(['a.png', 'b.png']);
    expect(relato.interrompidaEm).toBe(1);
    expect(relato.falhas[0].rotulo).toBe('b.png');
  });

  it('duplicata é pulada e listada — contra sessões existentes e contra a própria fila', async () => {
    const files = arquivos(['a.png', 'b.png', 'a.png']);
    const { analisar, chamados } = analisadorDe({ 'a.png': [], 'b.png': [] });
    const { sessoes, gravar } = gravadorEmMemoria();
    const existente: Session = {
      id: 'x',
      date: '2026-01-01T00:00:00.000Z',
      filename: 'b.png',
      viableCount: 0,
      inviableCount: 0,
      metadata: METADATA,
    };

    const relato = await processarFilaComIA(files, {
      metadataBase: METADATA,
      sessoesExistentes: [existente],
      analisar,
      gravar,
    });

    expect(chamados).toEqual(['a.png']); // b já existia; o segundo a.png já foi gravado nesta fila
    expect(sessoes.map((s) => s.filename)).toEqual(['a.png']);
    expect(relato.puladas).toEqual(['b.png', 'a.png']);
    expect(relato.gravadas).toBe(1);
  });

  it('a fila é a do clique: mudar a lista depois de começar não muda o que se processa', async () => {
    const files = arquivos(['a.png', 'b.png']);
    const { analisar, chamados } = analisadorDe({ 'a.png': [], 'b.png': [] });
    const { gravar } = gravadorEmMemoria();
    const promessa = processarFilaComIA(files, { metadataBase: METADATA, sessoesExistentes: [], analisar, gravar });
    files.push(new File(['x'], 'c.png'));
    files.length = 0;
    const relato = await promessa;
    expect(chamados).toEqual(['a.png', 'b.png']);
    expect(relato.total).toBe(2);
  });

  it('detecção sem máscara conta como marcação e é declarada no relato', async () => {
    const { analisar } = analisadorDe({ 'a.png': [deteccao(10, 10, 'viavel', false), deteccao(30, 30, 'viavel')] });
    const { sessoes, gravar } = gravadorEmMemoria();
    const relato = await processarFilaComIA(arquivos(['a.png']), {
      metadataBase: METADATA,
      sessoesExistentes: [],
      analisar,
      gravar,
    });
    expect(relato.semContorno).toBe(1);
    expect(sessoes[0].viableCount).toBe(2);
    expect(sessoes[0].yoloSegmentations).toHaveLength(1);
  });
});

describe('descreverRelato', () => {
  it('diz quantas viraram sessão, quais foram puladas e quais falharam', () => {
    const texto = descreverRelato({
      total: 5,
      gravadas: 2,
      puladas: ['p1.png'],
      falhas: [{ rotulo: 'p2.tif', erro: 'TIFF ilegível' }],
      semContorno: 3,
      interrompidaEm: null,
    });
    expect(texto).toContain('2 de 5');
    expect(texto).toContain('p1.png');
    expect(texto).toContain('p2.tif — TIFF ilegível');
    expect(texto).toContain('3 detecções vieram sem contorno');
  });

  it('quando interrompida, diz em qual imagem', () => {
    const texto = descreverRelato({ total: 30, gravadas: 6, puladas: [], falhas: [], semContorno: 0, interrompidaEm: 6 });
    expect(texto).toMatch(/interrompida na imagem 7 de 30/);
    expect(texto).toContain('6 sessões gravadas');
  });
});
