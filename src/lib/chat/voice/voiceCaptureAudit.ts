/**
 * Production voice capture audit — mic → WebRTC → OpenAI Realtime.
 *
 * Observes a *clone* of the mic stream (never inserts DSP into the RTC sender path).
 * Classifies whether a short/partial transcript is due to missing audio (transport)
 * vs recognition, using duration / bytes / packet-loss / VAD correlation.
 */

import { logPipeline } from '../pipelineDiagnostics'

export type VoiceCaptureShrinkStage =
  | 'none'
  | 'microphone'
  | 'webrtc_transport'
  | 'server_vad'
  | 'recognition'

export type VoiceCapturePartialCause =
  | 'ok'
  | 'missing_audio_transport'
  | 'missing_audio_vad_cut'
  | 'recognition_partial'
  | 'insufficient_signal'
  | 'unknown'

export type VoiceCaptureTurnSnapshot = {
  /** Wall-clock while local mic energy looked like speech this turn. */
  microphoneRecordingDurationMs: number
  /** Sum of server speech_started → speech_stopped intervals. */
  serverVadDurationMs: number
  sampleRate: number | null
  channelCount: number | null
  audioFrameCount: number
  droppedFrames: number
  /** outbound-rtp packetsSent delta during the turn. */
  packetsSentDelta: number
  /** remote-inbound-rtp packetsLost delta during the turn. */
  packetsLostDelta: number
  bytesSentDelta: number
  /** Peak RMS-ish level 0–1 during the turn. */
  peakAudioEnergy: number
  /** Mean energy while speaking. */
  meanSpeechEnergy: number
  voiceActivityStartMs: number | null
  voiceActivityEndMs: number | null
  serverSpeechStartedAtMs: number | null
  serverSpeechStoppedAtMs: number | null
  realtimeReconnects: number
  iceDisconnects: number
  trackMuteEvents: number
  trackEndedEvents: number
  /** Server emitted input_audio_buffer.committed for this turn. */
  serverReceivedCommittedAudio: boolean
  connectionState: string | null
  iceConnectionState: string | null
  finalTranscript: string
  transcriptCharCount: number
  shrinkStage: VoiceCaptureShrinkStage
  partialCause: VoiceCapturePartialCause
}

export type VoiceCaptureAudit = {
  attachPeer: (pc: RTCPeerConnection) => void
  attachLocalStream: (stream: MediaStream) => void
  noteConnectionState: (state: string) => void
  noteIceConnectionState: (state: string) => void
  markReconnect: (reason: string) => void
  onSpeechStarted: (atMs: number) => void
  onSpeechStopped: (atMs: number) => void
  onServerAudioCommitted: () => void
  beginTurn: (atMs: number) => void
  /** Emit turn audit when ASR commits or rejects; returns classification. */
  endTurn: (input: {
    finalTranscript: string
    assemblerAudioDurationMs?: number
  }) => VoiceCaptureTurnSnapshot
  getReconnectCount: () => number
  snapshot: () => Partial<VoiceCaptureTurnSnapshot>
  /** Stop cloned-stream energy monitor only — keep peer stats across mic release. */
  releaseMicMonitor: () => void
  dispose: () => void
}

