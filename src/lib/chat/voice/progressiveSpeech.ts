/**
 * Progressive speech helpers — retained for analysis / optional future use.
 * Production voiceSession speaks each assistant reply exactly ONCE (final text).
 * Mid-stream chunk TTS caused duplicate intonation and stitched playback.
 */

/** Split complete sentences; trailing incomplete fragment is left in `rest`. */
export function splitSpokenSentences(text: string): { ready: string[]; rest: string } {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return { ready: [], rest: '' }

  const ready: string[] = []
  let rest = cleaned
  const re = /(.+?[.!?؟。！]+)\s*/
  while (rest.length > 0) {
    const m = rest.match(re)
    if (!m || m.index !== 0) break
    const sentence = m[1]!.trim()
    if (sentence) ready.push(sentence)
    rest = rest.slice(m[0].length).trim()
  }
  return { ready, rest }
}

/**
 * Return newly speakable text since `alreadySpokenChars`.
 * Mid-stream: join all newly completed sentences into ONE continuous chunk
 * so TTS does not restart between every period (ChatGPT-like continuity).
 */
export function takeNewSpokenChunks(
  fullSpoken: string,
  alreadySpokenChars: number,
): { chunks: string[]; nextCursor: number } {
  const full = (fullSpoken || '').replace(/\s+/g, ' ').trim()
  if (!full || alreadySpokenChars >= full.length) {
    return { chunks: [], nextCursor: alreadySpokenChars }
  }

  const { ready, rest } = splitSpokenSentences(full)
  let consumed = 0
  const newlyReady: string[] = []
  for (const sentence of ready) {
    const end = full.indexOf(sentence, consumed)
    if (end < 0) continue
    const after = end + sentence.length
    if (after <= alreadySpokenChars) {
      consumed = after
      continue
    }
    newlyReady.push(sentence)
    consumed = after
  }

  // Fast first audio: natural clause before punctuation arrives.
  if (newlyReady.length === 0 && alreadySpokenChars === 0) {
    const opener = full.slice(0, Math.min(full.length, 88)).trim()
    const breakAt = opener.search(/[،,;:]\s/)
    if (breakAt >= 12) {
      const piece = opener.slice(0, breakAt + 1).trim()
      if (piece.length >= 12) {
        return { chunks: [piece], nextCursor: full.indexOf(piece) + piece.length }
      }
    }
    // Soft start ~28 chars on a word boundary (Arabic often delays punctuation).
    if (opener.length >= 28) {
      const soft = opener.slice(0, 44)
      const space = soft.lastIndexOf(' ')
      const piece = (space >= 16 ? soft.slice(0, space) : soft).trim()
      if (piece.length >= 16) {
        return { chunks: [piece], nextCursor: full.indexOf(piece) + piece.length }
      }
    }
  }

  // Mid-stream clause breath (only after first audio has started).
  if (newlyReady.length === 0 && alreadySpokenChars > 0) {
    const pending = full.slice(alreadySpokenChars).trim()
    const breakAt = pending.search(/[،,;:]\s/)
    if (breakAt >= 22 && pending.length >= 48) {
      const piece = pending.slice(0, breakAt + 1).trim()
      if (piece.length >= 22) {
        return {
          chunks: [piece],
          nextCursor: alreadySpokenChars + pending.indexOf(piece) + piece.length,
        }
      }
    }
  }

  if (newlyReady.length === 0) {
    return { chunks: [], nextCursor: alreadySpokenChars }
  }

  // Join into one continuous utterance — one Edge synth = one natural breath group.
  const joined = newlyReady.join(' ').replace(/\s+/g, ' ').trim()
  const last = newlyReady[newlyReady.length - 1]!
  const idx = full.lastIndexOf(last)
  const nextCursor = idx >= 0 ? idx + last.length : full.length - rest.length
  return {
    chunks: joined ? [joined] : [],
    nextCursor: Math.max(nextCursor, alreadySpokenChars),
  }
}

/** Flush any unspoken tail at end of turn. */
export function takeSpokenTail(fullSpoken: string, alreadySpokenChars: number): string {
  const full = (fullSpoken || '').replace(/\s+/g, ' ').trim()
  if (!full || alreadySpokenChars >= full.length) return ''
  return full.slice(alreadySpokenChars).trim()
}
