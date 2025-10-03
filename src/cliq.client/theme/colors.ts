// Central color tokens and palettes
// Base semantic color scale; keep raw hex codes here only.
export const baseColors = {
  // Brand / primary accent
  primary: '#1DA1F2',
  primaryLight: '#66C4FF',
  primaryDark: '#0A84C1',

  // Status
  danger: '#FF3B30',
  warning: '#FF9500',
  success: '#34C759',
  info: '#007AFF',

  // Greys
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F8F9FA',
  gray100: '#F5F8FA',
  gray200: '#E1E4E8',
  gray300: '#E1E8ED',
  gray400: '#CED5DA',
  gray500: '#999999',
  gray600: '#666666',
  gray700: '#444444',
  gray800: '#333333',
  gray900: '#111111',

  // Misc specific existing values
  cardBorder: '#e1e4e8',
  softBlue: '#97d6fc',
  highlightPurple: '#8C66FF',
};

// Theme shape describing semantic roles used across the UI.
export interface SemanticColors {
  background: string;
  backgroundAlt: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryContrast: string;
  accent: string;
  danger: string;
  overlay: string;
  separator: string;
  shadow: string;
  inputBorder: string;
  inputPlaceholder: string;
  notification: string;
  blob1: string;
  blob2: string;
  blob3: string;
}

export interface Theme {
  name: string;
  isDark: boolean;
  colors: SemanticColors;
  gradients?: {
    primary: string[];
    accent: string[];
  };
}

export const lightTheme: Theme = {
  name: 'light',
  isDark: false,
  colors: {
    background: 'transparent',
    backgroundAlt: baseColors.gray50,
    card: baseColors.white,
    cardBorder: baseColors.cardBorder,
    textPrimary: baseColors.gray900,
    textSecondary: baseColors.gray700,
    textMuted: baseColors.gray600,
    primary: baseColors.primary,
    primaryContrast: baseColors.white,
    accent: baseColors.highlightPurple,
    danger: baseColors.danger,
    overlay: 'rgba(0,0,0,0.4)',
    separator: baseColors.cardBorder,
    shadow: '#000',
    inputBorder: baseColors.gray300,
    inputPlaceholder: baseColors.gray600,
    notification: baseColors.danger,
  blob1: '#6699FF', // approximate current lighter blue
  blob2: '#99CCFF', // very light blue
  blob3: '#8C66FF', // purple accent
  },
  gradients: {
    primary: ['#f06c6cff','#da9358ff', ],
    accent: ['#4F46E5', '#7C3AED'],
  }
};

// Placeholder for a future seasonal / halloween theme illustrating overrides.
export const halloweenTheme: Theme = {
  name: 'halloween',
  isDark: true,
  colors: {
    background: 'transparent',
    backgroundAlt: '#140606ff',
    card: '#682300ff',
    cardBorder: '#2A2A2A',
    textPrimary: baseColors.white,
    textSecondary: baseColors.gray300,
    textMuted: baseColors.gray200,
    primary: '#FF8800', // This would become orange in a Halloween variant
    primaryContrast: baseColors.black,
    accent: '#FF5500',
    danger: baseColors.danger,
    overlay: 'rgba(0,0,0,0.6)',
    separator: '#2A2A2A',
    shadow: '#000',
    inputBorder: '#333333',
    inputPlaceholder: baseColors.gray600,
    notification: baseColors.danger,
  blob1: '#c8ce2dff',
  blob2: '#e56829ff',
  blob3: '#e85409ff', // accent warm variant
  },
  gradients: {
    primary: ['#4f26f2ff', '#e01df2ff'],
    accent: ['#d53002ff', '#891222ff'],
  }
};

// Registered themes. Keeping 'dark' pointing at halloweenTheme for backward compatibility
// while adding an explicit 'halloween' key so seasonal logic can target it directly.
export const themes = {
  light: lightTheme,
  dark: halloweenTheme,
  halloween: halloweenTheme,
};

export type ThemeName = keyof typeof themes;
