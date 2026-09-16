// =============================================================================
// Detecção de "pasta por classe": raiz/<classe>/<imagem>.
//
// POR QUÊ.
//
// Vários conjuntos (café, milho, trigo durum) não têm anotação nenhuma além
// do nome da subpasta. Só reconhecemos isso quando há pelo menos duas
// subpastas de primeiro nível com imagem dentro e nenhuma imagem solta na
// raiz — senão o palpite é fraco demais (ex.: uma única subpasta `train/`).
//
// Arquivos que não são imagem (README, txt de citação) não contam nem para
// bloquear (raiz) nem para formar classe — só olhamos para o que vira
// miniatura. A checagem de extensão é duplicada aqui (em vez de importar de
// `formato.ts`) para não criar um ciclo entre os dois módulos.
// =============================================================================

const EXTENSOES_DE_IMAGEM = /\.(jpe?g|png|tiff?|bmp|webp)$/i;

export function classesPorPasta(caminhos: string[]): Map<string, string[]> | null {
  const porClasse = new Map<string, string[]>();
  let temImagemNaRaiz = false;

  for (const caminhoBruto of caminhos) {
    const caminho = caminhoBruto.replace(/\\/g, '/');
    if (!EXTENSOES_DE_IMAGEM.test(caminho)) continue;

    const partes = caminho.split('/');
    if (partes.length < 2) {
      temImagemNaRaiz = true;
      continue;
    }
    const classe = partes[0];
    const lista = porClasse.get(classe) ?? [];
    lista.push(caminho);
    porClasse.set(classe, lista);
  }

  if (temImagemNaRaiz) return null;
  if (porClasse.size < 2) return null;

  return porClasse;
}
