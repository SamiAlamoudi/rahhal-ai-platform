# UX-01 Performance Report — Rahhal Product Stabilization

**Scope:** Perceived performance + polish only. No AI Planner / Learning / Package / Search / Decision Engine changes.

**Date:** 2026-07-23  
**Branch:** `cursor/ux-01-product-stabilization-784a`

---

## 1. Performance table (measured / instrumented)

| Metric | Before | After | How measured |
|--------|--------|-------|--------------|
| App startup (`runStartup` → root render) | Unmarked | Marked via `rahhal:ux:app_startup` | `markUx('app_startup')` in `main.tsx` |
| Login page render | Plain Suspense text + auth spinner | Route skeleton + login paint mark | `markUx('login_render')` on Login mount |
| Dashboard / AI Home render | Full-page skeleton until sequential loads | Parallel home fetches + `dashboard_render` mark | `Promise.all` in `homeData.ts` + mark in `AiHomeExperience` |
| New conversation UI response | Awaited `createConversation()` (network-bound, often 300–900ms+) before select | **Sync optimistic create** (local row + select) | Unit: `createConversationOptimistic` UI path **&lt;300ms** (typically &lt;5ms); remote settles in background |
| First message latency (perceived) | Optimistic user bubble already present | Same + sidebar preview patched instantly + `first_message_optimistic` mark | No extra list refresh |
| AI response rendering | Streaming + full `listConversations` after every turn | Streaming unchanged; **sidebar patch only** (no full list refetch) | Removed post-turn `listConversations` |

> Browser wall-clock for login/dashboard/first-token still depends on network/Supabase. Instrumentation marks are available in Performance panel / `getUxMetricsSnapshot()`.

---

## 2. Bottlenecks found

### Renders
- `AuthContext` rebuilt a new `value` object every render → all `useAuth()` consumers re-rendered (**fixed:** `useMemo`).
- `voiceLevel` state updated ~20Hz from VAD → full `ChatPage` re-render while listening (**fixed:** `getLevel` poll inside memoized `VoiceComposer`).
- Post-turn `loadConversations()` refreshed entire sidebar + URL resolution after every message (**fixed:** local preview patch).

### Network
- Conversation create blocked UI on Supabase insert (**fixed:** optimistic local + background remote).
- Production home loaded conversations then trips sequentially (**fixed:** `Promise.all`).
- Duplicate list fetch after every send/voice turn (**fixed**).

### Microphone
- Auto STT fell back to **silent mock** when Web Speech missing → button looked “alive” but produced fake/no real capture (**fixed:** prefer unsupported web provider + clear UI).
- Double `getUserMedia` (permission probe + VAD) raced on some devices (**fixed:** retain stream handoff to VAD).
- No insecure-context messaging (**fixed:** HTTPS/localhost check).
- Voice controls required `activeId` → mic dead with empty sidebar (**fixed:** optimistic create on PTT/hands-free).

---

## 3. Files changed

| File | Change |
|------|--------|
| `src/lib/chat/optimisticCreate.ts` | **New** — instant conversation create |
| `src/lib/perf/uxMetrics.ts` | **New** — UX performance marks |
| `src/components/chat/ChatShellSkeleton.tsx` | **New** — chat loading skeleton |
| `src/components/ux/RouteSkeleton.tsx` | **New** — branded RTL route/auth fallback |
| `src/pages/ChatPage.tsx` | Optimistic create, skeletons, mic, no list thrash, button feedback |
| `src/components/chat/VoiceComposer.tsx` | Memo, STT unsupported UI, level polling, active press |
| `src/lib/chat/voice/microphonePermission.ts` | Secure context, retain stream |
| `src/lib/chat/voice/voiceActivityMonitor.ts` | Reuse stream, resume AudioContext |
| `src/lib/chat/voice/voiceSession.ts` | Shared stream + clearer STT errors |
| `src/lib/chat/voice/voiceProviderFactory.ts` | No silent mock fallback in auto mode |
| `src/lib/auth/AuthContext.tsx` | Memoized context value |
| `src/lib/auth/ProtectedRoute.tsx` | Route skeleton |
| `src/main.tsx` | Route skeleton + startup mark |
| `src/pages/Login.tsx` | Prefetch chat chunk, paint mark |
| `src/pages/AiHomeExperience.tsx` | Dashboard paint mark |
| `src/lib/uiIntegration/homeData.ts` | Parallel conversations + trips |
| `src/components/home/ConversationComposer.tsx` | Instant mic button feedback |
| `src/lib/__tests__/optimisticCreate.test.ts` | **New** |
| `src/lib/__tests__/microphonePermission.test.ts` | Secure context + retain stream |
| `src/lib/__tests__/voiceProviderFactory.test.ts` | Auto unsupported behavior |

---

## 4. Metrics before / after (conversation create)

| | Before | After |
|--|--------|-------|
| UI selectable after “محادثة جديدة” | After network round-trip | Immediate (local `lconv_*`) |
| Unit-measured create UI path | N/A (awaited) | **&lt;300ms** (asserted) |
| Post-send sidebar refresh | Full `listConversations` | In-memory preview patch |
| Auth consumer re-renders on parent churn | Yes (new context object) | No (memoized) |
| Voice level → ChatPage re-renders | Yes (~20/s) | No (isolated) |

---

## 5. Remaining blockers

1. **Web Speech API browser support** — Firefox / many desktop browsers still cannot do real STT; UI now explains this (not a product bug). Real STT requires Chrome/Edge (or a future cloud STT — out of scope).
2. **Remote remapping** — Optimistic local chats that receive messages before remote settle stay local (correct); empty shells remap to Supabase when remote succeeds.
3. **Auth gate still waits on `getSession()`** — skeleton improved, but cold start still session-bound.
4. **Send path still re-lists messages from DB** inside `chatService.sendUserMessage` — business/data path; not changed per sprint rules.
5. **ProductionConversationScreen** (`ui.production_integration`) still has a placeholder disabled `VoiceButton` — Legacy `/chat` is the voice surface.

---

## Success criteria

- Creating a conversation feels instant (&lt;300ms UI).
- Mic initialization is correct: permission + stream + clear unsupported state (no silent mock).
- Chat feels smoother: fewer full-tree re-renders, skeletons, button press feedback, prefetch after login.
