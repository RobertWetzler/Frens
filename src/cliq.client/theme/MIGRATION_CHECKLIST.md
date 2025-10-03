Theming Migration Checklist
===========================

Goal: Replace all hard-coded color literals with semantic theme tokens from `ThemeContext` / `colors.ts`.

Legend
- Status: TODO | PARTIAL | DONE
- Token Guidance (examples): primary, accent, card, cardBorder, textPrimary, textSecondary, textMuted, separator, danger, backgroundAlt, inputBorder, inputPlaceholder, shadow, primaryContrast

Core Principles
1. No raw hex values in components after migration (except inside `theme/colors.ts`).
2. Favor semantic tokens (e.g. `textSecondary`) over direct brand tokens unless truly brand‑specific.
3. Consolidate near-duplicate greys into existing gray scale tokens.
4. Gradients: define reusable gradient tokens (see bottom) before mass replacing.

Priority Order
1. Global/navigation (App & tab bar colors)
2. Shared UI components (high reuse)
3. Primary content screens
4. Auth & onboarding UI
5. Low-frequency / legal / modal content
6. Gradients & decorative visuals

Checklist

| File | Category | Status | Notes / Color Patterns | Planned Token Mapping |
|------|----------|--------|------------------------|-----------------------|
| `App.tsx` | Core | DONE | Tab bar colors themed | primary |
| `components/Header.tsx` | Component | DONE | Migrated: tokens + variant actions | — |
| `components/Button.tsx` | Component | DONE | Variants themed (primary, outline, ghost) | — |
| `components/NotificationSubscribeButton.tsx` | Component | DONE | Migrated: accent + separators + texts themed | accent, primary, backgroundAlt, separator, textMuted |
| `components/Avatar.tsx` | Component | DONE | Overlay uses theme.accent; container card | softBlue → accent |
| `components/CommentSection.tsx` | Component | DONE | Migrated: thread line, separators, text colors themed | — |
| `components/DateInput.tsx` | Component | DONE | Borders & placeholders themed | inputPlaceholder, inputBorder, textMuted |
| `components/AnimatedBackground.tsx` | Visual | TODO | 3 gradient arrays of blues | gradient.primary (new) |
| `components/NotificationBell.tsx` | Component | DONE | Badge & icon themed | primary, primaryLight |
| `components/Post.tsx` | Component | DONE | Migrated to theme (primary, textMuted, separator, shadow) | — |
| `components/CircleFilter.tsx` | Component | DONE | Purples/Blues (#6699FF, #8C66FF), greys | accent, accentAlt, textMuted, separator |
| `components/Event.tsx` | Component | DONE | Date badge, meta, borders themed | separator, primary, textSecondary, textMuted |
| `components/TermsOfService.tsx` | Component | DONE | Themed surfaces, borders, buttons | card, textPrimary, textSecondary, separator, primary |
| `components/EmailSignInButton.tsx` | Auth | DONE | Inputs, buttons, placeholders themed | primary, card, textSecondary |
| `components/AppleSignInButton.tsx` | Auth | DONE | Web button themed (consider brand token later) | textPrimary/card |
| `components/PWAInstallBanner.tsx` | PWA | DONE | Uses theme.gradients.accent | gradient.accent |
| `components/PWAInstallModal.tsx` | PWA | DONE | Uses theme.gradients.accent | gradient.accent |
| `components/GlobalShaderBackground.tsx` | Visual | TODO (verify) | Any fallback tint? | background / overlay |
| `components/ShaderBackground.tsx` | Visual | DONE | Shader blobs themed via blob1/2/3 tokens | blob1, blob2, blob3 |
| `screens/AddUsersToCircleScreen.tsx` | Screen | DONE | Search, list items, actions themed | primary, textPrimary, textMuted, separator, card |
| `screens/CreateCircleScreen.tsx` | Screen | DONE | Form inputs, toggles, list themed | primary, textPrimary, textMuted, inputBorder |
| `screens/CreatePostScreen.tsx` | Screen | DONE | Themed: inputs, circle list, switch, icons | primary, textSecondary, textMuted, separator, shadow |
| `screens/ProfileScreen.tsx` | Screen | DONE | Themed: buttons, states, avatar, refresh | primary, accent, textMuted, separator |
| `screens/HomeSreen.tsx` | Screen | DONE | Themed: gradient header, empty state, share btn | gradient.accent, primary, textMuted |
| `screens/CalendarScreen.tsx` | Screen | DONE | Themed: event color + nav icons | primary |
| `screens/CirclesScreen.tsx` | Screen | DONE | Themed: menus, badges, modals, members list | primary, separator, textMuted |
| `screens/NotificationScreen.tsx` | Screen | DONE | Themed: list items, buttons, empty state | primary, separator, textMuted |
| `screens/SignInScreen.tsx` | Screen | DONE | Themed: animated auth intro, texts | primary, card, textPrimary |
| `screens/GroupScreen.tsx` | Screen | DONE | Basic container + text themed | primary, textPrimary |
| `theme/colors.ts` | Theme | DONE | Source of truth | — |
| `theme/ThemeContext.tsx` | Theme | DONE | Provider | — |
| `theme/README.md` | Docs | DONE | Migration guidance | — |

Planned New Tokens (If Needed)
| Token | Purpose | Initial Value (Light) | Initial Value (Dark) |
|-------|---------|-----------------------|---------------------|
| accentAlt | Secondary accent (if both purple + blue needed) | baseColors.highlightPurple | #FF5500 (example) |
| gradient.primary | Brand background gradients | ['#1E3A8A','#3B82F6'] | ['#1E3A8A','#1DA1F2'] |
| gradient.accent | Accent gradients (purple set) | ['#4F46E5','#7C3AED'] | ['#4F46E5','#7C3AED'] |
| softBlue (already) | Light connective line color | #97d6fc | #3A6B85 |

Migration Steps Template
1. Import `useTheme`: `const { theme } = useTheme();`
2. Replace inline colors: `color="#1DA1F2"` → `color={theme.colors.primary}`
3. For StyleSheet objects: merge dynamic parts: `[styles.box, { borderColor: theme.colors.separator }]`
4. For repeated local constants: elevate to semantic choose (e.g. `const textColor = theme.colors.textMuted`).
5. For gradients: replace arrays with `theme.gradients.primary` once gradient tokens added.

Review Checklist Per File
- No remaining `#` literals (except comments allowed temporarily until removed)
- ActivityIndicator & Ionicons use theme colors
- Borders use `separator` / `inputBorder`
- Placeholder text uses `inputPlaceholder`
- Surfaces/card backgrounds use `card`
- Action buttons use `primary` / `accent`
- Shadows use `theme.colors.shadow`

Post-Migration Cleanup
- Run grep for `#[0-9A-Fa-f]{3,6}` across `src/cliq.client` to confirm elimination
- Remove any obsolete comments with old hex codes
- Add gradient tokens implementation (optional step if required by design)

Progress Tracking
Update the Status column as you migrate. Consider PRs grouping related components (e.g. "feed primitives", "forms", "auth").

Next Immediate Action Suggestion
- Finish `App.tsx` tab bar tint migration.
- Add gradient token structure before converting gradient components.
