// =============================================================================
// SeedCounter — importar JSON: do `File` ao estado da cena
//
// POR QUE EXISTE. É a segunda extração de `App.tsx` no mesmo molde de
// `features/exportar`: o App entrega o que a importação precisa escrever
// (contornos, anotação, histórico, metadado, nome) e recebe de volta os dois
// handlers que os componentes sempre receberam — `processJSONFile` (o
// arrastar-e-soltar) e `handleImportHistoryJSON` (os `<input type="file">`
// da barra lateral e do histórico).
//
// O QUE FICA AQUI E O QUE NÃO FICA. Aqui só há o que precisa do navegador:
// ler o `File`, escrever no estado, avisar a pessoa. Reconhecer o tipo do
// arquivo, conferir cada campo e traduzir a classe está em `importar.ts`, que
// roda em node e tem teste. Estado, nenhum: o hook não cria nada.
//
// SEGMENTAÇÕES IMPORTADAS SUBSTITUEM AS DA CENA. `addYoloSegmentations`
// troca a lista inteira — é o comportamento de sempre, e o que a fila de
// detecção também faz. Uma sessão avulsa passa por `carregar`, que esquece o
// histórico de desfazer: Ctrl+Z logo depois de importar não pode "desimportar"
// para a anotação de outra imagem.
// =============================================================================

import { useCallback } from 'react';
import type React from 'react';
import type { Mark, Metadata, Session, YoloSegmentation } from '../../types';
import { registrarEvento } from '../../lib/diagnostico/trilha';
import {
  ehErro,
  interpretarJSON,
  mensagemDeImportacao,
  MENSAGEM_HISTORICO_INVALIDO,
  MENSAGEM_JSON_ILEGIVEL,
} from './importar';

export interface EntradaDaImportacao {
  /** Substitui os contornos da cena — a lista inteira. */
  addYoloSegmentations: (segs: YoloSegmentation[]) => void;
  /** Troca marcas e contornos e esquece o histórico de desfazer (`useMarks`). */
  carregar: (a: { marks?: Mark[]; segmentacoes?: YoloSegmentation[] }) => void;
  /** Grava no IndexedDB; `false` quando a gravação falha (`useSessions`). */
  importSessions: (sessoes: Session[]) => Promise<boolean>;
  setMetadata: (m: Metadata) => void;
  setFilename: (nome: string) => void;
}

export function useImportacao(e: EntradaDaImportacao) {
  const { addYoloSegmentations, carregar, importSessions, setMetadata, setFilename } = e;

  const processJSONFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const texto = event.target?.result;
          const r = interpretarJSON(typeof texto === 'string' ? texto : '');
          if (ehErro(r)) {
            // Trilha: o tamanho e o motivo explicam um arquivo recusado; o
            // nome é dado de quem usa (ver `trilha.ts`). O motivo diz qual
            // campo faltou e nunca carrega valor do arquivo.
            registrarEvento('importar:recusado', { bytes: file.size, motivo: r.erro });
            alert(r.erro);
            return;
          }

          switch (r.tipo) {
            case 'segmentacoes':
              addYoloSegmentations(r.segmentacoes);
              registrarEvento('importar', { tipo: r.tipo, total: r.segmentacoes.length });
              alert(mensagemDeImportacao(r));
              return;

            case 'backup': {
              // `importSessions` é assíncrona (grava no IndexedDB): sem o
              // await aqui `ok` era a Promise em si, sempre truthy — o alerta
              // de "formato inválido" nunca disparava, mesmo quando a
              // gravação falhava. `strictNullChecks` (TS2801) pegou isso.
              const ok = await importSessions(r.sessoes);
              registrarEvento('importar', { tipo: r.tipo, total: r.sessoes.length, ok });
              alert(ok ? mensagemDeImportacao(r) : MENSAGEM_HISTORICO_INVALIDO);
              return;
            }

            case 'sessao': {
              const { sessao } = r;
              setMetadata(sessao.metadata);
              carregar({ marks: sessao.marks, segmentacoes: sessao.segmentacoes });
              if (sessao.filename) setFilename(sessao.filename);
              registrarEvento('importar', {
                tipo: r.tipo,
                marcas: sessao.marks.length,
                contornos: sessao.segmentacoes.length,
              });
              alert(mensagemDeImportacao(r));
              return;
            }
          }
        } catch (error) {
          // O que a conferência não previu (uma escrita no estado que lançou)
          // ainda vira aviso, e não rejeição silenciosa de promessa.
          console.error('Erro ao importar o arquivo JSON', error);
          alert(MENSAGEM_JSON_ILEGIVEL);
        }
      };
      reader.onerror = () => {
        registrarEvento('importar:recusado', { bytes: file.size, motivo: 'leitura' });
        alert(MENSAGEM_JSON_ILEGIVEL);
      };
      reader.readAsText(file);
    },
    [addYoloSegmentations, carregar, importSessions, setMetadata, setFilename]
  );

  /**
   * Os `<input type="file">` ligam esta prop ao `onChange`, então ela recebe
   * o EVENTO — não o `File`. Passar `processJSONFile` direto fazia
   * `reader.readAsText(evento)` lançar TypeError, e o botão "Importar" da
   * barra lateral nunca funcionou. Zerar o valor permite reimportar o mesmo
   * arquivo: sem isto o `onChange` não dispara na segunda vez.
   */
  const handleImportHistoryJSON = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (file) processJSONFile(file);
      ev.target.value = '';
    },
    [processJSONFile]
  );

  return { processJSONFile, handleImportHistoryJSON };
}
