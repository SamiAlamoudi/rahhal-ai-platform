/**
 * Time-aware personalized greetings for AI Home.
 */

import type { AiHomeGreeting, HomeLocale } from './types'

export function resolveDayPart(date = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

export function buildAiHomeGreeting(input?: {
  displayName?: string | null
  returning?: boolean
  now?: Date
}): AiHomeGreeting {
  const part = resolveDayPart(input?.now)
  const name = input?.displayName?.trim() || null
  const returning = input?.returning ?? false

  const timeGreetingAr =
    part === 'morning' ? 'صباح الخير.'
    : part === 'afternoon' ? 'مساء النور.'
    : part === 'evening' ? 'مساء الخير.'
    : 'أهلاً بك.'

  const timeGreetingEn =
    part === 'morning' ? 'Good morning.'
    : part === 'afternoon' ? 'Good afternoon.'
    : part === 'evening' ? 'Good evening.'
    : 'Hello.'

  const welcomeAr = returning
    ? (name ? `مرحباً بعودتك، ${name}.` : 'مرحباً بعودتك.')
    : (name ? `أهلاً ${name}.` : 'أهلاً بك في بيلامو.')

  const welcomeEn = returning
    ? (name ? `Welcome back, ${name}.` : 'Welcome back.')
    : (name ? `Welcome, ${name}.` : 'Welcome to Bilamo.')

  return {
    timeGreetingAr,
    timeGreetingEn,
    welcomeAr,
    welcomeEn,
    questionAr: 'إلى أين تود السفر اليوم؟',
    questionEn: 'Where would you like to travel today?',
  }
}

export function formatGreetingLines(greeting: AiHomeGreeting, locale: HomeLocale): string[] {
  if (locale === 'ar') {
    return [greeting.timeGreetingAr, greeting.welcomeAr, greeting.questionAr]
  }
  return [greeting.timeGreetingEn, greeting.welcomeEn, greeting.questionEn]
}
