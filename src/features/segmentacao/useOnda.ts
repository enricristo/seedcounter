// =============================================================================
// SeedCounter — a onda: contorno por clique, "contornar esta" e o lote
//
// POR QUE EXISTE. `segmentarComOnda` (clique avulso), `handleSegmentarUma`
// ("contornar esta" na galeria) e `handleSegmentarPendentes` (o lote das
// marcações sem contorno) rodavam a mesma sequência dentro do App —
// `segmentarNoCanvas`, decidir se o contorno é confiável, montar o
// `YoloSegmentation`, avisar. A parte pura (o objeto que cada um monta, os
// recados) está em `contorno-do-clique.ts`; aqui fica só a orquestração: ler
// a cena, chamar `segmentarNoCanvas`, decidir os ids (que dependem do
// relógio — por isso moram AQUI, não na parte pura) e escrever no estado.
//
// TRÊS FÓRMULAS DE ID, DE PROPÓSITO — NÃO UNIFICADAS.
//   clique avulso   → Date.now() + Math.floor(Math.random() * 1000)
//   "uma" (galeria) → Date.now()
//   lote            → Date.now() + i
// Nasceram em momentos diferentes e nunca colidiram na prática: o clique
// avulso e "uma" são um evento por vez; o lote soma `i` porque várias
// chamadas de `Date.now()` no mesmo laço caem no mesmo milissegundo, e sem o
// `+ i` colidiriam entre si. O contrato desta extração é comportamento
// IDÊNTICO — uniformizar seria consertar algo que ninguém pediu.
//
// `marcarComSom` FICA FORA DESTE MÓDULO, DE PROPÓSITO. `handleCanvasClick`
// também a chama fora da onda (ferramenta de marcação manual, sem contorno)
// — então ela continua definida no App (marca + `tocarMarca`) e este hook só
// RECEBE a função pronta, como recebe `appendYoloSegmentation`.
//
// O QUE FICA NO APP, E POR QUÊ (não é deste hook):
//   `recadoDaOnda` — estado do App, mostrado junto ao canvas e usado por
//     outros temas (carregar referência, desenho à mão); o hook recebe um
//     callback (`avisar`).
//   `marcasSemContorno` — derivado (`useMemo`) usado também pela galeria,
//     fora da onda.
//   `imagemDeTrabalho`/`imagemParaAutomacoes` — estado de CENA.
//   `handleCanvasClick` — decide QUANDO chamar `segmentarComOnda`
//     (ferramenta ativa, Shift/Ctrl invertendo a classe); é outro tema.
//   `classeExternaDaImagem` — o App continua computando a variável (outros
//     temas também a leem, como o desenho à mão); só a FÓRMULA foi
//     substituída por `classeExternaDe`, de `contorno-do-clique.ts`.
//
// DEPENDÊNCIAS DOS `useCallback`: COPIADAS DO APP, `imagemParaAutomacoes`
// INCLUSIVE FALTANDO. No App, nenhum dos três handlers tinha
// `imagemParaAutomacoes` na lista de deps (o eslint já avisava disso nos
// três — `react-hooks/exhaustive-deps` nas linhas 1203, 2165 e 2223 da
// develop). Preservar a lista INTEIRA, com essa falta, é preservar QUANDO o
// callback se renova — a extração não pode mudar isso, então o aviso apenas
// se MUDA de arquivo, não desaparece nem se duplica. `avisar`,
// `iniciarAtividade` e `atualizarProgresso` entram nas listas porque agora
// chegam como PARÂMETRO do hook (antes eram, respectivamente, um `setState`
// nativo e um import de módulo — os dois que o eslint reconhece como
// estáveis sem exigir — e por isso não apareciam nas listas originais); os
// três continuam de fato estáveis (o App passa `setRecadoDaOnda` e os
// imports direto, sem embrulhar), então listá-los não muda o comportamento,
// só satisfaz a regra sem criar aviso novo.
// =============================================================================

