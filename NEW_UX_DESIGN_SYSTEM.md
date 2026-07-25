# NEW_UX_DESIGN_SYSTEM — Product Sprint A

## Intent

Calm, trustworthy, travel-focused, Arabic-first. Intelligent consultant — not a SaaS dashboard or OTA form wall.

## Source of truth

`src/lib/productUx/tokens.ts` + CSS variables in `src/index.css`.

Do **not** introduce a second competing design system. Existing Tailwind `@theme` primary scale remains the brand blues.

## Tokens

| Domain | Keys |
|--------|------|
| Typography | Cairo / Tajawal display+body; size scale xs→hero; weights; line heights |
| Spacing | 0 → 64 |
| Radius | control / panel / hero / pill |
| Elevation | sm / md / lg / glow |
| Borders | subtle / strong / focus |
| Colors | ink, muted, surface, brand, semantic success/warning/danger/info |
| Status | listening, thinking, speaking, interrupted, reconnecting, offline, error, ready |
| Atmosphere | hero / page gradients (horizon blues) |
| Motion | enter 420ms, stagger 70ms, reduced-motion safe drift |
| Breakpoints | 390 / 768 / 1024 / 1280 / 1536 |

## Composition rules

1. Brand is a hero-level signal on auth + home.
2. Full-bleed atmospheric plane on branded entry; no inset hero collage.
3. Cards only for interactive results / forms.
4. Progressive disclosure for results (reason + price first, details on expand).
5. Minimal navigation (Home · Chat · Trips · Settings).

## Directionality

- Default product locale Arabic RTL (`dir="rtl"` on new shell).
- English LTR supported via `ProductLocale` and `dir` on result rails.
