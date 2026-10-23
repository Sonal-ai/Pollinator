'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
type Theme = 'light' | 'dark';
const EVENT = 'pollinator-theme-change';
function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const storage = (event: StorageEvent) => {
    if (event.key !== 'pollinator-theme' && event.key !== null) return;
    const next = event.newValue === 'dark' || event.newValue === 'light'
      ? event.newValue : media.matches ? 'dark' : 'light';
    applyTheme(next, false);
  };
  window.addEventListener('storage', storage);
  const sync = () => {
    try { if (!localStorage.getItem('pollinator-theme')) applyTheme(media.matches ? 'dark' : 'light', false); }
    catch { /* Browser storage can be disabled. */ }
    callback();
  };
  media.addEventListener('change', sync);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', storage);
    media.removeEventListener('change', sync);
  };
}
function applyTheme(theme: Theme, persist = true) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.style.colorScheme = theme;
  if (persist) { try { localStorage.setItem('pollinator-theme', theme); } catch {} }
  window.dispatchEvent(new Event(EVENT));
}
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void; setTheme: (theme: Theme) => void }>({ theme: 'light', toggleTheme: () => {}, setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme);
  return <ThemeContext.Provider value={{
    theme, setTheme: (value: Theme) => applyTheme(value),
    toggleTheme: () => applyTheme(readTheme() === 'dark' ? 'light' : 'dark'),
  }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
