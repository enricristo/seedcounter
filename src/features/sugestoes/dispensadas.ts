// =============================================================================
// SeedCounter — memória do que a pessoa dispensou
//
// "AGORA NÃO" NÃO É "NUNCA MAIS" — E ÀS VEZES É.
//
// Uma marcação sem contorno é problema DESTA imagem: dispensar o aviso não
// deve calar a mesma sugestão na próxima digitalização, que tem seu próprio
// punhado de marcações soltas. Já declarar a espécie no laudo é hábito de
// bancada — dispensar essa vale para sempre, ou o cartão volta a cada imagem
// nova enquanto a pessoa não muda de rotina. Por isso a dispensa carrega
// escopo: 'sempre', ou a chave da imagem em que foi dispensada.
//
// Guardado em localStorage sob 'sc:sugestoesDispensadas', como um mapa
// id -> escopo. Tudo em try/catch: armazenamento bloqueado (aba anônima,
// política de navegador, cota cheia) não pode derrubar o aplicativo — só
// perde a memória da dispensa, e o cartão volta a aparecer.
// =============================================================================

const CHAVE = 'sc:sugestoesDispensadas';

/** 'sempre', ou a chave da imagem em que a sugestão foi dispensada. */
type MapaDeDispensas = Record<string, string>;

function ler(): MapaDeDispensas {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return {};
    const analisado: unknown = JSON.parse(bruto);
    if (!analisado || typeof analisado !== 'object' || Array.isArray(analisado)) return {};
    return analisado as MapaDeDispensas;
  } catch {
    // Sem armazenamento (bloqueado, ou nem existe): trata como se nada
    // tivesse sido dispensado ainda.
    return {};
  }
}

function escrever(mapa: MapaDeDispensas): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(mapa));
  } catch {
    // Ignorado de propósito: não poder lembrar não pode impedir de usar.
  }
}

/**
 * As dispensas que valem AGORA para esta imagem: as de escopo 'sempre' mais
 * as que foram dispensadas especificamente nesta `chaveDaImagem`.
 */
export function lerDispensadas(chaveDaImagem: string | null): Set<string> {
  const mapa = ler();
  const validas = new Set<string>();
  for (const [id, escopo] of Object.entries(mapa)) {
    if (escopo === 'sempre' || (chaveDaImagem !== null && escopo === chaveDaImagem)) {
      validas.add(id);
    }
  }
  return validas;
}

/** Registra que a pessoa dispensou esta sugestão, no escopo escolhido. */
export function dispensar(
  id: string,
  escopo: 'imagem' | 'sempre',
  chaveDaImagem: string | null
): void {
  if (escopo === 'imagem' && chaveDaImagem === null) {
    // Sem imagem carregada não há o que escopar — não há o que gravar.
    return;
  }
  const mapa = ler();
  mapa[id] = escopo === 'sempre' ? 'sempre' : (chaveDaImagem as string);
  escrever(mapa);
}
