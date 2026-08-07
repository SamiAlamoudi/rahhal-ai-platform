/**
 * Transport factory — VOICE_TRANSPORT / VITE_VOICE_TRANSPORT / VITE_VOICE_ARCHITECTURE.
 * auto → probe realtime capability → classic fallback (no paid credentials required for classic).
 */

import { probeRealtimeCapability } from '../../chat/voice/voiceArchitecture'
import { createClassicBilamoTransport } from './classicTransport'
import { createRealtimeWebRtcBilamoTransport } from './realtimeWebRtcTransport'
import {
  resolveVoiceTransportMode,
  type BilamoVoiceTransport,
  type BilamoVoiceTransportMode,
} from './bilamoVoiceTransport'

export type CreateBilamoVoiceTransportOptions = {
  mode?: BilamoVoiceTransportMode
  /** Force classic (tests / unsupported). */
  forceClassic?: boolean
  /** Inject realtime transport for tests. */
  realtimeFactory?: () => BilamoVoiceTransport
  classicFactory?: () => BilamoVoiceTransport
  probe?: typeof probeRealtimeCapability
}

function readEnvMode(): BilamoVoiceTransportMode {
  const transport = import.meta.env.VITE_VOICE_TRANSPORT as string | undefined
  if (transport && String(transport).trim()) {
    return resolveVoiceTransportMode(transport)
  }
  const arch = (import.meta.env.VITE_VOICE_ARCHITECTURE as string | undefined)?.trim().toLowerCase()
  if (arch === 'tts' || arch === 'classic' || arch === 'classic_tts') return 'classic'
  if (arch === 'realtime' || arch === 'webrtc' || arch === 'realtime_webrtc') return 'realtime'
  if (arch === 'auto') return 'auto'
  return 'auto'
}

/**
 * Resolve which transport to use. Never throws — always returns a usable transport.
 * When realtime is requested but unavailable, returns classic and sets `fellBack`.
 */
export async function createBilamoVoiceTransport(
  options: CreateBilamoVoiceTransportOptions = {},
): Promise<{
  transport: BilamoVoiceTransport
  mode: BilamoVoiceTransportMode
  selected: BilamoVoiceTransport['kind']
  fellBack: boolean
  reason: string | null
}> {
  const mode = options.mode ?? readEnvMode()
  const classicFactory = options.classicFactory ?? createClassicBilamoTransport
  const realtimeFactory = options.realtimeFactory
    ?? (() => createRealtimeWebRtcBilamoTransport())
  const probe = options.probe ?? probeRealtimeCapability

  if (options.forceClassic || mode === 'classic') {
    return {
      transport: classicFactory(),
      mode,
      selected: 'classic_tts',
      fellBack: false,
      reason: mode === 'classic' ? 'configured_classic' : 'forced_classic',
    }
  }

  if (mode === 'realtime') {
    try {
      const cap = await probe()
      if (cap?.configured) {
        return {
          transport: realtimeFactory(),
          mode,
          selected: 'realtime_webrtc',
          fellBack: false,
          reason: null,
        }
      }
    } catch {
      /* fall through */
    }
    return {
      transport: classicFactory(),
      mode,
      selected: 'classic_tts',
      fellBack: true,
      reason: 'realtime_unavailable',
    }
  }

  // auto
  try {
    const cap = await probe()
    if (cap?.configured) {
      return {
        transport: realtimeFactory(),
        mode: 'auto',
        selected: 'realtime_webrtc',
        fellBack: false,
        reason: null,
      }
    }
  } catch {
    /* classic */
  }

  return {
    transport: classicFactory(),
    mode: 'auto',
    selected: 'classic_tts',
    fellBack: true,
    reason: 'auto_classic_fallback',
  }
}
