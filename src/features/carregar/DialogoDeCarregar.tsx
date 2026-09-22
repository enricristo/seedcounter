// =============================================================================
// SeedCounter — DialogoDeCarregar
//
// Aparece quando alguém carrega uma imagem com a cena OCUPADA (imagem aberta
// e marcações) — nunca na primeira imagem do dia; quem decide é
// `decisao.ts`. Faz duas perguntas, nesta ordem:
//
//   1. O que fazer com a cena atual: substituir, ou deixar e enfileirar.
//   2. O que a imagem nova é em relação à atual: próxima repetição, outro
//      tratamento ou outro experimento — com os campos que cada resposta
//      mudaria, cada um dizendo de onde veio, e uma caixa por campo.
//
// Três decisões deliberadas, no padrão de `ConfirmDialog`:
//   - Foco inicial em "Cancelar": Enter logo após abrir não faz nada.
//   - Esc e clique fora cancelam — e cancelar NÃO abre a imagem: os arquivos
//     pendentes são descartados, a cena continua exatamente como estava.
//   - Metadado só entra marcado. Campo vazio na cena vem pré-marcado; campo
//     que a pessoa já preencheu vem desmarcado, com o valor atual e o
//     proposto lado a lado, para ela decidir.
//
// Só o NOME do arquivo aparece — nunca o caminho, que o navegador nem dá.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Layers, Replace, ListPlus } from 'lucide-react';
import { motion } from 'motion/react';
import type { Metadata } from '../../types';
import type { EscolhaAoCarregar } from './decisao';
import {
  listarMudancas,
  ROTULO_DO_CAMPO,
  type CampoDeContinuidade,
  type Continuidade,
  type TipoDeContinuidade,
} from './continuidade';

export interface ConfirmacaoDeCarregar {
  escolha: EscolhaAoCarregar;
  tipo: TipoDeContinuidade;
  marcados: Set<CampoDeContinuidade>;
}

interface DialogoDeCarregarProps {
  /** Nome do PRIMEIRO arquivo pendente, só o nome. */
  nomeDoArquivo: string;
  /** Quantos arquivos vieram juntos — uma pergunta só para todos. */
  quantosArquivos: number;
  /** Substituir perderia marcação que ninguém gravou. */
  avisoDeNaoSalvo: boolean;
  continuidade: Continuidade;
  metadata: Metadata;
  onCancelar: () => void;
  onConfirmar: (c: ConfirmacaoDeCarregar) => void;
}

const ESCOLHAS: { id: EscolhaAoCarregar; rotulo: string; frase: string; Icone: typeof Replace }[] =
  [
    {
      id: 'substituir',
      rotulo: 'Substituir a cena atual',
      frase: 'A imagem nova entra no lugar desta; a fila recomeça.',
      Icone: Replace,
    },
    {
      id: 'adicionar-a-fila',
      rotulo: 'Adicionar à fila',
      frase: 'Esta cena fica como está; a nova espera na fila.',
      Icone: ListPlus,
    },
    {
      id: 'adicionar-e-ir',
      rotulo: 'Adicionar e ir para ela',
      frase: 'Entra na fila e abre agora; as marcações desta ficam guardadas na fila.',
      Icone: Layers,
    },
  ];

