/* global PermissionState */
/**
 * File System Access API — o TS não declara `showDirectoryPicker` em lib.dom
 * (só Chrome/Edge implementam; `FileSystemDirectoryHandle`, `FileSystemFileHandle`
 * e `.values()`/`.entries()` já existem em lib.dom desde o TS 4.4).
 *
 * `queryPermission`/`requestPermission` também faltam nos tipos padrão: são
 * parte da extensão "File System Access" da mesma API, não do core que o
 * TS empacota. Sem eles não dá para revalidar um handle salvo no Dexie antes
 * de reabrir a pasta.
 */
declare global {
  interface Window {
    showDirectoryPicker?(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemHandle {
    queryPermission?(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<PermissionState>;
    requestPermission?(
      descriptor?: FileSystemHandlePermissionDescriptor
    ): Promise<PermissionState>;
  }

  /**
   * `FileSystemDirectoryHandle.entries()`/`.values()`/`.keys()` (varredura
   * assíncrona da pasta) só existem em lib.dom quando a lib
   * "DOM.AsyncIterable" está habilitada — e não podemos mexer em
   * `tsconfig.json` neste lote (fora do escopo do agente). Redeclaramos aqui
   * a mesma forma que o TS oficial usa (lib.dom.asynciterable.d.ts), só o
   * suficiente para tipar a varredura.
   */
  interface FileSystemDirectoryHandleAsyncIterator<T> extends AsyncIterator<T> {
    [Symbol.asyncIterator](): FileSystemDirectoryHandleAsyncIterator<T>;
  }

  interface FileSystemDirectoryHandle {
    [Symbol.asyncIterator](): FileSystemDirectoryHandleAsyncIterator<[string, FileSystemHandle]>;
    entries(): FileSystemDirectoryHandleAsyncIterator<[string, FileSystemHandle]>;
    keys(): FileSystemDirectoryHandleAsyncIterator<string>;
    values(): FileSystemDirectoryHandleAsyncIterator<FileSystemHandle>;
  }
}

export {};
