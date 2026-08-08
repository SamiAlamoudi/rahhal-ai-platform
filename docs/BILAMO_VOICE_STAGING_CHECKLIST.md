# Bilamo Voice — Human Staging Checklist (PR #348)

**Goal:** Prove audible Bilamo voice on real devices (iPhone Safari) before merge.  
**Do not merge** until a human confirms device speaker audio. CI green is not sufficient.

## Environment (required)

Set on the **staging host** (Vercel/preview) or local `.env.local` used only for staging — never commit secrets.

```bash
# Client (Vite — rebuild/redeploy after change)
VITE_SUPABASE_URL=<staging supabase url>
VITE_SUPABASE_ANON_KEY=<staging anon key>
VITE_VOICE_TRANSPORT=realtime
VITE_VOICE_METRICS=1

# Server only (Edge /api — NEVER VITE_*)
OPENAI_API_KEY=sk-...
```

Optional second pass for fallback:

```bash
VITE_VOICE_TRANSPORT=auto     # expect realtime when key present
# then disable OPENAI_API_KEY temporarily → must land on classic, text still works
VITE_VOICE_TRANSPORT=classic  # classic-only control run
```

### Confirm wiring (DevTools Console)

After login and Home/`/chat` load (tap Speak once if needed):

```js
copy(JSON.stringify(window.__BILAMO_VOICE_METRICS__, null, 2))
```

| Check | Expect |
|-------|--------|
| Realtime selected | `transportKind === "realtime_webrtc"` |
| Metrics enabled | Console shows `[bilamo.voice.metrics]` JSON (no transcripts) |
| No permanent key | Network → `/api/openai/realtime-session` GET has `configured: true` but **no** `sk-` in response; page source has no `OPENAI_API_KEY` / `sk-` |

Also: Application → Local Storage / JS sources search for `sk-` → none.

---

## Latency capture

After each meaningful voice turn, paste:

```js
const m = window.__BILAMO_VOICE_METRICS__
console.table({
  partial: m?.latest?.timeToFirstPartialMs,
  final: m?.latest?.timeToFinalTranscriptMs,
  firstAudio: m?.latest?.timeToFirstAudioMs,
  interrupt: m?.latest?.interruptionLatencyMs,
  reconnect: m?.latest?.reconnectLatencyMs,
  connect: m?.latest?.connectionSetupMs,
})
console.table(m?.aggregates)
```

Record **last** values and **p50/p95** from `aggregates` when `count ≥ 3`.

| Metric | Field |
|--------|-------|
| First partial | `latest.timeToFirstPartialMs` / `aggregates.timeToFirstPartialMs` |
| First audio | `latest.timeToFirstAudioMs` / `aggregates.timeToFirstAudioMs` |
| Interruption | `latest.interruptionLatencyMs` / `aggregates.interruptionLatencyMs` |
| Reconnect | `latest.reconnectLatencyMs` / `aggregates.reconnectLatencyMs` |

---

## Required functional checks (all browsers)

Mark each: Pass / Fail / N/A

| # | Check | Pass? | Notes |
|---|--------|-------|-------|
| 1 | Mic permission granted when Speak tapped | | |
| 2 | Realtime connect succeeds (`transportKind` realtime; listening works) | | |
| 3 | Partial transcript appears under orb while speaking | | |
| 4 | Final transcript commits (user bubble / turn starts) | | |
| 5 | Bilamo speaks with streamed audio | | |
| 6 | Natural barge-in while Bilamo is speaking | | |
| 7 | Playback stops immediately | | |
| 8 | Old response never resumes | | |
| 9 | New utterance continues **same** conversation | | |
| 10 | After brief network drop, reconnect succeeds | | |
| 11 | Mic does **not** auto-reopen after reconnect | | |
| 12 | No duplicate / overlapping playback | | |
| 13 | Orb never stuck in listening/speaking/thinking | | |
| 14a | Arabic Saudi: «أبغى رحلة مباشرة من الرياض لطوكيو الأسبوع الجاي» | | |
| 14b | Arabic Egyptian: «عايز أسافر دبي أنا ومراتي» | | |
| 14c | Arabic Levantine: «بدي رحلة على إسطنبول آخر الشهر» | | |
| 14d | Arabic Moroccan: «بغيت نمشي لباريس الأسبوع الجاي» | | |
| 15 | Text (اكتب / Type) works during/after voice | | |
| 16 | `VITE_VOICE_TRANSPORT=auto` + key removed → classic; text still works | | |
| 17 | No permanent OpenAI key in browser (network/source) | | |

---

## Exact steps by browser

### Chrome desktop

1. Deploy/build staging with env above; open staging URL in Chrome.
2. Login (demo or staging user) → land on `/` (orb Home).
3. DevTools → Console → confirm metrics command works after first Speak.
4. Allow microphone when prompted.
5. Speak a short EN trip request → verify partial → final → streamed reply (#1–5).
6. While Bilamo speaks, talk over it (barge-in) → verify #6–9; record interrupt latency.
7. DevTools → Network → Offline 3–5s during listening, then Online → verify #10–11; record reconnect latency.
8. Run Arabic samples 14a–14d (one turn each); confirm intent-ish reply, no duplicate user bubbles (#12–14).
9. Open Type → send text mid-session (#15).
10. Secret scan in Network/Sources (#17).
11. Redeploy with `VITE_VOICE_TRANSPORT=auto` and temporarily unset server `OPENAI_API_KEY` → Speak should use classic (or recovery); text still works (#16).

### Safari macOS

1. Same staging URL in Safari 17+.
2. Safari → Settings → Websites → Microphone → Allow for staging origin.
3. Repeat functional table #1–15 (skip Offline via DevTools if unavailable — use Network Link Conditioner or toggle Wi‑Fi briefly for #10–11).
4. Note WebRTC / autoplay quirks in Notes column.
5. Confirm #17 (Web Inspector → Network / Search).

### Safari iPhone

1. Open staging URL in Safari (HTTPS required for mic/WebRTC).
2. When prompted, Allow Microphone.
3. Use headphones if echo is severe; keep phone unlocked.
4. Run #1–9, #12–15, #17 on a quiet short trip turn + one barge-in.
5. For #10–11: Airplane Mode 3s then off; confirm no stuck orb and no auto-mic.
6. Record latencies via Mac Web Inspector remote debug if available; otherwise note qualitative “immediate / laggy”.

### Chrome Android

1. Chrome → staging URL (HTTPS).
2. Allow mic; disable battery optimization for Chrome if mic drops.
3. Repeat #1–15, #17.
4. Network drop: toggle airplane mode briefly for #10–11.
5. Capture metrics via `chrome://inspect` remote debugging → Console → metrics snippet.

---

## Results template (paste into PR comment)

```
Browser/device:
transportKind:
connectionSetupMs (last / p50 / p95):
timeToFirstPartialMs (last / p50 / p95):
timeToFirstAudioMs (last / p50 / p95):
interruptionLatencyMs (last / p50 / p95):
reconnectLatencyMs (last / p50 / p95):
Checklist #1–17: (all Pass / list Failures)
Arabic notes:
Blockers:
Tester:
Date:
```

## Merge gate

All of #1–17 **Pass** on **Chrome desktop** (required) and at least one of Safari macOS / Safari iPhone / Chrome Android (recommended).  
Latency numbers filled for partial, first audio, interrupt (reconnect if tested).

Until that human sign-off exists → **NOT READY TO MERGE**.
