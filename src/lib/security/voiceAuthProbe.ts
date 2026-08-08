/**
 * Safe voice-auth probe for diagnostics — never returns tokens or secrets.
 */

import { getProxyAccessToken } from './proxyAuth'
import {
  getActiveVoiceCorrelationId,
  noteVoiceAuthProbe,
  noteVoiceHttpResult,
  noteVoiceRequestDispatched,
  parseSafeErrorCodeFromResponse,
} from '../bilamo/voice/voiceHttpTrace'
import { newVoiceCorrelationId } from '../bilamo/voice/voicePlaybackDiagnostics'

export type VoiceAuthProbeResult = {
  supabaseSessionAvailable: boolean
  authenticatedUser: boolean
  authProbeCode: string | null
  ok: boolean
}

export async function probeVoiceAuth(): Promise<VoiceAuthProbeResult> {
  try {
    const token = await getProxyAccessToken()
    if (!token) {
      const result = {
        supabaseSessionAvailable: false,
        authenticatedUser: false,
        authProbeCode: 'AUTH_REQUIRED',
        ok: false,
      }
      noteVoiceAuthProbe(result)
      return result
    }
    const result = {
      supabaseSessionAvailable: true,
      authenticatedUser: true,
      authProbeCode: null as string | null,
      ok: true,
    }
    noteVoiceAuthProbe(result)
    return result
  } catch {
    const result = {
      supabaseSessionAvailable: false,
      authenticatedUser: false,
      authProbeCode: 'AUTH_PROBE_FAILED',
      ok: false,
    }
    noteVoiceAuthProbe(result)
    return result
  }
}

/** Attach correlation id for voice API calls (safe short id). */
export async function voiceApiHeaders(
  correlationId?: string | null,
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const { requireProxyAuthHeaders } = await import('./proxyAuth')
  const id = correlationId || getActiveVoiceCorrelationId() || newVoiceCorrelationId()
  return requireProxyAuthHeaders({
    ...extra,
    'x-correlation-id': id,
  })
}

/**
 * Authenticated same-origin voice API fetch with safe HTTP diagnostics.
 * Never logs response bodies or tokens.
 */
export async function voiceAuthenticatedFetch(
  route: string,
  init: RequestInit & {
    kind?: 'realtime' | 'realtime_session' | 'realtime_capability' | 'tts' | 'other'
  } = {},
): Promise<Response> {
  const { kind = 'other', headers: initHeaders, ...rest } = init
  const extra: Record<string, string> = {}
  if (initHeaders instanceof Headers) {
    initHeaders.forEach((value, key) => {
      extra[key] = value
    })
  } else if (Array.isArray(initHeaders)) {
    for (const [key, value] of initHeaders) extra[key] = value
  } else if (initHeaders) {
    Object.assign(extra, initHeaders)
  }
  const headers = await voiceApiHeaders(getActiveVoiceCorrelationId(), extra)
  noteVoiceRequestDispatched(route)
  const res = await fetch(route, { ...rest, headers })
  const bodyCode = res.ok ? null : await parseSafeErrorCodeFromResponse(res)
  noteVoiceHttpResult({ route, status: res.status, bodyCode, kind })
  return res
}
