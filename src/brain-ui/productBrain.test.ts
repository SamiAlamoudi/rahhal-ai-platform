import { describe, expect, it } from 'vitest'
import {
  getProductBrainController,
  PRODUCT_TURN_OWNER,
  resetProductBrainController,
} from './productBrain'

describe('productBrain singleton', () => {
  it('shares one controller and resets cleanly', async () => {
    resetProductBrainController()
    const a = getProductBrainController()
    const b = getProductBrainController()
    expect(a).toBe(b)
    expect(PRODUCT_TURN_OWNER).toBe('TravelBrain.processTurn')
    await a.start('prod-user', 'en')
    expect(a.getState().ready).toBe(true)
    resetProductBrainController()
    expect(getProductBrainController()).not.toBe(a)
  })
})
