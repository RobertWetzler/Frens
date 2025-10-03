Centralized Theming System
===========================

Files:
- colors.ts: Raw design tokens (baseColors) and semantic theme objects (lightTheme, darkTheme).
- ThemeContext.tsx: React context to provide and switch themes.

How to Use in Components:
1. Import the hook: `import { useTheme } from '../theme/ThemeContext';`
2. Access colors: `const { theme } = useTheme();`
3. Replace hard-coded values: `style={{ backgroundColor: theme.colors.card }}`.

Semantic Color Guidelines:
- primary: Main brand/action color (buttons, links, active icons)
- primaryContrast: Text/icon color placed on top of primary backgrounds
- card: Surface background for cards/panels
- cardBorder / separator: Thin dividing lines
- textPrimary / textSecondary / textMuted: Hierarchy of text emphasis
- background: App-level background (kept transparent here due to shader layer)
- backgroundAlt: Scroll/body fallback background if needed
- inputBorder / inputPlaceholder: Form fields
- accent: Secondary highlight color (e.g., gradient stop, accent buttons)
- danger / notification: Destructive actions & badges

Adding a Seasonal / Holiday Theme:
1. Duplicate `darkTheme` (or `lightTheme`) in `colors.ts` with a new name (e.g. `halloweenTheme`).
2. Override only the semantic colors you want to change (e.g. primary to orange, card to near-black).
3. Add it to the `themes` export map.
4. Switch at runtime: `const { setTheme } = useTheme(); setTheme('halloween');`

Batch Replacements Strategy (optional):
You can progressively migrate existing hex codes:
- '#1DA1F2' -> theme.colors.primary
- '#e1e4e8' / '#E1E8ED' -> theme.colors.separator
- '#FFFFFF' / '#fff' -> theme.colors.card (or theme.colors.primaryContrast if foreground)
- '#666', '#666666' -> theme.colors.textMuted
- '#333', '#333333' -> theme.colors.textSecondary
- '#111' -> theme.colors.textPrimary
- '#FF3B30' / '#FF6B6B' -> theme.colors.danger

Example Inline Conversion:
Before: `<Ionicons color="#1DA1F2" />`
After:  `const { theme } = useTheme(); <Ionicons color={theme.colors.primary} />`

Next Steps (Not yet applied):
- Migrate remaining components/screens to use theme.
- Introduce a hook `useThemedStyles(fn)` that memoizes StyleSheet creation per theme.
- Optionally persist user theme preference with AsyncStorage or secure storage.

This file is intentionally concise so you can quickly adapt future palettes.
