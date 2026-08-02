# Voice Orb Rules

The **Rahhal Orb** is the visual logo of the AI. It is not a microphone icon.

## Anatomy

1. **Halo** — soft outer glow (state-colored)
2. **Core** — glass sphere with tide→gold radial
3. **Ring** — thin orbit track
4. **Eye** — small luminous center (presence)
5. **State glyphs** — wave / orbit / check / alert / slash (never all at once)

## States

| State | Motion | Color bias |
|-------|--------|------------|
| Idle | Slow breathe | Tide calm |
| Listening | Halo expand + wave bars | Tide bright |
| Thinking | Orbit tick | Tide + gold |
| Speaking | Wave + pulse | Tide active |
| Success | Gold flash + check | Dune gold |
| Error | Soft shake + alert | Ember |
| Offline | Desaturate + slash | Mist gray |

## Sizes

`sm` (48) · `md` (64) · `lg` (96) · `hero` (144–176)

## Interaction

- Interactive only when it starts/stops voice (`interactive` prop → `<button>`).
- Otherwise `role="img"` with Arabic `aria-label`.
- Never place stickers/badges on top of the Orb.

## Placement

- Chat / voice: primary companion mark
- Empty AI states: centered with one line of copy
- Do not use as a generic bullet or favicon replacement without the ring+eye anatomy
