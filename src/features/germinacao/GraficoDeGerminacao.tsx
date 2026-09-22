// =============================================================================
// SeedCounter — germinação: o gráfico das curvas (a única parte com recharts)
//
// Separado do painel pelo mesmo motivo de `bancadas/GraficoDaComparacao`: é
// o único arquivo daqui que importa `recharts`, e o painel — grade, tabelas,
// exportação — chega na hora sem esperar os 460 KB. Ver `lib/sob-demanda`.
//
// O que este componente decide é só o DESENHO. Quais séries existem, que cor
// cada uma tem e onde vai etiqueta direta já vem decidido de `curvas.ts`,
// que é testável sem DOM. As regras aplicadas aqui (skill dataviz):
//
//   • traço fino (curva 1,75 px por amostra; 2,5 px na média por tratamento),
//     marcador ≥ 8 px com anel da cor da superfície, grade em linha
//     contínua de um tom acima da superfície — nunca tracejada;
//   • texto sempre em tinta (`--color-ink-*`), nunca na cor da série: a cor
//     mora no traço e no ponto, a identidade do texto vem do traço ao lado;
//   • um tooltip para todas as séries no instante apontado, com o valor na
//     frente e o nome atrás;
//   • tema claro e escuro sem JavaScript: toda cor é `var(--color-*)`, e o
//     bloco `.dark` de `index.css` redefine o token dentro do SVG também.
// =============================================================================

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import {
  corDoTratamento,
  type DadosDoGrafico,
  type LinhaDoGrafico,
  type ModoDoGrafico,
  type SerieDoGrafico,
} from './curvas';

export interface GraficoDeGerminacaoProps {
  dados: DadosDoGrafico;
  modo: ModoDoGrafico;
  /** Tratamentos escondidos pela legenda. Esconder não repinta: a cor é do tratamento. */
  ocultos: ReadonlySet<string>;
}

const TINTA_2 = 'var(--color-ink-2)';
const TINTA_3 = 'var(--color-ink-3)';
const SUPERFICIE = 'var(--color-surface-1)';

/** `.toFixed(1)` com vírgula, sem "-0,0". */
function pct(v: number): string {
  const t = v.toFixed(1).replace('.', ',');
  return t === '-0,0' ? '0,0' : t;
}

function horas(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}

/** O objeto de dados atrás do payload do tooltip, se for uma linha nossa. */
function linhaDoPayload(payload: TooltipContentProps['payload']): LinhaDoGrafico | null {
  const primeiro: unknown = payload[0]?.payload;
  if (typeof primeiro !== 'object' || primeiro === null) return null;
  const linha = primeiro as Record<string, unknown>;
  return typeof linha.horas === 'number' ? (linha as LinhaDoGrafico) : null;
}

interface DicaProps {
  series: readonly SerieDoGrafico[];
  ocultos: ReadonlySet<string>;
}

/**
 * O tooltip: uma linha por TRATAMENTO, com a média das curvas ajustadas das
 * repetições visíveis no instante apontado e, quando o instante é um tempo
 * observado, a média do observado. Por tratamento e não por amostra porque
 * 24 amostras × 2 séries dariam 48 linhas — ninguém lê isso num hover.
 */