import { useCallback, useState } from 'react';
import type { Mark, YoloSegmentation } from '../../types';
import type { OpcoesDeRegistro } from '../../lib/historico';
import type { Categoria } from '../../lib/classe-do-modelo';
import { segmentarNoCanvas } from './onda-no-canvas';
import { contornoDoClique, recadoDoContorno, recadoDeUma, recadoDoLote } from './contorno-do-clique';

export interface EntradaDaOnda {
  imagemDeTrabalho: HTMLImageElement | null;
  imagemParaAutomacoes: HTMLImageElement | null;

  marks: Mark[];
  /** A mesma lista que a galeria mostra como "falta contornar". */
  marcasSemContorno: Mark[];
  appendYoloSegmentation: (seg: YoloSegmentation, op?: OpcoesDeRegistro) => void;

  /** Ver o cabeçalho: mora no App porque `handleCanvasClick` também a usa fora da onda. */
  marcarComSom: (x: number, y: number, tipo: Categoria) => number;

  /** `metadata.umPerPixel` — só o clique avulso formata a área com ele. */
  umPerPixel: number | undefined;
  /** `classeExternaDaImagem` — só o clique avulso usa; "uma" e o lote usam `marca.classeExterna`. */
  classeExterna: string | undefined;

  /** Ver o cabeçalho: `recadoDaOnda` é do App — este hook só avisa. */
  avisar: (recado: { tom: 'ok' | 'aviso'; texto: string }) => void;

  iniciarAtividade: (chave: string, rotulo: string) => () => void;
  atualizarProgresso: (chave: string, progresso: number, rotulo?: string) => void;
}

