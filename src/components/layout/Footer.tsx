import React from 'react';
import { IndicadorDeAtividade } from '../../features/atividade/IndicadorDeAtividade';
import { DISSERTACAO } from '../../features/easter/fucik';
import type { FonteDeUmaAutomacao } from '../../lib/fonte-da-automacao';

interface FooterProps {
  filename?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Zoom atual (1 = 100%). Ausente = sem imagem. */
  zoomLevel?: number;
  /** Total de objetos contados na cena. */
  totalDeObjetos?: number;
  /** Sobrescreve a versão do build. Normalmente não é passado. */
  version?: string;
  /** Abre as notas de versão. Ausente = o número fica só informativo. */
  onAbrirNovidades?: () => void;
  /**
   * As condições de medição em curso: espécie, escala, protocolo. É o
   * contexto que toda medida carrega; sem ele, "285 px" não diz nada.
   */
  bancada?: { especie?: string; umPerPixel?: number; protocolo?: string; equipamento?: string };
  /**
   * Que imagem as automações estão lendo, e o gatilho para forçar a original.
   * Ausente = sem imagem aberta.
   */
  fonteDaAutomacao?: {
    resumo: { texto: string; alterada: boolean };
    detalhes: FonteDeUmaAutomacao[];
    forcarOriginal: boolean;
    onAlternar: () => void;
  };
}

const LOGOS = [
  {
    src: '/logo-gpeorq.png',
    alt: 'Logo GPEOrq',
    href: 'https://www.instagram.com/gpeorq',
    titulo: 'GPEOrq — Grupo de Pesquisa em Orquídeas · @gpeorq',
  },
  {
    src: '/logo-gpsem.png',
    alt: 'Logo GPSEM',
    href: 'https://www.instagram.com/gpsem_2000/',
    titulo: 'GPSEM — Grupo de Estudos e Pesquisas em Sementes · @gpsem_2000',
  },
];

const CREDITOS =
  'Desenvolvido por Enrico S. Ambrosio (Matemático, graduando em Agronomia) · enrico.ambrosio@unesp.br · ' +
  'Orientação: Dr. Nelson Barbosa Machado Neto e Dra. Ceci Castilho Custódio · GPEOrq / GPSEM';

/** Um item da barra: rótulo pequeno em cima, valor embaixo. */
function Item({ rotulo, children, title }: { rotulo: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="flex min-w-0 flex-col leading-none" title={title}>
      <span className="text-ink-3 text-[8px] font-bold tracking-widest uppercase">{rotulo}</span>
      <span className="text-ink-2 truncate font-mono text-[10px] tabular-nums">{children}</span>
    </div>
  );
}

/**
 * A barra inferior: três grupos com o mesmo peso — estado, imagem em curso,
 * condições de medição — e, à direita, filiação e versão.
 *
 * Antes era uma linha de texto em caixa alta de um lado e dois parágrafos
 * de créditos de 9 px do outro; nada tinha rótulo e o zoom, que é o que
 * muda o tempo todo, não aparecia. Os créditos completos ficam no tooltip
 * da filiação — a barra é de trabalho, não de página institucional.
 */
