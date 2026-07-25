/**
 * Integration Sprint 9 — Budget & Pricing Intelligence barrel.
 * Feature-gated by `ai.integration_budget_pricing` (default OFF).
 */

export { INTEGRATION_BUDGET_PRICING_VERSION } from './types'
export type {
  BudgetEnvelope,
  BudgetPricingIntent,
  BudgetPricingResult,
  BudgetTier,
  BudgetTradeoff,
  CostBreakdown,
  CostMemorySnapshot,
  CurrencyAmount,
  FlexibleAlternative,
  FlexibleAlternativeKind,
  OptimizedBudgetOption,
} from './types'

export {
  INTEGRATION_BUDGET_PRICING_FEATURE_ID,
  isIntegrationBudgetPricingEnabled,
} from './feature'

export { BudgetEngine, createBudgetEngine } from './budgetEngine'
export { buildCostBreakdown, type OfferPriceHints } from './breakdown'
export { buildBudgetTradeoffs } from './tradeoffs'
export { optimizeBudgetOptions } from './optimizer'
export { buildFlexibleAlternatives } from './flexible'
export {
  learnCostMemory,
  readCostMemory,
  resetCostMemoryForTests,
} from './costMemory'
export {
  detectBudgetPricingIntent,
  extractBudgetAmount,
  isBudgetPricingAsk,
} from './intents'
export { buildBudgetPricingSummary } from './consultant'
export { convertAmount, formatMoney, normalizeCurrency } from './currency'

export {
  runBudgetPricing,
  type BudgetPricingDeps,
  type RunBudgetPricingInput,
} from './engine'

export {
  enrichWithIntegrationBudgetPricing,
  shouldRunBudgetPricing,
  toBudgetPricingMeta,
} from './enrich'
