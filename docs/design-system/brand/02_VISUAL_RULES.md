# Visual Rules

## Color language

| Role | Token family | Use |
|------|--------------|-----|
| Horizon | `--rahhal-horizon-*` | Page atmosphere, hero washes |
| Tide | `--rahhal-tide-*` | Primary actions, links, AI calm |
| Dune gold | `--rahhal-dune-*` | Luxury accent, success warmth |
| Mist | `--rahhal-mist-*` | Glass fills, separators |
| Ember | `--rahhal-ember-*` | Error / urgency (rare) |

Never introduce a third accent hue outside Travel DNA category tints (those stay muted and share stroke language).

## Gradient language

- **Horizon wash**: soft vertical mist → tide → deep ink (page backdrops).
- **Orb core**: radial tide → white core → gold rim highlight.
- **Insight cards**: diagonal mist with 8–12% gold edge.
- Max **two** gradient stops visible in any single interactive control.

## Glass language

- Fill: `rgba` mist 0.55–0.72 + backdrop blur 12–20px.
- Border: 1px mist-white at 18–28% opacity.
- Never solid white cards as the default brand surface.
- Nested glass: reduce blur one step; never stack three glass layers.

## Shadow system

| Level | Name | Intent |
|-------|------|--------|
| 0 | flat | Inline text / icons |
| 1 | lift | Chips, small controls |
| 2 | float | Cards, recommendation panels |
| 3 | stage | Modals, orb hero presence |

Shadows use **cool tide-ink**, not pure black. Gold never casts a shadow alone.

## Patterns

Proprietary background patterns (CSS only):

- `rahhal-pattern-dune` — soft horizontal bands
- `rahhal-pattern-compass` — sparse radial ticks
- `rahhal-pattern-mist` — noise-like gradient mesh

Use at ≤8% contrast. Patterns are atmosphere, not content.

## Highlight effects

- Focus rings: tide, 2px, offset 2px.
- AI glow: single soft outer halo on Orb / thinking chips — never multi-layer neon.
- Selection: mist-gold wash, not browser default purple.

## Section separators

Prefer **horizon hairlines** (gradient fade center) over hard rules or heavy dividers.
