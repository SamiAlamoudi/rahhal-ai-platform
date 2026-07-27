/**
 * Progressive speech helpers — ChatGPT-Voice style sentence queue.
 */

/** Split complete sentences; trailing incomplete fragment is left in `rest`. */
export function splitSpokenSentences(text: string): { ready: string[]; rest: string } {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return { ready: [], rest: '' }

  const ready: string[] = []
  let rest = cleaned
  // Arabic / Latin sentence enders
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
 * Given growing spoken text and how much was already enqueued,
 * return newly completed sentences to speak and the new cursor.
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
  const chunks: string[] = []
  for (const sentence of ready) {
    const end = full.indexOf(sentence, consumed)
    if (end < 0) continue
    const after = end + sentence.length
    if (after <= alreadySpokenChars) {
      consumed = after
      continue
    }
    chunks.push(sentence)
    consumed = after
  }

  // Prefer speaking a long enough opener even without punctuation (fast first audio).
  if (chunks.length === 0 && alreadySpokenChars === 0) {
    const opener = full.slice(0, Math.min(full.length, 110)).trim()
    if (opener.length >= 24 && (rest.length === 0 || opener.length >= 60)) {
      // Only if we have a natural break or short complete reply.
      const breakAt = opener.search(/[،,;:]\s/)
      if (breakAt >= 20) {
        const piece = opener.slice(0, breakAt + 1).trim()
        return { chunks: [piece], nextCursor: full.indexOf(piece) + piece.length }
      }
    }
  }

  let nextCursor = alreadySpokenChars
  if (chunks.length > 0) {
    const last = chunks[chunks.length - 1]!
    const idx = full.lastIndexOf(last)
    nextCursor = idx >= 0 ? idx + last.length : full.length - rest.length
  }
  return { chunks, nextCursor: Math.max(nextCursor, alreadySpokenChars) }
}

/** Flush any unspoken tail at end of turn. */
export function takeSpokenTail(fullSpoken: string, alreadySpokenChars: number): string {
  const full = (fullSpoken || '').replace(/\s+/g, ' ').trim()
  if (!full || alreadySpokenChars >= full.length) return ''
  return full.slice(alreadySpokenChars).trim()
}
