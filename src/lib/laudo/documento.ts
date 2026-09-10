// =============================================================================
// SeedCounter — desenho do documento
//
// A composição do PDF. O modelo já chegou pronto de `montagem.ts`; aqui só se
// decide onde cada coisa fica na folha.
//
// A PALETA VEM DO SISTEMA DE DESIGN, e isso corrige uma deriva. O gerador
// anterior pintava a faixa do cabeçalho em esmeralda (#10b981) — a cor que o
// aplicativo abandonou quando adotou o acento único da bancada óptica
// (#0c6e7a). O documento que saía do laboratório não se parecia com o programa
// que o produziu.
//
// As cores das sementes vêm de theme/specimen.ts, as mesmas do canvas e da
// imagem: assim a legenda do laudo descreve exatamente o que a figura mostra.
// Onde a cor do espécime seria ilegível como texto (ciano sobre branco), ela
// aparece como AMOSTRA DE COR ao lado do número, e o número fica em tinta
// escura — a cor liga o dado à figura sem custar contraste.
// =============================================================================

import { jsPDF } from 'jspdf';
import { ESPECIME } from '../../theme/specimen';
import { ajustarNaCaixa, larguraDaColuna } from './layout';
import { AUSENTE, type DocumentoDeLaudo } from './montagem';
import type { ImagensDoLaudo } from './imagens';
import type { Logotipo } from './marca';

// --- Papel ------------------------------------------------------------------

const MARGEM = 42;
const A4 = { largura: 595.28, altura: 841.89 };
const LARGURA_UTIL = A4.largura - MARGEM * 2;

// --- Tinta ------------------------------------------------------------------
// Valores de src/index.css. Só o tema claro: papel não tem tema.

const COR = {
  tinta1: '#182023',
  tinta2: '#4a585c',
  tinta3: '#637378',
  linha: '#cbd6d9',
  linhaSuave: '#e1e8ea',
  acento: '#0c6e7a',
  acentoTinta: '#e0f0f2',
  alerta: '#b5730c',
  alertaFundo: '#fdf6e7',
  superficie: '#edf2f4',
  papel: '#ffffff',
} as const;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// --- Cursor -----------------------------------------------------------------

/**
 * A posição vertical corrente, com quebra de página.
 *
 * O gerador anterior somava coordenadas na mão (`metaY + 24`, `canvasY + 15`),
 * o que fazia qualquer campo a mais exigir reajuste manual de tudo abaixo — e
 * era por isso que ele nunca paginava: não havia como. O cursor resolve as
 * duas coisas.
 */
class Cursor {
  y = 0;

  constructor(
    private doc: jsPDF,
    private aoQuebrar: () => number
  ) {
    this.y = this.aoQuebrar();
  }

  /** Garante espaço; abre página nova quando não cabe. */
  espaco(altura: number) {
    if (this.y + altura > A4.altura - 74) {
      this.doc.addPage();
      this.y = this.aoQuebrar();
    }
  }

  avancar(d: number) {
    this.y += d;
  }
}

// --- Peças ------------------------------------------------------------------

function texto(
  doc: jsPDF,
  conteudo: string,
  x: number,
  y: number,
  op: {
    tamanho?: number;
    peso?: 'normal' | 'bold';
    cor?: string;
    largura?: number;
    alinhar?: 'left' | 'center' | 'right';
  } = {}
) {
  const { tamanho = 9, peso = 'normal', cor = COR.tinta1, largura, alinhar = 'left' } = op;
  doc.setFont('Helvetica', peso);
  doc.setFontSize(tamanho);
  doc.setTextColor(...rgb(cor));
  doc.text(conteudo, x, y, { maxWidth: largura, align: alinhar });
}

/** Altura que um texto vai ocupar depois de quebrado na largura dada. */
function alturaDoTexto(doc: jsPDF, conteudo: string, largura: number, tamanho: number): number {
  doc.setFontSize(tamanho);
  const linhas = doc.splitTextToSize(conteudo, largura) as string[];
  return linhas.length * tamanho * 1.25;
}

function regua(doc: jsPDF, y: number, cor: string = COR.linha, espessura = 0.75) {
  doc.setDrawColor(...rgb(cor));
  doc.setLineWidth(espessura);
  doc.line(MARGEM, y, A4.largura - MARGEM, y);
}

