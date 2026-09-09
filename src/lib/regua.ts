// =============================================================================
// SeedCounter — a escala da régua
//
// DUAS UNIDADES AO MESMO TEMPO, E NÃO ALTERNÂNCIA.
//
// A régua trocava de unidade: sem calibração mostrava pixel, com calibração
// mostrava milímetro, e o pixel sumia. Mas as duas unidades respondem a
// perguntas diferentes e são precisas ao mesmo tempo:
//
//   o PIXEL é o que a imagem tem — é nele que se raciocina sobre resolução,
//     sobre o raio da onda, sobre quanto detalhe existe para segmentar;
//   o MILÍMETRO é como o lote é descrito, medido e publicado.
//
// Alternar obrigaria a lembrar em qual modo a régua está — o mesmo erro que a
// máscara evita mostrando o estado no próprio botão. Régua profissional resolve
// isso há séculos: duas escalas impressas, lado a lado.
//
// O PASSO SEGUE A UNIDADE FÍSICA QUANDO ELA EXISTE.
//
// Um traço a cada 283,7 px não ajuda ninguém; um traço a cada 2 mm ajuda. Então
// quando há calibração o passo é escolhido em milímetro e o pixel vira o rótulo
// secundário — que sai quebrado, e tudo bem: é o número que a imagem tem, não
// um número que alguém escolheu.
// =============================================================================

export interface EscalaDaRegua {
  /** Distância entre traços principais, em pixels da imagem. */
  pixelsPorTraco: number;
  /** Unidade do rótulo principal, para o canto da régua. */
  unidade: 'mm' | 'px';
  /** O rótulo grande do traço `i`. */
  principal: (i: number) => string;
  /** O rótulo pequeno, ou `null` quando não há segunda escala. */
  secundario: ((i: number) => string) | null;
}

/**
 * Arredonda um passo para 1, 2, 5 ou 10 vezes uma potência de dez.
 *
 * É o que faz a régua marcar 2 mm em vez de 1,87 mm. O olho lê escala redonda;
 * escala quebrada obriga a fazer conta para saber onde está.
 */
export function passoBonito(bruto: number): number {
  if (!Number.isFinite(bruto) || bruto <= 0) return 1;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const normalizado = bruto / potencia;
  const bonito = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return bonito * potencia;
}

/** Comprimento em milímetros, escrito na casa que o valor merece. */
export function escreverMm(mm: number): string {
  if (!Number.isFinite(mm)) return '';
  if (mm === 0) return '0';
  // Abaixo de 1 mm o micrômetro é a unidade que a pessoa usa de fato.
  if (Math.abs(mm) < 1) return `${Math.round(mm * 1000)}µm`;
  // `Number()` derruba o zero à direita: 2,50 vira 2,5, e 2,00 vira 2.
  return `${Number(mm.toFixed(2))}mm`;
}

export interface OpcoesDaRegua {
  zoom: number;
  umPerPixel?: number;
  /** Distância desejada entre traços, em pixels de TELA. */
  alvoNaTela?: number;
}

/**
 * Monta a escala da régua para o zoom e a calibração atuais.
 *
 * Sem calibração devolve só pixel — inventar milímetro sem escala seria pior
 * que não ter a segunda linha.
 */
export function escalaDaRegua({
  zoom,
  umPerPixel,
  alvoNaTela = 90,
}: OpcoesDaRegua): EscalaDaRegua {
  const zoomSeguro = Math.max(0.01, Number.isFinite(zoom) ? zoom : 1);
  const pixelsDaImagemPorTraco = alvoNaTela / zoomSeguro;

  if (umPerPixel && umPerPixel > 0) {
    const mmPorTraco = passoBonito((pixelsDaImagemPorTraco * umPerPixel) / 1000);
    const pixelsPorTraco = (mmPorTraco * 1000) / umPerPixel;
    return {
      pixelsPorTraco,
      unidade: 'mm',
      principal: (i) => escreverMm(i * mmPorTraco),
      // O pixel sai quebrado de propósito: é o que a imagem tem naquele ponto,
      // não um número escolhido para ficar bonito.
      secundario: (i) => `${Math.round(i * pixelsPorTraco)}px`,
    };
  }

  const pixelsPorTraco = passoBonito(pixelsDaImagemPorTraco);
  return {
    pixelsPorTraco,
    unidade: 'px',
    principal: (i) => `${Math.round(i * pixelsPorTraco)}`,
    secundario: null,
  };
}
