import { describe, expect, it } from 'vitest'
import { TRAVEL_INTENT_IDS } from '../intent'
import { BRAIN_TOOLS, INTENT_TOOL_MAP, ToolRouter } from './index'

describe('ToolRouter', () => {
  it('maps every intent to a catalog tool without executing', () => {
    const router = new ToolRouter()
    for (const intent of TRAVEL_INTENT_IDS) {
      const route = router.route(intent)
      expect(BRAIN_TOOLS).toContain(route.toolId)
      expect(route.execute).toBe(false)
      expect(route.toolId).toBe(INTENT_TOOL_MAP[intent])
    }
  })
})
