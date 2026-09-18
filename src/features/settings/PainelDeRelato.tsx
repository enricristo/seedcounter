// =============================================================================
// SeedCounter — "Relatar problema"
//
// ONDE ELE MORA, E POR QUÊ.
//
// Dentro do painel de Configurações (`FeaturesModal`), logo acima de "Sobre".
// Foi o lugar escolhido por três motivos, nesta ordem:
//
//   1. É onde um técnico procura. "Alguma coisa está errada com o programa" e
//      "quero mexer nas opções do programa" levam à mesma engrenagem na cabeça
//      de quem usa — e este painel já é o único lugar que fala SOBRE o
//      aplicativo em vez de sobre a contagem.
//
//   2. Fica colado no número da versão e no contato, que são as duas outras
//      coisas que alguém precisa na hora de relatar. Separar em um quarto
//      lugar seria espalhar a mesma tarefa por três telas.
//
//   3. NÃO fica na barra de ferramentas nem no rodapé como botão próprio. Um
//      botão de erro sempre visível sugere que erro é esperado, e ocuparia
//      espaço permanente de uma barra que é de trabalho. O rodapé leva a ele
//      por um ícone discreto ao lado da versão — caminho, não destino.
//
// O QUE ELE OFERECE, E POR QUE SÃO DOIS CAMINHOS.
//
// Baixar o `.json` é o caminho completo. Copiar o resumo existe porque a
// maioria dos relatos vai chegar por mensagem de texto, e pedir anexo a quem
// está no meio de um treinamento é pedir que o relato não aconteça.
// =============================================================================

import React, { useState } from 'react';
import { LifeBuoy, Download, ClipboardCopy, Check } from 'lucide-react';
import {
  baixarRelatorioDeDiagnostico,
  copiarResumoDeDiagnostico,
} from '../../lib/diagnostico/relatar';
import type { ContextoDoRelatorio } from '../../lib/diagnostico/relatorio';

interface PainelDeRelatoProps {
  /**
   * As condições da medição em curso, lidas na hora do clique.
   *
   * É função, e não objeto, porque o painel fica montado com o modal fechado:
   * um objeto seria o estado de quando o modal abriu, não o de quando o
   * problema aconteceu.
   */
  contexto?: () => ContextoDoRelatorio;
}

export function PainelDeRelato({ contexto }: PainelDeRelatoProps) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<'sim' | 'falhou' | null>(null);

  const baixar = () => {
    setArquivo(baixarRelatorioDeDiagnostico(contexto?.() ?? {}));
  };

  const copiar = () => {
    void copiarResumoDeDiagnostico(contexto?.() ?? {}).then((texto) => {
      setCopiado(texto === null ? 'falhou' : 'sim');
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <LifeBuoy size={13} className="text-ink-3" />
        <h3 className="text-ink-3 text-[10px] font-bold tracking-widest uppercase">
          Relatar problema
        </h3>
      </div>

      <div className="border-line space-y-3 rounded-xl border p-3">
        <p className="text-ink-2 text-[11px] leading-relaxed">
          Se o programa travou, contou errado ou fez algo que você não esperava, gere o relatório
          logo depois de acontecer — ele guarda a sequência das últimas ações desta sessão, que é o
          que explica o problema.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={baixar}
            className="border-line text-ink-2 rounded-control hover:border-accent hover:text-accent focus-visible:ring-accent/40 flex cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {arquivo ? <Check size={13} /> : <Download size={13} />} Baixar relatório
          </button>
          <button
            type="button"
            onClick={copiar}
            className="border-line text-ink-2 rounded-control hover:border-accent hover:text-accent focus-visible:ring-accent/40 flex cursor-pointer items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {copiado === 'sim' ? <Check size={13} /> : <ClipboardCopy size={13} />} Copiar resumo
          </button>
        </div>

        {arquivo && (
          <p className="text-ink-3 font-mono text-[10px] break-all">
            Baixado: {arquivo} — mande este arquivo para quem cuida do programa (contato logo abaixo,
            em Sobre).
          </p>
        )}
        {copiado === 'sim' && (
          <p className="text-ink-3 text-[10px] leading-relaxed">
            Resumo copiado: versão, navegador e os últimos erros. Cole na mensagem do relato.
          </p>
        )}
        {copiado === 'falhou' && (
          <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
            Este navegador não deixou copiar. Use o botão de baixar o relatório.
          </p>
        )}

        {/* A promessa fica na tela, não só dentro do arquivo: quem hesita em
            enviar hesita ANTES de abrir, e a essa altura já desistiu. */}
        <p className="text-ink-3 text-[10px] leading-relaxed">
          O relatório tem a versão do programa, o navegador, a escala e a espécie declaradas, e a
          lista das últimas ações. <strong>Nenhuma imagem, nenhum pixel, nenhum dado pessoal</strong>{' '}
          — nem o nome dos seus arquivos, só a extensão e o tamanho. É um arquivo de texto: você pode
          abrir e conferir antes de enviar.
        </p>
      </div>
    </div>
  );
}
