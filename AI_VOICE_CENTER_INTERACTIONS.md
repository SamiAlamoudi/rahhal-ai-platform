# Voice Center — Interaction Diagram

**Phase 4 Stage 3** · UI-only interactions · No speech / AI / APIs

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Listening: Start / Mic
  Listening --> Paused: Pause
  Paused --> Listening: Resume
  Listening --> Muted: Mute
  Muted --> Listening: Unmute
  Listening --> Idle: Stop
  Speaking --> Idle: Stop
  Idle --> Speaking: Replay
  Listening --> Idle: Clear Session
  Speaking --> Idle: Clear Session
  Idle --> Offline: Offline placeholder
  Idle --> PermissionRequired: Permission placeholder
  Idle --> NoiseDetected: Noise placeholder
  Idle --> Disconnected: Disconnected placeholder
```

```mermaid
sequenceDiagram
  participant U as Traveler UI
  participant VC as VoiceCenter state
  participant Mic as MicrophoneStage
  participant Tx as TranscriptPanel

  U->>VC: Start / Mic click
  VC->>Mic: sessionState = listening
  Note over VC: No STT invoked
  U->>VC: Shortcut "Plan a trip"
  VC->>Tx: currentTravelerText = prompt
  U->>VC: Pause / Resume / Mute / Stop
  VC->>Mic: update animation class
  U->>VC: Replay
  VC->>Mic: sessionState = speaking
  Note over VC: No TTS invoked
  U->>VC: Clear Session
  VC->>Tx: transcript cleared
```

## Interaction rules

1. Controls only mutate local `VoiceCenterUiState`.  
2. Shortcuts never call AI — they set placeholder traveler text.  
3. Export / voice selector / DSP toggles are placeholders (`data-placeholder`).  
4. Session history actions (rename/archive/delete/favorite) are local list mutations.  
5. Chat Conversation Center is never opened or embedded from these controls.
