// =============================================================================
// SeedCounter — continuidade: a imagem nova é a próxima repetição, outro
// tratamento ou outro experimento?
//
// POR QUE ESTE MÓDULO EXISTE.
//
// Quem carrega a segunda imagem do dia quase sempre está no MESMO ensaio da
// primeira: é a repetição 2, ou o tratamento seguinte. O metadado da cena
// anterior já diz o projeto, o tratamento, a espécie — e o nome do arquivo
// novo diz o que mudou ("rep 2", "T8"). Pedir para digitar tudo de novo é a
// forma mais barata de fazer alguém deixar o metadado em branco, e metadado
// em branco é o motivo número um de dado que não se reaproveita.
//
// A REGRA: TRÊS PROPOSTAS, SEMPRE, CADA UMA COM O PORQUÊ.
//
// Este módulo nunca escolhe sozinho. Ele monta as três hipóteses possíveis,
// aponta qual parece mais provável e diz de onde tirou cada valor: "porque
// o arquivo se chama X e a cena atual é Y". A pessoa escolhe, e o diálogo só
// escreve o que ela marcou. É a mesma regra de `lib/sugestoes-do-arquivo.ts`:
// sugere, nunca preenche.
//
// A HEURÍSTICA É DELIBERADAMENTE SIMPLES.
//
// Mesma espécie sugerida e mesmo tratamento (ou nenhum no nome) → próxima
// repetição. Mesma espécie, tratamento diferente no nome → outro tratamento.
// Espécie diferente, ou nenhuma sugestão → outro experimento como padrão.
// Um modelo mais esperto acertaria mais vezes e erraria de forma mais
// difícil de explicar — e aqui a explicação É o produto: sem ela a pessoa
// não tem como conferir em um segundo, e uma proposta inconferível vira
// preenchimento automático disfarçado.
// =============================================================================

import type { SugestoesDaAmostra } from '../../lib/sugestoes-do-arquivo';
import type { Metadata } from '../../types';

export type TipoDeContinuidade = 'proxima-repeticao' | 'outro-tratamento' | 'outro-experimento';

/** Os campos de metadado que uma proposta pode tocar. */
export type CampoDeContinuidade = 'researcher' | 'project' | 'treatment' | 'plate' | 'especie';

export const ROTULO_DO_CAMPO: Record<CampoDeContinuidade, string> = {
  researcher: 'Pesquisador',
  project: 'Projeto',
  treatment: 'Tratamento',
  plate: 'Placa / repetição',
  especie: 'Espécie',
};

/** O que a cena atual já sabe de si, achatado para o que importa aqui. */
export interface CenaAtual {
  researcher: string;
  project: string;
  treatment: string;
  plate: string;
  /** `metadata.amostra?.especieNomeCientifico`. */
  especie?: string;
}

export interface ValorProposto {
  valor: string;
  /** De onde veio, para a pessoa conferir num relance. */
  origem: string;
}

export interface PropostaDeContinuidade {
  tipo: TipoDeContinuidade;
  titulo: string;
  /** "porque o arquivo se chama X e a cena atual é Y". */
  porque: string;
  /** Só os campos que a proposta tem algo a dizer. Vazio = "deixa em branco". */
  campos: Partial<Record<CampoDeContinuidade, ValorProposto>>;
}

export interface Continuidade {
  /** A hipótese que a heurística acha mais provável — pré-selecionada, nunca aplicada sozinha. */
  padrao: TipoDeContinuidade;
  /** Sempre as três, na mesma ordem, para o seletor ser estável. */
  propostas: PropostaDeContinuidade[];
}

// -----------------------------------------------------------------------------
// Tratamento no nome do arquivo
// -----------------------------------------------------------------------------

/**
 * "T8", "trat 3", "tratamento-12", "controle", "testemunha".
 *
 * `sugerirDoArquivo` se recusa a adivinhar tratamento a partir de texto
 * livre, e com razão. O que se aceita aqui é ainda mais estreito que lá:
 * só a forma codificada (letra T + número) e as duas palavras que todo
 * ensaio agronômico usa para o controle. Nada de "dose", "adubo", "salino" —
 * isso é texto livre, e texto livre erra.
 */
export function acharTratamento(nomeDoArquivo: string): { valor: string; origem: string } | null {
  const texto = nomeDoArquivo.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[_\-.]+/g, ' ');
  const codigo = texto.match(/\b(?:T|trat(?:amento)?)\s*[:-]?\s*(\d{1,3})\b/iu);
  if (codigo) return { valor: `T${Number(codigo[1])}`, origem: codigo[0].trim() };
  const controle = texto.match(/\b(controle|testemunha)\b/iu);
  if (controle) return { valor: controle[1].toLowerCase(), origem: controle[0] };
  return null;
}

