import type { ChatProvider, ChatStreamChunk, ChatCompletionRequest } from './chatTypes'

function inferDemoDestination(userText: string): string {
  const lower = userText.toLowerCase()
  if (/morocco|المغرب|مراكش|marrakech/i.test(lower)) return 'Morocco'
  if (/japan|tokyo|اليابان|طوكيو/i.test(lower)) return 'Japan'
  if (/paris|باريس|france|فرنسا/i.test(lower)) return 'Paris'
  if (/london|لندن/i.test(lower)) return 'London'
  if (/dubai|دبي/i.test(lower)) return 'Dubai'
  if (/istanbul|اسطنبول|إسطنبول|تركيا/i.test(lower)) return 'Istanbul'
  if (/cairo|القاهرة|مصر/i.test(lower)) return 'Cairo'
  if (/bali|بالي/i.test(lower)) return 'Bali'
  const toMatch = lower.match(/\b(?:to|in)\s+([a-z][a-z\s]{1,40})/)
    || userText.match(/(?:إلى|الى|في)\s+([^\s،,]{2,40})/)
  if (toMatch?.[1]) {
    const raw = toMatch[1].replace(/[?.!].*$/, '').trim()
    if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  return 'Your destination'
}

function buildMockReply(userText: string): string {
  const trimmed = userText.trim()
  const topic = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed || 'رحلتك'
  const destination = inferDemoDestination(trimmed)

  return [
    `## اقتراح رحّال`,
    ``,
    `فهمت طلبك حول **${topic}**.`,
    ``,
    `إليك خطة مختصرة:`,
    ``,
    `1. حدّد الميزانية والمدة`,
    `2. اختر مدن الدخول والخروج`,
    `3. قارن الطيران مع الإقامة`,
    ``,
    `> هذه استجابة تجريبية من المزوّد mock. الصوت سيُضاف لاحقاً على نفس خدمة المحادثة.`,
    ``,
    `مثال لمقتطف تنسيق يمكنك نسخه:`,
    ``,
    '```json',
    `{`,
    `  "destination": "${destination}",`,
    `  "nights": 5,`,
    `  "budgetCurrency": "SAR"`,
    `}`,
    '```',
    ``,
    `إذا رغبت، اسألني عن *الطيران* أو *الفنادق* أو *تأجير السيارات*.`,
  ].join('\n')
}

async function* streamText(
  text: string,
  signal: AbortSignal,
  chunkSize = 18,
  delayMs = 16,
): AsyncGenerator<ChatStreamChunk> {
  let index = 0
  while (index < text.length) {
    if (signal.aborted) {
      yield { type: 'error', error: 'cancelled' }
      return
    }
    const next = text.slice(index, index + chunkSize)
    index += chunkSize
    yield { type: 'delta', text: next }
    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delayMs)
        const onAbort = () => {
          clearTimeout(timer)
          resolve()
        }
        if (signal.aborted) {
          clearTimeout(timer)
          resolve()
          return
        }
        signal.addEventListener('abort', onAbort, { once: true })
      })
    }
  }
  if (signal.aborted) {
    yield { type: 'error', error: 'cancelled' }
    return
  }
  yield { type: 'done' }
}

export const mockChatProvider: ChatProvider = {
  providerId: 'mock',

  async *streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
    const reply = buildMockReply(lastUser?.content ?? '')
    yield* streamText(reply, input.signal)
  },
}

export function createDeterministicMockChatProvider(reply: string, delayMs = 0): ChatProvider {
  return {
    providerId: 'mock-deterministic',
    async *streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
      yield* streamText(reply, input.signal, 10, delayMs)
    },
  }
}
