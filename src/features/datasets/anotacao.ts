// =============================================================================
// Interpreta a anotação de UMA imagem dentro de um conjunto já reconhecido.
//
// POR QUÊ.
//
// `reconhecerFormato` (B1) diz QUE FORMATO um conjunto tem e onde estão os
// arquivos de anotação; este módulo lê o conteúdo desses arquivos para UMA
// imagem específica e devolve algo que o App sabe desenhar — polígonos,
// marcas de caixa, ou só a classe da imagem.
//
// Continua puro no sentido do plano: a única operação que toca o disco é
// `arquivo.obterFile()` (e `.text()` no File que ela devolve). Todo o resto —
// escolher qual `.txt`/`.csv`/`data.yaml` corresponde à imagem, decidir se é
// caixa ou polígono, montar a classe pelo índice — é lógica sobre strings,
// testável com uma fonte falsa em memória.
//
// DESVIO DO ESBOÇO DO PLANO: a assinatura sugerida era
// `lerAnotacaoDe(pasta, conjunto, caminho, largura, altura)`. Em vez de passar
// `PastaAberta` inteira (que mistura TODOS os conjuntos), quem chama monta um
// `Map` só com os arquivos deste conjunto, já indexado pelo caminho RELATIVO
// AO CONJUNTO — o mesmo vocabulário que `reconhecerFormato` usa em
// `imagens`/`anotacao`. Isso evita este módulo precisar saber como o nome do
// conjunto vira prefixo de caminho (regra que já mora em `DatasetsPanel.tsx`
// e em `agruparPorConjunto`), e mantém a árvore de dependência de mão única.
// =============================================================================

import type { ArquivoDoDataset } from './fonte';
import type { DatasetReconhecido } from '../../lib/datasets/formato';
import { parDeLabelYolo } from '../../lib/datasets/formato';
import { lerLabelYolo, centroDaAnotacao } from '../../lib/datasets/yolo';
import { lerNamesDoDataYaml } from '../../lib/datasets/data-yaml';
import { lerClassesCsv } from '../../lib/datasets/roboflow-multiclass';

/** Um polígono de referência (contorno), com a classe do rótulo original. */
export interface ContornoDeReferencia {
  poligono: [number, number][];
  classe: string;
}

/** Uma caixa de referência, reduzida ao centro — vira marca, não contorno. */
export interface MarcaDeReferencia {
  x: number;
  y: number;
  classe: string;
}

export interface AnotacaoCarregada {
  /** Presente quando o rótulo YOLO desta imagem tem polígono(s). */
  contornos?: ContornoDeReferencia[];
  /** Presente quando o rótulo YOLO desta imagem tem caixa(s). */
  marcas?: MarcaDeReferencia[];
  /** Classe(s) da IMAGEM inteira — multiclasse (CSV) ou pasta-por-classe. */
  classesDaImagem?: string[];
  /** Classes conhecidas do conjunto (data.yaml, cabeçalho do CSV, ou nomes de pasta) — para o chip/filtro mesmo sem marcação nesta imagem em particular. */
  classes: string[];
}

async function lerTexto(arquivo: ArquivoDoDataset | undefined): Promise<string | null> {
  if (!arquivo) return null;
  try {
    const file = await arquivo.obterFile();
    return await file.text();
  } catch {
    // Arquivo sumiu, permissão revogada no meio da sessão, etc. — sem
    // anotação para esta imagem, não uma exceção que derruba o clique.
    return null;
  }
}

function nomeBase(caminho: string): string {
  const barra = caminho.lastIndexOf('/');
  return barra === -1 ? caminho : caminho.slice(barra + 1);
}

function diretorioDe(caminho: string): string {
  const barra = caminho.lastIndexOf('/');
  return barra === -1 ? '' : caminho.slice(0, barra + 1);
}

