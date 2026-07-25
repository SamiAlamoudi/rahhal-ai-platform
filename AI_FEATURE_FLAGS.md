# Feature Flags — Phase 6 Stage 1 (Integration Foundation)

## Foundation flag

| Flag | Default | Depends on |
|------|---------|------------|
| `ui.integration_foundation` | **OFF** | `ui.application_shell` |

## Integrated module flags (all default OFF)

`ui.application_shell` · `ui.conversation_center` · `ui.voice_center` · `ui.travel_workspace` · `ui.executive_dashboard` · `ui.command_palette` · `ui.journey_timeline` · `ui.decision_center` · `ui.insights_center` · `ui.traveler_profile` · `ui.memory_center` · `ui.booking_hub` · `ui.operations_center`

## Feature Flag Manager

`src/ui/integrationFoundation/registry/featureFlagManager.ts`

- Reads `getFeatureRegistry()` for registration/status
- Local UI overrides for the toggle screen (**not persisted**, not production wiring)
- Module previews use `tryRender*(…, { enabled: true })` and do not require global flag ON

Canonical registry SoT remains `FEATURE_REGISTRY.md` / `featureRegistry.ts`.
