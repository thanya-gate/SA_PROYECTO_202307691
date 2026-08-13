import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'yousac_theme';
const SYSTEM_KEY = '(prefers-color-scheme: dark)';

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia(SYSTEM_KEY).matches ? 'dark' : 'light';
}

function storedPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* almacenamiento no disponible */
  }
  return 'system';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(storedPreference);
  const [systemPref, setSystemPref] = useState<Theme>(systemTheme);

  const theme: Theme = preference === 'system' ? systemPref : preference;

  useEffect(() => {
    const mq = window.matchMedia(SYSTEM_KEY);
    const onChange = () => setSystemPref(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [theme, preference]);

  const toggle = useCallback(() => {
    setPreference((current) => {
      const resolved: Theme = current === 'system' ? systemTheme() : current;
      return resolved === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return { theme, preference, setPreference, toggle };
}
