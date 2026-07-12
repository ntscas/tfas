import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker registered successfully:', reg.scope);
        // Force checking for updates immediately on load to make sure we don't get stuck caching old versions
        reg.update();
      })
      .catch(err => console.error('[PWA] Service Worker registration failed:', err));
  });
}
