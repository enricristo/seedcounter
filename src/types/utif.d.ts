import type { IFD } from 'utif';

/**
 * `@types/utif` declara `decodeImage(buffer, ifd)` com dois argumentos, mas a
 * implementação real (UTIF.js) recebe um terceiro `ifds` — a lista completa
 * de páginas — e o usa para TIFFs multipágina com tiras/strips compartilhadas
 * entre IFDs. `lib/tiff.ts` passa esse terceiro argumento de propósito, desde
 * antes do `noImplicitAny`; a ampliação abaixo apenas corrige o tipo para
 * bater com o que a biblioteca aceita, sem tirar o argumento (isso mudaria
 * comportamento) nem esconder o tipo atrás de `any`.
 */
declare module 'utif' {
  export function decodeImage(buffer: Buffer | ArrayBuffer, ifd: IFD, ifds?: IFD[]): void;
}
