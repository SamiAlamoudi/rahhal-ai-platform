/**
 * RC-3 — wire travelAgentService.impl call sites to deferredLoaders.
 */
import fs from 'node:fs'

const path = 'src/lib/agent/travelAgentService.impl.ts'
let text = fs.readFileSync(path, 'utf8')

// Inline tiny goal extraction (avoid pulling autonomous into sync helper)
text = text.replace(
  `    const goal = goalFromMeta(meta)
    if (!meta.autonomous && !goal) continue`,
  `    const goal = meta.autonomous?.goal && typeof meta.autonomous.goal === 'object'
      ? meta.autonomous.goal
      : null
    if (!meta.autonomous && !goal) continue`,
)

text = text.replace(
  `const listBookingRecords = options.listBookingRecords
    ?? (async () => loadUserBookingRecords())`,
  `const listBookingRecords = options.listBookingRecords
    ?? (async () => {
      const { loadUserBookingRecords } = await loadBooking()
      return loadUserBookingRecords()
    })`,
)

function wrapAwaitLoad(loader, names, source) {
  let out = source
  for (const name of names) {
    const reAwait = new RegExp(
      `(\\n\\s*)(const|let) ([^=\\n]+) = await ${name}\\(`,
      'g',
    )
    out = out.replace(reAwait, (_, indent, kw, assign) => {
      return `${indent}const __mod_${name} = await ${loader}()\n${indent}${kw} ${assign} = await __mod_${name}.${name}(`
    })
    const reSync = new RegExp(
      `(\\n\\s*)(const|let) ([^=\\n]+) = ${name}\\(`,
      'g',
    )
    out = out.replace(reSync, (_, indent, kw, assign) => {
      return `${indent}const __mod_${name} = await ${loader}()\n${indent}${kw} ${assign} = __mod_${name}.${name}(`
    })
    const reAssign = new RegExp(
      `(\\n\\s*)([A-Za-z0-9_]+) = await ${name}\\(`,
      'g',
    )
    out = out.replace(reAssign, (_, indent, assign) => {
      return `${indent}const __mod_${name} = await ${loader}()\n${indent}${assign} = await __mod_${name}.${name}(`
    })
    const reAssignSync = new RegExp(
      `(\\n\\s*)([A-Za-z0-9_]+) = ${name}\\(`,
      'g',
    )
    out = out.replace(reAssignSync, (_, indent, assign) => {
      return `${indent}const __mod_${name} = await ${loader}()\n${indent}${assign} = __mod_${name}.${name}(`
    })
  }
  return out
}

const groups = [
  ['loadTravelPlanner', ['runTravelPlanner']],
  ['loadBudgetIntelligence', ['enrichWithBudgetIntelligence']],
  ['loadTravelerPersonalization', ['enrichWithTravelerPersonalization', 'runTravelerPersonalization']],
  ['loadTripOptimizer', ['enrichWithTripOptimizer']],
  ['loadAdaptiveLearning', ['getLearnedProfile', 'runAdaptiveLearningTurn']],
  ['loadPackageBuilder', ['enrichWithDynamicPackages']],
  ['loadItineraryRefinement', ['enrichWithItineraryRefinement']],
  ['loadAutonomousDecision', ['enrichWithAutonomousDecision']],
  ['loadPriceIntelligence', ['enrichWithPriceIntelligence']],
  ['loadBookingIntelligence', ['enrichWithBookingIntelligence']],
  ['loadBookingExecution', [
    'enrichWithBookingExecution',
    'shouldRunBookingExecution',
    'findLatestConfirmedBookingExecution',
  ]],
  ['loadPaymentsPlatform', [
    'enrichWithPaymentsPlatform',
    'shouldRunPayments',
    'shouldShowPaymentSummary',
    'findLatestPaymentsResult',
  ]],
  ['loadAutonomous', ['runAutonomousTurn', 'upsertTravelGoal']],
  ['loadBrainCore', ['runRahhalBrainTurn']],
  ['loadReasoning', [
    'seedRequirementsFromPreferences',
    'matchDestinationSelection',
    'runTravelReasoning',
    'applyReasoningToRequirements',
    'toReasoningSnapshot',
    'learnPreferencesFromRequirements',
  ]],
  ['loadSmartItinerary', ['buildSmartItineraryConciergeReply']],
  ['loadOrderManagement', ['buildOrderConciergeReply', 'findManagedOrderBySessionId']],
  ['loadBookingConfirmation', [
    'buildConfirmationConciergeReply',
    'confirmationStateFromSession',
  ]],
  ['loadBooking', [
    'findLatestBookingRecord',
    'getBookingOrchestrator',
    'buildBookingHistoryConciergeReply',
  ]],
  ['loadConciergeRecommendations', ['buildConciergeRecommendations']],
  ['loadConciergeMeta', ['rebuildConciergeStateFromMessages']],
  ['loadConciergeIntegration', ['integrateConciergeIntoTurn']],
  ['loadAlphaExperience', ['assembleAlphaTravelerExperience']],
  ['loadBookingAssistant', ['assembleBookingAssistant']],
  ['loadConstitution', ['applyConstitutionToTurn']],
]

