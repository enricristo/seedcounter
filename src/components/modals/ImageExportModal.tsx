// =============================================================================
// SeedCounter — o diálogo de exportar a foto anotada
//
// POR QUE EXISTE. Antes o botão baixava o PNG sem perguntar nada, e quem
// queria só as inviáveis para uma figura, ou a legenda embutida para mandar
// por mensagem, tinha de recortar depois. O diálogo pergunta o pouco que
// muda a imagem: quais classes e qual legenda.
//
// A DECISÃO QUE ELE CARREGA. Ele não sabe desenhar nem contar; só monta
// `ImageExportOptions` e devolve para quem chamou. Toda a regra da imagem
// mora em `lib/export-image.ts`, e o que o diálogo mostra como cor de cada
// classe vem de `theme/specimen.ts` — a bolinha do diálogo e a marca no PNG
// não podem contar histórias diferentes.
// =============================================================================

import { useState, type ReactNode } from 'react';
import { X, Image as ImageIcon, Check, Layers, BarChart3, TableProperties } from 'lucide-react';
import { useModalEscape } from '../../hooks/useModalEscape';
import type { ImageExportOptions, TipoDeSobreposicao } from '../../lib/export-image';
import { ESPECIME } from '../../theme/specimen';

export type EscopoDaExportacao = 'single' | 'batch';

interface ImageExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Há mais de uma imagem no histórico — habilita o ZIP da fila. */
  hasImageQueue: boolean;
  onExport: (options: ImageExportOptions, scope: EscopoDaExportacao) => void;
}

const SOBREPOSICOES: { valor: TipoDeSobreposicao; rotulo: string; icone: ReactNode }[] = [
  { valor: 'none', rotulo: 'Nenhum', icone: <ImageIcon size={24} /> },
  { valor: 'table', rotulo: 'Tabela', icone: <TableProperties size={24} /> },
  { valor: 'chart', rotulo: 'Gráfico', icone: <BarChart3 size={24} /> },
  { valor: 'both', rotulo: 'Ambos', icone: <Layers size={24} /> },
];

function OpcaoDeClasse({
  marcado,
  cor,
  rotulo,
  onChange,
}: {
  marcado: boolean;
  cor: string;
  rotulo: string;
  onChange: (marcado: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between p-4 rounded-xl border border-line bg-surface-2 cursor-pointer hover:border-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${marcado ? '' : 'border-line'}`}
          style={marcado ? { borderColor: cor, backgroundColor: cor } : undefined}
        >
          {marcado && <Check size={10} className="text-[#101719]" />}
        </div>
        <span className="font-medium text-ink-1">{rotulo}</span>
      </div>
      <input
        type="checkbox"
        className="hidden"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function ImageExportModal({ isOpen, onClose, hasImageQueue, onExport }: ImageExportModalProps) {
  const [includeViable, setIncludeViable] = useState(true);
  const [includeInviable, setIncludeInviable] = useState(true);
  const [overlayType, setOverlayType] = useState<TipoDeSobreposicao>('none');

  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  // Sem classe nenhuma a imagem sai só com a foto; não é erro, mas avisa.
  const nadaSelecionado = !includeViable && !includeInviable;
  const opcoes: ImageExportOptions = { includeViable, includeInviable, overlayType };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-exportar-foto"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-1 rounded-2xl w-full max-w-lg shadow-2xl border border-line flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <ImageIcon size={20} className="text-accent" />
            </div>
            <div>
              <h2 id="titulo-exportar-foto" className="text-xl font-bold text-ink-1">
                Exportar Foto Anotada
              </h2>
              <p className="text-sm text-ink-2">Configurar visualização do PNG</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 text-ink-3 hover:text-ink-1 hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2 uppercase tracking-wider">O que renderizar?</h3>
            <OpcaoDeClasse
              marcado={includeViable}
              cor={ESPECIME.viable}
              rotulo="Sementes Viáveis"
              onChange={setIncludeViable}
            />
            <OpcaoDeClasse
              marcado={includeInviable}
              cor={ESPECIME.inviable}
              rotulo="Sementes Inviáveis/Mortas"
              onChange={setIncludeInviable}
            />
            {nadaSelecionado && (
              <p className="text-xs text-ink-3">
                Nenhuma classe marcada: a imagem sai sem marcas e a legenda mostra zero.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2 uppercase tracking-wider">Sobreposição (Overlay)</h3>
            <div className="grid grid-cols-2 gap-3">
              {SOBREPOSICOES.map(({ valor, rotulo, icone }) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={overlayType === valor}
                  onClick={() => setOverlayType(valor)}
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                    overlayType === valor
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line bg-surface-2 text-ink-2 hover:border-accent/50'
                  }`}
                >
                  {icone}
                  <span className="font-medium">{rotulo}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-line shrink-0 bg-surface-1 rounded-b-2xl flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onExport(opcoes, 'single')}
            className="w-full py-3 bg-accent hover:bg-accent/90 text-accent-on font-bold rounded-xl shadow-lg shadow-accent/20 transition-all cursor-pointer"
          >
            Baixar Somente Esta (PNG)
          </button>

          {hasImageQueue && (
            <button
              type="button"
              onClick={() => onExport(opcoes, 'batch')}
              className="w-full py-3 bg-surface-2 hover:bg-surface-3 text-ink-1 font-bold rounded-xl border border-line transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Layers size={18} />
              Baixar Fila Completa (.ZIP)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
