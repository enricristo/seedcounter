import React from 'react';

interface FooterProps {
  filename?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Sobrescreve a versão do build. Normalmente não é passado. */
  version?: string;
}

const LOGOS = [
  {
    src: '/logo-gpeorq.png',
    alt: 'Logo GPEOrq',
    href: 'https://www.instagram.com/gpeorq',
    titulo: 'GPEOrq — Grupo de Pesquisa em Orquídeas',
  },
  {
    src: '/logo-gpsem.png',
    alt: 'Logo GPSEM',
    href: 'https://www.instagram.com/gpsem_2000/',
    titulo: 'GPSEM — Grupo de Estudos e Pesquisas em Sementes',
  },
];

export function Footer({ filename, imageWidth, imageHeight, version }: FooterProps) {
  // A versão vem do build, não de uma constante que alguém precisa lembrar de
  // atualizar. __APP_VERSION__ sai do package.json e __BUILD_COMMIT__ do git,
  // então cada publicação se identifica sozinha — e um relatório exportado
  // pode dizer exatamente qual código o produziu.
  const versaoExibida = version ?? `v${__APP_VERSION__}`;
  const link = 'hover:text-accent underline decoration-current/25 underline-offset-2 transition-colors'; // prettier-ignore

  return (
    <footer className="border-line bg-surface-1 flex h-12 shrink-0 items-center justify-between border-t px-6">
      {/* Estado do sistema e identificação da imagem em curso. */}
      <div className="text-ink-3 flex items-center gap-4 text-[10px] font-bold tracking-wide uppercase">
        <div className="flex items-center gap-1.5">
          {/* Ponto estático, não pulsante: um indicador que pisca sem parar
              cansa a vista numa sessão longa de contagem, e o estado aqui não
              muda — é sempre local e offline. */}
          <span className="bg-ok h-1.5 w-1.5 rounded-full" />
          <span>Local offline</span>
        </div>
        {filename && (
          <div className="border-line text-ink-2 border-l pl-3 font-mono text-[10px] normal-case tabular-nums">
            {filename} {imageWidth && imageHeight && `• ${imageWidth}×${imageHeight}px`}
          </div>
        )}
      </div>

      {/* Créditos e filiação. As logos vieram do cabeçalho: aqui elas ficam
          ao lado do texto que já as nomeava, em vez de disputar espaço com a
          navegação. */}
      <div className="flex items-center gap-3">
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
                // Esconde o link inteiro, não só a imagem: esconder apenas a
                // <img> deixava a caixa branca vazia na barra.
                onError={(e) => {
                  const a = e.currentTarget.closest('a');
                  if (a) a.style.display = 'none';
                }}
              />
            </a>
          ))}
        </div>

        <div className="flex flex-col items-end">
          <div className="text-ink-2 text-[10px]">
            <span className="text-accent font-bold">GPEOrq</span> /{' '}
            <span className="text-accent font-bold">GPSEM</span> — Unoeste •{' '}
            <a
              href="https://www.instagram.com/gpeorq"
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              @gpeorq
            </a>
            {' · '}
            <a
              href="https://www.instagram.com/gpsem_2000/"
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              @gpsem_2000
            </a>
          </div>
          <div className="text-ink-3 mt-0.5 max-w-2xl truncate text-right text-[9px]">
            Desenvolvido por Enrico S. Ambrosio (Matemático, graduando em Agronomia) •{' '}
            <a href="mailto:enrico.ambrosio@unesp.br" className={link}>
              enrico.ambrosio@unesp.br
            </a>
            {' • '}Orientação: Dr. Nelson Barbosa Machado Neto e Dra. Ceci Castilho Custódio
          </div>
        </div>
        <div
          className="bg-surface-2 text-ink-2 border-line rounded-control border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider tabular-nums"
          title={`Compilado em ${__BUILD_DATE__} · commit ${__BUILD_COMMIT__}`}
        >
          {versaoExibida}
          <span className="text-ink-3 ml-1 font-normal">{__BUILD_COMMIT__}</span>
        </div>
      </div>
    </footer>
  );
}
