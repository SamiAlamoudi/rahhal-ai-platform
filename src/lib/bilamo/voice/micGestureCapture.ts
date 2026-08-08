/**
 * Safari iPhone: getUserMedia MUST run inside the originating user-gesture stack.
 * Any awaited network (capability probe / auth / SDP) before this call loses the gesture
 * and leaves Mic permission = "prompt" with no MediaStream.
 */

export type MicGestureCaptureResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; code: 'mic_unsupported' | 'mic_permission_failed' | 'mic_track_missing'; message: string }

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  },
}

/** Call synchronously from orb/mic tap — before prepare/auth/SDP awaits. */
export async function captureMicFromUserGesture(): Promise<MicGestureCaptureResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      code: 'mic_unsupported',
      message: 'getUserMedia unavailable',
    }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    const track = stream.getAudioTracks()[0]
    if (!track || track.readyState === 'ended') {
      stream.getTracks().forEach((t) => t.stop())
      return {
        ok: false,
        code: 'mic_track_missing',
        message: 'No live audio track',
      }
    }
    try {
      if ('contentHint' in track) {
        ;(track as MediaStreamTrack & { contentHint?: string }).contentHint = 'speech'
      }
    } catch {
      /* ignore */
    }
    return { ok: true, stream }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      code: 'mic_permission_failed',
      message,
    }
  }
}

export function stopMicStream(stream: MediaStream | null | undefined): void {
  if (!stream) return
  try {
    stream.getTracks().forEach((t) => {
      try {
        t.stop()
      } catch {
        /* ignore */
      }
    })
  } catch {
    /* ignore */
  }
}
