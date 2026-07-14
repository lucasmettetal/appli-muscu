import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { applyTheme, getInitialTheme } from './lib/theme';

// Applique le thème avant le rendu pour éviter tout flash de couleur.
applyTheme(getInitialTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
