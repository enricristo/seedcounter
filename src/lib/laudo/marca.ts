// =============================================================================
// SeedCounter — a marca no documento
//
// Carrega os logotipos para dentro do PDF.
//
// A REGRA QUE GOVERNA ESTE MÓDULO: um logotipo que não carrega NUNCA impede um
// laudo de sair. O documento existe por causa dos números; a marca é
// identificação institucional, não conteúdo. Rede fora do ar, arquivo movido,
// build servido de outro caminho — em qualquer desses casos o laudo sai sem o
// logotipo, e sai.
//
// Por isso tudo aqui devolve `null` em vez de lançar, e há um limite de tempo:
// uma requisição pendurada travaria a exportação sem dizer por quê.
// =============================================================================

/** Tempo máximo esperando um logotipo. Depois disso o laudo sai sem ele. */
const LIMITE_MS = 3000;

export interface Logotipo {
  dataUrl: string;
  largura: number;
  altura: number;
}

const cache = new Map<string, Logotipo | null>();

/**
 * Carrega um arquivo de `public/` como data URL, com as dimensões naturais.
 *
 * As dimensões vêm junto porque quem desenha precisa preservar a proporção —
 * um logotipo esticado é pior que logotipo nenhum.
 */
export async function carregarLogotipo(arquivo: string): Promise<Logotipo | null> {
  if (cache.has(arquivo)) return cache.get(arquivo) ?? null;

  const resultado = await Promise.race([
    carregar(arquivo),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LIMITE_MS)),
  ]).catch(() => null);

  cache.set(arquivo, resultado);
  return resultado;
}

async function carregar(arquivo: string): Promise<Logotipo | null> {
  const base = import.meta.env.BASE_URL ?? '/';
  const url = `${base}${base.endsWith('/') ? '' : '/'}${arquivo}`;

  const imagem = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  if (!imagem || !imagem.naturalWidth) return null;

  const canvas = document.createElement('canvas');
  canvas.width = imagem.naturalWidth;
  canvas.height = imagem.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(imagem, 0, 0);

  try {
    return {
      dataUrl: canvas.toDataURL('image/png'),
      largura: imagem.naturalWidth,
      altura: imagem.naturalHeight,
    };
  } catch {
    // Canvas contaminado por origem cruzada. Sem logotipo, com laudo.
    return null;
  }
}

/** Os logotipos do cabeçalho, na ordem em que aparecem. */
export async function logotiposInstitucionais(): Promise<Logotipo[]> {
  const carregados = await Promise.all([
    carregarLogotipo('logo-gpeorq.png'),
    carregarLogotipo('logo-gpsem.png'),
  ]);
  return carregados.filter((l): l is Logotipo => l !== null);
}

/** Esquece o que foi carregado. Existe para o teste não vazar estado. */
export function limparCacheDeLogotipos() {
  cache.clear();
}