function tituloDeSecao(doc: jsPDF, cursor: Cursor, rotulo: string) {
  cursor.espaco(34);
  texto(doc, rotulo.toUpperCase(), MARGEM, cursor.y, {
    tamanho: 8,
    peso: 'bold',
    cor: COR.acento,
  });
  cursor.avancar(5);
  regua(doc, cursor.y, COR.linhaSuave, 0.5);
  cursor.avancar(14);
}

// --- Cabeçalho --------------------------------------------------------------

function desenharCabecalho(doc: jsPDF, laudo: DocumentoDeLaudo, logos: Logotipo[]): number {
  // Faixa do acento: a assinatura visual do programa no papel.
  doc.setFillColor(...rgb(COR.acento));
  doc.rect(0, 0, A4.largura, 5, 'F');

  let y = MARGEM + 4;

  // Logotipos à direita, proporção preservada, alinhados pela base.
  const alturaLogo = 30;
  let xLogo = A4.largura - MARGEM;
  for (const logo of [...logos].reverse()) {
    const caixa = ajustarNaCaixa(
      { largura: logo.largura, altura: logo.altura },
      { largura: 74, altura: alturaLogo }
    );
    if (caixa.largura <= 0) continue;
    xLogo -= caixa.largura;
    doc.addImage(logo.dataUrl, 'PNG', xLogo, y - 10, caixa.largura, caixa.altura);
    xLogo -= 10;
  }

  const larguraTexto = Math.max(220, xLogo - MARGEM - 10);

  texto(doc, laudo.cabecalho.instituicao, MARGEM, y, {
    tamanho: 12,
    peso: 'bold',
    cor: COR.tinta1,
    largura: larguraTexto,
  });
  y += alturaDoTexto(doc, laudo.cabecalho.instituicao, larguraTexto, 12);

  for (const linha of laudo.cabecalho.linhas) {
    if (!linha?.trim()) continue;
    texto(doc, linha, MARGEM, y, { tamanho: 7.5, cor: COR.tinta3, largura: larguraTexto });
    y += alturaDoTexto(doc, linha, larguraTexto, 7.5);
  }

  y = Math.max(y, MARGEM + alturaLogo + 4) + 6;
  regua(doc, y, COR.linha, 1);
  return y + 20;
}

/** Cabeçalho reduzido das páginas seguintes. */
function desenharCabecalhoDeContinuacao(doc: jsPDF, laudo: DocumentoDeLaudo): number {
  doc.setFillColor(...rgb(COR.acento));
  doc.rect(0, 0, A4.largura, 3, 'F');

  const y = MARGEM;
  texto(doc, laudo.titulo, MARGEM, y, { tamanho: 8, peso: 'bold', cor: COR.tinta2 });
  if (laudo.numero !== AUSENTE) {
    texto(doc, `Nº ${laudo.numero}`, A4.largura - MARGEM, y, {
      tamanho: 8,
      cor: COR.tinta3,
      alinhar: 'right',
    });
  }
  regua(doc, y + 6, COR.linhaSuave, 0.5);
  return y + 24;
}

// --- Título e ressalva ------------------------------------------------------

function desenharTitulo(doc: jsPDF, cursor: Cursor, laudo: DocumentoDeLaudo) {
  texto(doc, laudo.titulo, MARGEM, cursor.y, { tamanho: 17, peso: 'bold', cor: COR.tinta1 });

  if (laudo.numero !== AUSENTE) {
    texto(doc, `Nº ${laudo.numero}`, A4.largura - MARGEM, cursor.y, {
      tamanho: 12,
      peso: 'bold',
      cor: COR.acento,
      alinhar: 'right',
    });
  }
  cursor.avancar(13);

  texto(doc, `Emitido em ${laudo.emitidoEm}`, MARGEM, cursor.y, { tamanho: 7.5, cor: COR.tinta3 });
  cursor.avancar(18);
}

