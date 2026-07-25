# Preference Schema — Phase 7 Stage 4

**Source:** output + category contracts in `src/lib/orchestration/preferenceExtractionEngine/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `ExtractedPreference` | preferenceId · categoryId · valueHint · sourceKind |
| `PreferenceCandidate` | candidateId · categoryId · rawHint · detectorHint |
| `PreferenceEvidence` | evidenceId · candidateId · utteranceHint · strengthHint |
| `PreferenceConfidence` | preferenceId · scoreHint · bandHint |
| `PreferenceValidation` | preferenceId · valid · issues |
| `PreferenceUpdate` | updateId · preferenceId · actionHint |

## Categories

`destination` · `accommodation` · `transportation` · `budget` · `food` · `activity` · `language` · `accessibility` · `weather` · `travel_style`

Each category has a `CategoryPreferencesContract` with empty `preferenceHints` in blueprints.

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
