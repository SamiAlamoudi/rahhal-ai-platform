/**
 * Airline-style age rules relative to departure date.
 * Adult ≥ 12, Child 2–11, Infant < 2 (IATA common practice).
 */

import type { PassengerType } from './types'

export const ADULT_MIN_AGE = 12
export const CHILD_MIN_AGE = 2
export const CHILD_MAX_AGE = 11
export const INFANT_MAX_AGE = 1

export function parseIsoDate(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null
  const d = new Date(`${value.slice(0, 10)}T12:00:00.000Z`)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Whole years completed on `onDate` (UTC noon basis). */
export function ageOnDate(dateOfBirth: string, onDate: string): number | null {
  const birth = parseIsoDate(dateOfBirth)
  const ref = parseIsoDate(onDate)
  if (!birth || !ref || birth.getTime() > ref.getTime()) return null
  let age = ref.getUTCFullYear() - birth.getUTCFullYear()
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
    age -= 1
  }
  return age
}

export function expectedTypeForAge(age: number): PassengerType {
  if (age < CHILD_MIN_AGE) return 'infant'
  if (age <= CHILD_MAX_AGE) return 'child'
  return 'adult'
}

export function isAgeValidForType(
  type: PassengerType,
  dateOfBirth: string,
  departureDate: string,
): { ok: boolean; age: number | null; expected: PassengerType | null } {
  const age = ageOnDate(dateOfBirth, departureDate)
  if (age == null) return { ok: false, age: null, expected: null }
  const expected = expectedTypeForAge(age)
  return { ok: expected === type, age, expected }
}

export function ageRuleMessage(
  locale: 'ar' | 'en',
  type: PassengerType,
  age: number | null,
  expected: PassengerType | null,
): string {
  if (locale === 'ar') {
    if (age == null) return 'تاريخ الميلاد غير صالح بالنسبة لتاريخ المغادرة.'
    if (expected && expected !== type) {
      return `العمر ${age} سنة لا يطابق نوع المسافر (${labelAr(type)}). المتوقع: ${labelAr(expected)}.`
    }
    return 'تحقق من عمر المسافر وفق قواعد البالغ/الطفل/الرضيع.'
  }
  if (age == null) return 'Date of birth is invalid relative to the departure date.'
  if (expected && expected !== type) {
    return `Age ${age} does not match passenger type (${type}). Expected: ${expected}.`
  }
  return 'Check passenger age against adult/child/infant rules.'
}

function labelAr(type: PassengerType): string {
  if (type === 'adult') return 'بالغ'
  if (type === 'child') return 'طفل'
  return 'رضيع'
}
