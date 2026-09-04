/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Identidade do build, injetada pelo Vite (ver `define` em vite.config.ts).
// Existe para que um relatório exportado possa dizer qual código o produziu.
declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;
