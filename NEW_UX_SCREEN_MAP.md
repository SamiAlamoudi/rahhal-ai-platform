# NEW_UX_SCREEN_MAP — Product Sprint A

```
Auth
  /login, /signup, /forgot-password  → AuthExperience (brand atmosphere)

Product (ui.new_experience ON)
  /            → NewHomeExperience (AppShell transparent)
  /chat        → LegacyChatPage + ProductAppBar + new result bridge
  /my-trips    → ProductPageShell + existing trip lists
  /settings    → ProductPageShell + TravelPreferencesPanel + existing settings

Product (ui.new_experience OFF) — rollback
  /            → AiHomeExperience or LegacyHome
  /chat        → LegacyChatPage (prior chrome)
  /my-trips    → prior header
  /settings    → prior header
```

## Primary journey

Home composer / suggestion → `/chat` seed (`initialPrompt`) → `chatEngine` → `travelAgentService.planTurn` → MessageBubble → ConversationResults (flag ON).
