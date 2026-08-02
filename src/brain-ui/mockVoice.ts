/**
 * Mock voice transcription — no STT / TTS / network.
 */

const MOCK_UTTERANCES = [
  'Book a flight from Riyadh to Istanbul for 4 nights budget 5000 SAR',
  'أريد حجز طيران من الرياض إلى دبي',
  'Recommend a quiet hotel in Dubai',
  'Compare packages for Istanbul',
] as const

export function mockTranscribe(sampleIndex = 0): string {
  return MOCK_UTTERANCES[sampleIndex % MOCK_UTTERANCES.length]!
}

export function isDeveloperMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === '1' || params.get('brainDebug') === '1') return true
    return window.localStorage.getItem('rahhal_brain_debug') === '1'
  } catch {
    return false
  }
}
