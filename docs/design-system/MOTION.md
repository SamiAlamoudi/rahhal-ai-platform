# Motion Guidelines

Rahhal motion is **micro and intentional**. Animation explains hierarchy — never entertains.

## Principles

1. Prefer opacity + small translation (≤12px).  
2. Use shared easing: `--ds-ease-emphasized` for entrances, `--ds-ease-standard` for UI, `--ds-ease-exit` for dismissals.  
3. Durations: 120 / 200 / 280 / **350ms max**. No animation exceeds 350ms.  
4. Stagger related items by 60ms max (three steps).  
5. Voice listening pulse is the only continuous ambient motion — keep soft and slow.

## Do

- Screen enter: `ds-animate-enter`  
- Primary button press: brief scale via transition (CSS)  
- Skeleton shimmer for loading content  
- Respect `prefers-reduced-motion` (tokens collapse durations to 0)

## Don’t

- Bounce / spring overload  
- Parallax noise on Home  
- Auto-playing decorative Lottie walls  
- Motion that blocks reading Arabic/English text

## Reduced motion

All continuous animations disable under `prefers-reduced-motion: reduce`. Functional state changes remain instant and clear.
