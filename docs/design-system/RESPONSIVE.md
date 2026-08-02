# Responsive Rules

Rahhal’s primary canvas is **mobile** (390pt reference). Larger breakpoints expand the gallery and future desktop companion views without turning Home into a dense dashboard.

## Breakpoints

| Name | Width | Intent |
| --- | --- | --- |
| phone | 0–479 | Default product canvas |
| phablet | 480–767 | Comfortable single column |
| tablet | 768–1023 | Optional side summary |
| desktop | 1024+ | Design gallery two-column; future consultant desk |

## Rules

1. **8pt spacing** everywhere (`--ds-space-*`).  
2. Phone shells max at `--ds-phone-width` (390).  
3. Content measure for reading blocks ≤ `--ds-content-max` (720).  
4. Bottom navigation / composers account for `--ds-safe-bottom`.  
5. Gallery becomes single column under 900px.  
6. Touch targets ≥ 44×44pt for primary actions (voice CTA larger).  
7. Avoid multi-column card walls on Home — one vertical composition.

## Future desktop

Desktop may present conversation + itinerary side-by-side, but the **first viewport** of Home remains companion-first (brand, one promise, voice CTA), never an OTA toolbelt.
