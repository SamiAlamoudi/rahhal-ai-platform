# Accessibility Guidelines

Target: **WCAG 2.2 AA** minimum for all design-system surfaces.

## Contrast

- Light mode ink on Warm White / Pure White meets AA for body and UI text.  
- Dark mode ink on Deep Ocean surfaces uses elevated neutrals (`--ds-ink`, `--ds-ink-secondary`).  
- Primary buttons use inverse ink on Deep Ocean / Turquoise.  
- Never place caption text on busy photography without a scrim.

## Structure

- One clear `h1` per screen shell.  
- Interactive controls are real `<button>` / `<input>` elements with visible focus (browser + `--ds-focus`).  
- Icons that convey meaning expose `title` / `aria-label`; decorative icons use `aria-hidden`.  
- Progress, dialogs, snackbars, and tabs use appropriate ARIA roles.

## Dynamic type

Typography uses `rem` / `clamp` for hero/display. Avoid fixed px for reading text. Components should tolerate larger system text without clipping CTAs (prefer wrapping over overflow hide).

## Keyboard & screen readers

- Tab order follows visual reading order in both RTL and LTR.  
- Dialogs and bottom sheets declare `role="dialog"` and `aria-modal`.  
- Bottom navigation marks the current item with `aria-current="page"`.  
- Voice button exposes pressed/listening state via `aria-pressed`.

## RTL / LTR

Showcase toggles `dir="rtl" | "ltr"` on the design-system root. Layouts use logical CSS where practical (flex/grid). Mirror chat bubbles and chevrons when implementing production CSS logical properties.

## Motion

See `MOTION.md`. Reduced motion is mandatory, not optional.
