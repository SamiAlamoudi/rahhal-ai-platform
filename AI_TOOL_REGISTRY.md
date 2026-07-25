# Tool Registry — Phase 6 Stage 7

**Source:** `TOOL_REGISTRY` / `TOOL_CAPABILITY_REGISTRY` in `src/lib/orchestration/toolEngine/`

## Tool Registry

Declarative catalog of future tools (`enabledHint: false`). Each entry maps:

| Field | Meaning |
|-------|---------|
| `id` | Registry row id (`treg-<capability>`) |
| `capabilityId` | Future capability key |
| `toolId` | Placeholder tool id (`tool-<capability>`) |
| `enabledHint` | Always `false` in architecture |

## Capability Registry

| Category hint | Capabilities |
|---------------|--------------|
| `travel_services` | flight_search · hotel_search · activity_search · booking_apis · visa_services |
| `reference_services` | weather · maps · currency |
| `communication` | calendar · email · whatsapp · notifications |
| `commerce` | payments · crm |
| `media_processing` | document_processing · translation · voice · image |

## Discovery

`ToolDiscoveryContract` lists placeholder `tool-*` ids. No live discovery, adapters, or provider SDKs.