export function useOnda(entrada: EntradaDaOnda) {
  const {
    imagemDeTrabalho,
    imagemParaAutomacoes,
    marks,
    marcasSemContorno,
    appendYoloSegmentation,
    marcarComSom,
    umPerPixel,
    classeExterna,
    avisar,
    iniciarAtividade,
    atualizarProgresso,
  } = entrada;

  /**
   * Segmentação por clique.
   *
   * A marcação é criada SEMPRE, mesmo quando o contorno não sai confiável: o
   * ponto clicado é a identidade e a localização da semente, e a contagem não
   * pode depender de o algoritmo ter acertado a borda. Quem contou foi a
   * pessoa. O contorno, esse sim, só entra quando dá para confiar.
   */
  const segmentarComOnda = useCallback(
    (x: number, y: number, tipo: Categoria) => {
      // `imagemParaAutomacoes` some quando forcarOriginalNasAutomacoes está
      // ligado mas a imagem original ainda não carregou — guarda de tipo, não
      // caso novo: sem ela, segmentarNoCanvas nem tem o que ler.
      if (!imagemDeTrabalho || !imagemParaAutomacoes) return;
      const marcaId = marcarComSom(x, y, tipo);

      const inicio = performance.now();
      // A imagem de TRABALHO, nao a original: se a pessoa achatou o fundo, foi
      // exatamente para a onda parar na borda certa. Passar a original aqui
      // tornava o achatamento decorativo.
      const r = segmentarNoCanvas(imagemParaAutomacoes, { x, y });
      const ms = Math.round(performance.now() - inicio);

      if (!r) {
        avisar(recadoDoContorno(r, umPerPixel, ms));
        return;
      }

      if (r.tocouBorda) {
        avisar(recadoDoContorno(r, umPerPixel, ms));
        return;
      }

      appendYoloSegmentation(
        contornoDoClique({
          id: Date.now() + Math.floor(Math.random() * 1000),
          contorno: r.contorno,
          tipo,
          classeExterna,
          marcaId,
        }),
        // Marca e contorno sairam do MESMO clique: um Ctrl+Z tira os dois.
        { fundir: true }
      );

      avisar(recadoDoContorno(r, umPerPixel, ms));
    },
    [imagemDeTrabalho, marcarComSom, appendYoloSegmentation, umPerPixel, classeExterna, avisar]
  );

  /**
   * Contorna UMA marcação, escolhida na galeria.
   *
   * Existe ao lado do lote porque são gestos diferentes: o lote é "confio,
   * resolve tudo"; este é "quero ver o que a onda faz NESTA aqui". Serve para
   * conferir uma semente duvidosa antes de mandar o lote, e para o caso em que
   * só uma ficou de fora.
   */
  const handleSegmentarUma = useCallback(
    (marcaId: number) => {
      if (!imagemDeTrabalho || !imagemParaAutomacoes) return;
      const marca = marks.find((m) => m.id === marcaId);
      if (!marca) return;

      const r = segmentarNoCanvas(imagemParaAutomacoes, { x: marca.x, y: marca.y });
      if (!r || r.tocouBorda) {
        avisar(recadoDeUma(r));
        return;
      }

      appendYoloSegmentation(
        contornoDoClique({
          id: Date.now(),
          contorno: r.contorno,
          tipo: marca.type,
          classeExterna: marca.classeExterna,
          marcaId: marca.id,
        })
      );
      avisar(recadoDeUma(r));
    },
    [imagemDeTrabalho, marks, appendYoloSegmentation, avisar]
  );

  const [segmentandoLote, setSegmentandoLote] = useState<{ feitas: number; total: number } | null>(
    null
  );

  /**
   * Roda a onda a partir de cada marcação sem contorno.
   *
   * O trabalho já foi feito pela pessoa quando ela marcou: o clique diz ONDE há
   * semente, e a onda só precisa medir a borda. É por isso que isto é barato e
   * confiável de um jeito que "detectar tudo do zero" nunca é.
   *
   * TRÊS REGRAS QUE NÃO PODEM CAIR:
   *
   * 1. A CONTAGEM NÃO MUDA. Nenhuma marcação é criada nem apagada aqui — só
   *    contornos são acrescentados. Se o lote errasse e criasse marcação, o
   *    número do laudo mudaria por causa de um botão de conveniência.
   * 2. CONTORNO DUVIDOSO NÃO ENTRA. A mesma regra do clique avulso: o contorno
   *    vira área e medida no CSV, e um número errado é pior que número nenhum.
   * 3. CEDE A TELA. Duzentas ondas seguidas travariam o navegador sem dizer
   *    nada; o laço solta o fio a cada poucas sementes e mostra o progresso.
   */
  const handleSegmentarPendentes = useCallback(async () => {
    if (!imagemDeTrabalho || !imagemParaAutomacoes || marcasSemContorno.length === 0) return;

    const pendentes = [...marcasSemContorno];
    setSegmentandoLote({ feitas: 0, total: pendentes.length });
    const encerrar = iniciarAtividade('lote', `Contornando ${pendentes.length} marcações…`);

    let medidas = 0;
    let escaparam = 0;

    for (let i = 0; i < pendentes.length; i++) {
      const marca = pendentes[i];
      const r = segmentarNoCanvas(imagemParaAutomacoes, { x: marca.x, y: marca.y });

      if (r && !r.tocouBorda) {
        appendYoloSegmentation(
          contornoDoClique({
            id: Date.now() + i,
            contorno: r.contorno,
            tipo: marca.type,
            classeExterna: marca.classeExterna,
            marcaId: marca.id,
          }),
          // O lote e um pedido so; Ctrl+Z desfaz o lote, nao um contorno.
          { fundir: medidas > 0 }
        );
        medidas++;
      } else {
        escaparam++;
      }

      if (i % 4 === 3) {
        setSegmentandoLote({ feitas: i + 1, total: pendentes.length });
        atualizarProgresso('lote', (i + 1) / pendentes.length);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    encerrar();
    setSegmentandoLote(null);
    avisar(recadoDoLote(medidas, pendentes.length, escaparam));
  }, [
    imagemDeTrabalho,
    marcasSemContorno,
    appendYoloSegmentation,
    avisar,
    iniciarAtividade,
    atualizarProgresso,
  ]);

  return { segmentarComOnda, handleSegmentarUma, handleSegmentarPendentes, segmentandoLote };
}
