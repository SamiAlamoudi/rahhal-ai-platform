/**
 * Sprint 32 — ConversationRenderer
 * Turns structured responses into user-facing markdown text.
 */

import type { ConversationStructuredResponse } from './types'

export class ConversationRenderer {
  render(structured: ConversationStructuredResponse, locale: 'ar' | 'en' = 'en'): string {
    if (structured.phase === 'clarifying' && structured.followUps[0]) {
      return structured.followUps[0].question
    }
    if (structured.phase === 'clarifying') {
      return structured.summary
    }

    const lines: string[] = []
    lines.push(locale === 'ar' ? '## الملخص' : '## Summary')
    lines.push(structured.summary)
    lines.push('')

    if (structured.flights.length) {
      lines.push(locale === 'ar' ? '## الرحلات' : '## Flights')
      for (const flight of structured.flights.slice(0, 3)) {
        lines.push(
          `- **${flight.airline}** ${flight.from}→${flight.to} · ${flight.cabin} · ${flight.stops} stop(s) · ${flight.price} ${flight.currency}`,
        )
      }
      lines.push('')
    }

    if (structured.hotels.length) {
      lines.push(locale === 'ar' ? '## الفنادق' : '## Hotels')
      for (const hotel of structured.hotels.slice(0, 3)) {
        lines.push(
          `- **${hotel.name}** · ${hotel.stars}★ · ${hotel.area} · ${hotel.nightly} ${hotel.currency}/night`,
        )
      }
      lines.push('')
    }

    if (structured.dailyItinerary.length) {
      lines.push(locale === 'ar' ? '## الجدول اليومي' : '## Daily itinerary')
      for (const day of structured.dailyItinerary) {
        lines.push(`### ${locale === 'ar' ? 'اليوم' : 'Day'} ${day.day}: ${day.title}`)
        lines.push(day.summary)
        for (const item of day.items.slice(0, 4)) {
          lines.push(`- ${item}`)
        }
      }
      lines.push('')
    }

    if (structured.estimatedTotalCost) {
      const c = structured.estimatedTotalCost
      lines.push(locale === 'ar' ? '## التكلفة التقديرية' : '## Estimated total cost')
      lines.push(
        `**${c.total} ${c.currency}** `
        + `(flights ${c.flights} · hotels ${c.hotels} · other ${c.activities + c.transport + c.taxesAndFees})`,
      )
      if (c.withinBudget === true) {
        lines.push(locale === 'ar' ? 'ضمن الميزانية ✓' : 'Within budget ✓')
      } else if (c.withinBudget === false) {
        lines.push(locale === 'ar' ? 'فوق الميزانية' : 'Over budget')
      }
      lines.push('')
    }

    lines.push(locale === 'ar' ? '## مستوى الثقة' : '## Confidence score')
    lines.push(`${Math.round(structured.confidenceScore * 100)}%`)
    lines.push('')

    if (structured.reasoning.length) {
      lines.push(locale === 'ar' ? '## الأسباب' : '## Reasoning')
      for (const reason of structured.reasoning.slice(0, 5)) {
        lines.push(`- ${reason}`)
      }
      lines.push('')
    }

    if (structured.suggestedFollowUpActions.length) {
      lines.push(locale === 'ar' ? '## اقتراحات' : '## Suggested follow-up actions')
      for (const action of structured.suggestedFollowUpActions) {
        lines.push(`- ${action.label} _(e.g. “${action.commandHint}”)_`)
      }
    }

    return lines.join('\n').trim()
  }
}

export function createConversationRenderer(): ConversationRenderer {
  return new ConversationRenderer()
}
