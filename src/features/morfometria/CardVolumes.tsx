// =============================================================================
// SeedCounter — volume da semente, do embrião e do ar
//
// POR QUE ESTE CARD MOSTRA AS EQUAÇÕES, E NÃO SÓ O RESULTADO.
//
// Estas duas fórmulas vêm da metodologia de um projeto de doutorado, e o número
// que sai delas vai para uma qualificação. Quem apresenta precisa poder apontar
// para a tela e dizer "é esta equação, com estes valores" — sem abrir o código,
// sem confiar na palavra do software. Um resultado sem a conta ao lado é um
// número que a banca não tem como conferir.
//
// A MEDIDA DA SEMENTE VEM DA IMAGEM; A DO EMBRIÃO É DIGITADA.
//
// O comprimento e a largura da semente saem da segmentação, que é o que o
// aplicativo sabe fazer. O embrião é outra coisa: ele está DENTRO da testa
// translúcida, e separá-lo exige resolução que um scanner de mesa raramente
// entrega — a 1200 DPI um embrião de 100 µm tem menos de cinco pixels. Então
// aqui ele é digitado, vindo do microscópio, e o card serve de calculadora
// honesta em vez de fingir que mediu.
// =============================================================================

import { useState } from 'react';
import {
  volumesDaSemente,
  type ConvencaoDaAltura,
} from '../../lib/morfometria-volumetrica';

interface CardVolumesProps {
  /** Comprimento mediano da semente, em milímetros. Ausente = sem calibração. */
  comprimentoMm?: number | null;
  /** Largura mediana da semente, em milímetros. */
  larguraMm?: number | null;
}

/** Número em notação científica curta, que é como volume em µm³ se lê. */
function cientifica(v: number): string {
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / 10 ** exp;
  return `${mant.toFixed(2).replace('.', ',')}×10${sobrescrito(exp)}`;
}

function sobrescrito(n: number): string {
  const mapa: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
  };
  return String(n).split('').map((c) => mapa[c] ?? c).join('');
}

export function CardVolumes({ comprimentoMm, larguraMm }: CardVolumesProps) {
  const [embriaoC, setEmbriaoC] = useState('');
  const [embriaoL, setEmbriaoL] = useState('');
  const [convencao, setConvencao] = useState<ConvencaoDaAltura>('metade');

  const temSemente = typeof comprimentoMm === 'number' && typeof larguraMm === 'number';
  // Micrômetros: é a unidade em que semente de orquídea se descreve, e a que
  // as duas equações produzem volume em µm³.
  const cUm = temSemente ? comprimentoMm! * 1000 : 0;
  const lUm = temSemente ? larguraMm! * 1000 : 0;

  const ec = Number(embriaoC.replace(',', '.'));
  const el = Number(embriaoL.replace(',', '.'));
  const temEmbriao = Number.isFinite(ec) && ec > 0 && Number.isFinite(el) && el > 0;

  const v = temSemente
    ? volumesDaSemente(
        {
          comprimentoUm: cUm,
          larguraUm: lUm,
          embriaoComprimentoUm: temEmbriao ? ec : undefined,
          embriaoLarguraUm: temEmbriao ? el : undefined,
        },
        convencao
      )
    : null;

  const campo =
    'bg-surface-2 border-line rounded-control w-full border px-1.5 py-1 font-mono text-[11px] tabular-nums focus:border-accent focus:outline-none';

  return (
    <div className="border-line-soft space-y-2 border-t pt-2">
      <h4 className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
        Volumes
      </h4>

      {/* As equações, como o projeto as escreve. */}
      <div className="bg-surface-2 rounded-control text-ink-2 space-y-1 p-2 font-mono text-[10px] leading-relaxed">
        <p>
          <span className="text-ink-3">(1)</span> Ev = ⁴⁄₃ · π · a · b²
        </p>
        <p className="text-ink-3 text-[9px]">
          embrião, esferoide prolato · a = semieixo maior, b = semieixo menor
        </p>
        <p className="pt-1">
          <span className="text-ink-3">(2)</span> Sv = 2 · ⅓ · π · r² · h
        </p>
        <p className="text-ink-3 text-[9px]">
          semente, dois cones pela base · r = largura/2, h = {convencao === 'metade' ? 'comprimento/2' : 'comprimento'}
        </p>
        <p className="pt-1">
          <span className="text-ink-3">(3)</span> Var = Sv − Ev
        </p>
      </div>

      {!temSemente ? (
        <p className="text-ink-3 text-[10px] leading-snug">
          Calibre a escala para que comprimento e largura tenham unidade física.
        </p>
      ) : (
        <>
          <div className="text-ink-2 grid grid-cols-2 gap-x-2 font-mono text-[10px] tabular-nums">
            <span className="text-ink-3">semente (mediana)</span>
            <span className="text-right">
              {Math.round(cUm)} × {Math.round(lUm)} µm
            </span>
          </div>

          {/* O embrião é digitado — ver a nota no topo do arquivo. */}
          <div className="flex items-end gap-1.5">
            <label className="flex-1">
              <span className="text-ink-3 block text-[9px] font-bold tracking-wide uppercase">
                Embrião C (µm)
              </span>
              <input
                value={embriaoC}
                onChange={(e) => setEmbriaoC(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                className={campo}
                aria-label="Comprimento do embrião em micrômetros"
              />
            </label>
            <label className="flex-1">
              <span className="text-ink-3 block text-[9px] font-bold tracking-wide uppercase">
                Embrião L (µm)
              </span>
              <input
                value={embriaoL}
                onChange={(e) => setEmbriaoL(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                className={campo}
                aria-label="Largura do embrião em micrômetros"
              />
            </label>
          </div>

          {v && (
            <div className="text-ink-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums">
              <span className="text-ink-3">Sv</span>
              <span className="text-right">{cientifica(v.sementeUm3)} µm³</span>
              {v.embriaoUm3 !== null && (
                <>
                  <span className="text-ink-3">Ev</span>
                  <span className="text-right">{cientifica(v.embriaoUm3)} µm³</span>
                  <span className="text-ink-3">Var</span>
                  <span className="text-right">{cientifica(v.arUm3!)} µm³</span>
                  <span className="text-ink-3 font-semibold">ar</span>
                  <span className="text-right font-semibold">
                    {(v.fracaoDeAr! * 100).toFixed(1).replace('.', ',')}%
                  </span>
                </>
              )}
            </div>
          )}

          {v?.aviso && <p className="text-warn text-[10px] leading-relaxed">{v.aviso}</p>}

          {/* A ambiguidade que muda o resultado em 2× fica na tela, não num
              comentário: quem for publicar escolhe conscientemente. */}
          <label className="text-ink-3 block text-[9px] leading-snug">
            Altura de cada cone na equação (2):
            <select
              value={convencao}
              onChange={(e) => setConvencao(e.target.value as ConvencaoDaAltura)}
              className="bg-surface-2 border-line rounded-control text-ink-1 ml-1 border px-1 py-px text-[10px]"
            >
              <option value="metade">comprimento / 2</option>
              <option value="inteiro">comprimento</option>
            </select>
            <span className="mt-0.5 block">
              As duas leituras são possíveis e diferem por um fator de 2 no volume — e
              portanto na fração de ar. Confira no artigo qual foi usada antes de publicar.
            </span>
          </label>
        </>
      )}
    </div>
  );
}