export function DialogoDeCarregar({
  nomeDoArquivo,
  quantosArquivos,
  avisoDeNaoSalvo,
  continuidade,
  metadata,
  onCancelar,
  onConfirmar,
}: DialogoDeCarregarProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Com trabalho não salvo, o padrão é o que não perde nada. Sem, o gesto
  // mais comum — a próxima placa por cima da anterior já gravada — vence.
  const [escolha, setEscolha] = useState<EscolhaAoCarregar>(
    avisoDeNaoSalvo ? 'adicionar-a-fila' : 'substituir'
  );
  const [tipo, setTipo] = useState<TipoDeContinuidade>(continuidade.padrao);

  const proposta = useMemo(
    () => continuidade.propostas.find((p) => p.tipo === tipo) ?? continuidade.propostas[0],
    [continuidade, tipo]
  );
  const mudancas = useMemo(() => listarMudancas(metadata, proposta), [metadata, proposta]);

  // Pré-marca só o que está vazio. Trocar de proposta recomeça a marcação —
  // a caixa marcada para "T8 em Tratamento" não pode sobreviver a virar
  // "Outro experimento", onde Tratamento fica em branco.
  const [marcados, setMarcados] = useState<Set<CampoDeContinuidade>>(new Set());
  useEffect(() => {
    setMarcados(new Set(mudancas.filter((m) => m.preencheria).map((m) => m.campo)));
  }, [mudancas]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelar]);

  const alternar = (campo: CampoDeContinuidade) =>
    setMarcados((prev) => {
      const s = new Set(prev);
      if (s.has(campo)) s.delete(campo);
      else s.add(campo);
      return s;
    });

  // "Adicionar à fila" deixa a cena atual na tela: os metadados propostos só
  // fazem sentido para a imagem NOVA, e por isso ficam guardados até ela
  // abrir (ver `App.onImageLoaded`). A seção continua visível para a pessoa
  // decidir agora — só o rótulo explica quando entra.
  const aplicaAoAbrir = escolha === 'adicionar-a-fila';
  const maisArquivos = quantosArquivos > 1 ? ` e mais ${quantosArquivos - 1}` : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancelar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="carregar-titulo"
        aria-describedby="carregar-arquivo"
        className="bg-surface-1 border-line rounded-panel flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border shadow-2xl"
      >
        <header className="border-line flex items-start gap-3 border-b p-5">
          <div className="min-w-0 flex-1">
            <h2 id="carregar-titulo" className="text-ink-1 text-base leading-tight font-bold">
              Há uma cena aberta
            </h2>
            <p
              id="carregar-arquivo"
              className="text-ink-2 mt-1 truncate text-xs leading-relaxed"
              title={nomeDoArquivo}
            >
              Carregar <span className="text-ink-1 font-semibold">{nomeDoArquivo}</span>
              {maisArquivos}?
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            title="Cancelar — nada abre"
            aria-label="Cancelar — nada abre"
            className="text-ink-3 hover:text-ink-1 hover:bg-surface-2 rounded-control -mt-1 -mr-1 shrink-0 p-1.5 transition-colors"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* 1. O que fazer com a cena atual */}
          <fieldset>
            <legend className="text-ink-3 mb-2 text-[10px] font-bold tracking-widest uppercase">
              A cena atual
            </legend>
            <div className="space-y-1">
              {ESCOLHAS.map(({ id, rotulo, frase, Icone }) => (
                <label
                  key={id}
                  className={`rounded-control flex cursor-pointer items-start gap-2.5 border px-3 py-2 transition-colors ${
                    escolha === id
                      ? 'border-accent bg-accent-tint'
                      : 'border-line hover:bg-surface-2'
                  }`}
                >
                  <input
                    type="radio"
                    name="carregar-escolha"
                    value={id}
                    checked={escolha === id}
                    onChange={() => setEscolha(id)}
                    className="accent-accent mt-0.5"
                  />
                  <Icone
                    size={14}
                    strokeWidth={1.75}
                    className="text-ink-3 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink-1 text-xs font-semibold">{rotulo}</span>
                    <span className="text-ink-3 text-[10px] leading-snug">{frase}</span>
                  </span>
                </label>
              ))}
            </div>
            {avisoDeNaoSalvo && escolha === 'substituir' && (
              <p role="alert" className="text-danger mt-2 text-[11px] leading-snug">
                As marcações desta imagem não foram gravadas no histórico. Substituir apaga o que
                foi contado aqui.
              </p>
            )}
          </fieldset>

          {/* 2. O que a imagem nova é */}
          <fieldset>
            <legend className="text-ink-3 mb-2 text-[10px] font-bold tracking-widest uppercase">
              A imagem nova é
            </legend>
            <div className="space-y-1">
              {continuidade.propostas.map((p) => (
                <label
                  key={p.tipo}
                  className={`rounded-control flex cursor-pointer items-start gap-2.5 border px-3 py-2 transition-colors ${
                    tipo === p.tipo
                      ? 'border-accent bg-accent-tint'
                      : 'border-line hover:bg-surface-2'
                  }`}
                >
                  <input
                    type="radio"
                    name="carregar-continuidade"
                    value={p.tipo}
                    checked={tipo === p.tipo}
                    onChange={() => setTipo(p.tipo)}
                    className="accent-accent mt-0.5"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-ink-1 text-xs font-semibold">
                      {p.titulo}
                      {p.tipo === continuidade.padrao && (
                        <span className="text-accent ml-1.5 text-[10px] font-bold tracking-wide uppercase">
                          provável
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-ink-3 mt-2 text-[10px] leading-snug">{proposta.porque}</p>

            {/* O que vai mudar — só entra o que está marcado */}
            <div className="mt-3">
              <p className="text-ink-3 mb-1.5 text-[10px] font-bold tracking-widest uppercase">
                {aplicaAoAbrir ? 'Entra quando a imagem abrir' : 'O que muda nos metadados'}
              </p>
              {mudancas.length === 0 ? (
                <p className="text-ink-3 text-[11px]">
                  Nada a mudar — os metadados já estão assim.
                </p>
              ) : (
                <ul className="space-y-1">
                  {mudancas.map((m) => (
                    <li key={m.campo}>
                      <label className="hover:bg-surface-2 rounded-control flex cursor-pointer items-start gap-2 px-2 py-1">
                        <input
                          type="checkbox"
                          checked={marcados.has(m.campo)}
                          onChange={() => alternar(m.campo)}
                          className="accent-accent mt-0.5"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-ink-1 text-[11px]">
                            <span className="font-semibold">{ROTULO_DO_CAMPO[m.campo]}</span>
                            {': '}
                            {m.de ? (
                              <>
                                <span className="text-ink-3 line-through">{m.de}</span>
                                {' → '}
                              </>
                            ) : null}
                            <span className={m.campo === 'especie' ? 'italic' : ''}>{m.para}</span>
                          </span>
                          <span className="text-ink-3 text-[10px]">
                            {m.origem}
                            {!m.preencheria && ' · já preenchido: só entra se você marcar'}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </fieldset>
        </div>

        <footer className="border-line bg-surface-2 flex justify-end gap-2 border-t p-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancelar}
            className="border-line text-ink-2 hover:text-ink-1 hover:bg-surface-1 rounded-control border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar({ escolha, tipo, marcados })}
            className="bg-accent text-accent-on hover:bg-accent-strong rounded-control px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all"
          >
            Confirmar
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
