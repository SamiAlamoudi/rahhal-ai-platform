# Motion Rules

## Principles

1. **Calm and expensive** — ease curves soft; no springy bounce unless success celebration (once).
2. **≤350ms** for UI transitions (entry, exit, expand, collapse, cards).
3. **Respect `prefers-reduced-motion`** — reduce to opacity/color only; Orb becomes static mark.
4. **One motion job per element** — never opacity + scale + rotate + blur together.

## Curves

| Token | Curve | Use |
|-------|-------|-----|
| enter | `cubic-bezier(0.22, 1, 0.36, 1)` | Fade/slide in |
| exit | `cubic-bezier(0.4, 0, 1, 1)` | Soft dismiss |
| voice | `cubic-bezier(0.45, 0, 0.55, 1)` | Orb breathing |
| think | linear segment + ease | Orbit / stream |

## Catalog

| Moment | Behavior |
|--------|----------|
| Entry | 12–16px rise + fade, 280ms |
| Exit | Fade 180ms (no drop) |
| Expand / collapse | Height + fade, 300ms |
| Voice | Halo breathe 2.4s loop |
| Thinking | Orbit ring 1.8s; chip shimmer |
| Streaming | Soft left→right mist on reply |
| Card transition | Crossfade 240ms; keep layout stable |
| Booking | Progress bar tide fill; no confetti |
| Success | Single gold pulse + check, 320ms |

## Forbidden

- Infinite bounce
- Parallax that moves content under the finger
- Stagger > 5 items on one screen
- Motion that blocks interaction > 350ms
