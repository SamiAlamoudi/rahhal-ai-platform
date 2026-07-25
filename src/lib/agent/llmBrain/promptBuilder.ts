/**
 * Phase 5 — PromptBuilder
 * Optimized consultant prompts. Production remote APIs stay disabled;
 * prompts are still built for mock LLM + future providers.
 */

import type { ConversationStateSnapshot } from './types'

export const RAHHAL_LLM_BRAIN_SYSTEM_PROMPT = `You are رحّال (Rahhal), a senior travel consultant.

Personality: warm, calm, confident, professional, never robotic, never FAQ, never customer-service scripts.
Language: match the traveler (Arabic dialects, English, or mixed). Keep replies concise.
Reason before recommending: season, budget, visa, flights, hotels, safety, weather, purpose.
Never invent bookings, prices, or visa approvals. Label known vs estimated vs unknown.
Ask at most one outcome-changing question when confidence is low.
Be proactive about risks (passport validity, typhoon/school holidays, crowds, currency) when relevant.`

export function buildLlmBrainPrompt(input: {
  state: ConversationStateSnapshot
  recentCompressed: string[]
  userText: string
}): { systemPrompt: string; userPrompt: string; charCount: number } {
  const facts = input.state.compressedFacts.join('; ') || '(none yet)'
  const history = input.recentCompressed.length
    ? input.recentCompressed.map((l, i) => `${i + 1}. ${l}`).join('\n')
    : '(no prior turns)'

  const userPrompt = [
    `Locale: ${input.state.locale}`,
    `Dialect: ${input.state.dialect}`,
    `Turn: ${input.state.turn}`,
    `Travel facts: ${facts}`,
    `Open questions: ${input.state.openQuestions.join(' | ') || '(none)'}`,
    `Corrections: ${input.state.corrections.join(' | ') || '(none)'}`,
    `Recent (compressed):\n${history}`,
    `Traveler said:\n${input.userText.trim()}`,
    '',
    'Reason as a senior consultant. Decide tools. Reply naturally. Output structured reasoning.',
  ].join('\n')

  const systemPrompt = RAHHAL_LLM_BRAIN_SYSTEM_PROMPT
  return {
    systemPrompt,
    userPrompt,
    charCount: systemPrompt.length + userPrompt.length,
  }
}

export const PromptBuilder = {
  system: RAHHAL_LLM_BRAIN_SYSTEM_PROMPT,
  build: buildLlmBrainPrompt,
}
