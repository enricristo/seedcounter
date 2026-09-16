/* global FileSystemDirectoryHandle, FileSystemFileHandle */
/**
 * Fonte de arquivos do explorador de datasets.
 *
 * Duas formas de apontar uma pasta local, uma mesma lista na saída:
 * File System Access API (`showDirectoryPicker`), com o handle guardado no
 * Dexie para a permissão persistir entre sessões — e o fallback
 * `<input webkitdirectory>` para navegadores sem a API (Firefox, Safari),
 * que funciona mas não lembra nada.
 *
 * Este módulo TOCA File/FileSystemHandle/DOM de propósito — é a camada que
 * `src/lib/datasets/` (puro, testável em node) não pode tocar. Só
 * `agruparPorConjunto` é puro aqui, e é o único testado em node.
 */
import { db, type PastaDeDatasetGuardada } from '../../lib/db';

/** Um arquivo dentro da pasta aberta. Caminho relativo à raiz, sempre com `/`. */
export interface ArquivoDoDataset {
  caminho: string;
  obterFile(): Promise<File>;
}

/** Um conjunto = subpasta de primeiro nível (ou a raiz, para imagens soltas). */
export interface ConjuntoDeArquivos {
  nome: string;
  caminhos: string[];
}

export interface PastaAberta {
  nome: string;
  arquivos: ArquivoDoDataset[];
  conjuntos: ConjuntoDeArquivos[];
  /** 'handle': permissão lembrada (Chrome/Edge). 'input': não lembra (fallback). */
  origem: 'handle' | 'input';
}

/** Nome do que aparece no painel quando a imagem está solta na raiz da pasta. */
const NOME_DA_RAIZ = '(raiz)';

/** Limites da varredura — a pasta real tem ~60.000 arquivos; sem limite, trava a aba. */
const PROFUNDIDADE_MAXIMA = 6;
const MAXIMO_DE_ENTRADAS = 100_000;
/** A cada quantas entradas a varredura cede a tela (evita "página não responde"). */
const CEDER_A_CADA = 500;

