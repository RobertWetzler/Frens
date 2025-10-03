import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';

// Generic hook to create theme-aware styles with memoization on theme change.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  creator: (theme: ReturnType<typeof useTheme>['theme']) => T
) {
  return () => {
    const { theme } = useTheme();
    return useMemo(() => StyleSheet.create(creator(theme)), [theme]);
  };
}