function desenharRessalva(doc: jsPDF, cursor: Cursor, laudo: DocumentoDeLaudo) {
  if (!laudo.ressalva) return;

  const larguraTexto = LARGURA_UTIL - 24;
  const alturaCorpo = alturaDoTexto(doc, laudo.ressalva, larguraTexto, 8);
  const pendencias = laudo.pendencias.length
    ? `Campos obrigatórios ausentes: ${laudo.pendencias.join('; ')}.`
    : '';
  const alturaPendencias = pendencias ? alturaDoTexto(doc, pendencias, larguraTexto, 7) + 4 : 0;
  const altura = alturaCorpo + alturaPendencias + 20;

  cursor.espaco(altura + 10);

  doc.setFillColor(...rgb(COR.alertaFundo));
  doc.setDrawColor(...rgb(COR.alerta));
  doc.setLineWidth(0.75);
  doc.roundedRect(MARGEM, cursor.y - 10, LARGURA_UTIL, altura, 4, 4, 'FD');

  // Barra sólida à esquerda: distingue o aviso de um bloco de conteúdo comum
  // mesmo numa impressão em escala de cinza.
  doc.setFillColor(...rgb(COR.alerta));
  doc.rect(MARGEM, cursor.y - 10, 3, altura, 'F');

  let y = cursor.y + 2;
  texto(doc, laudo.ressalva, MARGEM + 12, y, {
    tamanho: 8,
    peso: 'bold',
    cor: COR.alerta,
    largura: larguraTexto,
  });
  y += alturaCorpo;

  if (pendencias) {
    y += 4;
    texto(doc, pendencias, MARGEM + 12, y, {
      tamanho: 7,
      cor: COR.tinta2,
      largura: larguraTexto,
    });
  }

  cursor.y = cursor.y - 10 + altura + 18;
}

// --- Resultado --------------------------------------------------------------

function desenharResultados(doc: jsPDF, cursor: Cursor, laudo: DocumentoDeLaudo) {
  tituloDeSecao(doc, cursor, 'Resultado da contagem');

  const alturaCartao = 56;
  cursor.espaco(alturaCartao + 8);

  const vao = 12;
  const largura = larguraDaColuna(LARGURA_UTIL, laudo.resultados.length, vao);

  laudo.resultados.forEach((r, i) => {
    const x = MARGEM + i * (largura + vao);
    const total = r.papel === 'total';

    doc.setFillColor(...rgb(total ? COR.acentoTinta : COR.superficie));
    doc.roundedRect(x, cursor.y, largura, alturaCartao, 5, 5, 'F');

    // Amostra da cor do espécime: liga o número à figura sem usar a cor como
    // tinta de texto, onde ciano sobre branco reprovaria em contraste.
    if (!total) {
      doc.setFillColor(...rgb(r.papel === 'viavel' ? ESPECIME.viable : ESPECIME.inviable));
      doc.circle(x + 14, cursor.y + 15, 4, 'F');
      doc.setDrawColor(...rgb(COR.tinta2));
      doc.setLineWidth(0.5);
      doc.circle(x + 14, cursor.y + 15, 4, 'S');
    }

    texto(doc, r.rotulo.toUpperCase(), x + (total ? 14 : 24), cursor.y + 18, {
      tamanho: 7.5,
      peso: 'bold',
      cor: COR.tinta2,
    });

    texto(doc, String(r.contagem), x + 14, cursor.y + 43, {
      tamanho: 21,
      peso: 'bold',
      cor: total ? COR.acento : COR.tinta1,
    });

    if (r.porcentagem) {
      texto(doc, r.porcentagem, x + largura - 12, cursor.y + 43, {
        tamanho: 10,
        cor: COR.tinta2,
        alinhar: 'right',
      });
    }
  });

  cursor.avancar(alturaCartao + 20);
}

// --- Campos -----------------------------------------------------------------

function desenharBlocos(doc: jsPDF, cursor: Cursor, laudo: DocumentoDeLaudo) {
  for (const bloco of laudo.blocos) {
    if (bloco.campos.length === 0) continue;
    tituloDeSecao(doc, cursor, bloco.titulo);

    const vao = 24;
    const largura = larguraDaColuna(LARGURA_UTIL, 2, vao);
    const larguraRotulo = 88;
    const larguraValor = largura - larguraRotulo;
    const ESPACO_MINIMO = 15;

    // A ALTURA DE CADA LINHA VEM DO TEXTO, não de uma constante.
    //
    // A primeira versão usava 15 pt fixos por campo. Uma procedência longa
    // ("Fazenda Santa Rita — Álvares Machado/SP") quebrava em duas linhas e a
    // segunda linha era escrita POR CIMA do campo seguinte — no laudo de teste,
    // o número da amostra ficou soterrado. Num documento normativo isso é pior
    // que feio: é um campo ilegível que ninguém percebe ter sumido.
    const alturas = bloco.campos.map((c) =>
      Math.max(ESPACO_MINIMO, alturaDoTexto(doc, c.valor, larguraValor, 8.5) + 4)
    );

    // Preenche COLUNA A COLUNA, não linha a linha: a lista é lida de cima para
    // baixo, como lista, e não em ziguezague.
    const porColuna = Math.ceil(bloco.campos.length / 2);
    const alturaDaColuna = (c: number) =>
      alturas.slice(c * porColuna, (c + 1) * porColuna).reduce((t, h) => t + h, 0);
    const alturaTotal = Math.max(alturaDaColuna(0), alturaDaColuna(1));

    cursor.espaco(alturaTotal + 6);

    const y = [cursor.y, cursor.y];
    bloco.campos.forEach((campo, i) => {
      const coluna = Math.floor(i / porColuna);
      const x = MARGEM + coluna * (largura + vao);

      texto(doc, campo.rotulo, x, y[coluna], { tamanho: 7.5, cor: COR.tinta3 });
      texto(doc, campo.valor, x + larguraRotulo, y[coluna], {
        tamanho: 8.5,
        peso: 'bold',
        cor: COR.tinta1,
        largura: larguraValor,
      });
      y[coluna] += alturas[i];
    });

    cursor.avancar(alturaTotal + 12);
  }
}

