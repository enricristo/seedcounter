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

import { Columns2, Plus, X } from 'lucide-react';
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
      // O modo tem NOME. Um "+" mudo no cabeçalho não convida ninguém a
      // descobrir que o app abre quatro cenas ao mesmo tempo — e é a
      // funcionalidade que separa este app de um contador comum. O rótulo
      // some abaixo de `lg` para não disputar espaço com as abas em tela
      // estreita; o ícone e o título continuam lá.
      <button
        type="button"
        onClick={() => abrirNova()}
        className="text-ink-3 hover:text-ink-1 hover:border-accent hover:bg-surface-2 border-line rounded-control flex h-7 shrink-0 items-center gap-1.5 border border-dashed px-2 transition-colors"
        title="Modo Multibancada — abra até quatro cenas lado a lado e compare imagens, ou a mesma placa em datas diferentes"
        aria-label="Abrir o modo Multibancada"
      >
        <Columns2 size={13} strokeWidth={2} aria-hidden="true" />
        <span className="hidden text-[10px] font-bold tracking-wide uppercase lg:inline">Multibancada</span>
        <Plus size={11} strokeWidth={2.5} aria-hidden="true" />
      </button>
    );
  }

  const visiveis = todas.slice(0, abertas);

  return (
    <div
      className="bg-surface-2 rounded-panel flex shrink-0 items-center gap-0.5 p-0.5"
      role="group"
      aria-label={`Modo Multibancada — ${abertas} bancadas abertas`}
    >
      {/* O nome do modo, à esquerda das bancadas: quem está com quatro cenas
          abertas precisa saber o que está vendo, e como voltar a uma só
          (fechando as outras no ×). */}
      <span
        className="text-ink-3 hidden shrink-0 px-1.5 text-[9px] font-bold tracking-widest uppercase xl:inline"
        title="Modo Multibancada — cada bancada tem imagem, marcações, medidas e calibração próprias"
      >
        Multibancada
      </span>
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