/** "T 8", "t8" e "T08" são o mesmo tratamento. */
function normalizarTratamento(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^t0*(\d)/, 't$1');
}

function mesmaEspecie(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A placa atual é um número? Então a próxima é ele + 1. */
function incrementarPlaca(plate: string): string | null {
  const m = plate.trim().match(/^(\D*?)(\d+)$/);
  if (!m) return null;
  return `${m[1]}${Number(m[2]) + 1}`;
}

// -----------------------------------------------------------------------------
// As três propostas
// -----------------------------------------------------------------------------

function descreverCena(cena: CenaAtual): string {
  const partes: string[] = [];
  if (cena.project) partes.push(`é do projeto "${cena.project}"`);
  if (cena.treatment) partes.push(`tratamento "${cena.treatment}"`);
  if (cena.plate) partes.push(`placa "${cena.plate}"`);
  if (cena.especie) partes.push(`espécie ${cena.especie}`);
  return partes.length > 0 ? partes.join(', ') : 'não tem projeto nem tratamento preenchido';
}

type Campos = PropostaDeContinuidade['campos'];

const DA_CENA = 'da cena atual';

/** Só entra no objeto se houver valor: campo vazio não é proposta, é silêncio. */
function daCena(campos: Campos, campo: CampoDeContinuidade, valor: string | undefined): void {
  if (valor) campos[campo] = { valor, origem: DA_CENA };
}

function doNome(
  campos: Campos,
  campo: CampoDeContinuidade,
  achado: { valor: string; origem: string } | null | undefined
): void {
  if (achado)
    campos[campo] = { valor: achado.valor, origem: `"${achado.origem}" no nome do arquivo` };
}

/**
 * Monta as três propostas e aponta a mais provável.
 *
 * Nunca lê o metadado por conta própria: recebe a cena achatada e as
 * sugestões que `sugerirDoArquivo` já extraiu do nome — assim os testes
 * cobrem a heurística sem tocar em `File` nem em estado.
 */
export function proporContinuidade(
  cena: CenaAtual,
  sugestoes: SugestoesDaAmostra,
  nomeDoArquivo: string
): Continuidade {
  const tratamentoDoNome = acharTratamento(nomeDoArquivo);
  const especieDoNome = sugestoes.especieNomeCientifico;
  const repDoNome = sugestoes.repeticao
    ? { valor: String(sugestoes.repeticao.valor), origem: sugestoes.repeticao.origem }
    : null;
  const porque = `porque o arquivo se chama "${nomeDoArquivo}" e a cena atual ${descreverCena(cena)}`;

  // --- 1. Próxima repetição -------------------------------------------------
  // A repetição vem do nome quando ele a declara; senão, é a placa atual + 1
  // — e, se a placa atual não for número, fica em branco.
  const c1: Campos = {};
  daCena(c1, 'researcher', cena.researcher);
  daCena(c1, 'project', cena.project);
  daCena(c1, 'treatment', cena.treatment);
  if (repDoNome) doNome(c1, 'plate', repDoNome);
  else {
    const inc = incrementarPlaca(cena.plate);
    if (inc) c1.plate = { valor: inc, origem: `placa atual "${cena.plate}" + 1` };
  }
  daCena(c1, 'especie', cena.especie);
  const proximaRepeticao: PropostaDeContinuidade = {
    tipo: 'proxima-repeticao',
    titulo: 'Mesmo experimento, próxima repetição',
    porque,
    campos: c1,
  };

  // --- 2. Outro tratamento --------------------------------------------------
  // Tratamento do nome, ou em branco — nunca o da cena, que é o que muda.
  const c2: Campos = {};
  daCena(c2, 'researcher', cena.researcher);
  daCena(c2, 'project', cena.project);
  doNome(c2, 'treatment', tratamentoDoNome);
  doNome(c2, 'plate', repDoNome);
  daCena(c2, 'especie', cena.especie);
  const outroTratamento: PropostaDeContinuidade = {
    tipo: 'outro-tratamento',
    titulo: 'Mesmo experimento, outro tratamento',
    porque,
    campos: c2,
  };

  // --- 3. Outro experimento -------------------------------------------------
  // Herda só quem está contando. Projeto, tratamento e placa recomeçam — o
  // que o nome do arquivo ou a pasta disserem entra como proposta, o resto
  // fica em branco para a pessoa preencher.
  const c3: Campos = {};
  daCena(c3, 'researcher', cena.researcher);
  if (sugestoes.projeto) {
    c3.project = { valor: sugestoes.projeto.valor, origem: `pasta "${sugestoes.projeto.origem}"` };
  }
  doNome(c3, 'treatment', tratamentoDoNome);
  doNome(c3, 'plate', repDoNome);
  doNome(c3, 'especie', especieDoNome);
  const outroExperimento: PropostaDeContinuidade = {
    tipo: 'outro-experimento',
    titulo: 'Outro experimento',
    porque,
    campos: c3,
  };

  // --- Qual é a mais provável -----------------------------------------------
  let padrao: TipoDeContinuidade = 'outro-experimento';
  const especieBate = mesmaEspecie(especieDoNome?.valor, cena.especie);
  const tratamentoBate =
    tratamentoDoNome !== null &&
    cena.treatment !== '' &&
    normalizarTratamento(tratamentoDoNome.valor) === normalizarTratamento(cena.treatment);

  if (especieBate) {
    // Mesma espécie: é o mesmo ensaio. O tratamento decide entre repetição e
    // outro tratamento; sem tratamento no nome, a hipótese mais barata é a
    // próxima repetição.
    padrao = tratamentoDoNome && !tratamentoBate ? 'outro-tratamento' : 'proxima-repeticao';
  } else if (!especieDoNome && cena.project) {
    // Sem espécie no nome não dá para dizer que é OUTRA espécie. Se o nome
    // traz um tratamento ou uma repetição, ele está falando do mesmo ensaio
    // — "rep 2" solto num arquivo é a segunda placa do que estava aberto.
    if (tratamentoDoNome && !tratamentoBate) padrao = 'outro-tratamento';
    else if (tratamentoBate || repDoNome) padrao = 'proxima-repeticao';
  }

  return { padrao, propostas: [proximaRepeticao, outroTratamento, outroExperimento] };
}

// -----------------------------------------------------------------------------
// Aplicar
// -----------------------------------------------------------------------------

/**
 * O que mudaria no metadado se a proposta entrasse, campo a campo.
 *
 * `preencheria` é o que a interface pré-marca: campo vazio na cena. Campo já
 * preenchido pela pessoa NÃO é pré-marcado — ela sabe mais que o nome do
 * arquivo — mas continua na lista, desmarcado, para ela poder marcar.
 */
export interface MudancaProposta {
  campo: CampoDeContinuidade;
  de: string;
  para: string;
  origem: string;
  /** Vazio hoje: entra sem a pessoa precisar marcar. */
  preencheria: boolean;
}

export function lerCampo(meta: Metadata, campo: CampoDeContinuidade): string {
  if (campo === 'especie') return meta.amostra?.especieNomeCientifico ?? '';
  return meta[campo] ?? '';
}

export function listarMudancas(
  meta: Metadata,
  proposta: PropostaDeContinuidade
): MudancaProposta[] {
  const saida: MudancaProposta[] = [];
  for (const campo of Object.keys(ROTULO_DO_CAMPO) as CampoDeContinuidade[]) {
    const proposto = proposta.campos[campo];
    if (!proposto) continue;
    const atual = lerCampo(meta, campo);
    if (atual === proposto.valor) continue; // já está assim — nada a mudar
    saida.push({
      campo,
      de: atual,
      para: proposto.valor,
      origem: proposto.origem,
      preencheria: atual === '',
    });
  }
  return saida;
}

/**
 * Escreve no metadado SÓ os campos marcados. Não toca em mais nada — nem em
 * `dataset`, nem em `amostra` além da espécie — porque o resto do que a cena
 * anterior tinha (calibração, procedência) é decisão de outros pontos do App.
 */
export function aplicarContinuidade(
  meta: Metadata,
  proposta: PropostaDeContinuidade,
  marcados: ReadonlySet<CampoDeContinuidade>
): Metadata {
  let saida: Metadata = meta;
  for (const campo of marcados) {
    const proposto = proposta.campos[campo];
    if (!proposto) continue;
    if (campo === 'especie') {
      saida = {
        ...saida,
        amostra: { ...(saida.amostra ?? {}), especieNomeCientifico: proposto.valor },
      };
    } else {
      saida = { ...saida, [campo]: proposto.valor };
    }
  }
  return saida;
}
