// =============================================================================
// SeletorDeBancadas — o único jeito de abrir, trocar e fechar bancadas só
// com o mouse (C2, Task 3 — controle visível).
//
// Antes deste controle, abrir uma bancada exigia Ctrl+Shift+N e trocar de
// ativa exigia Ctrl+1..4 — teclas que o navegador e o sistema tomam (aba
// anônima, trocar de aba, zoom), então quem não sabia o atalho de cor nunca
// via as bancadas existirem. Este seletor fica no cabeçalho, ao lado do chip
// de espécie: contexto de navegação, como as abas Contagem/Longitudinal.
//
// Com UMA bancada aberta (o caso comum, quem não usa bancadas), o controle
// se resume a um "+" discreto — nada de números, nada de moldura. É o mesmo
// espírito do `Bancadas.tsx`: com uma só, a tela não pode ganhar nem perder
// um pixel de ruído visual.
// =============================================================================

import { Plus, X } from 'lucide-react';
import { MAXIMO_DE_BANCADAS, type Bancadas as BancadasEstado } from '../../hooks/useBancadas';

interface SeletorDeBancadasProps {
  bancadas: BancadasEstado;
}

/** Nome do arquivo sem extensão, cortado curto — o título completo mora no `title`. */
function nomeCurto(nomeDoArquivo: string): string {
  const semExtensao = nomeDoArquivo.replace(/\.[^./]+$/, '');
  return semExtensao.length > 12 ? `${semExtensao.slice(0, 11)}…` : semExtensao;
}

const botaoAbrir =
  'text-ink-3 hover:text-ink-1 hover:bg-surface-2 rounded-control flex h-6 w-6 shrink-0 items-center justify-center transition-colors';

export function SeletorDeBancadas({ bancadas }: SeletorDeBancadasProps) {
  const { todas, abertas, indiceAtivo, ativar, abrirNova, fechar } = bancadas;
  const podeAbrirMais = abertas < MAXIMO_DE_BANCADAS;

  if (abertas <= 1) {
    // Só o "+", e só quando ainda cabe uma segunda — quem nunca abriu uma
    // segunda bancada não tem por que ver número, moldura ou destaque.
    if (!podeAbrirMais) return null;
    return (
      <button
        type="button"
        onClick={() => abrirNova()}
        className={botaoAbrir}
        title="Abrir uma nova bancada — compare até 4 imagens ao mesmo tempo"
        aria-label="Abrir nova bancada"
      >
        <Plus size={13} strokeWidth={2.25} aria-hidden="true" />
      </button>
    );
  }

  const visiveis = todas.slice(0, abertas);

  return (
    <div
      className="bg-surface-2 rounded-panel flex shrink-0 items-center gap-0.5 p-0.5"
      role="group"
      aria-label="Bancadas abertas"
    >
      {visiveis.map((b, indice) => {
        const ativa = indice === indiceAtivo;
        const nomeDoArquivo = b.fila.filename;
        return (
          <span key={b.id} className="flex items-center">
            <button
              type="button"
              onClick={() => ativar(indice)}
              aria-pressed={ativa}
              aria-label={
                nomeDoArquivo
                  ? `Ativar bancada ${indice + 1}: ${nomeDoArquivo}`
                  : `Ativar bancada ${indice + 1}, sem imagem`
              }
              title={nomeDoArquivo || `Bancada ${indice + 1}`}
              className={`rounded-control flex items-center gap-1 px-2 py-1 text-[10px] font-bold normal-case transition-all ${
                ativa
                  ? 'bg-accent text-accent-on'
                  : 'text-ink-2 hover:bg-surface-1 hover:text-ink-1'
              }`}
            >
              <span className="tracking-wide">{indice + 1}</span>
              {nomeDoArquivo && <span className="max-w-16 truncate">{nomeCurto(nomeDoArquivo)}</span>}
            </button>
            {/* O × só existe com mais de uma bancada aberta — é sempre o
                caso aqui dentro, já que abertas<=1 sai mais cedo acima. */}
            <button
              type="button"
              onClick={() => fechar(indice)}
              aria-label={`Fechar bancada ${indice + 1}`}
              title="Fechar esta bancada"
              className="text-ink-3 hover:text-danger flex h-5 w-4 items-center justify-center"
            >
              <X size={10} aria-hidden="true" />
            </button>
          </span>
        );
      })}

      {podeAbrirMais && (
        <button
          type="button"
          onClick={() => abrirNova()}
          className={botaoAbrir}
          title="Abrir uma nova bancada"
          aria-label="Abrir nova bancada"
        >
          <Plus size={13} strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
