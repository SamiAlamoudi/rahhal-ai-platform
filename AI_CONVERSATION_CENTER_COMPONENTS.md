# Conversation Center — Component Diagram

**Phase 4 Stage 2** · Package `src/ui/conversationCenter`

```mermaid
flowchart TB
  Registry[conversationCenterRegistry<br/>ui.conversation_center]
  Root[ConversationCenter]
  Registry -->|gate| Root

  Root --> Sidebar[ConversationSidebar]
  Root --> Main[Main region]
  Root --> Tokens[conversationTokens / CSS]

  Main --> Empty[EmptyStates]
  Main --> List[MessageList]
  Main --> Dock[Composer dock]

  List --> Bubble[MessageBubble]
  Bubble --> Card[TravelCard]
  Dock --> Composer[Composer]

  State[conversationCenterState] -.-> Root
  Types[types.ts contracts] -.-> Root
  Types -.-> Sidebar
  Types -.-> Bubble
  Types -.-> Composer
```

## Component responsibilities

| Component | Responsibility |
|-----------|----------------|
| `ConversationCenter` | Feature gate, layout grid, local UI state, no AI |
| `ConversationSidebar` | Buckets, search, thread list, pin/archive/rename/delete, export/share placeholders |
| `MessageList` | Scroll region, jump-to-latest, appear animation hook |
| `MessageBubble` | Kind/role rendering, actions, confidence, streaming placeholder |
| `TravelCard` | Destination/hotel/flight/… expandable placeholders |
| `Composer` | Auto-grow textarea, quick actions, external-nav buttons |
| `EmptyStates` | First / no history / no results / offline / loading |

## External nav (not embeds)

```mermaid
flowchart LR
  Composer -->|navigatesTo placeholder| Voice[voice_center]
  Composer -->|navigatesTo placeholder| Know[knowledge_center]
  Composer -->|future| Attach[attachment/image/mic/camera/location]
  Voice -.->|forbidden| InsideChat[Inside Chat surface]
  Know -.->|forbidden| InsideChat
```
