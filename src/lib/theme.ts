// Gestion du thème clair/sombre. La classe `.dark` est posée sur <html> ; les
// styles sombres sont centralisés dans styles/index.css (overrides des tons
// neutres/accents), ce qui évite d'annoter chaque page.

export type Theme = 'light' | 'dark';

const KEY = 'muscu_theme';

export function getStoredTheme(): Theme | null {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

export function getInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(KEY, theme);
}
