import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
    <App />
    <Analytics />
  </StrictMode>,
    <FeatureFlagProvider>
      <App />
      <Analytics />
      <SpeedInsights />
    </FeatureFlagProvider>
  </StrictMode>
);
