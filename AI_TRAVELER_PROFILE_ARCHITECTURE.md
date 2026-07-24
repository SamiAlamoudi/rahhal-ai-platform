# Traveler Profile Center — Architecture Notes

**Package:** `src/ui/travelerProfile/`

```mermaid
flowchart TB
  Registry[travelerProfileRegistry]
  Root[TravelerProfileCenter]
  Registry -->|gate| Root
  Root --> Overview[ProfileOverview]
  Root --> Personal[PersonalInfoPanel]
  Root --> Prefs[PreferencesPanel]
  Root --> Docs[DocumentsPanel]
  Root --> Loyalty[LoyaltyAndTravelers]
  Root --> Settings[SettingsAndSecurity]
  State[travelerProfileState] -.-> Root
  Tokens[travelerProfileTokens] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| Authentication / storage / payments | None |
| AI / Runtime / Booking / Maps / Weather | Not wired |
| Firebase / Notifications | Not wired |
| Backend / realtime | None |
| RTL + light/dark + reduced motion | Yes |
