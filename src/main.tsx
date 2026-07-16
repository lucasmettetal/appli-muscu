import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { applyTheme, getInitialTheme } from './lib/theme';

// Applique le thème avant le rendu pour éviter tout flash de couleur.
applyTheme(getInitialTheme());

// Après un nouveau déploiement, les chunks hashés changent de nom. Un onglet qui
// tourne encore l'ancienne version peut échouer à charger un chunk lazy
// (« Failed to fetch dynamically imported module »). On recharge alors la page
// pour récupérer la version à jour — au plus une fois par ~10 s pour éviter toute
// boucle si le réseau est réellement coupé.
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  const KEY = 'chunk-reload-at';
  const last = Number(sessionStorage.getItem(KEY) || '0');
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
