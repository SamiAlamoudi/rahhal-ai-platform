# Memory & Knowledge Center — Architecture Notes

**Package:** `src/ui/memoryCenter/`

```mermaid
flowchart TB
  Registry[memoryCenterRegistry]
  Root[MemoryCenter]
  Registry -->|gate| Root
  Root --> Toolbar[MemoryToolbar]
  Root --> Overview[MemoryOverview]
  Root --> Timeline[MemoryTimelinePanel]
  Root --> Places[PlacesAndPreferences]
  Root --> People[PeopleAndDocuments]
  Root --> Rules[RulesAndKnowledge]
  State[memoryCenterState] -.-> Root
  Tokens[memoryCenterTokens] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| AI / Runtime / Database / Firebase / Chat | Not wired |
| Auth / Sync / Storage / Search backend | None |
| Backend / realtime | None |
| RTL + light/dark + reduced motion | Yes |
