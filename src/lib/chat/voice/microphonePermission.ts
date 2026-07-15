import type { MicrophonePermissionState } from './voiceTypes'

export async function queryMicrophonePermission(): Promise<MicrophonePermissionState> {
  if (typeof navigator === 'undefined') {
    return { state: 'unsupported', error: 'بيئة بدون متصفح' }
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

export async function requestMicrophoneAccess(): Promise<MicrophonePermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { state: 'unsupported', error: 'الميكروفون غير مدعوم في هذا الجهاز' }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const track of stream.getTracks()) track.stop()
    return { state: 'granted', error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'تم رفض إذن الميكروفون'
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
