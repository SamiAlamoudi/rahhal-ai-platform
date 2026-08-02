# Brain ⇄ UI Integration

**Route:** `/brain-ui`  
**Code:** `src/brain-ui/`  
**Brain:** `src/brain` (TravelBrain mocks only)

## What this is

Conversation-driven Premium UI wired to the AI Travel Brain foundation.

- No Amadeus / Booking / provider runtime
- No STT / TTS / network AI SDK
- Design System tokens & brand CSS reused, not redesigned

## API

```tsx
import { BrainProvider, useTravelBrain } from '../brain-ui'

<BrainProvider>
  <App />
</BrainProvider>

const {
  state,
  sendMessage,
  startVoice,
  stopVoice,
  resetConversation,
  getRecommendations,
  getConversation,
  getTimeline,
} = useTravelBrain()
```

## Screens

| Screen | File |
|--------|------|
| Home | `screens/BrainHomeScreen.tsx` |
| Chat | `screens/BrainChatScreen.tsx` |
| Voice | `screens/BrainVoiceScreen.tsx` |

## Developer debug

Append `?debug=1` or set `localStorage.rahhal_brain_debug=1` for the Memory Debug Panel.