export function Footer({
  filename,
  imageWidth,
  imageHeight,
  zoomLevel,
  totalDeObjetos,
  version,
  onAbrirNovidades,
  bancada,
  fonteDaAutomacao,
}: FooterProps) {
  const versaoExibida = version ?? `v${__APP_VERSION__}`;
  const separador = <span className="bg-line h-6 w-px shrink-0" aria-hidden="true" />;

  return (
    <footer className="border-line bg-surface-1 flex h-12 shrink-0 items-center gap-4 border-t px-4">
      {/* 1. Estado — ponto estático: o app é sempre local e offline; um
          indicador que pisca sem parar cansa numa sessão longa. */}
      <div className="flex shrink-0 items-center gap-2" title="Os dados ficam neste computador; nada sai sem você exportar.">
        <span className="bg-ok h-1.5 w-1.5 rounded-full" />
        <Item rotulo="Dados">local · offline</Item>
      </div>
      <div className="empty:hidden">
        <IndicadorDeAtividade />
      </div>

      {separador}

      {/* 2. Imagem em curso */}
      {filename ? (
        <div className="flex min-w-0 items-center gap-4">
          <Item rotulo="Imagem" title={filename}>
            {filename}
          </Item>
          {imageWidth && imageHeight && (
            <Item rotulo="Pixels">
              {imageWidth}×{imageHeight}
            </Item>
          )}
          {zoomLevel != null && <Item rotulo="Zoom">{Math.round(zoomLevel * 100)}%</Item>}
          {totalDeObjetos != null && <Item rotulo="Objetos">{totalDeObjetos}</Item>}
        </div>
      ) : (
        <Item rotulo="Imagem">nenhuma aberta</Item>
      )}

      {separador}

      {/* 3. Condições de medição — some o que não foi declarado, em vez de
          mostrar "—" três vezes. */}
      <div className="hidden min-w-0 items-center gap-4 md:flex">
        <Item rotulo="Escala" title={bancada?.umPerPixel ? 'µm por pixel, da calibração desta imagem' : 'Sem calibração: medidas em pixel. Calibre no painel esquerdo.'}>
          {bancada?.umPerPixel && bancada.umPerPixel > 0
            ? `${bancada.umPerPixel.toFixed(2).replace('.', ',')} µm/px`
            : 'sem calibração'}
        </Item>
        {bancada?.especie && (
          <Item rotulo="Espécie">
            <span className="italic">{bancada.especie}</span>
          </Item>
        )}
        {bancada?.equipamento && <Item rotulo="Equipamento">{bancada.equipamento}</Item>}
        {/* Que imagem as automações leem. Clicar força a original — é um
            experimento de um clique ("a detecção piorou por causa do ajuste?"),
            não uma configuração escondida. */}
        {fonteDaAutomacao && (
          <button
            type="button"
            onClick={fonteDaAutomacao.onAlternar}
            aria-pressed={fonteDaAutomacao.forcarOriginal}
            title={[
              ...fonteDaAutomacao.detalhes.map((d) => `${d.rotulo}: ${d.fonte} — ${d.motivo}`),
              '',
              fonteDaAutomacao.forcarOriginal
                ? 'Clique para voltar a ler a imagem ajustada.'
                : 'Clique para forçar a leitura da imagem original.',
            ].join(String.fromCharCode(10))}
            className={`rounded px-1 py-0.5 text-left transition-colors hover:bg-surface-2 ${
              fonteDaAutomacao.resumo.alterada ? 'text-ink-1' : ''
            }`}
          >
            <Item rotulo="Automação lê">
              {fonteDaAutomacao.resumo.alterada && <span className="bg-accent mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" />}
              {fonteDaAutomacao.resumo.texto}
            </Item>
          </button>
        )}
        {bancada?.protocolo && bancada.protocolo !== 'simples' && <Item rotulo="Protocolo">{bancada.protocolo}</Item>}
      </div>

      <div className="flex-1" />

      {/* 4. Filiação e versão. Créditos completos no tooltip. */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-1.5 md:flex">
          {LOGOS.map((l) => (
            <a
              key={l.src}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              title={l.titulo}
              className="rounded-control border-line hover:border-accent flex items-center justify-center border bg-white p-0.5 transition-colors"
            >
              <img
                src={l.src}
                alt={l.alt}
                className="h-6 w-6 object-contain"
                onError={(e) => {
                  const a = e.currentTarget.closest('a');
                  if (a) a.style.display = 'none';
                }}
              />
            </a>
          ))}
        </div>
        <div className="hidden flex-col items-end leading-tight lg:flex" title={CREDITOS}>
          <span className="text-ink-2 text-[10px]">
            <span className="text-accent font-bold">GPEOrq</span> / <span className="text-accent font-bold">GPSEM</span>
            {' · '}
            {/* O nome leva à dissertação — o easter egg mais discreto: quem
                clica num nome quer saber quem é, e a resposta é o trabalho. */}
            <a
              href={DISSERTACAO.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${DISSERTACAO.titulo} — dissertação de mestrado (repositório da biblioteca)`}
              className="hover:text-accent decoration-current/25 underline underline-offset-2 transition-colors"
            >
              Enrico S. Ambrosio
            </a>
          </span>
          <span className="text-ink-3 text-[9px]">
            Orientação: Dr. Nelson Barbosa Machado Neto e Dra. Ceci Castilho Custódio
          </span>
        </div>
        {/* O número da versão é o gancho para as notas. Cromo neutro: ciano e
            magenta significam viável e inviável em toda a interface. */}
        <button
          type="button"
          onClick={onAbrirNovidades}
          disabled={!onAbrirNovidades}
          title={
            onAbrirNovidades
              ? `Ver o que mudou · compilado em ${__BUILD_DATE__} · commit ${__BUILD_COMMIT__}`
              : `Compilado em ${__BUILD_DATE__} · commit ${__BUILD_COMMIT__}`
          }
          className="bg-surface-2 text-ink-2 border-line rounded-control focus-visible:ring-accent/40 border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider tabular-nums transition-colors enabled:cursor-pointer enabled:hover:border-accent enabled:hover:text-accent focus-visible:ring-2 focus-visible:outline-none"
        >
          {versaoExibida}
          <span className="text-ink-3 ml-1 font-normal">{__BUILD_COMMIT__}</span>
        </button>
      </div>
    </footer>
  );
}
