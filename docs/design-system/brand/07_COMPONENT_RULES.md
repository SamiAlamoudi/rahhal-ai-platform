# Component Rules

Brand components live under `src/design-system/brand/` and are scoped by `[data-rahhal-ds]`.

## Family members

| Component | Role |
|-----------|------|
| `RahhalOrb` | AI brand mark + voice states |
| `AiPersonalityChip` / strip | Visual AI state labels |
| `TravelDnaMark` / grid | Category identity |
| Illustration marks | Empty / ambient storytelling |
| Signature surfaces | `.rahhal-glass`, `.rahhal-card-signature`, price/recommendation cards |

## Glass cards

- Recommendation: glass + dune edge highlight + float shadow-2
- Price insight: mist pattern + tabular numbers + tide accent on delta
- Success celebration: horizon separator + Orb success + one sentence

## Floating layers

Use `.rahhal-float-layer` for overlays that sit above maps/chat without hard modal chrome. Max one float layer + one modal.

## Loading language

Prefer **mist shimmer** and Orb `thinking` over spinners. If a spinner is required, use tide arc — never browser default.

## Do not

- Restyle product routes outside the design-system gallery without an explicit product task
- Mix Material / generic icon packs into brand surfaces
- Add new card radii outside the signature radius scale
