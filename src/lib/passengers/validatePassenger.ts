/**
 * Passenger field + party validation with friendly ar/en messages.
 */

import { isValidCountryCode, normalizeCountryCode } from './countries'
import {
  ageRuleMessage,
  isAgeValidForType,
  parseIsoDate,
} from './ageRules'
import type {
  Passenger,
  PassengerFieldError,
  PassengerValidationResult,
  TravellerCounts,
} from './types'
import { PASSENGER_GENDERS, PASSENGER_TITLES } from './types'

export interface ValidatePassengerOptions {
  locale?: 'ar' | 'en'
  /** YYYY-MM-DD departure used for age + passport expiry. */
  departureDate: string
  /** Require email/phone on primary adult only when true (default: every adult). */
  requireContactOnEveryAdult?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** E.164-ish: optional +, 8–15 digits */
const PHONE_RE = /^\+?[0-9\s()-]{8,20}$/

function msg(
  locale: 'ar' | 'en',
  ar: string,
  en: string,
): string {
  return locale === 'ar' ? ar : en
}

function push(
  errors: PassengerFieldError[],
  field: PassengerFieldError['field'],
  message: string,
): void {
  errors.push({ field, message })
}

export function validatePassenger(
  passenger: Passenger,
  options: ValidatePassengerOptions,
): PassengerValidationResult {
  const locale = options.locale ?? 'en'
  const errors: PassengerFieldError[] = []
  const requireContact = options.requireContactOnEveryAdult !== false

  if (!PASSENGER_TITLES.includes(passenger.title as (typeof PASSENGER_TITLES)[number])) {
    push(errors, 'title', msg(locale, 'يرجى اختيار اللقب.', 'Please select a title.'))
  }
  if (!passenger.firstName.trim()) {
    push(errors, 'firstName', msg(locale, 'الاسم الأول مطلوب.', 'First name is required.'))
  } else if (passenger.firstName.trim().length < 2) {
    push(errors, 'firstName', msg(locale, 'الاسم الأول قصير جداً.', 'First name is too short.'))
  }
  if (!passenger.lastName.trim()) {
    push(errors, 'lastName', msg(locale, 'اسم العائلة مطلوب.', 'Last name is required.'))
  } else if (passenger.lastName.trim().length < 2) {
    push(errors, 'lastName', msg(locale, 'اسم العائلة قصير جداً.', 'Last name is too short.'))
  }
  if (!PASSENGER_GENDERS.includes(passenger.gender as (typeof PASSENGER_GENDERS)[number])) {
    push(errors, 'gender', msg(locale, 'يرجى اختيار الجنس.', 'Please select a gender.'))
  }

  if (!passenger.dateOfBirth) {
    push(errors, 'dateOfBirth', msg(locale, 'تاريخ الميلاد مطلوب.', 'Date of birth is required.'))
  } else if (!parseIsoDate(passenger.dateOfBirth)) {
    push(errors, 'dateOfBirth', msg(locale, 'تاريخ الميلاد غير صالح.', 'Date of birth is invalid.'))
  } else {
    const ageCheck = isAgeValidForType(
      passenger.type,
      passenger.dateOfBirth,
      options.departureDate,
    )
    if (!ageCheck.ok) {
      push(
        errors,
        'dateOfBirth',
        ageRuleMessage(locale, passenger.type, ageCheck.age, ageCheck.expected),
      )
    }
  }

  if (!passenger.nationality.trim()) {
    push(errors, 'nationality', msg(locale, 'الجنسية مطلوبة.', 'Nationality is required.'))
  } else if (!isValidCountryCode(passenger.nationality)) {
    push(
      errors,
      'nationality',
      msg(locale, 'رمز الدولة غير صالح (حرفان ISO).', 'Invalid country code (ISO alpha-2).'),
    )
  }

  if (!passenger.passportNumber.trim()) {
    push(errors, 'passportNumber', msg(locale, 'رقم الجواز مطلوب.', 'Passport number is required.'))
  } else if (passenger.passportNumber.trim().length < 5) {
    push(
      errors,
      'passportNumber',
      msg(locale, 'رقم الجواز قصير جداً.', 'Passport number is too short.'),
    )
  }

  if (!passenger.passportExpiry) {
    push(errors, 'passportExpiry', msg(locale, 'انتهاء الجواز مطلوب.', 'Passport expiry is required.'))
  } else {
    const expiry = parseIsoDate(passenger.passportExpiry)
    const departure = parseIsoDate(options.departureDate)
    if (!expiry) {
      push(errors, 'passportExpiry', msg(locale, 'تاريخ انتهاء الجواز غير صالح.', 'Passport expiry is invalid.'))
    } else if (departure && expiry.getTime() < departure.getTime()) {
      push(
        errors,
        'passportExpiry',
        msg(
          locale,
          'يجب أن يكون جواز السفر ساريًا في تاريخ المغادرة.',
          'Passport must be valid on the departure date.',
        ),
      )
    }
  }

  if (!passenger.passportIssuingCountry.trim()) {
    push(
      errors,
      'passportIssuingCountry',
      msg(locale, 'دولة إصدار الجواز مطلوبة.', 'Passport issuing country is required.'),
    )
  } else if (!isValidCountryCode(passenger.passportIssuingCountry)) {
    push(
      errors,
      'passportIssuingCountry',
      msg(locale, 'رمز دولة الإصدار غير صالح.', 'Invalid issuing country code.'),
    )
  }

  const needsContact = passenger.type === 'adult' && requireContact
  if (needsContact || passenger.email.trim()) {
    if (!passenger.email.trim()) {
      push(errors, 'email', msg(locale, 'البريد الإلكتروني مطلوب للبالغ.', 'Email is required for adults.'))
    } else if (!EMAIL_RE.test(passenger.email.trim())) {
      push(errors, 'email', msg(locale, 'البريد الإلكتروني غير صالح.', 'Email address is invalid.'))
    }
  }

  if (needsContact || passenger.mobileNumber.trim()) {
    if (!passenger.mobileNumber.trim()) {
      push(errors, 'mobileNumber', msg(locale, 'رقم الجوال مطلوب للبالغ.', 'Mobile number is required for adults.'))
    } else if (!PHONE_RE.test(passenger.mobileNumber.trim())) {
      push(errors, 'mobileNumber', msg(locale, 'رقم الجوال غير صالح.', 'Mobile number is invalid.'))
    }
  }

  const fieldMessages: PassengerValidationResult['fieldMessages'] = {}
  for (const err of errors) {
    if (!fieldMessages[err.field]) fieldMessages[err.field] = err.message
  }

  return { valid: errors.length === 0, errors, fieldMessages }
}

export function validatePassengerParty(
  passengers: Passenger[],
  expected: TravellerCounts,
  options: ValidatePassengerOptions,
): PassengerValidationResult {
  const locale = options.locale ?? 'en'
  const errors: PassengerFieldError[] = []

  const adults = passengers.filter((p) => p.type === 'adult').length
  const children = passengers.filter((p) => p.type === 'child').length
  const infants = passengers.filter((p) => p.type === 'infant').length

  if (
    adults !== expected.adults
    || children !== expected.children
    || infants !== expected.infants
    || passengers.length !== expected.total
  ) {
    push(
      errors,
      'counts',
      msg(
        locale,
        `عدد المسافرين يجب أن يطابق الرحلة (${expected.adults} بالغ، ${expected.children} طفل، ${expected.infants} رضيع).`,
        `Passenger count must match the itinerary (${expected.adults} adults, ${expected.children} children, ${expected.infants} infants).`,
      ),
    )
  }

  if (expected.adults < 1) {
    push(
      errors,
      'counts',
      msg(locale, 'يلزم بالغ واحد على الأقل للحجز.', 'At least one adult is required to book.'),
    )
  }

  passengers.forEach((p, index) => {
    const result = validatePassenger(p, options)
    for (const err of result.errors) {
      errors.push({
        field: err.field,
        message: msg(
          locale,
          `مسافر ${index + 1}: ${err.message}`,
          `Passenger ${index + 1}: ${err.message}`,
        ),
      })
    }
  })

  const fieldMessages: PassengerValidationResult['fieldMessages'] = {}
  for (const err of errors) {
    if (!fieldMessages[err.field]) fieldMessages[err.field] = err.message
  }

  return { valid: errors.length === 0, errors, fieldMessages }
}

export function normalizePassengerCountries(passenger: Passenger): Passenger {
  return {
    ...passenger,
    nationality: passenger.nationality
      ? normalizeCountryCode(passenger.nationality)
      : '',
    passportIssuingCountry: passenger.passportIssuingCountry
      ? normalizeCountryCode(passenger.passportIssuingCountry)
      : '',
  }
}
