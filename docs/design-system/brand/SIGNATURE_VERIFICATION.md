# Signature Brand — Verification

## Checklist

- [x] Signature CSS: gradients, glass, shadows, patterns, Orb anatomy + states
- [x] Rahhal Orb: idle · listening · thinking · speaking · success · error · offline
- [x] AI personality: 8 cognitive state chips
- [x] Travel DNA: 14 connected category marks
- [x] Illustration language: horizon geometry (no cartoons)
- [x] Brand book under `docs/design-system/brand/`
- [x] Sound design documented only (no audio implementation)
- [x] Gallery `/design-system` defaults to Brand mode
- [x] No backend / API / AI engine changes
- [x] Motion respects ≤350ms UI cap + `prefers-reduced-motion` for Orb

## Commands

```bash
npm run typecheck
npm run lint
npm run test:run -- src/lib/__tests__/designSystem.brand.test.ts
npm run build
```

## Manual gallery pass

1. Open `/design-system`
2. Confirm Brand tab is default
3. Cycle all seven Orb states
4. Toggle Light/Dark and RTL/LTR
5. Switch to Screens — existing shells still render
