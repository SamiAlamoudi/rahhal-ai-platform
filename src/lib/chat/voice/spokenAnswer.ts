/**
 * Extract natural-language speech from an assistant reply.
 * Strips cards, URLs, prices tables, UI chrome — keep a short spoken answer.
 */

const MAX_SPOKEN_CHARS = 360

export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\(([^)]+)\)/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\bSAR\b|\bUSD\b|\bEUR\b/gi, ' ')
    .replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Prefer providerMeta.spokenText; otherwise a cleaned, truncated answer.
 */
export function extractSpokenAnswer(input: {
  content: string
  spokenText?: string | null
}): string {
  const meta = typeof input.spokenText === 'string' ? input.spokenText.trim() : ''
  if (meta) return meta.slice(0, MAX_SPOKEN_CHARS)
  return stripMarkdownForSpeech(input.content).slice(0, MAX_SPOKEN_CHARS)
}