// --- Imagens ----------------------------------------------------------------

function desenharImagens(doc: jsPDF, cursor: Cursor, imagens: ImagensDoLaudo | null) {
  if (!imagens) return;

  tituloDeSecao(doc, cursor, 'Registro fotográfico');

  const vao = 14;
  const largura = larguraDaColuna(LARGURA_UTIL, 2, vao);
  const caixa = ajustarNaCaixa(
    { largura: imagens.largura, altura: imagens.altura },
    { largura, altura: 250 }
  );

  cursor.espaco(caixa.altura + 34);

  const painel = [
    { dados: imagens.original, legenda: 'Imagem original, sem anotação' },
    { dados: imagens.analisada, legenda: 'Objetos identificados e conferidos' },
  ];

  painel.forEach((p, i) => {
    const x = MARGEM + i * (largura + vao) + (largura - caixa.largura) / 2;

    doc.addImage(p.dados, 'JPEG', x, cursor.y, caixa.largura, caixa.altura);
    doc.setDrawColor(...rgb(COR.linha));
    doc.setLineWidth(0.75);
    doc.rect(x, cursor.y, caixa.largura, caixa.altura, 'S');

    texto(doc, p.legenda, MARGEM + i * (largura + vao), cursor.y + caixa.altura + 11, {
      tamanho: 7,
      cor: COR.tinta3,
      largura,
    });
  });

  cursor.avancar(caixa.altura + 26);
}

// --- Rastreabilidade, observações, assinatura -------------------------------

function desenharRastreabilidade(doc: jsPDF, cursor: Cursor, laudo: DocumentoDeLaudo) {
  tituloDeSecao(doc, cursor, 'Método e rastreabilidade');

  for (const campo of laudo.rastreabilidade) {
    const largura = LARGURA_UTIL - 108;
    const altura = Math.max(12, alturaDoTexto(doc, campo.valor, largura, 8));
    cursor.espaco(altura + 4);

    texto(doc, campo.rotulo, MARGEM, cursor.y, { tamanho: 7.5, cor: COR.tinta3 });
    texto(doc, campo.valor, MARGEM + 108, cursor.y, {
      tamanho: 8,
      cor: COR.tinta1,
      largura,
    });
    cursor.avancar(altura + 2);
  }

  cursor.avancar(10);
}

function desenharObservacoes(doc: jsPDF, cursor: Cursor, laudo: DocumentoDeLaudo) {
  // A IN 40/2010 pede o campo, mesmo vazio: um boletim sem "Observações" é um
  // boletim com um campo faltando, não um boletim mais limpo.
  const conteudo = laudo.observacoes.trim() || 'Nada a observar.';
  tituloDeSecao(doc, cursor, 'Observações');

  const altura = alturaDoTexto(doc, conteudo, LARGURA_UTIL, 8);
  cursor.espaco(altura + 8);
  texto(doc, conteudo, MARGEM, cursor.y, { tamanho: 8, cor: COR.tinta1, largura: LARGURA_UTIL });
  cursor.avancar(altura + 18);
}

