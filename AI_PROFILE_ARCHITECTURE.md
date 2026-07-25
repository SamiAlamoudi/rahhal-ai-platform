# Profile Architecture — Phase 7 Stage 1

## Layers

| Layer | Contracts |
|-------|-----------|
| Core | Traveler Profile · Identity · Status · Versioning |
| Preferences | Style · Interests · Budget · Accommodation · Transport · Food · Accessibility · Language |
| Favorites | Destinations · Airlines · Hotels · Activities |
| People | Family · Companions · Emergency contacts |
| Documents | Passport metadata · Visa metadata · Documents registry |
| Trust | Privacy · Consent · Notification preferences |
| History | Timeline · Audit trail |
| Quality | Validation |
| AI capabilities | Evidence · Memory · Context enrichment · Preference learning · Taste analyzer |

## Isolation

`TRAVELER_PROFILE_ISOLATION` asserts **false** for DB, auth, storage, OCR, LLMs, Runtime, HTTP, streaming, APIs, and business logic.  
`distinctFromUiTravelerProfile: true` — foundation contracts do not replace `ui.traveler_profile` presentation.
