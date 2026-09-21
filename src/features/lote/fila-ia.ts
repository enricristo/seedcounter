// =============================================================================
// SeedCounter — a fila inteira pelo modelo ("Processar Fila (IA)")
//
// O QUE É. A pessoa carregou trinta placas na fila e quer o YOLO em todas,
// sem abrir uma a uma: cada imagem vira UMA SESSÃO na Galeria, com marcações
// e contornos do modelo, e a cena aberta no canvas NÃO é tocada. É o irmão do
// Lote (`lote.ts`) para quem confia no modelo o bastante para não conferir
// antes — por isso grava direto, e por isso precisa ser mais cuidadoso com
// o que grava.
//
// POR QUE O LAÇO MORA AQUI E NÃO NO App. A primeira versão era um `for`
// dentro de `App.tsx` que (1) reaproveitava o `ref` de cancelamento do
// ensaio ao carregar — que ninguém zerava, então um ensaio parado antes fazia
// a fila terminar na imagem zero; (2) podia rodar duas vezes ao mesmo tempo
// se o botão fosse clicado de novo; (3) derrubava a fila inteira na primeira
// imagem que falhasse; (4) gravava a mesma placa de novo se já houvesse
// sessão; (5) marcava toda semente como inviável por um `classId === 1` que
// em `YOLO_CLASSES` é 'viavel'. Nada disso era testável dentro do App. Aqui o
// laço é puro — `analisar` e `gravar` são injetados — e cada regra tem teste.
//
// AS REGRAS.
//
//   - UMA FILA POR VEZ. Há um worker de inferência só, e duas filas
//     cancelariam as detecções uma da outra. Um segundo pedido é recusado.
//   - CANCELÁVEL DE FORA. `cancelarFilaIA()` para o laço na próxima imagem;
//     a imagem em andamento termina, mas o resultado dela NÃO é gravado —
//     cancelar significa "não grave mais nada", não "grave até onde deu".
//   - ERRO É POR IMAGEM. TIFF corrompido, modelo ausente, worker morto: a
//     imagem entra no relato como falha, vai para a trilha, e a fila segue.
//     Exceção: se OUTRA detecção tomou o worker (a pessoa rodou o AI Pointer
//     no meio), a fila para — insistir cancelaria a detecção da pessoa.
//   - DUPLICATA PULA. O Lote pergunta à pessoa porque tem tabela e botão;
//     aqui não há onde perguntar no meio de trinta imagens. Uma placa que já
//     tem sessão com o mesmo nome de arquivo é pulada e listada no relato —
//     nunca gravada de novo em silêncio.
//   - A SESSÃO DIZ DE ONDE VEIO. `metadata.procedencia.modo = 'automatica'`
//     e `metadata.receita` = a receita de IA: quem abrir a sessão depois sabe
//     que nenhuma pessoa conferiu aquele número.
//
// FORMATO DA SESSÃO — mesmo do AI Pointer, não do Lote: cada detecção vira
// uma MARCAÇÃO (é o que conta), e as que vieram com máscara ganham também o
// CONTORNO, ligado à marcação por `marcaId`. Assim uma detecção sem máscara
// não some da contagem, e `enumerarObjetos` pareia contorno e marca sem
// contar duas vezes. A contagem gravada sai de `contarObjetos` — a mesma
// função que toda tela usa — para a sessão nunca dizer um número que a
// Galeria, ao abri-la, não confirme.
// =============================================================================

import { contarObjetos } from '../../lib/contagem';
import { calculateSeedDimensions } from '../../lib/pca-utils';
import { extensaoDe, registrarErro, registrarEvento } from '../../lib/diagnostico/trilha';
import { RECEITAS } from '../ensaio/receitas';
import { ehDuplicata } from './duplicata';
import { decodificarParaCanvas } from './abrir-imagem';
import { categoriaDaDeteccao, descreverFalhaDoModelo, type Detector } from './processar-imagem';
import type { YoloDetection } from '../../lib/yolo-onnx';
import type { Mark, Metadata, ProcedenciaDaAnalise, Session, YoloSegmentation } from '../../types';

