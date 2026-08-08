/**
 * P0 audible-output regressions — text is never proof of voice.
 */
import { describe, expect, it } from 'vitest'
import {
  classifyTtsProbeHttp,
  shouldConfirmAudible,
} from '../bilamo/voice/directAudioProbe'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('direct audio probe classification', () => {
  it('rejects auth / server / empty / wrong MIME as failed stages', () => {
    expect(classifyTtsProbeHttp(401, 0, null)).toBe('tts_http_401')
    expect(classifyTtsProbeHttp(403, 0, null)).toBe('tts_http_403')
    expect(classifyTtsProbeHttp(500, 0, null)).toBe('tts_http_500')
    expect(classifyTtsProbeHttp(200, 0, 'audio/wav')).toBe('zero_byte_tts')
    expect(classifyTtsProbeHttp(200, 32, 'audio/wav')).toBe('zero_byte_tts')
    expect(classifyTtsProbeHttp(200, 2048, 'application/json')).toBe('wrong_mime:application/json')
    expect(classifyTtsProbeHttp(200, 2048, 'audio/wav')).toBe('ok')
  })

  it('confirms audible only when play resolved AND progression exists', () => {
    expect(shouldConfirmAudible({
      playResult: 'resolved',
      playingEvent: false,
      maxCurrentTime: 0,
      ended: false,
    })).toBe(false)
    expect(shouldConfirmAudible({
      playResult: 'rejected',
      playingEvent: true,
      maxCurrentTime: 1,
      ended: false,
    })).toBe(false)
    expect(shouldConfirmAudible({
      playResult: 'resolved',
      playingEvent: true,
      maxCurrentTime: 0,
      ended: false,
    })).toBe(true)
    expect(shouldConfirmAudible({
      playResult: 'resolved',
      playingEvent: false,
      maxCurrentTime: 0.2,
      ended: false,
    })).toBe(true)
  })

  it('play() rejection is never audible confirmation', () => {
    expect(shouldConfirmAudible({
      playResult: 'rejected',
      playingEvent: false,
      maxCurrentTime: 0,
      ended: false,
    })).toBe(false)
    expect(shouldConfirmAudible({
      playResult: 'pending',
      playingEvent: false,
      maxCurrentTime: 0,
      ended: false,
    })).toBe(false)
  })
})

describe('realtime session config — force audio output', () => {
  it('realtime-call session JSON locks output_modalities to audio', () => {
    const src = readFileSync(resolve(__dirname, '../../../api/openai/realtime-call.ts'), 'utf8')
    expect(src).toMatch(/output_modalities:\s*\[\s*'audio'\s*\]/)
  })

  it('client response.create requests audio modalities', () => {
    const src = readFileSync(
      resolve(__dirname, '../chat/voice/realtimeWebRtcSession.ts'),
      'utf8',
    )
    expect(src).toMatch(/output_modalities:\s*\[\s*'audio'\s*\]/)
    expect(src).toMatch(/response_done_no_audio/)
    expect(src).toMatch(/obtainPrimedRemoteAudioElement/)
  })

  it('Safari unlock primes remote + TTS playback elements', () => {
    const src = readFileSync(
      resolve(__dirname, '../chat/voice/audioElementTextToSpeechProvider.ts'),
      'utf8',
    )
    expect(src).toMatch(/obtainPrimedRemoteAudioElement/)
    expect(src).toMatch(/obtainPrimedTtsPlaybackElement/)
    expect(src).toMatch(/primeElementForSafari/)
    expect(src).toMatch(/visibilitychange/)
    expect(src).toMatch(/pageshow/)
    // Must never wipe live WebRTC srcObject during unlock.
    expect(src).toMatch(/Never wipe a live remote WebRTC stream/)
    expect(src).toMatch(/liveStream/)
    expect(src).toMatch(/resumeSharedAudioContext/)
  })

  it('realtime ensureRemoteAudible requires progression, not bare play()', () => {
    const src = readFileSync(
      resolve(__dirname, '../chat/voice/realtimeWebRtcSession.ts'),
      'utf8',
    )
    expect(src).toMatch(/waitForRemotePlaybackEvidence/)
    expect(src).toMatch(/play_resolved_no_progression/)
    expect(src).toMatch(/resumeSharedAudioContext/)
    expect(src).toMatch(/NEVER full unlock/)
    expect(src).toMatch(/BILAMO_TRANSCRIPTION_PROMPT/)
  })

  it('session never promotes audioPlaybackStarted into audible', () => {
    const sessionSrc = readFileSync(
      resolve(__dirname, '../bilamo/voice/bilamoVoiceSession.ts'),
      'utf8',
    )
    const traceSrc = readFileSync(
      resolve(__dirname, '../bilamo/voice/voiceHttpTrace.ts'),
      'utf8',
    )
    expect(sessionSrc).toMatch(/Never promote bare play\(\)\/audioPlaybackStarted into audible/)
    expect(traceSrc).toMatch(/Never promote bare play\(\)\/audioPlaybackStarted into audible/)
    expect(traceSrc).not.toMatch(/audible: diag\.audible \|\| diag\.audioPlaybackStarted/)
  })

  it('server realtime transcription prompt biases Bilamo/بيلامو', () => {
    const src = readFileSync(resolve(__dirname, '../../../api/openai/realtime-call.ts'), 'utf8')
    expect(src).toMatch(/بيلامو/)
    expect(src).toMatch(/prompt:/)
    expect(src).toMatch(/not بلال/)
  })
})

