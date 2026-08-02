# Rahhal Design System — Signature Brand Experience

**Route:** `/design-system` (public showcase — default **Brand** tab)  
**Code:** `src/design-system/` (+ `src/design-system/brand/`)  
**Edition:** **Signature Brand** on Premium Experience V2  
**Scope:** UX · UI · tokens · components · motion · accessibility · screen shells · brand DNA  
**Out of scope:** backend · APIs · business logic · live search · payments · AI engine  

See `brand/README.md` for the brand book · `BEFORE_AFTER_V2.md` for V2 polish.

---

## Identity

Rahhal is an **AI Travel Companion**, not an OTA homepage.

Visual pillars: calm · luxury · trust · elegance · intelligence.

- Deep Ocean Blue primary  
- Elegant Turquoise secondary  
- Warm White background / Pure White surfaces  
- Soft elevation, large breathing space, 8pt grid  
- Outlined iconography only  
- Bilingual typography: **Cairo** (Arabic body) + **Plus Jakarta Sans** (display / Latin UI)

---

## Folder structure

```text
src/design-system/
  tokens/           # themes.css + typed token map
  brand/            # Signature DNA — Orb, Travel DNA, illustrations, CSS
  icons/            # outlined SVG icon set
  components/       # primitives, travel cards, overlays
  screens/          # 24 production-ready UI shells
  showcase/         # gallery chrome (Brand | Screens)
  docs/             # motion / a11y / responsive notes
  index.ts          # public facade
docs/design-system/       # product-facing design documentation
docs/design-system/brand/ # brand book (principles → expansion)
```

---

## Deliverables checklist

| Deliverable | Location |
| --- | --- |
| Design tokens (color, space, radius, elevation, type, motion, opacity, borders, icons) | `tokens/themes.css`, `tokens/index.ts` |
| Light + Dark themes | `[data-rahhal-ds][data-theme]` |
| Component library | `components/*` |
| 24 premium screens | `screens/*` |
| Motion guidelines | `docs/MOTION.md` |
| Accessibility | `docs/ACCESSIBILITY.md` |
| Responsive rules | `docs/RESPONSIVE.md` |
| Showcase | `/design-system` |
| Signature Brand system | `src/design-system/brand/` |
| Brand book | `docs/design-system/brand/` |
| Rahhal Orb (7 states) | `brand/RahhalOrb.tsx` |
| AI personality visuals | `brand/AiPersonality.tsx` |
| Travel DNA (14 categories) | `brand/TravelDna.tsx` |

---

## Home doctrine

The Home shell is conversation-first:

1. Brand + companion hero (voice CTA dominates)  
2. Optional text search  
3. Secondary shortcuts (Flights / Hotels / Packages / Cars / Discover)  
4. Recent trips  

It must never read as a traditional booking marketplace.

---

## Integration note

The design system is **scoped** under `[data-rahhal-ds]` so existing product routes keep their current styling until a deliberate migration. Future implementation should adopt tokens/components incrementally — do not fork a second visual language.