type RtpCounters = {
  packetsSent: number
  packetsLost: number
  bytesSent: number
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function readTrackSettings(track: MediaStreamTrack | undefined): {
  sampleRate: number | null
  channelCount: number | null
} {
  if (!track || typeof track.getSettings !== 'function') {
    return { sampleRate: null, channelCount: null }
  }
  try {
    const s = track.getSettings()
    return {
      sampleRate: typeof s.sampleRate === 'number' ? s.sampleRate : null,
      channelCount: typeof s.channelCount === 'number' ? s.channelCount : null,
    }
  } catch {
    return { sampleRate: null, channelCount: null }
  }
}

/**
 * Compare pipeline durations and transport counters to find where audio shrinks.
 */
export function classifyVoiceCaptureIntegrity(input: {
  microphoneRecordingDurationMs: number
  serverVadDurationMs: number
  packetsSentDelta: number
  packetsLostDelta: number
  bytesSentDelta: number
  droppedFrames: number
  realtimeReconnects: number
  iceDisconnects: number
  trackMuteEvents: number
  trackEndedEvents: number
  serverReceivedCommittedAudio: boolean
  peakAudioEnergy: number
  finalTranscript: string
}): { shrinkStage: VoiceCaptureShrinkStage; partialCause: VoiceCapturePartialCause } {
  const micMs = input.microphoneRecordingDurationMs
  const vadMs = input.serverVadDurationMs
  const letters = (input.finalTranscript || '').replace(/[^\p{L}\p{N}]/gu, '').length
  const transportBroken =
    input.realtimeReconnects > 0
    || input.trackEndedEvents > 0
    || input.packetsLostDelta >= 8
    || (input.packetsSentDelta > 40 && input.packetsLostDelta / input.packetsSentDelta >= 0.05)
    || (micMs >= 4000 && input.bytesSentDelta < 2000)
    || (micMs >= 4000 && input.packetsSentDelta < 20)

  if (micMs < 800 && letters < 8) {
    return { shrinkStage: 'microphone', partialCause: 'insufficient_signal' }
  }

  if (transportBroken) {
    return { shrinkStage: 'webrtc_transport', partialCause: 'missing_audio_transport' }
  }

  // Local mic heard a long utterance but server VAD window is much shorter.
  if (micMs >= 6000 && vadMs > 0 && vadMs < micMs * 0.55) {
    return { shrinkStage: 'server_vad', partialCause: 'missing_audio_vad_cut' }
  }

  // Audio looked continuous (energy + bytes + VAD) but transcript is a fragment.
  if (
    micMs >= 5000
    && vadMs >= 4000
    && input.bytesSentDelta >= 4000
    && input.serverReceivedCommittedAudio
    && letters < 18
  ) {
    return { shrinkStage: 'recognition', partialCause: 'recognition_partial' }
  }

  if (micMs >= 5000 && letters < 14 && !input.serverReceivedCommittedAudio) {
    return { shrinkStage: 'server_vad', partialCause: 'missing_audio_vad_cut' }
  }

  return { shrinkStage: 'none', partialCause: 'ok' }
}

export function createVoiceCaptureAudit(): VoiceCaptureAudit {
  let pc: RTCPeerConnection | null = null
  let localStream: MediaStream | null = null
  let monitorStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let sampleTimer: ReturnType<typeof setInterval> | null = null
  let statsTimer: ReturnType<typeof setInterval> | null = null

  let sampleRate: number | null = null
  let channelCount: number | null = null
  let reconnectCount = 0
  let iceDisconnects = 0
  let trackMuteEvents = 0
  let trackEndedEvents = 0
  let connectionState: string | null = null
  let iceConnectionState: string | null = null

  // Per-turn accumulators
  let turnOpen = false
  let turnStartedAt = 0
  let localSpeechMs = 0
  let localSpeechOpenAt: number | null = null
  let serverVadMs = 0
  let serverSpeechOpenAt: number | null = null
  let voiceActivityStartMs: number | null = null
  let voiceActivityEndMs: number | null = null
  let serverSpeechStartedAtMs: number | null = null
  let serverSpeechStoppedAtMs: number | null = null
  let frameCount = 0
  let droppedFrames = 0
  let peakEnergy = 0
  let energySum = 0
  let energySamples = 0
  let serverCommitted = false
  let turnReconnects = 0
  let turnIceDisconnects = 0
  let turnMuteEvents = 0
  let turnEndedEvents = 0
  let rtpAtTurnStart: RtpCounters | null = null
  let rtpLatest: RtpCounters = { packetsSent: 0, packetsLost: 0, bytesSent: 0 }
  let reconnectBaseline = 0
  let iceBaseline = 0
  let muteBaseline = 0
  let endedBaseline = 0

  const log = (event: string, meta?: Record<string, unknown>) => {
    logPipeline({
      stage: 'microphone',
      event,
      meta: {
        connectionState,
        iceConnectionState,
        sampleRate,
        channelCount,
        reconnectCount,
        ...meta,
      },
    })
  }

  const stopMonitor = () => {
    if (sampleTimer) {
      clearInterval(sampleTimer)
      sampleTimer = null
    }
    try {
      analyser?.disconnect()
    } catch {
      // ignore
    }
    analyser = null
    if (audioContext) {
      void audioContext.close().catch(() => undefined)
      audioContext = null
    }
    if (monitorStream) {
      try {
        monitorStream.getTracks().forEach((t) => t.stop())
      } catch {
        // ignore
      }
      monitorStream = null
    }
  }

  const stopStats = () => {
    if (statsTimer) {
      clearInterval(statsTimer)
      statsTimer = null
    }
  }

  const readRtp = async (): Promise<RtpCounters> => {
    if (!pc || typeof pc.getStats !== 'function') return { ...rtpLatest }
    try {
      const report = await pc.getStats()
      let packetsSent = 0
      let packetsLost = 0
      let bytesSent = 0
      report.forEach((row) => {
        const r = row as {
          type?: string
          kind?: string
          packetsSent?: number
          packetsLost?: number
          bytesSent?: number
        }
        if (r.type === 'outbound-rtp' && (r.kind === 'audio' || r.kind == null)) {
          packetsSent += r.packetsSent ?? 0
          bytesSent += r.bytesSent ?? 0
        }
        if (r.type === 'remote-inbound-rtp' && (r.kind === 'audio' || r.kind == null)) {
          packetsLost += r.packetsLost ?? 0
        }
      })
      rtpLatest = { packetsSent, packetsLost, bytesSent }
      return rtpLatest
    } catch {
      return { ...rtpLatest }
    }
  }

  const startStatsLoop = () => {
    stopStats()
    statsTimer = setInterval(() => {
      void readRtp()
    }, 500)
  }

  const startEnergyMonitor = (stream: MediaStream) => {
    stopMonitor()
    const track = stream.getAudioTracks()[0]
    const settings = readTrackSettings(track)
    sampleRate = settings.sampleRate
    channelCount = settings.channelCount

    try {
      // Clone so monitoring never touches the RTC sender track lifecycle.
      monitorStream = typeof stream.clone === 'function' ? stream.clone() : stream
    } catch {
      monitorStream = stream
    }

    const Ctx =
      typeof window !== 'undefined'
        ? (window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined
    if (!Ctx || !monitorStream) {
      log('capture_audit_monitor_unavailable')
      return
    }

    try {
      audioContext = new Ctx()
      const source = audioContext.createMediaStreamSource(monitorStream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const speechThreshold = 0.012

      sampleTimer = setInterval(() => {
        if (!analyser) return
        analyser.getByteTimeDomainData(data)
        frameCount += 1
        let sum = 0
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i]! - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        const energy = Math.max(0, Math.min(1, rms * 4))
        if (!turnOpen) return

        // Heuristic dropped-frame: analyser returned a flat buffer while track is live+unmuted.
        const live = localStream?.getAudioTracks().some(
          (t) => t.readyState === 'live' && t.enabled && !t.muted,
        )
        if (live && rms < 0.0004 && localSpeechOpenAt != null) {
          droppedFrames += 1
        }

        if (energy > peakEnergy) peakEnergy = energy
        if (rms >= speechThreshold) {
          energySum += energy
          energySamples += 1
          if (localSpeechOpenAt == null) {
            localSpeechOpenAt = nowMs()
            if (voiceActivityStartMs == null) voiceActivityStartMs = localSpeechOpenAt
          }
          voiceActivityEndMs = nowMs()
        } else if (localSpeechOpenAt != null) {
          localSpeechMs += Math.max(0, nowMs() - localSpeechOpenAt)
          localSpeechOpenAt = null
        }
      }, 50)

      log('capture_audit_monitor_started', {
        sampleRate,
        channelCount,
        usingClone: monitorStream !== stream,
      })
    } catch (error) {
      log('capture_audit_monitor_failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      stopMonitor()
    }
  }

  const bindTrackLifecycle = (stream: MediaStream) => {
    stream.getAudioTracks().forEach((track) => {
      try {
        if ('contentHint' in track) {
          ;(track as MediaStreamTrack & { contentHint?: string }).contentHint = 'speech'
        }
      } catch {
        // ignore
      }
      track.onmute = () => {
        trackMuteEvents += 1
        if (turnOpen) turnMuteEvents += 1
        log('capture_track_muted', { readyState: track.readyState, enabled: track.enabled })
      }
      track.onunmute = () => {
        log('capture_track_unmuted', { readyState: track.readyState, enabled: track.enabled })
      }
      track.onended = () => {
        trackEndedEvents += 1
        if (turnOpen) turnEndedEvents += 1
        log('capture_track_ended', { readyState: track.readyState })
      }
    })
  }

  return {
    attachPeer(nextPc) {
      pc = nextPc
      connectionState = nextPc.connectionState
      iceConnectionState = nextPc.iceConnectionState
      startStatsLoop()
      void readRtp()
      log('capture_peer_attached', { connectionState, iceConnectionState })
    },

    noteConnectionState(state) {
      connectionState = state
      log('capture_connection_state', { connectionState })
      if ((state === 'failed' || state === 'closed') && turnOpen) {
        turnIceDisconnects += 1
      }
    },

    noteIceConnectionState(state) {
      iceConnectionState = state
      log('capture_ice_state', { iceConnectionState })
      if (state === 'disconnected' || state === 'failed') {
        iceDisconnects += 1
        if (turnOpen) turnIceDisconnects += 1
      }
    },

    attachLocalStream(stream) {
      localStream = stream
      bindTrackLifecycle(stream)
      startEnergyMonitor(stream)
      const settings = readTrackSettings(stream.getAudioTracks()[0])
      sampleRate = settings.sampleRate ?? sampleRate
      channelCount = settings.channelCount ?? channelCount
      log('capture_mic_attached', { sampleRate, channelCount })
    },

    markReconnect(reason) {
      reconnectCount += 1
      if (turnOpen) turnReconnects += 1
      log('capture_realtime_reconnect', { reason, reconnectCount })
    },

    onSpeechStarted(atMs) {
      if (!turnOpen) {
        this.beginTurn(atMs)
      }
      if (serverSpeechOpenAt == null) {
        serverSpeechOpenAt = atMs
        if (serverSpeechStartedAtMs == null) serverSpeechStartedAtMs = atMs
      }
      log('capture_server_vad_start', { atMs })
    },

    onSpeechStopped(atMs) {
      if (serverSpeechOpenAt != null) {
        serverVadMs += Math.max(0, atMs - serverSpeechOpenAt)
        serverSpeechOpenAt = null
      }
      serverSpeechStoppedAtMs = atMs
      log('capture_server_vad_stop', {
        atMs,
        serverVadDurationMs: Math.round(serverVadMs),
      })
    },

    onServerAudioCommitted() {
      serverCommitted = true
      log('capture_server_audio_committed', {
        serverVadDurationMs: Math.round(serverVadMs),
        microphoneRecordingDurationMs: Math.round(
          localSpeechMs + (localSpeechOpenAt != null ? nowMs() - localSpeechOpenAt : 0),
        ),
      })
    },

    beginTurn(atMs) {
      turnOpen = true
      turnStartedAt = atMs
      localSpeechMs = 0
      localSpeechOpenAt = null
      serverVadMs = 0
      serverSpeechOpenAt = null
      voiceActivityStartMs = null
      voiceActivityEndMs = null
      serverSpeechStartedAtMs = null
      serverSpeechStoppedAtMs = null
      frameCount = 0
      droppedFrames = 0
      peakEnergy = 0
      energySum = 0
      energySamples = 0
      serverCommitted = false
      turnReconnects = 0
      turnIceDisconnects = 0
      turnMuteEvents = 0
      turnEndedEvents = 0
      reconnectBaseline = reconnectCount
      iceBaseline = iceDisconnects
      muteBaseline = trackMuteEvents
      endedBaseline = trackEndedEvents
      rtpAtTurnStart = { ...rtpLatest }
      void readRtp().then((c) => {
        if (turnOpen && rtpAtTurnStart) rtpAtTurnStart = { ...c }
      })
      log('capture_turn_begin', { atMs: turnStartedAt })
    },

    endTurn(input) {
      const at = nowMs()
      if (localSpeechOpenAt != null) {
        localSpeechMs += Math.max(0, at - localSpeechOpenAt)
        localSpeechOpenAt = null
      }
      if (serverSpeechOpenAt != null) {
        serverVadMs += Math.max(0, at - serverSpeechOpenAt)
        serverSpeechOpenAt = null
      }

      const start = rtpAtTurnStart || { packetsSent: 0, packetsLost: 0, bytesSent: 0 }
      const packetsSentDelta = Math.max(0, rtpLatest.packetsSent - start.packetsSent)
      const packetsLostDelta = Math.max(0, rtpLatest.packetsLost - start.packetsLost)
      const bytesSentDelta = Math.max(0, rtpLatest.bytesSent - start.bytesSent)

      // Prefer measured local speech; fall back to assembler wall duration if monitor unavailable.
      const micMs = localSpeechMs > 0
        ? localSpeechMs
        : (input.assemblerAudioDurationMs ?? 0)

      const classified = classifyVoiceCaptureIntegrity({
        microphoneRecordingDurationMs: micMs,
        serverVadDurationMs: serverVadMs,
        packetsSentDelta,
        packetsLostDelta,
        bytesSentDelta,
        droppedFrames,
        realtimeReconnects: turnReconnects + Math.max(0, reconnectCount - reconnectBaseline),
        iceDisconnects: turnIceDisconnects + Math.max(0, iceDisconnects - iceBaseline),
        trackMuteEvents: turnMuteEvents + Math.max(0, trackMuteEvents - muteBaseline),
        trackEndedEvents: turnEndedEvents + Math.max(0, trackEndedEvents - endedBaseline),
        serverReceivedCommittedAudio: serverCommitted,
        peakAudioEnergy: peakEnergy,
        finalTranscript: input.finalTranscript,
      })

      const snapshot: VoiceCaptureTurnSnapshot = {
        microphoneRecordingDurationMs: Math.round(micMs),
        serverVadDurationMs: Math.round(serverVadMs),
        sampleRate,
        channelCount,
        audioFrameCount: frameCount,
        droppedFrames,
        packetsSentDelta,
        packetsLostDelta,
        bytesSentDelta,
        peakAudioEnergy: Number(peakEnergy.toFixed(4)),
        meanSpeechEnergy: energySamples
          ? Number((energySum / energySamples).toFixed(4))
          : 0,
        voiceActivityStartMs,
        voiceActivityEndMs,
        serverSpeechStartedAtMs,
        serverSpeechStoppedAtMs,
        realtimeReconnects: turnReconnects + Math.max(0, reconnectCount - reconnectBaseline),
        iceDisconnects: turnIceDisconnects + Math.max(0, iceDisconnects - iceBaseline),
        trackMuteEvents: turnMuteEvents + Math.max(0, trackMuteEvents - muteBaseline),
        trackEndedEvents: turnEndedEvents + Math.max(0, trackEndedEvents - endedBaseline),
        serverReceivedCommittedAudio: serverCommitted,
        connectionState,
        iceConnectionState,
        finalTranscript: input.finalTranscript.slice(0, 200),
        transcriptCharCount: input.finalTranscript.length,
        shrinkStage: classified.shrinkStage,
        partialCause: classified.partialCause,
      }

      logPipeline({
        stage: 'voice',
        event: 'voice_capture_audit',
        meta: {
          ...snapshot,
          pipeline: {
            userSpokenDurationMs: snapshot.microphoneRecordingDurationMs,
            audioSentBytesDelta: snapshot.bytesSentDelta,
            serverVadDurationMs: snapshot.serverVadDurationMs,
            finalTranscriptChars: snapshot.transcriptCharCount,
            shrinkStage: snapshot.shrinkStage,
            partialCause: snapshot.partialCause,
          },
        },
      })

      turnOpen = false
      return snapshot
    },

    getReconnectCount: () => reconnectCount,

    snapshot() {
      return {
        microphoneRecordingDurationMs: Math.round(
          localSpeechMs + (localSpeechOpenAt != null ? nowMs() - localSpeechOpenAt : 0),
        ),
        serverVadDurationMs: Math.round(
          serverVadMs + (serverSpeechOpenAt != null ? nowMs() - serverSpeechOpenAt : 0),
        ),
        sampleRate,
        channelCount,
        audioFrameCount: frameCount,
        droppedFrames,
        packetsSentDelta: rtpAtTurnStart
          ? Math.max(0, rtpLatest.packetsSent - rtpAtTurnStart.packetsSent)
          : 0,
        packetsLostDelta: rtpAtTurnStart
          ? Math.max(0, rtpLatest.packetsLost - rtpAtTurnStart.packetsLost)
          : 0,
        bytesSentDelta: rtpAtTurnStart
          ? Math.max(0, rtpLatest.bytesSent - rtpAtTurnStart.bytesSent)
          : 0,
        peakAudioEnergy: peakEnergy,
        realtimeReconnects: reconnectCount,
        iceDisconnects,
        trackMuteEvents,
        trackEndedEvents,
        serverReceivedCommittedAudio: serverCommitted,
        connectionState,
        iceConnectionState,
      }
    },

    releaseMicMonitor() {
      stopMonitor()
      localStream = null
    },

    dispose() {
      stopMonitor()
      stopStats()
      pc = null
      localStream = null
    },
  }
}
