import { createTravelAgentService } from '../src/lib/agent/travelAgentService.impl.ts'
import { createAgentLlmRegistry } from '../src/lib/agent/llm/factory.ts'
import type { ChatMessage } from '../src/lib/chat/chatTypes.ts'

async function main() {
  const service = createTravelAgentService({ llms: createAgentLlmRegistry('local') })
  const conversationId = 'verify-morocco'
  const messages: ChatMessage[] = [{
    id: 'u1',
    conversationId,
    role: 'user',
    modality: 'text',
    content: 'أريد السفر إلى المغرب لمدة أسبوع مع زوجتي بميزانية عشرة آلاف ريال',
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }]
  const turn = await service.planTurn({ conversationId, messages })
  console.log('---REPLY---')
  console.log(turn.reply)
  console.log('---SPOKEN---')
  console.log(turn.providerMeta?.spokenText)
  const blob = `${turn.reply}\n${String(turn.providerMeta?.spokenText || '')}`
  console.log('eng?', /Morocco|SAR|Mock|USD|Hotel|Old Town|Marrakech|Agadir/i.test(blob))
  console.log('dest', turn.memory?.requirements?.destination)
  console.log('objective-ish', turn.providerMeta?.kind)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
