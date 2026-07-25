# Profile Schema — Phase 7 Stage 1

**Source:** contracts in `src/lib/orchestration/travelerProfileFoundation/types.ts`

## Identity

| Field (hints) | Contract |
|---------------|----------|
| `identityId` · `displayNameHint` · `locale` | `TravelerIdentityContract` |

## Preference domains

`travel_style` · `travel_interests` · `budget` · `accommodation` · `transportation` · `food` · `accessibility` · `language` · `favorites` · `notifications` · `privacy`

## Document metadata (no storage / OCR)

| Contract | Notes |
|----------|-------|
| `PassportMetadataContract` | `ocr: false`, `stored: false` |
| `VisaMetadataContract` | `stored: false` |
| `TravelDocumentsRegistryContract` | Registry entries; `registered: false` |

## Consent

`ConsentRegistryContract` entries with `grantedHint: false` by default (`ai_personalization`, `profile_analytics`).

## Versioning & status

| Contract | Blueprint default |
|----------|-------------------|
| `ProfileVersioningContract` | `version: 0` |
| `ProfileStatusContract` | `status: 'draft'` |

Schema is declarative TypeScript interfaces only — no ORM, migrations, or persistence.
