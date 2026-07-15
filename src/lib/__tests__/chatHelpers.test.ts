import { describe, it, expect } from 'vitest'
import {
  filterConversations,
  findRetryTarget,
  parseInlineMarkdown,
  parseMarkdownBlocks,
  titleFromFirstMessage,
  validateConversationTitle,
  validateUserMessage,
} from '../chat/chatHelpers'
import type { ChatConversation, ChatMessage } from '../chat/chatTypes'

function conversation(partial: Partial<ChatConversation> & Pick<ChatConversation, 'id' | 'title'>): ChatConversation {
  return {
    modalityDefault: 'text',
    travelSessionId: null,
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...partial,
  }
}

function message(partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role' | 'content'>): ChatMessage {
  return {
    conversationId: 'c1',
    modality: 'text',
    audioUrl: null,
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...partial,
  }
}

describe('chatHelpers', () => {
  it('builds titles and validates inputs', () => {
    expect(titleFromFirstMessage('هذه رسالة طويلة جداً لاختبار قص عنوان المحادثة من أول رسالة للمستخدم في رحّال')).toContain('…')
    expect(validateConversationTitle('')).not.toBeNull()
    expect(validateConversationTitle('رحلة طوكيو')).toBeNull()
    expect(validateUserMessage('  ')).not.toBeNull()
    expect(validateUserMessage('خطة سفر')).toBeNull()
  })

  it('filters conversations by title', () => {
    const rows = [
      conversation({ id: '1', title: 'طوكيو' }),
      conversation({ id: '2', title: 'دبي' }),
    ]
    expect(filterConversations(rows, 'دبي')).toHaveLength(1)
    expect(filterConversations(rows, '')).toHaveLength(2)
  })

  it('finds retry target for assistant message', () => {
    const messages = [
      message({ id: 'u1', role: 'user', content: 'hi' }),
      message({ id: 'a1', role: 'assistant', content: 'hello' }),
    ]
    const target = findRetryTarget(messages, 'a1')
    expect(target?.user.id).toBe('u1')
    expect(findRetryTarget(messages, 'missing')).toBeNull()
  })

  it('parses markdown code fences and inline styles', () => {
    const blocks = parseMarkdownBlocks([
      '## عنوان',
      '',
      'نص **مهم** و`كود`',
      '',
      '```ts',
      'const x = 1',
      '```',
      '',
      '- واحد',
      '- اثنان',
    ].join('\n'))

    expect(blocks.some((b) => b.type === 'heading')).toBe(true)
    expect(blocks.some((b) => b.type === 'code' && b.language === 'ts')).toBe(true)
    expect(blocks.some((b) => b.type === 'list' && b.items.length === 2)).toBe(true)

    const inline = parseInlineMarkdown('Hello **world** and `x`')
    expect(inline.some((t) => t.type === 'bold' && t.value === 'world')).toBe(true)
    expect(inline.some((t) => t.type === 'code' && t.value === 'x')).toBe(true)
  })
})
