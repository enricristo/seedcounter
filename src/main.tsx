import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { registerSW } from 'virtual:pwa-register';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker for offline support
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
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
