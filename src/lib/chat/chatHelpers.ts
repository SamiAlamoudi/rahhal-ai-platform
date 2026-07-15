import type { ChatConversation, ChatMessage } from './chatTypes'

export function buildDefaultConversationTitle(index = 1): string {
  return `محادثة ${index}`
}

export function titleFromFirstMessage(content: string, fallback = 'محادثة جديدة'): string {
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (!trimmed) return fallback
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed
}

export function filterConversations(
  conversations: ChatConversation[],
  query: string,
): ChatConversation[] {
  const q = query.trim().toLowerCase()
  if (!q) return conversations
  return conversations.filter((c) => c.title.toLowerCase().includes(q))
}

export function validateConversationTitle(title: string): string | null {
  const trimmed = title.trim()
  if (!trimmed) return 'عنوان المحادثة مطلوب'
  if (trimmed.length > 80) return 'العنوان طويل جداً'
  return null
}

export function validateUserMessage(content: string): string | null {
  if (!content.trim()) return 'اكتب رسالة أولاً'
  if (content.length > 8000) return 'الرسالة طويلة جداً'
  return null
}

export function findLastUserMessage(messages: ChatMessage[]): ChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i]
  }
  return null
}

export function findRetryTarget(
  messages: ChatMessage[],
  assistantMessageId: string,
): { assistant: ChatMessage; user: ChatMessage } | null {
  const assistantIndex = messages.findIndex((m) => m.id === assistantMessageId)
  if (assistantIndex < 0) return null
  const assistant = messages[assistantIndex]
  if (assistant.role !== 'assistant') return null
  for (let i = assistantIndex - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return { assistant, user: messages[i] }
    }
  }
  return null
}

/** Lightweight markdown → safe HTML segments for rendering (no external deps). */
export type MarkdownBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'blockquote'; text: string }

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const source = markdown.replace(/\r\n/g, '\n')
  const blocks: MarkdownBlock[] = []
  const lines = source.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push({ type: 'code', language, code: codeLines.join('\n') })
      continue
    }

    if (/^#{1,3}\s+/.test(line)) {
      const match = line.match(/^(#{1,3})\s+(.*)$/)
      if (match) {
        const level = match[1].length as 1 | 2 | 3
        blocks.push({ type: 'heading', level, text: match[2].trim() })
      }
      i += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ type: 'blockquote', text: quote.join('\n') })
      continue
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items: string[] = []
      while (
        i < lines.length
        && (ordered ? /^\s*\d+\.\s+/.test(lines[i]) : /^\s*[-*]\s+/.test(lines[i]))
      ) {
        items.push(lines[i].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    if (!line.trim()) {
      i += 1
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim()
      && !lines[i].trim().startsWith('```')
      && !/^#{1,3}\s+/.test(lines[i])
      && !/^>\s?/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i])
      && !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') })
  }

  return blocks
}

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }

export function parseInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    if (raw.startsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) })
    } else if (raw.startsWith('**')) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) })
    } else {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) })
    }
    lastIndex = match.index + raw.length
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) })
  }
  if (tokens.length === 0) tokens.push({ type: 'text', value: text })
  return tokens
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  return false
}
