import React, { createContext, useContext, useState, useMemo, ReactNode, useCallback } from 'react';
import { Theme, themes, ThemeName, lightTheme } from './colors';

interface ThemeContextValue {
  theme: Theme;
  name: ThemeName;
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ initial?: ThemeName; children: ReactNode }> = ({ initial = 'holiday', children }) => {
  const [name, setName] = useState<ThemeName>(initial);
  const setTheme = useCallback((next: ThemeName) => setName(next), []);
  const toggleTheme = useCallback(() => setName(prev => prev === 'light' ? 'dark' : 'light'), []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: themes[name] ?? lightTheme,
    name,
    setTheme,
    toggleTheme,
  }), [name, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