/** O que `analisar` devolve por imagem: as detecções e a foto para a sessão. */
export interface AnaliseDeUmaImagem {
  deteccoes: YoloDetection[];
  /** JPEG da imagem (data URL) para a sessão poder ser reaberta. Ausente = sessão sem foto. */
  imagemJpeg?: string;
}

export interface OpcoesDaFilaIA {
  /** Metadados da bancada de onde a fila foi disparada — base de cada sessão. */
  metadataBase: Metadata;
  /** Sessões já gravadas, para a checagem de duplicata. */
  sessoesExistentes: Session[];
  /** Abre a imagem e roda o modelo. Injetado: é o que toca canvas e worker. */
  analisar: (file: File) => Promise<AnaliseDeUmaImagem>;
  /** Grava a sessão (Dexie). */
  gravar: (sessao: Session) => Promise<void>;
  /** Chamado antes de cada imagem, para a barra de atividade. */
  progresso?: (feito: number, total: number, rotulo: string) => void;
  /** Versão/commit para a procedência. Ausente fora do build. */
  versaoDoApp?: string;
  commit?: string;
  /** Relógio injetável — os ids de sessão e marcação saem dele. */
  agora?: () => number;
}

export interface FalhaDaFila {
  rotulo: string;
  erro: string;
}

export interface RelatoDaFilaIA {
  total: number;
  gravadas: number;
  /** Nomes de arquivo pulados por já terem sessão. */
  puladas: string[];
  falhas: FalhaDaFila[];
  /** Detecções que vieram sem máscara e entraram só como marcação. */
  semContorno: number;
  /** Índice (0-based) em que o cancelamento pegou; `null` = terminou tudo. */
  interrompidaEm: number | null;
}

// ---------------------------------------------------------------------------
// Uma fila por vez, cancelável de fora
// ---------------------------------------------------------------------------

let filaAtual: { cancelada: boolean } | null = null;

/** Há uma fila rodando agora? O botão usa isto para se desabilitar. */
export function filaIAEmAndamento(): boolean {
  return filaAtual !== null;
}

/** Pede à fila em andamento que pare na próxima imagem. Sem fila, não faz nada. */
export function cancelarFilaIA(): void {
  if (filaAtual) filaAtual.cancelada = true;
}

/** Lançado quando outra detecção tomou o worker no meio da fila. */
export class DeteccaoTomadaPorOutra extends Error {
  constructor() {
    super('Outra detecção começou antes desta terminar.');
    this.name = 'DeteccaoTomadaPorOutra';
  }
}

// ---------------------------------------------------------------------------
// De detecções a sessão
// ---------------------------------------------------------------------------

/** A receita de IA, como o Lote a registra — para a sessão ser auditável do mesmo jeito. */
const RECEITA_DE_IA = RECEITAS.find((r) => r.localizacao.usaModeloDeIA);

/**
 * Monta a sessão de uma imagem a partir do que o modelo devolveu.
 *
 * Pura: recebe o relógio para os ids serem previsíveis no teste.
 */
export function sessaoDeDeteccoes(
  entrada: {
    filename: string;
    deteccoes: YoloDetection[];
    imagemJpeg?: string;
    metadataBase: Metadata;
    versaoDoApp?: string;
    commit?: string;
  },
  agora: number
): { sessao: Session; semContorno: number } {
  const marks: Mark[] = entrada.deteccoes.map((d, i) => ({
    id: agora + i,
    x: d.x,
    y: d.y,
    type: categoriaDaDeteccao(d),
  }));

  const yoloSegmentations: YoloSegmentation[] = [];
  entrada.deteccoes.forEach((d, i) => {
    if (!d.polygon || d.polygon.length < 3) return;
    const { width, height } = calculateSeedDimensions(d.polygon);
    yoloSegmentations.push({
      id: agora + 1_000_000 + i,
      category: categoriaDaDeteccao(d),
      class_name: d.className,
      confidence: d.confidence,
      polygon_points: d.polygon,
      visible: true,
      width,
      height,
      origem: 'modelo',
      marcaId: marks[i].id,
    });
  });

  const contagem = contarObjetos(marks, yoloSegmentations);

  const procedencia: ProcedenciaDaAnalise = {
    ...entrada.metadataBase.procedencia,
    versaoDoApp: entrada.versaoDoApp,
    commit: entrada.commit,
    modo: 'automatica',
  };

  const metadata: Metadata = {
    ...entrada.metadataBase,
    procedencia,
    ...(RECEITA_DE_IA
      ? { receita: { id: RECEITA_DE_IA.id, parametros: { localizacao: RECEITA_DE_IA.localizacao, onda: RECEITA_DE_IA.onda } } }
      : {}),
  };

  return {
    sessao: {
      id: `${agora}-fila-ia`,
      date: new Date(agora).toISOString(),
      filename: entrada.filename,
      viableCount: contagem.viaveis,
      inviableCount: contagem.inviaveis,
      metadata,
      marks,
      yoloSegmentations,
      imageData: entrada.imagemJpeg,
    },
    semContorno: marks.length - yoloSegmentations.length,
  };
}

