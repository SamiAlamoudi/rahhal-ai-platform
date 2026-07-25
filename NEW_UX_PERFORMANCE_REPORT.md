# NEW_UX_PERFORMANCE_REPORT — Product Sprint A

## Discipline

- No new framework / icon pack / animation library.
- Framer Motion already in dependency tree (home/auth enter only).
- `NewHomeExperience` lazy-loaded from `Home.tsx` when flag ON.
- `NewExperienceResultsBridge` lazy-loaded from `MessageBubble` when flag ON.
- Flag OFF path avoids mounting new home/results trees.

## Bundle expectations

| Metric | Target |
|--------|--------|
| ChatPage gzip growth | ≤ 10% vs current baseline when flag OFF (lazy chunks not in critical path) |
| Performance score | ≥ 90 (preserve existing RC discipline) |
| Eager imports on ChatPage | Limited to lightweight chrome (`ProductAppBar`, badges); heavy results chunked |

## Validation commands

```bash
npm run typecheck
npm run lint
npm run product-ux:verify
npm run test:run
npm run build
```

Document ChatPage gzip in CI artifacts when comparing before/after enabling the flag in staging.
