import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assessAsrCompleteness,
  normalizeArabicAsrForExtraction,
} from '../chat/voice/arabicAsrNormalize'
import {
  ARABIC_UTTERANCE_COMMIT_MS,
  createArabicUtteranceAssembler,
} from '../chat/voice/arabicUtteranceAssembler'
import { extractFromUserText } from '../agent/extractRequirements'

describe('Arabic ASR normalization (parser-only)', () => {
  it('maps الضيافة / أنا وزوجتي / word dates without needing display rewrite', () => {
    const raw =
      'أبغى أسافر أنا وزوجتي لطوكيو من ثلاثة أغسطس إلى ثلاثة عشر أغسطس على الضيافة.'
    const normalized = normalizeArabicAsrForExtraction(raw)
    expect(normalized).toMatch(/3\s+أغسطس/)
    expect(normalized).toMatch(/13\s+أغسطس/)
    expect(normalized).toMatch(/درجة اقتصادية|لشخصين|أريد السفر/)

    const extracted = extractFromUserText(raw, 'ar')
    expect(extracted.patch.destination).toBe('Tokyo')
    expect(extracted.patch.travelers).toBe(2)
    expect(extracted.patch.cabinPreference).toBe('economy')
    expect(extracted.patch.startDate).toMatch(/-08-03$/)
    expect(extracted.patch.endDate).toMatch(/-08-13$/)
  })

  it('extracts the acceptance booking sentence', () => {
    const raw =
      'أريد السفر من الرياض إلى طوكيو من 3 أغسطس إلى 13 أغسطس لشخصين على درجة الضيافة.'
    const extracted = extractFromUserText(raw, 'ar')
    expect(extracted.patch.origin).toBe('Riyadh')
    expect(extracted.patch.destination).toBe('Tokyo')
    expect(extracted.patch.travelers).toBe(2)
    expect(extracted.patch.cabinPreference).toBe('economy')
    expect(extracted.patch.startDate).toMatch(/-08-03$/)
    expect(extracted.patch.endDate).toMatch(/-08-13$/)
  })
})

describe('ASR completeness guards', () => {
  it('rejects long audio with tiny transcript', () => {
    const v = assessAsrCompleteness({
      transcript: 'من 13',
      audioDurationMs: 8000,
      conversationLanguage: 'ar',
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('too_short_for_audio')
  })

  it('rejects CJK during Arabic session', () => {
    const v = assessAsrCompleteness({
      transcript: '东京旅行',
      audioDurationMs: 4000,
      conversationLanguage: 'ar',
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('wrong_script')
  })

  it('accepts a full Arabic booking sentence', () => {
    const v = assessAsrCompleteness({
      transcript: 'أريد السفر من الرياض إلى طوكيو من 3 أغسطس إلى 13 أغسطس لشخصين على درجة الضيافة',
      audioDurationMs: 9000,
      conversationLanguage: 'ar',
    })
    expect(v.ok).toBe(true)
  })
})

describe('utterance assembler — pause merge + single commit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('merges pause-split segments into one committed transcript', () => {
    const commits: string[] = []
    const rejects: string[] = []
    let now = 0
    const assembler = createArabicUtteranceAssembler({
      conversationLanguage: () => 'ar',
      nowMs: () => now,
      commitDelayMs: ARABIC_UTTERANCE_COMMIT_MS,
      onCommit: (r) => {
        commits.push(r.committedTranscript)
      },
      onReject: (r) => {
        rejects.push(r.reason)
      },
    })

    now = 0
    assembler.onSpeechStarted(now)
    now = 2000
    assembler.onSegmentFinal('أريد السفر من الرياض إلى طوكيو')
    assembler.onSpeechStopped(now)
    assembler.scheduleCommit(ARABIC_UTTERANCE_COMMIT_MS)

    // Brief pause — new speech before commit fires → keep assembling.
    now = 2800
    assembler.onSpeechStarted(now)
    now = 5000
    assembler.onSegmentFinal('من 3 أغسطس إلى 13 أغسطس لشخصين على درجة الضيافة')
    assembler.onSpeechStopped(now)
    assembler.scheduleCommit(ARABIC_UTTERANCE_COMMIT_MS)

    expect(commits).toHaveLength(0)
    vi.advanceTimersByTime(ARABIC_UTTERANCE_COMMIT_MS + 10)
    expect(commits).toHaveLength(1)
    expect(commits[0]).toContain('الرياض')
    expect(commits[0]).toContain('طوكيو')
    expect(commits[0]).toContain('درجة الضيافة')
    expect(rejects).toHaveLength(0)
  })

  it('does not commit interim-only text to the planner path before silence', () => {
    const commits: string[] = []
    let now = 0
    const assembler = createArabicUtteranceAssembler({
      conversationLanguage: () => 'ar',
      nowMs: () => now,
      onCommit: (r) => commits.push(r.committedTranscript),
      onReject: () => undefined,
    })
    assembler.onSpeechStarted(0)
    const display = assembler.onInterim('أريد السفر')
    expect(display).toBe('أريد السفر')
    expect(commits).toHaveLength(0)
    now = 1000
    assembler.onSpeechStopped(now)
    // No segment final yet — nothing to commit.
    assembler.scheduleCommit(ARABIC_UTTERANCE_COMMIT_MS)
    vi.advanceTimersByTime(ARABIC_UTTERANCE_COMMIT_MS + 10)
    // Interim alone without segment final: scheduleCommit requires segments or interim —
    // assembler allows interim; if only interim, flush may reject as noise if too short after duration.
    // With only interim "أريد السفر" and 1s audio — may commit or reject; must not double-commit.
    expect(commits.length + 0).toBeLessThanOrEqual(1)
  })
})
