import { useMemo, useState, useEffect, useRef } from 'react';
import { X, Activity, Download } from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type { SeedMeasurement } from '../../lib/measurements';
import type { Session } from '../../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface AnalyticsModalProps {
  onClose: () => void;
  /** Sessões salvas no banco (cada sessão contém medições de uma imagem do lote) */
  sessions: Session[];
  /** Função que constrói e retorna todas as medições (com extração de cor) sob demanda */
  getMedicoesCompletas: () => SeedMeasurement[];
}

export function AnalyticsModal({ onClose, getMedicoesCompletas }: AnalyticsModalProps) {
  const [medicoesAtuais, setMedicoesAtuais] = useState<SeedMeasurement[]>([]);
  const [carregando, setCarregando] = useState(true);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExportarPDF = async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`SeedCounter_Analytics_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF', err);
      alert('Ocorreu um erro ao gerar o PDF do Dashboard.');
    }
  };

  useEffect(() => {
    // Computa as medições completas (com cor) de forma assíncrona para não travar a abertura imediata do Modal
    const timer = setTimeout(() => {
      const completas = getMedicoesCompletas();
      setMedicoesAtuais(completas);
      setCarregando(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [getMedicoesCompletas]);

  // 1. Agregar todas as medições (Histórico do Lote + Tela Atual)
  const loteAggregado = useMemo(() => {
    // Começa com as da tela
    let agregadas: SeedMeasurement[] = [...medicoesAtuais];

    // TODO: Para carregar o histórico de Lote (várias fotos), precisaremos
    // persistir o array de SeedMeasurement na interface Session do banco.
    // Atualmente a Session salva apenas os cliques (marks) e polígonos.
    return agregadas;
  }, [medicoesAtuais]);

  // Case 1: Pureza Física (Área x Razão de Aspecto)
  const dataFisica = useMemo(() => {
    return loteAggregado
      .filter((m) => m.areaMm2 && m.feretMaxMm && m.feretMinMm && m.circularidade)
      .map((m) => {
        const razaoAspecto = m.feretMaxMm! / Math.max(m.feretMinMm!, 0.001);
        return {
          id: m.objectId,
          area: m.areaMm2,
          aspectRatio: razaoAspecto,
          circularity: m.circularidade!,
          classe: m.classeExterna || m.classe || 'N/A',
        };
      });
  }, [loteAggregado]);

  // Case 2: Sanidade / TZ (R-Mean x G-Mean)
  const dataCor = useMemo(() => {
    return loteAggregado
      .filter((m) => m.rMean !== undefined && m.gMean !== undefined && m.bMean !== undefined)
      .map((m) => {
        return {
          id: m.objectId,
          r: m.rMean,
          g: m.gMean,
          b: m.bMean,
          rgbColor: `rgb(${Math.round(m.rMean!)}, ${Math.round(m.gMean!)}, ${Math.round(m.bMean!)})`,
          classe: m.classeExterna || m.classe || 'N/A',
        };
      });
  }, [loteAggregado]);

  // Case 3: Tetrazólio em CIELAB (a* vs L*)
  const dataCIELAB = useMemo(() => {
    return loteAggregado
      .filter((m) => m.aMean !== undefined && m.lMean !== undefined && m.rMean !== undefined)
      .map((m) => {
        return {
          id: m.objectId,
          a: m.aMean, // Eixo Vermelho/Verde
          l: m.lMean, // Luminosidade
          rgbColor: `rgb(${Math.round(m.rMean!)}, ${Math.round(m.gMean!)}, ${Math.round(m.bMean!)})`,
        };
      });
  }, [loteAggregado]);

  // Case 4: Qualidade do Tegumento / Danos Mecânicos (Solidez vs Feret)
  const dataQualidadeFisica = useMemo(() => {
    return loteAggregado
      .filter((m) => m.solidez !== undefined && m.feretMaxMm !== undefined)
      .map((m) => {
        return {
          id: m.objectId,
          solidez: m.solidez! * 100, // Em porcentagem
          feret: m.feretMaxMm,
        };
      });
  }, [loteAggregado]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
      <div className="flex w-full h-full flex-col bg-surface-1 rounded-xl shadow-2xl border border-line overflow-hidden">
        
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4 bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-on">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-1">Enterprise Analytics (Batch Mode)</h2>
              <p className="text-sm text-ink-3">Análise do lote ({loteAggregado.length} sementes agregadas)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportarPDF}
              className="flex items-center gap-2 bg-accent hover:bg-accent-strong text-accent-on px-4 py-2 rounded-md text-sm font-bold tracking-wider uppercase transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              disabled={carregando}
            >
              <Download size={16} /> Exportar Lote (PDF)
            </button>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-3 transition-colors text-ink-2 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Dashboards */}
        <div ref={dashboardRef} className="flex-1 overflow-auto p-6 bg-surface-1 grid grid-cols-2 gap-6">
          
          {/* Card 1: Pureza Física */}
          <div className="flex flex-col bg-surface-2 rounded-xl border border-line p-5 shadow-sm">
            <h3 className="text-sm font-bold text-ink-2 uppercase tracking-wider mb-1">
              Case 1: Pureza Física (Morfometria)
            </h3>
            <p className="text-xs text-ink-3 mb-4">
              Área vs Razão de Aspecto. Dispersão para sinalizar impurezas físicas e defeitos morfológicos.
            </p>
            <div className="flex-1 min-h-[300px]">
              {carregando ? (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Analisando lote...
                </div>
              ) : dataFisica.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" dataKey="area" name="Área (mm²)" unit=" mm²" tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="aspectRatio" name="Aspect Ratio" tick={{ fontSize: 11 }} />
                    <ZAxis type="number" range={[40, 80]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Scatter name="Sementes" data={dataFisica}>
                      {dataFisica.map((entry, index) => {
                        // Circulares = Verde escuro (bom), Alongadas = amarelo/vermelho (impureza)
                        const redness = Math.max(0, Math.min(255, Math.floor((1 - entry.circularity) * 400)));
                        const greenness = Math.max(0, Math.min(255, Math.floor(entry.circularity * 200 + 50)));
                        return <Cell key={`cell-${index}`} fill={`rgb(${redness}, ${greenness}, 50)`} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Dados de área insuficientes
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Sanidade / Cor */}
          <div className="flex flex-col bg-surface-2 rounded-xl border border-line p-5 shadow-sm">
            <h3 className="text-sm font-bold text-ink-2 uppercase tracking-wider mb-1">
              Case 2: Sanidade (Colorimetria TZ)
            </h3>
            <p className="text-xs text-ink-3 mb-4">
              Dispersão RGB: Intensidade de Vermelho (R) vs Verde (G). A cor de cada ponto é a cor real da semente.
            </p>
            <div className="flex-1 min-h-[300px]">
              {carregando ? (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Lendo matriz de cores...
                </div>
              ) : dataCor.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" dataKey="r" name="R (Vermelho)" range={[0, 255]} tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="g" name="G (Verde)" range={[0, 255]} tick={{ fontSize: 11 }} />
                    <ZAxis type="number" range={[60, 100]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Scatter name="Cores" data={dataCor}>
                      {dataCor.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.rgbColor} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Dados de cor insuficientes (ative a extração de cor).
                </div>
              )}
            </div>
          </div>
          
          {/* Card 3: CIELAB (a* vs L*) */}
          <div className="flex flex-col bg-surface-2 rounded-xl border border-line p-5 shadow-sm">
            <h3 className="text-sm font-bold text-ink-2 uppercase tracking-wider mb-1">
              Case 3: Sinal Tetrazólio (a* CIELAB)
            </h3>
            <p className="text-xs text-ink-3 mb-4">
              a* (Vermelho) vs L* (Luminosidade). O sinal direto da respiração celular no ensaio de TZ.
            </p>
            <div className="flex-1 min-h-[300px]">
              {carregando ? (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Lendo matriz de cores...
                </div>
              ) : dataCIELAB.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" dataKey="a" name="a* (Sinal TZ)" tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="l" name="L* (Luz)" tick={{ fontSize: 11 }} />
                    <ZAxis type="number" range={[60, 100]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Scatter name="Cores" data={dataCIELAB}>
                      {dataCIELAB.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.rgbColor} stroke="rgba(0,0,0,0.1)" strokeWidth={1} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Sem dados do CIELAB
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Danos Mecânicos */}
          <div className="flex flex-col bg-surface-2 rounded-xl border border-line p-5 shadow-sm">
            <h3 className="text-sm font-bold text-ink-2 uppercase tracking-wider mb-1">
              Case 4: Qualidade de Tegumento (Danos)
            </h3>
            <p className="text-xs text-ink-3 mb-4">
              Solidez (%) vs Tamanho Máximo (Feret). Identifica sementes enrugadas, perfuradas ou quebradas.
            </p>
            <div className="flex-1 min-h-[300px]">
              {carregando ? (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Analisando geometria...
                </div>
              ) : dataQualidadeFisica.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" dataKey="feret" name="Tamanho (mm)" tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="solidez" name="Solidez (%)" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <ZAxis type="number" range={[60, 100]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Scatter name="Sementes" data={dataQualidadeFisica} fill="#9b59b6" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-ink-3 text-sm italic">
                  Sem dados de Solidez
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