// ---------------------------------------------------------------------------
// O laço
// ---------------------------------------------------------------------------

/**
 * Roda o modelo em cada arquivo de `files`, gravando uma sessão por imagem.
 *
 * `files` é copiado na entrada: a fila do app pode mudar enquanto isto roda
 * (a pessoa carrega outra pasta), e a lista que se prometeu processar é a
 * que estava na tela quando o botão foi apertado.
 */
export async function processarFilaComIA(files: File[], opcoes: OpcoesDaFilaIA): Promise<RelatoDaFilaIA> {
  if (filaAtual) throw new Error('Já há uma fila com IA em andamento.');
  const fila = files.slice();
  const agora = opcoes.agora ?? Date.now;
  const token = { cancelada: false };
  filaAtual = token;

  const relato: RelatoDaFilaIA = {
    total: fila.length,
    gravadas: 0,
    puladas: [],
    falhas: [],
    semContorno: 0,
    interrompidaEm: null,
  };
  const gravadasNestaFila = new Set<string>();

  try {
    for (let i = 0; i < fila.length; i++) {
      if (token.cancelada) {
        relato.interrompidaEm = i;
        break;
      }
      const file = fila[i];
      opcoes.progresso?.(i, fila.length, file.name);

      // Duplicata contra o que já existia E contra o que esta fila acabou de
      // gravar — o mesmo arquivo duas vezes na fila é a duplicata mais fácil
      // de produzir (arrastar a pasta de novo).
      if (gravadasNestaFila.has(file.name) || ehDuplicata(file.name, opcoes.sessoesExistentes).length > 0) {
        relato.puladas.push(file.name);
        continue;
      }

      let analise: AnaliseDeUmaImagem;
      try {
        analise = await opcoes.analisar(file);
      } catch (erro) {
        // Trilha: a extensão e o tamanho explicam um TIFF que não abre; o
        // nome do arquivo não explicaria nada a mais e é dado de quem usa.
        registrarErro(erro, 'manual');
        registrarEvento('fila-ia:falha', { indice: i, extensao: extensaoDe(file.name), bytes: file.size });
        if (erro instanceof DeteccaoTomadaPorOutra) {
          // Não é falha da imagem: é a pessoa usando o worker para outra
          // coisa. Parar aqui é o que evita a fila cancelar a detecção dela.
          relato.falhas.push({ rotulo: file.name, erro: erro.message });
          relato.interrompidaEm = i;
          break;
        }
        relato.falhas.push({ rotulo: file.name, erro: erro instanceof Error ? erro.message : String(erro) });
        continue;
      }

      // O resultado chegou, mas a pessoa cancelou enquanto o worker
      // calculava: nada mais é gravado. É o mesmo princípio de
      // `resultadoAindaVale` — o que conta é o estado NA CHEGADA.
      if (token.cancelada) {
        relato.interrompidaEm = i;
        break;
      }

      const { sessao, semContorno } = sessaoDeDeteccoes(
        {
          filename: file.name,
          deteccoes: analise.deteccoes,
          imagemJpeg: analise.imagemJpeg,
          metadataBase: opcoes.metadataBase,
          versaoDoApp: opcoes.versaoDoApp,
          commit: opcoes.commit,
        },
        agora()
      );
      relato.semContorno += semContorno;

      try {
        await opcoes.gravar(sessao);
        relato.gravadas++;
        gravadasNestaFila.add(file.name);
      } catch (erro) {
        registrarErro(erro, 'manual');
        relato.falhas.push({
          rotulo: file.name,
          erro: `Não foi possível gravar a sessão: ${erro instanceof Error ? erro.message : String(erro)}`,
        });
      }
    }
  } finally {
    if (filaAtual === token) filaAtual = null;
  }

  // Trilha: a fila é a operação mais longa do aplicativo, e o relato dela
  // chega sempre como "parou no meio" — estes números dizem onde e por quê.
  registrarEvento('fila-ia:rodar', {
    imagens: relato.total,
    gravadas: relato.gravadas,
    puladas: relato.puladas.length,
    falhas: relato.falhas.length,
    semContorno: relato.semContorno,
    interrompidaEm: relato.interrompidaEm,
  });

  return relato;
}

