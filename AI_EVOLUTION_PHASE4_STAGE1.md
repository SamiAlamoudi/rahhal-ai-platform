# AI Evolution — Phase 4 Stage 1

**Premium Application Shell & Navigation Foundation**

| Item | Value |
|------|--------|
| Flag | `ui.application_shell` |
| Default | **OFF** |
| Scope | Application framework only |
| Production routes | **Not wired** |

---

## Goal

Create the professional shell structure that future Rahhal screens will plug into — without booking, AI, or planning changes.

---

## Architecture diagrams

### Navigation

```mermaid
flowchart TB
  subgraph shell [Application Shell]
    BN[Bottom Navigation]
    SD[Side Drawer]
    DL[Deep Links]
    G[Guards]
  end

  BN --> Home
  BN --> Conversation[AI Conversation Center]
  BN --> Voice[Voice Center]
  BN --> Knowledge[Knowledge Center]
  BN --> Trips

  SD --> Executive[Executive Trips]
  SD --> Notifications
  SD --> Profile
  SD --> Settings

  DL --> Graphs[Independent module graphs]
  G --> Auth[Auth + visibility + feature flag]
```

### Module dependencies (isolation)

```mermaid
flowchart TD
  Shell[applicationShell package]
  Shell --> Modules[Module Registry]
  Shell --> Nav[Navigation]
  Shell --> DS[Design System]
  Shell --> Theme
  Shell --> I18n[Localization]
  Shell --> State[UI State]

  Modules --> Conv[Conversation graph]
  Modules --> Voice[Voice graph]
  Modules --> Know[Knowledge graph]
  Conv -.->|forbidden edge| Voice
  Conv -.->|forbidden edge| Know
```

---

## Deliverables

- `src/ui/applicationShell/*`
- Feature registry: `ui.application_shell`
- Docs: `AI_APPLICATION_SHELL.md`, `AI_DESIGN_SYSTEM_SHELL.md`, this file
- Tests: `src/lib/__tests__/applicationShell.phase4.stage1.test.ts`

---

## Validation

```
npm run lint
npm run typecheck
npm run arch:circular
npm run test:run
```

---

## Non-goals

- Booking / search / payment / maps  
- AI / Runtime / Conversation / Experience modifications  
- Mounting shell routes in production `main.tsx`  
- Merging or modifying previous PRs  

## Validation (Phase 4 Stage 1)

| Check | Result |
|-------|--------|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run arch:circular` | pass |
| `npm run test:run` | **2799** passed |

