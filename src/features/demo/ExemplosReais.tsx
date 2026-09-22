import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { agruparPorCultura, carregarCatalogo, sufixoDaEscala, type ExemploReal } from './exemplos-reais';

interface ExemplosReaisProps {
  onCarregar: (e: ExemploReal) => void;
  carregando: string | null;
}

/**
 * Exemplos reais, agrupados por cultura, com um seletor por grupo.
 *
 * Um `<select>` por cultura em vez de 54 botões: a lateral tem 300 px, e o
 * que a pessoa quer é "me dá uma orquídea real" — o nome do dataset e a
 * classe aparecem no próprio item. O catálogo só é buscado quando a seção
 * aparece; falha de rede vira uma linha, não uma tela em branco.
 */
export function ExemplosReais({ onCarregar, carregando }: ExemplosReaisProps) {
  const [grupos, setGrupos] = useState<ReturnType<typeof agruparPorCultura> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarCatalogo()
      .then((c) => vivo && setGrupos(agruparPorCultura(c.exemplos)))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : 'Catálogo indisponível.'));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="pt-1 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Database size={12} className="text-ink-3" />
        <span className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">Exemplos reais</span>
        {grupos && <span className="text-[9px] text-ink-3">· {grupos.reduce((n, g) => n + g.exemplos.length, 0)}</span>}
      </div>
      {erro && <p className="text-[10px] text-ink-3">{erro}</p>}
      {grupos && (
        <div className="grid grid-cols-1 gap-1">
          {grupos.map((g) => (
            <label key={g.cultura} className="flex items-center gap-1.5">
              <span className="w-16 shrink-0 text-[10px] font-bold text-ink-2">{g.rotulo}</span>
              <select
                className="min-w-0 flex-1 rounded-control border border-line bg-surface-2 px-1.5 py-1 text-[10px] text-ink-1 focus:border-accent focus:outline-none disabled:opacity-50"
                value=""
                disabled={!!carregando}
                onChange={(ev) => {
                  const e = g.exemplos.find((x) => x.slug === ev.target.value);
                  if (e) onCarregar(e);
                }}
                aria-label={`Exemplo real de ${g.rotulo}`}
              >
                <option value="">{carregando && g.exemplos.some((x) => x.slug === carregando) ? 'Abrindo…' : 'escolher…'}</option>
                {g.exemplos.map((e) => (
                  <option key={e.slug} value={e.slug} title={e.dica}>
                    {e.rotulo}
                    {sufixoDaEscala(e)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <p className="text-[9px] text-ink-3 leading-snug">
        Recortes reduzidos dos datasets do grupo e públicos; origem, licença e escala vão para as
        observações. Só a digitalização com régua auditada tem µm/px medido; as do laboratório entram
        com o DPI declarado no arquivo (declaração, confira na régua); as outras pedem calibração.
      </p>
    </div>
  );
}
