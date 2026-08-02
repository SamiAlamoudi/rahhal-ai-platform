# Sound Design (Documentation Only)

> **No implementation in this sprint.** Future audio identity for Rahhal.

## Intent

Audio should feel like **calm ocean presence + soft confirmation** — never slot-machine rewards, never loud travel jingles.

## Future cues

| Cue | Character | Notes |
|-----|-----------|-------|
| Voice activation | Soft tide swell, 180–250ms | Paired with Orb `listening` |
| Confirmation | Single warm chime (gold harmonic) | Booking step accept |
| Success | Short ascending fifth, low volume | Orb `success` |
| Notifications | Distant mist tap | Non-blocking |
| Ambient interaction | Optional very low bed while thinking | User-toggle; off by default |

## Principles (when built)

1. Respect system silent / focus modes
2. Never autoplay ambient on first visit
3. Max one overlapping cue
4. Provide mute in settings
5. Localization: no speech samples that fight Arabic TTS

## Out of scope now

No audio files, Web Audio graph, or provider hooks in this deliverable.
