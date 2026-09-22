// =============================================================================
// SeedCounter — a barreira de erro
//
// O QUE ELA SUBSTITUI.
//
// Uma tela branca. Até aqui, um erro no render de qualquer componente derrubava
// a árvore inteira e não sobrava nada na tela — nem aviso, nem caminho de
// volta, nem sinal de que o trabalho continuava salvo. Quem estava contando
// concluía a única coisa razoável de concluir: que perdeu tudo.
//
// POR QUE CLASSE.
//
// `componentDidCatch` e `getDerivedStateFromError` não têm equivalente em hook.
// Esta é a única classe do projeto, e é por obrigação do React, não por gosto.
//
// A TELA É CALMA DE PROPÓSITO.
//
// A pilha do erro não aparece. Quem está na bancada não vai depurar o programa;
// vai querer saber se perdeu o trabalho (não perdeu — as sessões vivem no
// IndexedDB e sobrevivem a recarregar) e o que fazer agora. A pilha vai para o
// arquivo de diagnóstico, que é onde ela serve para alguém.
// =============================================================================

import React from 'react';
import { AlertTriangle, Download, RotateCw, Check } from 'lucide-react';
import { registrarErro } from '../lib/diagnostico/trilha';
import { baixarRelatorioDeDiagnostico } from '../lib/diagnostico/relatar';

interface Props {
  children: React.ReactNode;
}

interface Estado {
  quebrou: boolean;
  /** Nome do arquivo baixado, para dizer o que saiu. */
  arquivoBaixado: string | null;
}

export class ErrorBoundary extends React.Component<Props, Estado> {
  state: Estado = { quebrou: false, arquivoBaixado: null };

  static getDerivedStateFromError(): Partial<Estado> {
    return { quebrou: true };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo): void {
    registrarErro(erro, 'render');
    // A árvore de componentes onde estourou é a informação que a pilha do
    // JavaScript não dá — ela mostra a função, não o lugar da interface.
    if (info.componentStack) {
      registrarErro(new Error(`Componentes: ${info.componentStack}`), 'render');
    }
  }

  private baixar = (): void => {
    // Sem contexto: a esta altura o estado da bancada já se foi. A trilha
    // guarda o que aconteceu antes, que é justamente o que faltava.
    const nome = baixarRelatorioDeDiagnostico();
    this.setState({ arquivoBaixado: nome });
  };

  private recarregar = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.quebrou) return this.props.children;

    const { arquivoBaixado } = this.state;

    return (
      <div className="bg-surface-0 text-ink-1 flex h-screen w-screen items-center justify-center p-6 font-sans">
        <div className="border-line bg-surface-1 rounded-panel w-full max-w-lg space-y-5 border p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="text-warn mt-0.5 shrink-0" />
            <div>
              <h1 className="text-ink-1 text-base font-bold">
                O programa parou de desenhar esta tela
              </h1>
              <p className="text-ink-2 mt-1 text-[13px] leading-relaxed">
                Alguma coisa deu errado dentro do SeedCounter. Não foi culpa do que você clicou.
              </p>
            </div>
          </div>

          {/* A primeira pergunta de quem está contando há uma hora. Responder
              antes de ela ser feita é metade da calma desta tela. */}
          <div className="border-line bg-surface-2 rounded-control border p-3">
            <p className="text-ink-2 text-[12px] leading-relaxed">
              <strong className="text-ink-1">Seu trabalho salvo continua aí.</strong> As sessões
              gravadas ficam neste navegador e sobrevivem a recarregar a página. O que se perde é
              apenas o que ainda não tinha sido salvo nesta imagem.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.baixar}
              className="border-line text-ink-1 rounded-control hover:border-accent hover:text-accent focus-visible:ring-accent/40 flex cursor-pointer items-center gap-2 border px-3 py-2 text-[12px] font-bold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {arquivoBaixado ? <Check size={14} /> : <Download size={14} />}
              Baixar relatório
            </button>
            <button
              type="button"
              onClick={this.recarregar}
              className="bg-accent rounded-control focus-visible:ring-accent/40 flex cursor-pointer items-center gap-2 px-3 py-2 text-accent-on text-[12px] font-bold tracking-wide uppercase transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
            >
              <RotateCw size={14} /> Recarregar
            </button>
          </div>

          {arquivoBaixado && (
            <p className="text-ink-3 font-mono text-[11px] break-all">{arquivoBaixado}</p>
          )}

          <p className="text-ink-3 text-[11px] leading-relaxed">
            O relatório é um arquivo de texto com a versão do programa, o navegador e a sequência de
            ações desta sessão. Ele <strong>não</strong> contém imagem, pixel nem dado pessoal — você
            pode abrir e conferir antes de enviar a quem cuida do programa.
          </p>
        </div>
      </div>
    );
  }
}
