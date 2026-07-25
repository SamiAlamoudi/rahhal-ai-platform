# NEW_UX_ACCESSIBILITY_REPORT — Product Sprint A

## Targets

WCAG 2.1 AA where applicable on new surfaces.

## Implemented

| Area | Implementation |
|------|----------------|
| Semantic HTML | `header` / `main` / `nav` / `article` / `section` / `dialog` (confirmation) |
| Labels | `aria-label` on brand, nav, cards, voice badge; `sr-only` on inputs |
| Focus | Visible `focus-visible:ring` on controls (min 2px primary) |
| Touch | Controls ≥ 40–44px (`min-h-10` / `min-h-11` / `min-h-12`) |
| Live regions | Voice badge + product states use `aria-live="polite"` / `role="alert"` for errors |
| Reduced motion | Atmosphere drift + CSS animations disabled under `prefers-reduced-motion` |
| RTL / LTR | `dir` on shell and results rail; mirrored layout via logical CSS |
| Contrast | White text on deep brand hero; slate ink on white panels |

## Known follow-ups

- Full automated axe suite not added this sprint (component + smoke coverage instead).
- High-contrast chat theme remains the existing Sprint 42 path.
