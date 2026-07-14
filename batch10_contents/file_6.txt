import { describe, it, expect } from 'vitest'
import { generateReasoning } from '../reasoningEngine'
import { buildFullReport, scoreToStars, formatStars } from '../reportFormatter'
import { orchestrateMockSearch, MOCK_PROVIDERS } from '../searchOrchestrator'
import { buildTravelSearchRequest } from '../travelSearchRequest'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  confirmDecisionProfile,
} from '../travelSession'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

function makeRequest() {
  let s = mergeTravelSession(createEmptyTravelSession(), MSG1)
  s = mergeTravelSession(s, 'من الرياض')
  s = mergeTravelSession(s, '15 أكتوبر')
  s = confirmDecisionProfile(s)
  return buildTravelSearchRequest(s)
}

describe('Scenario 9: Reasoning and recommendation', () => {
  it('generates reasoning using scoring data only (no external facts)', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    const top = result.rankedOptions[0]
    const reasoning = generateReasoning(top, req)

    expect(reasoning.optionId).toBe(top.id)
    expect(reasoning.weightedAverage).toBe(top.decisionScore?.weightedAverage ?? 0)
    expect(reasoning.confidence).toBe(top.decisionScore?.confidence ?? 0)
  })

  it('returns Arabic-ready output keys and params for recommendation summary', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    const top = result.rankedOptions[0]
    const reasoning = generateReasoning(top, req)

    expect(reasoning.recommendationSummary.length).toBeGreaterThan(0)
    for (const item of reasoning.recommendationSummary) {
      expect(item.key).toContain('.')
      expect(typeof item.params).toBe('object')
    }
  })

  it('stronger option receives stronger recommendation than weaker option', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    const top = result.rankedOptions[0]
    const bottom = result.rankedOptions[result.rankedOptions.length - 1]

    const topReasoning = generateReasoning(top, req)
    const bottomReasoning = generateReasoning(bottom, req)

    const levelOrder = { 'excellent': 4, 'recommended': 3, 'acceptable': 2, 'not-recommended': 1 }
    expect(levelOrder[topReasoning.recommendation]).toBeGreaterThanOrEqual(
      levelOrder[bottomReasoning.recommendation],
    )
  })

  it('does not produce unsupported facts — every reasoning item has a known key', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    const top = result.rankedOptions[0]
    const reasoning = generateReasoning(top, req)

    const allSections = [
      ...reasoning.strengths.items,
      ...reasoning.weaknesses.items,
      ...reasoning.riskWarnings.items,
      ...reasoning.recommendationSummary,
    ]
    for (const item of allSections) {
      expect(item.key.split('.').length).toBeGreaterThanOrEqual(2)
    }
  })

  it('buildFullReport produces OptionReport with valid Arabic labels', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    const reasoningMap = new Map()
    for (const opt of result.rankedOptions) {
      reasoningMap.set(opt.id, generateReasoning(opt, req))
    }
    const reports = buildFullReport(result.rankedOptions, reasoningMap)
    expect(reports.length).toBeGreaterThan(0)
    for (const report of reports) {
      expect(report.optionId).toBeTruthy()
      expect(report.overallScore).toBeGreaterThanOrEqual(0)
      expect(report.overallScore).toBeLessThanOrEqual(100)
      expect(report.recommendationLabel.length).toBeGreaterThan(0)
      expect(report.whyRahhalRecommends.length).toBeGreaterThan(0)
    }
  })

  it('scoreToStars and formatStars return correct Arabic labels', () => {
    expect(scoreToStars(92).label).toBe('ممتاز')
    expect(scoreToStars(84).label).toBe('جيد جداً')
    expect(scoreToStars(76).label).toBe('جيد جداً')
    expect(scoreToStars(68).label).toBe('جيد')

    const formatted = formatStars(scoreToStars(92))
    expect(formatted.label).toBe('ممتاز')
    expect(formatted.visual).toContain('★')
  })
})