function desenharAssinatura(doc: jsPDF, cursor: Cursor, laudo: DocumentoDeLaudo) {
  cursor.espaco(64);
  cursor.avancar(16);

  const largura = 240;
  const x = (A4.largura - largura) / 2;

  doc.setDrawColor(...rgb(COR.tinta2));
  doc.setLineWidth(0.75);
  doc.line(x, cursor.y, x + largura, cursor.y);

  texto(doc, laudo.assinatura.nome, A4.largura / 2, cursor.y + 12, {
    tamanho: 9,
    peso: 'bold',
    cor: COR.tinta1,
    alinhar: 'center',
  });
  texto(doc, laudo.assinatura.cargo, A4.largura / 2, cursor.y + 23, {
    tamanho: 7.5,
    cor: COR.tinta3,
    alinhar: 'center',
  });

  cursor.avancar(36);
}

/**
 * Um laudo e as páginas que ele ocupou.
 *
 * Num arquivo com vários laudos, o rodapé de cada página precisa saber a QUAL
 * laudo aquela página pertence — o aviso "não é um BAS" vale para as páginas
 * daquele documento, não para o arquivo inteiro.
 */
export interface Trecho {
  laudo: DocumentoDeLaudo;
  inicio: number;
  fim: number;
}

export function desenharRodapes(doc: jsPDF, trechos: Trecho[]) {
  const paginas = doc.getNumberOfPages();

  for (const { laudo, inicio, fim } of trechos) {
    for (let p = inicio; p <= Math.min(fim, paginas); p++) {
      desenharRodape(doc, laudo, p, paginas);
    }
  }
}

function desenharRodape(doc: jsPDF, laudo: DocumentoDeLaudo, p: number, paginas: number) {
  {
    doc.setPage(p);
    const y = A4.altura - 40;
    regua(doc, y, COR.linhaSuave, 0.5);

    texto(doc, 'SeedCounter — contagem de sementes assistida por imagem', MARGEM, y + 12, {
      tamanho: 6.5,
      cor: COR.tinta3,
    });
    texto(
      doc,
      'Unoeste • Laboratório de Sementes e Tecido Vegetal — Campus II, Presidente Prudente/SP',
      MARGEM,
      y + 21,
      { tamanho: 6.5, cor: COR.tinta3 }
    );

    texto(doc, `Página ${p} de ${paginas}`, A4.largura - MARGEM, y + 12, {
      tamanho: 6.5,
      cor: COR.tinta3,
      alinhar: 'right',
    });

    if (laudo.especie === 'relatorio') {
      texto(doc, 'DOCUMENTO DE PESQUISA — NÃO É UM BAS', A4.largura - MARGEM, y + 21, {
        tamanho: 6.5,
        peso: 'bold',
        cor: COR.alerta,
        alinhar: 'right',
      });
    }
  }
}

// --- Composição -------------------------------------------------------------

export function novoDocumento(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
}

/**
 * Escreve um laudo no documento, a partir da página corrente.
 *
 * Devolve o trecho de páginas que ocupou, para o rodapé saber depois a qual
 * laudo cada página pertence. Não desenha rodapé: a numeração "página X de Y"
 * só é conhecida quando o arquivo inteiro está montado.
 */
export function adicionarLaudo(
  doc: jsPDF,
  laudo: DocumentoDeLaudo,
  imagens: ImagensDoLaudo | null,
  logos: Logotipo[]
): Trecho {
  const inicio = doc.getNumberOfPages();

  let primeira = true;
  const cursor = new Cursor(doc, () => {
    if (primeira) {
      primeira = false;
      return desenharCabecalho(doc, laudo, logos);
    }
    return desenharCabecalhoDeContinuacao(doc, laudo);
  });

  desenharTitulo(doc, cursor, laudo);
  desenharRessalva(doc, cursor, laudo);
  desenharResultados(doc, cursor, laudo);
  desenharBlocos(doc, cursor, laudo);
  desenharImagens(doc, cursor, imagens);
  desenharRastreabilidade(doc, cursor, laudo);
  desenharObservacoes(doc, cursor, laudo);
  desenharAssinatura(doc, cursor, laudo);

  return { laudo, inicio, fim: doc.getNumberOfPages() };
}

/**
 * Compõe um laudo sozinho e devolve o jsPDF pronto para salvar.
 *
 * Devolver em vez de salvar deixa o chamador decidir: baixar, anexar, ou
 * mostrar. Salvar de dentro tornaria isto impossível de reaproveitar.
 */
export function comporLaudo(
  laudo: DocumentoDeLaudo,
  imagens: ImagensDoLaudo | null,
  logos: Logotipo[]
): jsPDF {
  const doc = novoDocumento();
  const trecho = adicionarLaudo(doc, laudo, imagens, logos);
  desenharRodapes(doc, [trecho]);
  return doc;
}
