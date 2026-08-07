import { useCallback, useEffect, useRef, useState } from 'react'

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> & {
      length: number
    }
  }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type BilamoSpeechState = {
  supported: boolean
  listening: boolean
  partial: string
  error: string | null
  start: (locale?: string) => boolean
  stop: () => void
}

/**
 * Browser speech recognition for Bilamo voice turns.
 * Final transcript is delivered via onFinal callback.
 */
export function useBilamoSpeech(onFinal: (transcript: string) => void): BilamoSpeechState {
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const intentionalStop = useRef(false)
  const finalRef = useRef('')
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const supported = typeof window !== 'undefined' && !!getCtor()

  const cleanup = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    rec.onresult = null
    rec.onerror = null
    rec.onend = null
    recognitionRef.current = null
  }, [])

  const stop = useCallback(() => {
    intentionalStop.current = true
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }, [])

  const start = useCallback(
    (locale = 'en-US') => {
      const Ctor = getCtor()
      if (!Ctor) {
        setError('Speech recognition is not supported in this browser')
        return false
      }
      cleanup()
      intentionalStop.current = false
      finalRef.current = ''
      setPartial('')
      setError(null)

      const recognition = new Ctor()
      recognition.lang = locale
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event) => {
        let interim = ''
        let added = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          const text = result?.[0]?.transcript ?? ''
          if (result && (result as { isFinal?: boolean }).isFinal) {
            added += text
          } else {
            interim += text
          }
        }
        if (added) {
          finalRef.current = `${finalRef.current} ${added}`.trim()
          setPartial(finalRef.current)
        } else if (interim) {
          setPartial(`${finalRef.current} ${interim}`.trim())
        }
      }

      let reconnectAttempted = false

      recognition.onerror = (event) => {
        const code = event.error || 'speech_error'
        if (intentionalStop.current && (code === 'aborted' || code === 'no-speech')) return
        if (code === 'no-speech') return
        // One soft reconnect on transient network drops — keeps Arabic turns alive.
        if (
          !intentionalStop.current
          && !reconnectAttempted
          && (code === 'network' || code === 'aborted')
        ) {
          reconnectAttempted = true
          try {
            recognition.start()
            return
          } catch {
            /* fall through to surface error */
          }
        }
        setError(code)
        setListening(false)
      }

      recognition.onend = () => {
        // Unexpected end mid-utterance with no final yet → one reconnect.
        if (
          !intentionalStop.current
          && !reconnectAttempted
          && !finalRef.current.trim()
          && recognitionRef.current === recognition
        ) {
          reconnectAttempted = true
          try {
            recognition.start()
            setListening(true)
            return
          } catch {
            /* fall through */
          }
        }
        setListening(false)
        const transcript = finalRef.current.trim()
        cleanup()
        if (transcript) onFinalRef.current(transcript)
      }

      recognitionRef.current = recognition
      try {
        recognition.start()
        setListening(true)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start listening')
        cleanup()
        return false
      }
    },
    [cleanup],
  )

  useEffect(
    () => () => {
      intentionalStop.current = true
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
      cleanup()
    },
    [cleanup],
  )

  return { supported, listening, partial, error, start, stop }
}
