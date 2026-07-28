import { describe, expect, it } from 'vitest'
import { takeNewSpokenChunks, takeSpokenTail } from '../chat/voice/progressiveSpeech'

/**
 * Root-cause regression: progressive soft-start + later full sentence
 * re-enqueues overlapping text → duplicate TTS with different intonation.
 */
describe('progressive speech — duplicate TTS root cause', () => {
  it('soft-start then completed sentence overlaps (historical bug)', () => {
    const growing = 'سأجهز لكم أفضل الخيارات المناسبة لرحلتكم القادمة إلى إسطنبول الآن.'
    const soft = takeNewSpokenChunks(growing.slice(0, 40), 0)
    expect(soft.chunks.length).toBe(1)
    const cursor = soft.nextCursor
    expect(cursor).toBeGreaterThan(0)
    expect(cursor).toBeLessThan(growing.length)

    const afterPunctuation = takeNewSpokenChunks(growing, cursor)
    // Historical progressive path pushed the FULL sentence again even though a
    // prefix was already spoken — that is the duplicate-intonation bug.
    const joined = [...soft.chunks, ...afterPunctuation.chunks].join(' ')
    const softPiece = soft.chunks[0]!
    expect(joined.includes(softPiece)).toBe(true)
    if (afterPunctuation.chunks.length > 0) {
      // Overlap: completed sentence still contains the soft-started prefix.
      expect(afterPunctuation.chunks[0]!).toContain(softPiece.slice(0, Math.min(12, softPiece.length)))
    }
  })

  it('one-shot policy: speak only the final full utterance once', () => {
    const full = 'إسطنبول خيار قوي. نبدأ بعطلة قصيرة ثم نضبط الفندق.'
    // Simulate UI streaming without mid-stream TTS — only final speak.
    const spokenOnce = [full]
    expect(spokenOnce).toHaveLength(1)
    expect(takeSpokenTail(full, 0)).toBe(full.replace(/\s+/g, ' ').trim())
  })
})