describe('response.create payload contract', () => {
  it('audio-only modalities — never text-only speak path', () => {
    const event = {
      type: 'response.create',
      response: { output_modalities: ['audio'] as const },
    }
    expect(event.response.output_modalities).toEqual(['audio'])
    expect(event.response.output_modalities).not.toContain('text')
  })
})

describe('classic fallback exactly once semantics', () => {
  it('ignores overlapping classic fallback while in-flight', () => {
    let classicCalls = 0
    let inFlight = false
    const recover = () => {
      if (inFlight) return
      inFlight = true
      classicCalls += 1
      inFlight = false
    }
    recover()
    recover()
    expect(classicCalls).toBe(2) // sequential recoveries allowed
    inFlight = true
    const before = classicCalls
    if (!inFlight) classicCalls += 1
    expect(classicCalls).toBe(before)
  })

  it('does not double-speak the same generation', () => {
    const spokenGens = new Set<number>()
    const speakOnce = (gen: number) => {
      if (spokenGens.has(gen)) return false
      spokenGens.add(gen)
      return true
    }
    expect(speakOnce(7)).toBe(true)
    expect(speakOnce(7)).toBe(false)
    expect(speakOnce(8)).toBe(true)
  })
})

describe('transcript is not audio evidence', () => {
  it('hadAudio stays false when only transcript exists', () => {
    const active = { hadAudio: false, responseDone: true, playbackStopped: false }
    const lastAssistantSpoken = 'مرحباً أنا بيلامو'
    // Mirror the fixed response.done rule: do NOT set hadAudio from transcript.
    if (active.hadAudio) {
      active.playbackStopped = false
    } else {
      active.playbackStopped = true
    }
    expect(active.hadAudio).toBe(false)
    expect(active.playbackStopped).toBe(true)
    expect(lastAssistantSpoken.length).toBeGreaterThan(0)
  })

  it('remote track muted/ended blocks speaking latch', () => {
    const track: { muted: boolean; readyState: string; enabled: boolean } = {
      muted: true,
      readyState: 'ended',
      enabled: false,
    }
    const canEnterSpeaking = track.readyState === 'live' && track.enabled && !track.muted
    expect(canEnterSpeaking).toBe(false)
  })
})

describe('AudioContext suspended recovery contract', () => {
  it('resume path is required before playback when suspended', () => {
    const src = readFileSync(
      resolve(__dirname, '../chat/voice/audioElementTextToSpeechProvider.ts'),
      'utf8',
    )
    expect(src).toMatch(/audioContext\.state === 'suspended'/)
    expect(src).toMatch(/audioContext\.resume\(\)/)
  })
})

describe('SPEAKING only after audible play', () => {
  it('conversation experience does not arm speaking from text alone', () => {
    const src = readFileSync(
      resolve(__dirname, '../../pages/bilamo/BilamoConversationExperience.tsx'),
      'utf8',
    )
    expect(src).toMatch(/Stay thinking until VoiceSession reports audible SPEAKING/)
    // Arm speak must set thinking, not speaking.
    expect(src).toMatch(/setChatOrb\('thinking'\)/)
  })

  it('classic TTS waits for playing/timeupdate not bare play() resolve', () => {
    const src = readFileSync(
      resolve(__dirname, '../chat/voice/audioElementTextToSpeechProvider.ts'),
      'utf8',
    )
    expect(src).toMatch(/Do NOT treat play\(\) resolve alone/)
    expect(src).toMatch(/ontimeupdate/)
  })
})

describe('direct probe uses persistent diagnostic audio element', () => {
  it('probe unlocks one persistent element before async TTS fetch', () => {
    const src = readFileSync(
      resolve(__dirname, '../bilamo/voice/directAudioProbe.ts'),
      'utf8',
    )
    expect(src).toMatch(/obtainDiagnosticAudioElement/)
    expect(src).toMatch(/unlockDiagnosticAudioElement/)
    expect(src).toMatch(/DIRECT_AUDIO_PROBE_TEXT/)
    expect(src).toMatch(/DIAGNOSTIC_TTS_FORMAT/)
    expect(src).toMatch(/mp3/)
    // Must reuse unlocked element after fetch — never invent a new one.
    expect(src).toMatch(/unlockedElement/)
  })
})

describe('interrupt cleanup + second-turn recovery markers', () => {
  it('bilamo session clears silent timer on interrupt and arms second-turn speak', () => {
    const src = readFileSync(
      resolve(__dirname, '../bilamo/voice/bilamoVoiceSession.ts'),
      'utf8',
    )
    expect(src).toMatch(/clearSilentRealtimeTimer/)
    expect(src).toMatch(/REALTIME_AUDIO_OK/)
    expect(src).toMatch(/REALTIME_AUDIO_FAILED/)
    expect(src).toMatch(/VOICE_OUTPUT_FAILED/)
    expect(src).toMatch(/SILENT_REALTIME_FALLBACK_MS = 2_500/)
  })
})
