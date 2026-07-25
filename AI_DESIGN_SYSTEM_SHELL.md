# Application Shell Design System — Phase 4 Stage 1

**Package:** `src/ui/applicationShell/designSystem`  
**Flag:** `ui.application_shell` (default OFF)

Presentation-token architecture for the Premium Application Shell. Independent from quarantined Sprint 119 UI tokens.

---

## Tokens

| Category | Keys |
|----------|------|
| Typography | display/body families · xs→2xl sizes |
| Spacing | xxs → 3xl |
| Radius | sm · md · lg · xl · pill |
| Elevation | none · sm · md · lg |

CSS variables are emitted via `shellTokenCssVariables()` for runtime theming.

---

## Theme

| Mode | Behavior |
|------|----------|
| light | Warm sand background · deep teal primary |
| dark | Navy surfaces · mint primary |
| system | Resolves from OS preference |

Dynamic tokens: `--shell-color-*` via `shellThemeCssVariables()`.

---

## Primitives (contracts)

Card · Button · Input · List · Section · Sheet · Dialog · Badge · Icon · Loading · EmptyState · ErrorState · Skeleton · Snackbar · BottomSheet

Specs live in `SHELL_PRIMITIVE_SPECS` — architecture inventory for future implementation stages. No booking widgets in this stage.

---

## Localization

| Locale | Direction |
|--------|-----------|
| `ar` | RTL |
| `en` | LTR |

Message catalog ids are prepared for future multilingual packs (`SHELL_MESSAGE_CATALOG_IDS`).

---

## Responsive

| Breakpoint | Width heuristic |
|------------|-----------------|
| phone | &lt; 600 |
| foldable | 600–899 |
| tablet | 900–1199 |
| desktop | ≥ 1200 |

Bottom nav preferred on phone/foldable; drawer chrome on tablet/desktop.
