import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { registerSW } from 'virtual:pwa-register';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker for offline support
//
// NAO recarrega sozinho quando ha versao nova. Recarregar no meio de uma
// contagem apagaria marcacoes nao salvas — o pior momento possivel para um
// "atualizacao disponivel". Em vez disso, avisa e deixa a pessoa escolher
// quando. O aviso e a resposta a "fiz deploy e continuo vendo a versao velha":
// o service worker cacheia o bundle, e sem isto so Ctrl+Shift+R resolvia.
let atualizarSW: ((recarregar?: boolean) => Promise<void>) | null = null;
if ('serviceWorker' in navigator) {
  atualizarSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('seedcounter:nova-versao'));
    },
  });
}

/** Aplica a atualizacao pendente e recarrega. Chamado pelo aviso na interface. */
export function aplicarAtualizacao() {
  return atualizarSW?.(true);
}

/**
 * Tira a tela de abertura.
 *
 * O atraso minimo existe porque uma abertura que pisca por 80 ms e pior que
 * nenhuma: o olho registra o lampejo, nao a marca. Meio segundo e o suficiente
 * para a identidade ser lida sem virar espera.
 */
function fecharAbertura() {
  const abertura = document.getElementById('abertura');
  if (!abertura) return;

  const MINIMO_MS = 520;
  const decorrido = performance.now();
  const esperar = Math.max(0, MINIMO_MS - decorrido);

  setTimeout(() => {
    abertura.classList.add('saindo');
    // Espera a transicao de opacidade antes de tirar do fluxo.
    setTimeout(() => abertura.remove(), 420);
  }, esperar);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureFlagProvider>
      <App />
      <Analytics />
      <SpeedInsights />
    </FeatureFlagProvider>
  </StrictMode>
);

fecharAbertura();