export function suportaHandles(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Agrupa caminhos por conjunto: a subpasta de primeiro nível é o conjunto;
 * imagem sem subpasta (direto na raiz) vai para `(raiz)`, sempre por último —
 * é o "resto" da pasta, não um conjunto que alguém nomeou.
 *
 * Puro: só strings, sem depender de `File` nem do navegador — é a parte
 * testável em node deste módulo.
 */
export function agruparPorConjunto(caminhos: string[]): ConjuntoDeArquivos[] {
  const porNome = new Map<string, string[]>();
  for (const caminho of caminhos) {
    const normalizado = caminho.replace(/\\/g, '/');
    const barra = normalizado.indexOf('/');
    const nome = barra === -1 ? NOME_DA_RAIZ : normalizado.slice(0, barra);
    const lista = porNome.get(nome);
    if (lista) {
      lista.push(normalizado);
    } else {
      porNome.set(nome, [normalizado]);
    }
  }

  const comRaiz = porNome.has(NOME_DA_RAIZ);
  const nomes = [...porNome.keys()].filter((n) => n !== NOME_DA_RAIZ).sort((a, b) => a.localeCompare(b));
  if (comRaiz) nomes.push(NOME_DA_RAIZ);

  return nomes.map((nome) => ({ nome, caminhos: porNome.get(nome)! }));
}

/** Cede a tela; usado pela varredura para não travar a aba em pastas grandes. */
function cederATela(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Varre a árvore recursivamente listando caminhos — nunca abre arquivo aqui,
 * `obterFile()` é preguiçoso e só lê quando alguém pedir. Profundidade e
 * contagem de entradas são limitadas porque a pasta real (~60.000 arquivos,
 * datasets de sementes com dezenas de milhares de imagens) não cabe inteira
 * sem ceder a tela.
 */
async function varrerDiretorio(
  dir: FileSystemDirectoryHandle,
  prefixo: string,
  profundidade: number,
  arquivos: ArquivoDoDataset[],
  contador: { entradas: number }
): Promise<void> {
  if (profundidade > PROFUNDIDADE_MAXIMA) return;

  for await (const [nome, handle] of dir.entries()) {
    contador.entradas++;
    if (contador.entradas > MAXIMO_DE_ENTRADAS) return;
    if (contador.entradas % CEDER_A_CADA === 0) await cederATela();

    const caminho = prefixo ? `${prefixo}/${nome}` : nome;
    if (handle.kind === 'file') {
      const arquivoHandle = handle as FileSystemFileHandle;
      arquivos.push({
        caminho,
        obterFile: () => arquivoHandle.getFile(),
      });
    } else {
      await varrerDiretorio(handle as FileSystemDirectoryHandle, caminho, profundidade + 1, arquivos, contador);
    }
  }
}

/**
 * Abre uma pasta via File System Access API, varre recursivamente e guarda o
 * handle no Dexie (marcando-o como a pasta aberta) para `reabrirUltimaPasta`
 * usar depois. Devolve `null` se a pessoa cancelar o seletor, ou se o
 * navegador não suportar `showDirectoryPicker`.
 */
export async function abrirPastaComHandle(): Promise<PastaAberta | null> {
  if (!suportaHandles()) return null;

  let handle: FileSystemDirectoryHandle;
  try {
    handle = await window.showDirectoryPicker!({ mode: 'read' });
  } catch {
    // AbortError (cancelou o seletor) ou qualquer outra falha de permissão — sem pasta.
    return null;
  }

  const arquivos: ArquivoDoDataset[] = [];
  await varrerDiretorio(handle, '', 0, arquivos, { entradas: 0 });

  await guardarHandle(handle);

  return {
    nome: handle.name,
    arquivos,
    conjuntos: agruparPorConjunto(arquivos.map((a) => a.caminho)),
    origem: 'handle',
  };
}

/**
 * Fallback para navegadores sem File System Access API: `<input type="file"
 * webkitdirectory>` entrega uma FileList cujo `webkitRelativePath` já traz
 * `nomeDaPasta/subpasta/arquivo.ext`. Tiramos o primeiro segmento (a própria
 * pasta escolhida) porque `agruparPorConjunto` espera caminhos relativos à
 * raiz, não à pasta-mãe da pasta.
 */
export function abrirPastaComInput(files: FileList): PastaAberta {
  const lista = Array.from(files);
  let nomeDaPasta = '';
  const arquivos: ArquivoDoDataset[] = [];

  for (const file of lista) {
    const relativo = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const normalizado = relativo.replace(/\\/g, '/');
    const barra = normalizado.indexOf('/');
    if (barra === -1) {
      // Sem subpasta — não deveria acontecer com webkitdirectory, mas não trava por isso.
      arquivos.push({ caminho: normalizado, obterFile: () => Promise.resolve(file) });
      continue;
    }
    if (!nomeDaPasta) nomeDaPasta = normalizado.slice(0, barra);
    const caminho = normalizado.slice(barra + 1);
    arquivos.push({ caminho, obterFile: () => Promise.resolve(file) });
  }

  return {
    nome: nomeDaPasta || '(pasta)',
    arquivos,
    conjuntos: agruparPorConjunto(arquivos.map((a) => a.caminho)),
    origem: 'input',
  };
}

/** Guarda o handle como a pasta aberta; desmarca as anteriores. */
async function guardarHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.transaction('rw', db.pastasDeDatasets, async () => {
    await db.pastasDeDatasets.toCollection().modify({ aberta: false });
    const existente = await db.pastasDeDatasets.where('nome').equals(handle.name).first();
    const registro: PastaDeDatasetGuardada = {
      id: existente?.id,
      nome: handle.name,
      handle,
      aberta: true,
    };
    await db.pastasDeDatasets.put(registro);
  });
}

/**
 * Reabre a última pasta guardada no Dexie. Revalida a permissão com
 * `queryPermission` antes de varrer — o handle sobrevive à recarga da página,
 * mas a permissão de leitura pode ter sido revogada; se estiver em
 * `'prompt'`, pede de novo com `requestPermission` (exige gesto do usuário,
 * então isto só funciona quando chamado a partir de um clique). Devolve
 * `null` se não houver pasta guardada, se a API não existir neste navegador,
 * ou se a permissão for negada.
 */
export async function reabrirUltimaPasta(): Promise<PastaAberta | null> {
  if (!suportaHandles()) return null;

  // IndexedDB não aceita boolean como chave de índice — `aberta` está listado
  // no schema para documentar a intenção, mas a busca é feita em memória
  // (a tabela guarda uma pasta por nome, nunca milhares de registros).
  const registro = (await db.pastasDeDatasets.toArray()).find((p) => p.aberta);
  if (!registro) return null;

  const handle = registro.handle;
  if (!handle.queryPermission) return null;

  let estado = await handle.queryPermission({ mode: 'read' });
  if (estado === 'prompt' && handle.requestPermission) {
    estado = await handle.requestPermission({ mode: 'read' });
  }
  if (estado !== 'granted') return null;

  const arquivos: ArquivoDoDataset[] = [];
  await varrerDiretorio(handle, '', 0, arquivos, { entradas: 0 });

  return {
    nome: handle.name,
    arquivos,
    conjuntos: agruparPorConjunto(arquivos.map((a) => a.caminho)),
    origem: 'handle',
  };
}
