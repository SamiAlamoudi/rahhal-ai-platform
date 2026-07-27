/**
 * Progressive speech helpers — ChatGPT-Voice style sentence queue.
 * Goal: first audio ASAP (<700ms path) and continuous speech while tokens arrive.
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
 *
 * Always returns *all* newly ready sentences (not just the first) so mid-stream
 * TTS continues while the LLM is still generating.
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

  // Fast first audio: speak a natural opener before punctuation arrives.
  if (chunks.length === 0 && alreadySpokenChars === 0) {
    const opener = full.slice(0, Math.min(full.length, 96)).trim()
    // Prefer clause break (، , ; :) once we have enough voiceable text.
    const breakAt = opener.search(/[،,;:]\s/)
    if (breakAt >= 14) {
      const piece = opener.slice(0, breakAt + 1).trim()
      if (piece.length >= 14) {
        return { chunks: [piece], nextCursor: full.indexOf(piece) + piece.length }
      }
    }
    // Otherwise, after ~36 chars of streaming, start on a word boundary.
    if (opener.length >= 36 && (rest.length > 0 || full.length >= 36)) {
      const soft = opener.slice(0, 48)
      const space = soft.lastIndexOf(' ')
      const piece = (space >= 20 ? soft.slice(0, space) : soft).trim()
      if (piece.length >= 20) {
        return { chunks: [piece], nextCursor: full.indexOf(piece) + piece.length }
      }
    }
  }

  // Mid-stream: if a long unfinished clause grew past the cursor, speak a breath chunk.
  if (chunks.length === 0 && alreadySpokenChars > 0 && !rest) {
    // full ended mid-sentence with no terminal punctuation yet — wait.
  } else if (chunks.length === 0 && alreadySpokenChars > 0) {
    const pending = full.slice(alreadySpokenChars).trim()
    const breakAt = pending.search(/[،,;:]\s/)
    if (breakAt >= 18 && pending.length >= 40) {
      const piece = pending.slice(0, breakAt + 1).trim()
      if (piece.length >= 18) {
        return {
          chunks: [piece],
          nextCursor: alreadySpokenChars + pending.indexOf(piece) + piece.length,
        }
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
