// A onda: contorno por clique, "contornar esta" e o lote. `onda-no-canvas.ts`
// continua importado direto pelo App (ponte com o canvas, não muda aqui).
// Componentes importam o módulo, não este barril — ver `dependencias.test.ts`.
export { useOnda } from './useOnda';
export type { EntradaDaOnda } from './useOnda';
export {
  contornoDoClique,
  recadoDoContorno,
  recadoDeUma,
  recadoDoLote,
  areaFormatada,
  classeExternaDe,
} from './contorno-do-clique';
export type { EntradaDoContorno } from './contorno-do-clique';
