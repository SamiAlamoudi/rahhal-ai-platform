import type { MicrophonePermissionState } from './voiceTypes'

/** Kept briefly so VAD can reuse the same getUserMedia grant (avoids double-prompt races). */
let retainedMicStream: MediaStream | null = null

function isInsecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === false
}

function releaseRetainedStream(): void {
  if (!retainedMicStream) return
  for (const track of retainedMicStream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* ignore */
    }
  }
  retainedMicStream = null
}

/** Hand off a retained mic stream to VAD (caller owns stop()). */
export function takeRetainedMicrophoneStream(): MediaStream | null {
  const stream = retainedMicStream
  retainedMicStream = null
  return stream
}

export function discardRetainedMicrophoneStream(): void {
  releaseRetainedStream()
}

export async function queryMicrophonePermission(): Promise<MicrophonePermissionState> {
  if (typeof navigator === 'undefined') {
    return { state: 'unsupported', error: 'بيئة بدون متصفح' }
  }

  if (isInsecureContext()) {
    return {
      state: 'unsupported',
      error: 'الميكروفون يتطلب اتصالاً آمناً (HTTPS أو localhost)',
    }
  }

  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
        return { state: status.state, error: null }
      }
    }
  } catch {
    // Fall through to getUserMedia probe
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return { state: 'unsupported', error: 'الميكروفون غير مدعوم في هذا الجهاز' }
  }

  return { state: 'prompt', error: null }
}

export type RequestMicrophoneOptions = {
  /** Keep the MediaStream alive for VAD reuse (default false — stops tracks). */
  retainStream?: boolean
}

export async function requestMicrophoneAccess(
  options: RequestMicrophoneOptions = {},
): Promise<MicrophonePermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { state: 'unsupported', error: 'الميكروفون غير مدعوم في هذا الجهاز' }
  }

  if (isInsecureContext()) {
    return {
      state: 'unsupported',
      error: 'الميكروفون يتطلب اتصالاً آمناً (HTTPS أو localhost)',
    }
  }

  try {
    releaseRetainedStream()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    if (options.retainStream) {
      retainedMicStream = stream
    } else {
      for (const track of stream.getTracks()) track.stop()
    }
    return { state: 'granted', error: null }
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    const message = e instanceof Error ? e.message : 'تم رفض إذن الميكروفون'
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { state: 'denied', error: 'تم رفض إذن الميكروفون — اسمح بالوصول من إعدادات المتصفح' }
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { state: 'unsupported', error: 'لم يتم العثور على ميكروفون في هذا الجهاز' }
    }
    return { state: 'denied', error: message }
  }
}

/**
 * Subscribe to microphone permission changes (Chrome/Edge). Returns an unsubscribe.
 */
export async function subscribeMicrophonePermission(
  onChange: (state: MicrophonePermissionState) => void,
): Promise<() => void> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return () => {}
  }
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    const handler = () => {
      if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
        onChange({ state: status.state, error: null })
      }
    }
    status.addEventListener('change', handler)
    return () => status.removeEventListener('change', handler)
  } catch {
    return () => {}
  }
}
