// =============================================================================
// SeedCounter — Identificação para laudo (BAS / BASO)
//
// A tela onde se preenche o que o Boletim de Análise de Sementes exige e o
// aplicativo ainda não perguntava. Ela existe SEPARADA do formulário de
// metadados da barra lateral por um motivo de vocabulário: projeto, tratamento,
// placa e quadrante identificam um ENSAIO; espécie, cultivar, lote, safra e
// categoria identificam um LOTE COMERCIAL. Misturar os dois num formulário só
// obrigaria o pesquisador a pular campos que não são dele e o analista a
// preencher campos que não são do laudo.
//
// O painel de pendências no topo é a peça que faz a norma virar ferramenta: a
// IN 40/2010 proíbe campo em branco, e quem tem como conferir isso antes da
// impressão é o software, não a pessoa relendo o PDF.
// =============================================================================

import React from 'react';
import { X, FileCheck2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MetadataInput } from '../../components/shared/MetadataInput';
import { useLaboratorio } from '../../hooks/useLaboratorio';
import {
  CATEGORIAS,
  conferirParaEmissao,
  escreverEspecie,
  type CategoriaDeSemente,
  type IdentificacaoDaAmostra,
  type Pendencia,
} from '../../lib/normas/identificacao';
import type { Metadata } from '../../types';

interface IdentificacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: Metadata;
  updateMetadata: <K extends keyof Metadata>(key: K, value: Metadata[K]) => void;
}

