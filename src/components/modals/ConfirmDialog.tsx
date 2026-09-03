// =============================================================================
// SeedCounter — ConfirmDialog
// Confirmação para ação destrutiva. Substitui window.confirm, que é o diálogo
// nativo do navegador: destoa da interface e não consegue dizer o que
// exatamente vai ser apagado.
//
// Três decisões deliberadas, todas de segurança:
//   1. O foco inicial vai para "Cancelar", nunca para a ação destrutiva —
//      então Enter logo após abrir cancela, não confirma.
//   2. O diálogo lista o que APAGA e o que PRESERVA. Uma confirmação que não
//      diz o alcance não é confirmação, é obstáculo.
//   3. Esc e o clique fora fecham cancelando.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Frase curta acima das listas. */
  message: string;
  /** O que a ação apaga. Aparece marcado em vermelho. */
  clears?: string[];
  /** O que a ação preserva. Aparece em tinta secundária. */
  keeps?: string[];
  /** Rótulo do botão destrutivo. */
  confirmLabel?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  clears = [],
  keeps = [],
  confirmLabel = 'Confirmar',
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Foco no botão seguro, não no destrutivo.
  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="bg-surface-1 border-line w-full max-w-md overflow-hidden rounded-lg border shadow-2xl"
      >
        <header className="border-line flex items-start gap-3 border-b p-5">
          <span className="text-danger mt-0.5 shrink-0">
            <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-ink-1 text-base leading-tight font-bold">
              {title}
            </h2>
            <p id="confirm-message" className="text-ink-2 mt-1 text-xs leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Fechar sem alterar nada"
            aria-label="Fechar sem alterar nada"
            className="text-ink-3 hover:text-ink-1 hover:bg-surface-2 -mt-1 -mr-1 shrink-0 rounded-sm p-1.5 transition-colors"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        {(clears.length > 0 || keeps.length > 0) && (
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            {clears.length > 0 && (
              <section>
                <h3 className="text-danger mb-2 text-[10px] font-bold tracking-widest uppercase">
                  Apaga
                </h3>
                <ul className="text-ink-2 space-y-1 text-xs">
                  {clears.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-danger" aria-hidden="true">
                        &minus;
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {keeps.length > 0 && (
              <section>
                <h3 className="text-ink-3 mb-2 text-[10px] font-bold tracking-widest uppercase">
                  Preserva
                </h3>
                <ul className="text-ink-3 space-y-1 text-xs">
                  {keeps.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden="true">&middot;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <footer className="border-line bg-surface-2 flex justify-end gap-2 border-t p-4">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="border-line text-ink-2 hover:text-ink-1 hover:bg-surface-1 rounded-sm border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-danger rounded-sm px-4 py-2 text-[11px] font-bold tracking-wider text-white uppercase transition-all hover:brightness-110"
          >
            {confirmLabel}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
