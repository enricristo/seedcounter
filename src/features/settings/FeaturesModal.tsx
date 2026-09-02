// =============================================================================
// SeedCounter — FeaturesModal
// Painel visível de funcionalidades (feature flags), para que quem usa a
// versão de teste descubra e ative os recursos experimentais sem atalho oculto.
// =============================================================================

import React from 'react';
import { X, Sparkles, RotateCcw, FlaskConical, CheckCircle2 } from 'lucide-react';
import { useFeatureFlags } from '../../context/FeatureFlagContext';
import { FEATURE_REGISTRY } from '../flags';

interface FeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  version?: string;
}

export function FeaturesModal({ isOpen, onClose, version = 'v3.0.0-beta' }: FeaturesModalProps) {
  const { flags, toggle, reset } = useFeatureFlags();

  if (!isOpen) return null;

  const stable = FEATURE_REGISTRY.filter(f => f.stable);
  const experimental = FEATURE_REGISTRY.filter(f => !f.stable);

  const renderFlag = (flag: typeof FEATURE_REGISTRY[number]) => (
    <label
      key={flag.key}
      className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 dark:border-zinc-800 hover:bg-neutral-50 dark:hover:bg-zinc-900/60 cursor-pointer transition-colors"
    >
      <input
        type="checkbox"
        checked={flags[flag.key]}
        onChange={() => toggle(flag.key)}
        className="mt-0.5 accent-emerald-500 w-4 h-4 shrink-0"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-neutral-800 dark:text-zinc-100">{flag.label}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
            flag.stable
              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
          }`}>
            {flag.phase}
          </span>
        </div>
        <p className="text-[11px] text-neutral-500 dark:text-zinc-500 mt-0.5 leading-snug">
          {flag.description}
        </p>
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-emerald-500" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-800 dark:text-zinc-100">
                Funcionalidades
              </h2>
              <p className="text-[10px] text-neutral-500 dark:text-zinc-500">{version}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-zinc-200 hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-[11px] text-neutral-600 dark:text-zinc-400 leading-relaxed">
            Ative ou desative recursos do aplicativo. As opções ficam salvas neste navegador
            e não afetam outros usuários.
          </p>

          {/* Estáveis */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
                Recursos estáveis
              </h3>
            </div>
            <div className="space-y-1.5">{stable.map(renderFlag)}</div>
          </div>

          {/* Experimentais */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <FlaskConical size={13} className="text-amber-500" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">
                Experimentais
              </h3>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Em desenvolvimento — podem apresentar erros. Confira os resultados antes de usar em pesquisa.
            </p>
            <div className="space-y-1.5">{experimental.map(renderFlag)}</div>
          </div>

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-zinc-800 text-neutral-600 dark:text-zinc-300 hover:bg-neutral-100 dark:hover:bg-zinc-800 text-[11px] font-bold uppercase tracking-wide transition-colors"
          >
            <RotateCcw size={14} /> Restaurar padrões
          </button>

          {/* Créditos */}
          <div className="pt-3 border-t border-neutral-200 dark:border-zinc-800 space-y-1">
            <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
              Desenvolvido por <strong>Enrico S. Ambrosio</strong> — Matemático, graduando em Agronomia
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
              <a href="mailto:enrico.ambrosio@unesp.br" className="text-emerald-600 dark:text-emerald-500 hover:underline">
                enrico.ambrosio@unesp.br
              </a>
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-zinc-500">
              GPEOrq / GPSEM — Unoeste ·{' '}
              <a href="https://www.instagram.com/gpeorq" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-500 hover:underline">@gpeorq</a>
              {' · '}
              <a href="https://www.instagram.com/gpsem_2000/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-500 hover:underline">@gpsem_2000</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