for (const [loader, names] of groups) {
  text = wrapAwaitLoad(loader, names, text)
}

text = text.replace(
  /(\n\s*)\? runTravelPlanner\(/g,
  '$1? (await loadTravelPlanner()).runTravelPlanner(',
)

// shouldRun* used in boolean expressions — handle common patterns
text = text.replace(
  /(\n\s*)const payCue = shouldRunPayments\(/g,
  '$1const __mod_shouldRunPayments = await loadPaymentsPlatform()\n$1const payCue = __mod_shouldRunPayments.shouldRunPayments(',
)
text = text.replace(
  /(\n\s*)const summaryCue = shouldShowPaymentSummary\(/g,
  '$1const __mod_shouldShowPaymentSummary = await loadPaymentsPlatform()\n$1const summaryCue = __mod_shouldShowPaymentSummary.shouldShowPaymentSummary(',
)
text = text.replace(
  /(\n\s*)const alphaBookingCue = shouldRunBookingExecution\(/g,
  '$1const __mod_shouldRunBookingExecution = await loadBookingExecution()\n$1const alphaBookingCue = __mod_shouldRunBookingExecution.shouldRunBookingExecution(',
)
text = text.replace(
  /(\n\s*)const alphaPaymentCue = shouldRunPayments\(/g,
  '$1const __mod_alphaPay = await loadPaymentsPlatform()\n$1const alphaPaymentCue = __mod_alphaPay.shouldRunPayments(',
)
text = text.replace(
  /(\n\s*)const alphaSummaryCue = shouldShowPaymentSummary\(/g,
  '$1const __mod_alphaSum = await loadPaymentsPlatform()\n$1const alphaSummaryCue = __mod_alphaSum.shouldShowPaymentSummary(',
)

// Boolean || chains with shouldRun*
text = text.replace(
  /shouldRunBookingExecution\(\{/g,
  '(await loadBookingExecution()).shouldRunBookingExecution({',
)
text = text.replace(
  /shouldRunPayments\(\{/g,
  '(await loadPaymentsPlatform()).shouldRunPayments({',
)
text = text.replace(
  /shouldShowPaymentSummary\(/g,
  '(await loadPaymentsPlatform()).shouldShowPaymentSummary(',
)

// getLearnedProfile ternary
text = text.replace(
  /\? getLearnedProfile\(/g,
  '? (await loadAdaptiveLearning()).getLearnedProfile(',
)

// tools executor
if (!text.includes('const { executor: toolExecutor } = await ensureTools()')) {
  text = text.replace(
    'const selected = selectToolsForTurn({',
    `const { executor: toolExecutor } = await ensureTools()
    const selected = selectToolsForTurn({`,
  )
}
text = text.replace(
  'const batch = await executor.execute({',
  'const batch = await toolExecutor.execute({',
)

// planTurn bootstrap for llms/concierge
if (!text.includes('const llms = await ensureLlms()')) {
  text = text.replace(
    'async planTurn(input) {',
    `async planTurn(input) {
      const llms = await ensureLlms()
      await ensureConcierge()`,
  )
}

// learnPreferencesFromRequirements as bare statement
text = text.replace(
  /(\n\s*)learnPreferencesFromRequirements\(/g,
  '$1(await loadReasoning()).learnPreferencesFromRequirements(',
)

fs.writeFileSync(path, text)
console.log('wired deferred loaders into', path)