function Dica({ series, ocultos, active, payload, label }: DicaProps & TooltipContentProps) {
  if (!active || payload.length === 0) return null;
  const linha = linhaDoPayload(payload);
  if (linha === null) return null;

  const porTratamento = new Map<
    string,
    { indiceDaCor: number; curva: number[]; observado: number[] }
  >();
  for (const s of series) {
    if (ocultos.has(s.tratamento)) continue;
    const v = linha[s.chave];
    if (typeof v !== 'number') continue;
    const atual = porTratamento.get(s.tratamento) ?? {
      indiceDaCor: s.indiceDaCor,
      curva: [],
      observado: [],
    };
    (s.tipo === 'curva' ? atual.curva : atual.observado).push(v);
    porTratamento.set(s.tratamento, atual);
  }
  if (porTratamento.size === 0) return null;
  const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

  return (
    <div className="bg-surface-1 border-line rounded-panel text-ink-1 border px-3 py-2 text-[11px] shadow-[0_8px_24px_-8px_rgb(0_0_0/0.28)]">
      <div className="text-ink-3 mb-1 font-mono tabular-nums">
        t = {horas(typeof label === 'number' ? label : linha.horas)} h
      </div>
      <table className="border-separate border-spacing-x-2 border-spacing-y-0.5">
        <tbody>
          {[...porTratamento.entries()].map(([tratamento, v]) => (
            <tr key={tratamento}>
              <td>
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3 align-middle"
                  style={{ backgroundColor: corDoTratamento(v.indiceDaCor) }}
                />
              </td>
              <td className="text-ink-1 text-right font-mono font-semibold tabular-nums">
                {v.curva.length > 0 ? `${pct(media(v.curva))} %` : '—'}
              </td>
              <td className="text-ink-3 text-right font-mono tabular-nums">
                {v.observado.length > 0 ? `obs. ${pct(media(v.observado))} %` : ''}
              </td>
              <td className="text-ink-2">{tratamento}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PropsDaEtiqueta {
  x?: number | string;
  y?: number | string;
  index?: number;
}

export function GraficoDeGerminacao({ dados, modo, ocultos }: GraficoDeGerminacaoProps) {
  const ultimoIndice = dados.linhas.length - 1;
  const etiquetaDe = new Map(dados.etiquetas.map((e) => [e.chave, e.texto]));
  const espessura = modo === 'tratamentos' ? 2.5 : 1.75;
  // Espaço à direita para a etiqueta direta mais longa (≈ 6,5 px por
  // caractere a 11 px), para o nome do tratamento não ser cortado na borda.
  const maiorEtiqueta = Math.max(0, ...dados.etiquetas.map((e) => e.texto.length));
  const margemDireita = maiorEtiqueta > 0 ? 16 + Math.ceil(maiorEtiqueta * 6.5) : 24;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={dados.linhas}
        margin={{ top: 12, right: margemDireita, left: 4, bottom: 20 }}
      >
        <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
        <XAxis
          dataKey="horas"
          type="number"
          domain={[0, dados.tFim]}
          tickCount={8}
          tick={{ fill: TINTA_3, fontSize: 11, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-line)' }}
          label={{
            value: 'horas após a semeadura',
            position: 'insideBottom',
            offset: -12,
            fill: TINTA_3,
            fontSize: 11,
          }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fill: TINTA_3, fontSize: 11, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={false}
          width={40}
          label={{
            value: 'germinação (%)',
            angle: -90,
            position: 'insideLeft',
            offset: 8,
            fill: TINTA_3,
            fontSize: 11,
          }}
        />
        <Tooltip
          cursor={{ stroke: 'var(--color-line)', strokeWidth: 1 }}
          isAnimationActive={false}
          content={(props) => <Dica series={dados.series} ocultos={ocultos} {...props} />}
        />
        {dados.series.map((s) => {
          const cor = corDoTratamento(s.indiceDaCor);
          const escondida = ocultos.has(s.tratamento);
          if (s.tipo === 'observado') {
            return (
              <Line
                key={s.chave}
                dataKey={s.chave}
                name={s.rotulo}
                stroke="none"
                dot={{ r: 4, fill: cor, stroke: SUPERFICIE, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: cor, stroke: SUPERFICIE, strokeWidth: 2 }}
                isAnimationActive={false}
                hide={escondida}
                legendType="none"
              />
            );
          }
          const texto = etiquetaDe.get(s.chave);
          return (
            <Line
              key={s.chave}
              dataKey={s.chave}
              name={s.rotulo}
              type="linear"
              stroke={cor}
              strokeWidth={espessura}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
              hide={escondida}
              legendType="none"
              label={
                texto === undefined
                  ? false
                  : ({ x, y, index }: PropsDaEtiqueta) =>
                      index === ultimoIndice && typeof x === 'number' && typeof y === 'number' ? (
                        <text x={x + 8} y={y} dy={4} fill={TINTA_2} fontSize={11} fontWeight={600}>
                          {texto}
                        </text>
                      ) : null
              }
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
