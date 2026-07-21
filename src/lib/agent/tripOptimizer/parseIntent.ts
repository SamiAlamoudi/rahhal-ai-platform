/**
 * Sprint 77 — detect optimization priorities from natural conversation.
 */

import type { OptimizationPriority } from './types'

export interface ParsedOptimizerIntent {
  priority: OptimizationPriority
  cues: string[]
  earlyMeeting: boolean
  hasChildren: boolean
  minWalking: boolean
  willingToPayMore: boolean
}

export function parseOptimizerIntent(text: string | null | undefined): ParsedOptimizerIntent {
  const lower = (text ?? '').toLowerCase()
  const cues: string[] = []
  let priority: OptimizationPriority = 'balanced'
  let earlyMeeting = false
  let hasChildren = false
  let minWalking = false
  let willingToPayMore = false

  if (/\bmost\s+comfortable\b|\bcomfort(?:able)?\b|راحة|مريح/.test(lower)) {
    priority = 'comfort'
    cues.push('comfort')
  }
  if (/\bconvenience\b|\bconvenient\b|\beasy\b|سهولة|مريح\s*للوصول/.test(lower)) {
    priority = 'convenience'
    cues.push('convenience')
  }
  if (/\bdon'?t\s+mind\s+paying\s+more\b|\bwilling\s+to\s+pay\b|\bprice\s+no\s+object\b|لا\s*مانع\s*من\s*دفع/.test(lower)) {
    willingToPayMore = true
    cues.push('willing_to_pay_more')
    if (priority === 'balanced') priority = 'luxury'
  }
  if (/\bminimum\s+walking\b|\bmin(?:imum)?\s+walk\b|\bless\s+walking\b|أقل\s*مشي|مشي\s*قليل/.test(lower)) {
    minWalking = true
    cues.push('min_walking')
    if (priority === 'balanced') priority = 'convenience'
  }
  if (/\bchildren\b|\bkids\b|\bfamily\b|أطفال|عائلة|عائلي/.test(lower)) {
    hasChildren = true
    cues.push('family')
    priority = 'family'
  }
  if (/\bearly\s+meeting\b|\bmorning\s+meeting\b|\bbusiness\s+meeting\b|اجتماع\s*مبكر|اجتماع\s*عمل/.test(lower)) {
    earlyMeeting = true
    cues.push('early_meeting')
    priority = 'business'
  }
  if (/\bluxury\b|\bpremium\b|فاخر/.test(lower) && !/\bbudget\b/.test(lower)) {
    cues.push('luxury')
    if (priority === 'balanced' || willingToPayMore) priority = 'luxury'
  }
  if (/\bbusiness\b|سفر\s*عمل|رحلة\s*عمل/.test(lower) && !hasChildren) {
    cues.push('business')
    if (priority === 'balanced') priority = 'business'
  }
  if (/\bcheapest\b|\bbudget\b|\bsave\s+money\b|أرخص|ميزانية\s*محدودة/.test(lower) && !willingToPayMore) {
    cues.push('budget')
    priority = 'budget'
  }
  if (/\bfastest\b|\bquick(?:est)?\b|\bshortest\b|أسرع/.test(lower)) {
    cues.push('speed')
    priority = 'speed'
  }
  if (/\bbest\s+value\b|\bvalue\s+for\s+money\b|أفضل\s*قيمة/.test(lower)) {
    cues.push('value')
    priority = 'value'
  }

  return { priority, cues, earlyMeeting, hasChildren, minWalking, willingToPayMore }
}
