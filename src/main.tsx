import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA (Progressive Web App) offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registered with scope: ', registration.scope);
      })
      .catch((err) => {
        console.error('ServiceWorker registration failed: ', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // In development, we can register it or print a friendly log
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registered in DEV with scope: ', registration.scope);
      })
      .catch((err) => {
        console.warn('Dev ServiceWorker registration failed: ', err);
      });
  });
}

