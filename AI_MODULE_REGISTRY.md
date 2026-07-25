# Module Registry — Phase 6 Stage 1

**Source:** `src/ui/integrationFoundation/registry/moduleRegistry.ts`

| Module id | Feature flag | Package |
|-----------|--------------|---------|
| `application_shell` | `ui.application_shell` | `src/ui/applicationShell` |
| `conversation_center` | `ui.conversation_center` | `src/ui/conversationCenter` |
| `voice_center` | `ui.voice_center` | `src/ui/voiceCenter` |
| `travel_workspace` | `ui.travel_workspace` | `src/ui/travelWorkspace` |
| `executive_dashboard` | `ui.executive_dashboard` | `src/ui/executiveDashboard` |
| `command_palette` | `ui.command_palette` | `src/ui/commandPalette` |
| `journey_timeline` | `ui.journey_timeline` | `src/ui/journeyTimeline` |
| `decision_center` | `ui.decision_center` | `src/ui/decisionCenter` |
| `insights_center` | `ui.insights_center` | `src/ui/insightsCenter` |
| `traveler_profile` | `ui.traveler_profile` | `src/ui/travelerProfile` |
| `memory_center` | `ui.memory_center` | `src/ui/memoryCenter` |
| `booking_hub` | `ui.booking_hub` | `src/ui/bookingHub` |
| `operations_center` | `ui.operations_center` | `src/ui/operationsCenter` |

Loader: `ModuleLoader.load(id, { forceEnabled: true })` → package `tryRender*` (presentation preview only).
