import { describe, expect, it } from 'vitest'
import { classifyVoiceCaptureIntegrity } from '../chat/voice/voiceCaptureAudit'

describe('classifyVoiceCaptureIntegrity', () => {
  const base = {
    microphoneRecordingDurationMs: 10_000,
    serverVadDurationMs: 9_500,
    packetsSentDelta: 400,
    packetsLostDelta: 0,
    bytesSentDelta: 40_000,
    droppedFrames: 0,
    realtimeReconnects: 0,
    iceDisconnects: 0,
    trackMuteEvents: 0,
    trackEndedEvents: 0,
    serverReceivedCommittedAudio: true,
    peakAudioEnergy: 0.4,
    finalTranscript: 'أريد السفر من الرياض إلى طوكيو من 3 أغسطس إلى 13 أغسطس لشخصين على درجة الضيافة.',
  }

  it('accepts a continuous Arabic booking capture', () => {
    expect(classifyVoiceCaptureIntegrity(base)).toEqual({
      shrinkStage: 'none',
      partialCause: 'ok',
    })
  })

  it('flags packet loss / reconnect as transport missing audio', () => {
    expect(classifyVoiceCaptureIntegrity({
      ...base,
      realtimeReconnects: 1,
      finalTranscript: 'من 13',
    }).partialCause).toBe('missing_audio_transport')

    expect(classifyVoiceCaptureIntegrity({
      ...base,
      packetsLostDelta: 40,
      packetsSentDelta: 200,
      finalTranscript: 'أريد',
    }).shrinkStage).toBe('webrtc_transport')

    expect(classifyVoiceCaptureIntegrity({
      ...base,
      bytesSentDelta: 500,
      packetsSentDelta: 5,
      finalTranscript: 'من الرياض',
    }).partialCause).toBe('missing_audio_transport')
  })

  it('flags server VAD cut when local speech is long but VAD window is short', () => {
    expect(classifyVoiceCaptureIntegrity({
      ...base,
      microphoneRecordingDurationMs: 12_000,
      serverVadDurationMs: 3_000,
      finalTranscript: 'أريد السفر من',
    })).toEqual({
      shrinkStage: 'server_vad',
      partialCause: 'missing_audio_vad_cut',
    })
  })

  it('flags recognition when audio looks complete but transcript is a fragment', () => {
    expect(classifyVoiceCaptureIntegrity({
      ...base,
      finalTranscript: 'من 13',
    })).toEqual({
      shrinkStage: 'recognition',
      partialCause: 'recognition_partial',
    })
  })

  it('flags short mic energy as insufficient signal', () => {
    expect(classifyVoiceCaptureIntegrity({
      ...base,
      microphoneRecordingDurationMs: 400,
      serverVadDurationMs: 300,
      bytesSentDelta: 800,
      packetsSentDelta: 10,
      finalTranscript: 'أريد',
    }).partialCause).toBe('insufficient_signal')
  })
})
