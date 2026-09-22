// =============================================================================
// SeedCounter — a classe do modelo, traduzida UMA vez
//
// O modelo foi treinado com `names: [inviavel, viavel]` (Roboflow v8,
// `data_sementes.yaml`): índice 0 é INVIÁVEL, índice 1 é VIÁVEL. É
// contra-intuitivo — quem escreve de cabeça põe "1 = ruim" — e foi exatamente
// assim que a fila com IA marcou todo lote como inviável (`classId === 1`), e
// que o importador de JSON fazia o mesmo (`class === 1`). Dois lugares, a
// mesma tabela decorada errado.
//
// POR QUE EM `lib/`. A tradução era uma função dentro de `features/lote/`, e
// o importador (App) e o painel de IA (`features/ai-pointer/`) não podiam
// importá-la sem atravessar uma feature que não é deles — então cada um
// escrevia a sua. Aqui todo mundo alcança, e a tabela mora no MESMO arquivo
// que a tradução: não dá para mudar uma sem ver a outra.
//
// Os produtores externos não seguem esta tabela: `python/orchid_seed_analyzer.py`
// escreve `category`/`class_name` com `class_id == 0 → viável` (invertido em
// relação ao treino) e com acento; o `hf_space` tem `{"0": "viable"}` como
// padrão. Por isso o importador confia PRIMEIRO no vocabulário do app
// (`category`), depois no NOME (normalizado, sem acento), e só por último no
// índice — e o índice é lido por esta tabela, não por um número decorado.
// =============================================================================

/** A ordem do treino. Índice = classe que o modelo devolve. */
export const YOLO_CLASSES = ['inviavel', 'viavel'] as const;
export type YoloClassName = (typeof YOLO_CLASSES)[number];

export type Categoria = 'viable' | 'inviable';

/** O nome interno (`class_name`) que corresponde a cada categoria. */
export function nomeDaCategoria(categoria: Categoria): YoloClassName {
  return categoria === 'inviable' ? 'inviavel' : 'viavel';
}

/**
 * Classe do modelo no vocabulário do app. Só `className` decide — é o nome
 * que `yolo-onnx.ts` já resolveu por `YOLO_CLASSES`, então não há segunda
 * tabela a consultar.
 */
export function categoriaDaDeteccao(det: { className: string }): Categoria {
  return categoriaDoNome(det.className) ?? 'viable';
}

/**
 * Categoria → índice do treino. É o inverso de `categoriaDoIndice`, e é o que
 * um dataset EXPORTADO pelo app tem de usar: com o mesmo índice do treino
 * (0 inviável, 1 viável), o que sai daqui se mistura ao conjunto original sem
 * remapear — e sem inverter tudo em silêncio, que é o erro desta tabela.
 */
export function indiceDaCategoria(categoria: Categoria): number {
  return YOLO_CLASSES.indexOf(nomeDaCategoria(categoria));
}

/** Índice do modelo → categoria, pela tabela do treino. Fora dela: `null`. */
export function categoriaDoIndice(indice: number): Categoria | null {
  const nome = YOLO_CLASSES[indice];
  return nome === undefined ? null : categoriaDoNome(nome);
}

/**
 * Nome de classe → categoria, tolerando o que chega de fora: maiúsculas,
 * acento ('inviável'), inglês ('inviable'). Nome que não é viável nem
 * inviável devolve `null` — quem chama decide o que fazer com "with mold" ou
 * "trigo duro"; inventar uma correspondência aqui seria pior que não ter.
 */
export function categoriaDoNome(nome: string): Categoria | null {
  const n = nome.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n === 'inviavel' || n === 'inviable') return 'inviable';
  if (n === 'viavel' || n === 'viable') return 'viable';
  return null;
}

/**
 * Categoria de um registro importado de JSON, na ordem de confiança:
 * `category` (já é o vocabulário do app), `class_name` (nome, normalizado),
 * `class`/`class_id` (índice, pela tabela do treino). Sem nada disso, viável —
 * a mesma convenção da onda, que não distingue e deixa a leitura para a pessoa.
 */
export function categoriaImportada(registro: unknown): Categoria {
  if (typeof registro !== 'object' || registro === null) return 'viable';
  const r = registro as Record<string, unknown>;

  if (typeof r.category === 'string') {
    const c = categoriaDoNome(r.category);
    if (c) return c;
  }
  if (typeof r.class_name === 'string') {
    const c = categoriaDoNome(r.class_name);
    if (c) return c;
  }
  const indice =
    typeof r.class === 'number' ? r.class : typeof r.class_id === 'number' ? r.class_id : null;
  if (indice !== null) {
    const c = categoriaDoIndice(indice);
    if (c) return c;
  }
  return 'viable';
}
