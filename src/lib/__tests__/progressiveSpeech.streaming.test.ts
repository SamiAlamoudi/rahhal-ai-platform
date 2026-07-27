import { describe, expect, it } from 'vitest'
import {
  takeNewSpokenChunks,
  takeSpokenTail,
  splitSpokenSentences,
} from '../chat/voice/progressiveSpeech'

describe('progressive speech — ChatGPT Voice streaming', () => {
  it('starts first audio from a clause break before full punctuation', () => {
    const partial = 'ميزانيتكم ممتازة لرحلة أسبوع، وسأقترح'
    const first = takeNewSpokenChunks(partial, 0)
    expect(first.chunks.length).toBeGreaterThan(0)
    expect(first.chunks[0]).toMatch(/ميزانيتكم/)
    expect(first.nextCursor).toBeGreaterThan(14)
  })

  it('enqueues mid-stream sentences while tokens continue', () => {
    let cursor = 0
    const step1 = takeNewSpokenChunks('مرحبا بكم. هل تفكرون', cursor)
    expect(step1.chunks[0]).toMatch(/مرحبا/)
    cursor = step1.nextCursor

    const step2 = takeNewSpokenChunks(
      'مرحبا بكم. هل تفكرون في إسطنبول؟ بعد الاختيار سأبحث.',
      cursor,
    )
    expect(step2.chunks.length).toBeGreaterThanOrEqual(1)
    expect(step2.chunks.join(' ')).toMatch(/إسطنبول|بعد/)
    cursor = step2.nextCursor

    const tail = takeSpokenTail(
      'مرحبا بكم. هل تفكرون في إسطنبول؟ بعد الاختيار سأبحث.',
      cursor,
    )
    // All spoken or only a tiny remainder.
    expect(tail.length).toBeLessThan(40)
  })

  it('splits multiple ready sentences in one pump', () => {
    const { ready } = splitSpokenSentences('أولاً. ثانياً. ثالثاً؟')
    expect(ready.length).toBe(3)
    const all = takeNewSpokenChunks('أولاً. ثانياً. ثالثاً؟', 0)
    expect(all.chunks.length).toBe(3)
  })

  it('soft-starts after ~36 chars without punctuation for TTFB', () => {
    const growing = 'سأجهز لكم أفضل الخيارات المناسبة لرحلتكم القادمة إلى'
    const first = takeNewSpokenChunks(growing, 0)
    expect(first.chunks.length).toBe(1)
    expect(first.chunks[0]!.length).toBeGreaterThanOrEqual(20)
  })
})