/**
 * Lê a anotação de uma imagem, dado o conjunto já reconhecido (B1) e um mapa
 * dos arquivos do conjunto indexado pelo caminho relativo ao CONJUNTO (mesmo
 * vocabulário de `reconhecido.imagens`/`reconhecido.anotacao`).
 *
 * `largura`/`altura` são as dimensões em pixel da imagem JÁ DECODIFICADA —
 * necessárias para desnormalizar as coordenadas YOLO (0..1). Devolve `null`
 * quando o formato não declara anotação carregável (`solto`, e por ora
 * `mascara-de-instancia`/`mascara-binaria`, que a B3 não cobre) ou quando o
 * arquivo de anotação esperado não foi encontrado.
 */
export async function lerAnotacaoDe(
  arquivosDoConjunto: Map<string, ArquivoDoDataset>,
  reconhecido: DatasetReconhecido,
  caminhoDaImagem: string,
  largura: number,
  altura: number
): Promise<AnotacaoCarregada | null> {
  switch (reconhecido.formato) {
    case 'yolo': {
      const caminhoDoLabel = parDeLabelYolo(caminhoDaImagem);
      const textoDoLabel = await lerTexto(arquivosDoConjunto.get(caminhoDoLabel));
      if (textoDoLabel == null) return null; // sem .txt pareado: nada para carregar

      const caminhoDoYaml = reconhecido.anotacao.find((c) => /(^|\/)data\.ya?ml$/i.test(c));
      const textoDoYaml = caminhoDoYaml ? await lerTexto(arquivosDoConjunto.get(caminhoDoYaml)) : null;
      const nomes = textoDoYaml != null ? lerNamesDoDataYaml(textoDoYaml) : [];

      const anotacoes = lerLabelYolo(textoDoLabel, largura, altura);
      const contornos: ContornoDeReferencia[] = [];
      const marcas: MarcaDeReferencia[] = [];
      for (const a of anotacoes) {
        const classe = nomes[a.classe] ?? String(a.classe);
        if (a.poligono) {
          contornos.push({ poligono: a.poligono, classe });
        } else if (a.caixa) {
          const [x, y] = centroDaAnotacao(a);
          marcas.push({ x, y, classe });
        }
      }
      if (contornos.length === 0 && marcas.length === 0) return null;
      return {
        contornos: contornos.length > 0 ? contornos : undefined,
        marcas: marcas.length > 0 ? marcas : undefined,
        classes: nomes,
      };
    }

    case 'roboflow-multiclass': {
      // O `_classes.csv` do Roboflow existe uma vez por split (train/valid/
      // test); a imagem pertence ao CSV que está na mesma pasta dela.
      const diretorioDaImagem = diretorioDe(caminhoDaImagem);
      const caminhoDoCsv =
        reconhecido.anotacao.find((c) => diretorioDe(c) === diretorioDaImagem) ?? reconhecido.anotacao[0];
      const textoDoCsv = caminhoDoCsv ? await lerTexto(arquivosDoConjunto.get(caminhoDoCsv)) : null;
      if (textoDoCsv == null) return null;

      const { classes, porImagem } = lerClassesCsv(textoDoCsv);
      const classesDaImagem = porImagem.get(nomeBase(caminhoDaImagem)) ?? [];
      return { classesDaImagem, classes };
    }

    case 'pasta-por-classe': {
      // A classe É o primeiro segmento do caminho — não há arquivo para ler.
      const barra = caminhoDaImagem.indexOf('/');
      if (barra === -1) return null;
      const classe = caminhoDaImagem.slice(0, barra);
      return { classesDaImagem: [classe], classes: reconhecido.classes };
    }

    case 'mascara-de-instancia':
    case 'mascara-binaria':
    case 'solto':
      // Fora do escopo desta tarefa (ver plano B3 — só yolo, multiclass e
      // pasta-por-classe).
      return null;

    default: {
      // Casos explícitos em cima, não um catch-all: se `FormatoDeDataset`
      // ganhar um valor novo sem que este switch seja atualizado, isto para
      // de compilar em vez de cair aqui em silêncio.
      const _exaustivo: never = reconhecido.formato;
      return _exaustivo;
    }
  }
}
