import { describe, expect, it } from 'vitest'
import {
  RECOVERY_CHAT_UI,
  RECOVERY_CONVERSATION,
  RECOVERY_TURN_OWNER,
} from '../lib/recovery/freeze'
import {
  PRODUCT_CONVERSATION,
  PRODUCT_CONVERSATION_UI,
  PRODUCT_TURN_OWNER,
} from './productBrain'

describe('production Brain UI migration', () => {
  it('has a single conversation owner: TravelBrain', () => {
    expect(RECOVERY_TURN_OWNER).toBe('TravelBrain.processTurn')
    expect(PRODUCT_TURN_OWNER).toBe(RECOVERY_TURN_OWNER)
    expect(RECOVERY_CHAT_UI).toBe('BrainChatPage')
    expect(PRODUCT_CONVERSATION_UI).toBe(RECOVERY_CHAT_UI)
    expect(RECOVERY_CONVERSATION).toBe(PRODUCT_CONVERSATION)
    expect(RECOVERY_TURN_OWNER).not.toContain('planTurn')
    expect(RECOVERY_CHAT_UI).not.toBe('LegacyChatPage')
  })
})
