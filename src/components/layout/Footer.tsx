import React from 'react';

interface FooterProps {
  filename?: string;
  imageWidth?: number;
  imageHeight?: number;
  version?: string;
}

export function Footer({
  filename,
  imageWidth,
  imageHeight,
  version = 'v3.0.0-beta',
}: FooterProps) {
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

      {/* Créditos e filiação. */}
      <div className="flex items-center gap-4">
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
        <div className="bg-surface-2 text-ink-2 border-line rounded-control border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider tabular-nums">
          {version}
        </div>
      </div>
    </footer>
  );
}