/**
 * O relato em uma frase (ou algumas), para a pessoa — nomes de arquivo
 * entram aqui de propósito: é a tela dela, não a trilha.
 */
export function descreverRelato(relato: RelatoDaFilaIA): string {
  const linhas: string[] = [];
  if (relato.interrompidaEm !== null) {
    linhas.push(
      `Fila interrompida na imagem ${relato.interrompidaEm + 1} de ${relato.total}: ` +
        `${relato.gravadas} ${relato.gravadas === 1 ? 'sessão gravada' : 'sessões gravadas'} na Galeria.`
    );
  } else {
    linhas.push(
      `Fila concluída: ${relato.gravadas} de ${relato.total} ${relato.total === 1 ? 'imagem virou sessão' : 'imagens viraram sessões'} na Galeria.`
    );
  }
  if (relato.puladas.length > 0) {
    linhas.push(
      `${relato.puladas.length} ${relato.puladas.length === 1 ? 'pulada' : 'puladas'} por já ter sessão com o mesmo nome: ${relato.puladas.join(', ')}.`
    );
  }
  if (relato.falhas.length > 0) {
    linhas.push(
      `${relato.falhas.length} ${relato.falhas.length === 1 ? 'falhou' : 'falharam'}:\n` +
        relato.falhas.map((f) => `• ${f.rotulo} — ${f.erro}`).join('\n')
    );
  }
  if (relato.semContorno > 0) {
    linhas.push(
      `${relato.semContorno} ${relato.semContorno === 1 ? 'detecção veio' : 'detecções vieram'} sem contorno e ` +
        `${relato.semContorno === 1 ? 'entrou' : 'entraram'} só como marcação (contam, mas sem medida).`
    );
  }
  return linhas.join('\n\n');
}

// ---------------------------------------------------------------------------
// A parte real, que toca canvas e worker
// ---------------------------------------------------------------------------

/**
 * O `analisar` de produção: decodifica, lê os pixels uma vez, despacha ao
 * worker e tira o JPEG para a sessão.
 *
 * CUIDADO DE MEMÓRIA: o canvas e o `ImageData` vivem só nesta função. O
 * `ImageData` é passado ao worker numa expressão só (clonado lá dentro) e a
 * nossa cópia pode ser coletada durante a inferência; o canvas sai de escopo
 * ao devolver. Nada de pixel vai para a sessão nem para o estado — a sessão
 * leva o JPEG, que é a convenção de `saveCurrentSession`.
 */
export async function analisarComModelo(file: File, detectar: Detector): Promise<AnaliseDeUmaImagem> {
  const canvas = await decodificarParaCanvas(file);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');

  let deteccoes: YoloDetection[];
  try {
    deteccoes = await detectar(ctx.getImageData(0, 0, canvas.width, canvas.height), {
      // Sem máscara não há contorno, e sem contorno não há morfometria nem
      // cor — a sessão ficaria só com pontos.
      withMasks: true,
    });
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    if (/cancelad/i.test(msg)) throw new DeteccaoTomadaPorOutra();
    throw new Error(descreverFalhaDoModelo(erro));
  }

  return { deteccoes, imagemJpeg: canvas.toDataURL('image/jpeg', 0.85) };
}
