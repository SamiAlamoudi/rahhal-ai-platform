/**
 * Staging/dev metrics publisher — structured logs only, never audio/transcripts.
 * Enable with VITE_VOICE_METRICS=1.
 */

import type { BilamoVoiceMetricsReport } from './bilamoVoiceMetrics'

const GLOBAL_KEY = '__BILAMO_VOICE_METRICS__'

export function voiceMetricsEnabled(): boolean {
  try {
    return String(import.meta.env.VITE_VOICE_METRICS || '').trim() === '1'
  } catch {
    return false
  }
}

export function publishBilamoVoiceMetrics(report: BilamoVoiceMetricsReport): void {
  if (typeof globalThis === 'undefined') return
  const g = globalThis as unknown as Record<string, unknown>
  g[GLOBAL_KEY] = report
  if (!voiceMetricsEnabled()) return
  // Structured staging summary — latency numbers only.
  console.info('[bilamo.voice.metrics]', JSON.stringify(report))
}

export function readPublishedBilamoVoiceMetrics(): BilamoVoiceMetricsReport | null {
  if (typeof globalThis === 'undefined') return null
  const g = globalThis as unknown as Record<string, unknown>
  const value = g[GLOBAL_KEY]
  return value && typeof value === 'object' ? (value as BilamoVoiceMetricsReport) : null
}