export function IdentificacaoModal({
  isOpen,
  onClose,
  metadata,
  updateMetadata,
}: IdentificacaoModalProps) {
  const { laboratorio, atualizarCampo } = useLaboratorio();
  const amostra = metadata.amostra ?? {};

  const mudarAmostra = <K extends keyof IdentificacaoDaAmostra>(
    campo: K,
    valor: IdentificacaoDaAmostra[K]
  ) => updateMetadata('amostra', { ...amostra, [campo]: valor });

  if (!isOpen) return null;

  const pendencias = conferirParaEmissao(laboratorio, amostra);
  const completo = pendencias.length === 0;
  const especieEscrita = escreverEspecie(amostra);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-line bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-line bg-surface-1">
          <div className="flex items-center gap-2.5">
            <FileCheck2 size={18} className="text-accent" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-1">
                Identificação para laudo
              </h2>
              <p className="text-[11px] text-ink-3">
                Campos do Boletim de Análise de Sementes — IN 40/2010
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <PainelDePendencias pendencias={pendencias} completo={completo} />

          <Secao
            titulo="Laboratório"
            explicacao="Registro único da instalação — vale para todo boletim emitido aqui."
          >
            <MetadataInput
              label="Nome do laboratório"
              value={laboratorio?.nome ?? ''}
              onChange={(v) => atualizarCampo('nome', v)}
              placeholder="Ex: Lab. de Sementes e Tecido Vegetal — Unoeste"
            />
            <div className="flex gap-3">
              <MetadataInput
                label="RENASEM"
                value={laboratorio?.renasem ?? ''}
                onChange={(v) => atualizarCampo('renasem', v)}
                placeholder="Ex: SP-00000/0000"
              />
              <CampoDeData
                label="Validade do RENASEM"
                value={laboratorio?.validadeDoRenasem ?? ''}
                onChange={(v) => atualizarCampo('validadeDoRenasem', v || undefined)}
              />
            </div>
            <MetadataInput
              label="Portaria de credenciamento"
              value={laboratorio?.portariaDeCredenciamento ?? ''}
              onChange={(v) => atualizarCampo('portariaDeCredenciamento', v)}
              placeholder="Ex: Portaria nº 000/0000"
            />
            <MetadataInput
              label="Endereço"
              value={laboratorio?.endereco ?? ''}
              onChange={(v) => atualizarCampo('endereco', v)}
              placeholder="Rua, cidade, UF"
            />
            <div className="flex gap-3">
              <MetadataInput
                label="Responsável Técnico"
                value={laboratorio?.responsavelTecnico ?? ''}
                onChange={(v) => atualizarCampo('responsavelTecnico', v)}
                placeholder="Quem assina o laudo"
              />
              <MetadataInput
                label="CREA"
                value={laboratorio?.crea ?? ''}
                onChange={(v) => atualizarCampo('crea', v || undefined)}
                placeholder="Ex: 0000000000-SP"
              />
            </div>
            <p className="text-[11px] text-ink-3 leading-snug">
              O laudo é assinado por uma pessoa. O aplicativo calcula, confere e imprime — a
              responsabilidade técnica pelo resultado é de quem assina.
            </p>
          </Secao>

          <Secao
            titulo="Amostra"
            explicacao="Identifica o lote. Os campos de pesquisa (projeto, tratamento, placa) continuam na barra lateral."
          >
            <div className="flex gap-3">
              <MetadataInput
                label="Espécie — nome comum"
                value={amostra.especieNomeComum ?? ''}
                onChange={(v) => mudarAmostra('especieNomeComum', v)}
                placeholder="Ex: soja"
              />
              <MetadataInput
                label="Nome científico"
                value={amostra.especieNomeCientifico ?? ''}
                onChange={(v) => mudarAmostra('especieNomeCientifico', v)}
                placeholder="Ex: Glycine max"
              />
            </div>
            {especieEscrita && (
              <p className="text-[11px] text-ink-3 -mt-1 ml-1">
                No boletim: <span className="font-semibold text-ink-2">{especieEscrita}</span>
              </p>
            )}

            <div className="flex gap-3">
              <MetadataInput
                label="Cultivar (RNC)"
                value={amostra.cultivar ?? ''}
                onChange={(v) => mudarAmostra('cultivar', v)}
                placeholder="Ex: BRS 1010"
              />
              <MetadataInput
                label="Lote"
                value={amostra.lote ?? ''}
                onChange={(v) => mudarAmostra('lote', v)}
                placeholder="Ex: L-2026-014"
              />
            </div>

            <div className="flex gap-3">
              <CampoDeCategoria
                value={amostra.categoria}
                onChange={(v) => mudarAmostra('categoria', v)}
              />
              <MetadataInput
                label="Safra"
                value={amostra.safra ?? ''}
                onChange={(v) => mudarAmostra('safra', v)}
                placeholder="Ex: 2025/2026"
              />
            </div>

            <div className="flex gap-3">
              <MetadataInput
                label="Representatividade (kg)"
                value={
                  amostra.representatividadeKg !== undefined
                    ? String(amostra.representatividadeKg)
                    : ''
                }
                onChange={(v) => {
                  const n = parseFloat(v.replace(',', '.'));
                  mudarAmostra('representatividadeKg', Number.isFinite(n) ? n : undefined);
                }}
                placeholder="Quanto o lote representa"
              />
              <MetadataInput
                label="Peneira"
                value={amostra.peneira ?? ''}
                onChange={(v) => mudarAmostra('peneira', v)}
                placeholder="Ex: 5,5"
              />
            </div>

            <MetadataInput
              label="Procedência"
              value={amostra.procedencia ?? ''}
              onChange={(v) => mudarAmostra('procedencia', v)}
              placeholder="Origem do lote"
            />

            <div className="flex gap-3">
              <MetadataInput
                label="Amostrador"
                value={amostra.amostrador ?? ''}
                onChange={(v) => mudarAmostra('amostrador', v)}
                placeholder="Quem coletou a amostra"
              />
              <MetadataInput
                label="RENASEM do amostrador"
                value={amostra.renasemDoAmostrador ?? ''}
                onChange={(v) => mudarAmostra('renasemDoAmostrador', v)}
                placeholder="Ex: SP-00000/0000"
              />
            </div>

            <div className="flex gap-3">
              <CampoDeData
                label="Data da amostragem"
                value={amostra.dataDaAmostragem ?? ''}
                onChange={(v) => mudarAmostra('dataDaAmostragem', v || undefined)}
              />
              <CampoDeData
                label="Data de recebimento"
                value={amostra.dataDeRecebimento ?? ''}
                onChange={(v) => mudarAmostra('dataDeRecebimento', v || undefined)}
              />
            </div>

            <div className="flex gap-3">
              <MetadataInput
                label="Número da amostra"
                value={amostra.numeroDaAmostra ?? ''}
                onChange={(v) => mudarAmostra('numeroDaAmostra', v)}
                placeholder="Atribuído pelo laboratório"
              />
              <MetadataInput
                label="Requerente"
                value={amostra.requerente ?? ''}
                onChange={(v) => mudarAmostra('requerente', v)}
                placeholder="Quem pediu a análise"
              />
            </div>

            <p className="text-[11px] text-ink-3 leading-snug">
              Espécie, cultivar, lote e safra são DECLARADOS pelo requerente. O laboratório os
              reproduz no boletim; não os verifica.
            </p>
          </Secao>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PainelDePendencias({
  pendencias,
  completo,
}: {
  pendencias: Pendencia[];
  completo: boolean;
}) {
  if (completo) {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-accent/30 bg-accent-tint">
        <CheckCircle2 size={16} className="text-accent mt-0.5 shrink-0" />
        <p className="text-[12px] text-ink-2 leading-snug">
          Identificação completa. Nenhum campo obrigatório do cabeçalho está em branco.
        </p>
      </div>
    );
  }

  const quantos =
    pendencias.length === 1
      ? 'Falta 1 campo obrigatório'
      : 'Faltam ' + pendencias.length + ' campos obrigatórios';

  return (
    <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-[12px] font-bold text-amber-800 dark:text-amber-300">{quantos}</p>
      </div>
      <ul className="space-y-0.5 ml-6 list-disc text-[11px] text-amber-800 dark:text-amber-300/90">
        {pendencias.map((p) => (
          <li key={p.campo}>{p.descricao}</li>
        ))}
      </ul>
    </div>
  );
}

function Secao({
  titulo,
  explicacao,
  children,
}: {
  titulo: string;
  explicacao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">{titulo}</h3>
        <p className="text-[11px] text-ink-3 mt-0.5">{explicacao}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

const CLASSE_DE_CAMPO =
  'w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all';

function CampoDeData({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label className="text-[11px] font-semibold text-ink-2 ml-1 tracking-wide uppercase">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={CLASSE_DE_CAMPO}
      />
    </div>
  );
}

function CampoDeCategoria({
  value,
  onChange,
}: {
  value?: CategoriaDeSemente;
  onChange: (v: CategoriaDeSemente | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label className="text-[11px] font-semibold text-ink-2 ml-1 tracking-wide uppercase">
        Categoria
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as CategoriaDeSemente | undefined)}
        className={CLASSE_DE_CAMPO}
      >
        <option value="">Selecione...</option>
        {(Object.keys(CATEGORIAS) as CategoriaDeSemente[]).map((c) => (
          <option key={c} value={c}>
            {CATEGORIAS[c]}
          </option>
        ))}
      </select>
    </div>
  );
}
