import { describe, expect, it } from 'vitest'
import {
  buildAttachmentRequest,
  detectContextualAttachmentRequest,
  labelForAttachmentKind,
} from '../chat/contextualAttachments'

describe('Recovery Phase 2.2 — contextual attachments', () => {
  it('hides by default for ordinary consultant replies', () => {
    expect(detectContextualAttachmentRequest('وين حاب تسافر؟')).toBeNull()
    expect(
      detectContextualAttachmentRequest('الصورة مكتملة تقريباً. نجهّز الخيارات؟'),
    ).toBeNull()
    expect(
      detectContextualAttachmentRequest('ملاحظة التأشيرة: قد تحتاج فيزا لليابان.'),
    ).toBeNull()
    expect(detectContextualAttachmentRequest('Passport validity is typically 6 months.')).toBeNull()
  })

  it('detects explicit Arabic document requests with contextual labels', () => {
    expect(detectContextualAttachmentRequest('أرسل لي جواز السفر من فضلك')?.kind).toBe('passport')
    expect(detectContextualAttachmentRequest('ممكن ترفق التأشيرة؟')?.labelAr).toBe(
      'إرفاق التأشيرة',
    )
    expect(detectContextualAttachmentRequest('أرفق التذكرة لو سمحت')?.labelAr).toBe(
      'إرفاق التذكرة',
    )
    expect(detectContextualAttachmentRequest('إرفاق بطاقة الصعود يساعدنا نراجع الرحلة')?.kind).toBe(
      'boarding_pass',
    )
    expect(detectContextualAttachmentRequest('أرسل تأكيد الفندق')?.labelAr).toBe(
      'إرفاق تأكيد الفندق',
    )
    expect(detectContextualAttachmentRequest('ارفع وثيقة التأمين')?.kind).toBe('travel_insurance')
    expect(detectContextualAttachmentRequest('أرسل إيصال الدفع')?.kind).toBe('payment_receipt')
  })

  it('detects photo requests with specific CTAs', () => {
    expect(detectContextualAttachmentRequest('أرسل صورة الفندق')?.labelAr).toBe(
      'إرفاق صورة الفندق',
    )
    expect(detectContextualAttachmentRequest('أرفق صورة المعلم')?.labelAr).toBe(
      'إرفاق صورة المعلم',
    )
    expect(detectContextualAttachmentRequest('أرسل صورة الوجهة')?.labelAr).toBe(
      'إرفاق صورة الوجهة',
    )
    expect(detectContextualAttachmentRequest('Can you upload a photo of the hotel?')?.kind).toBe(
      'hotel_photo',
    )
  })

  it('reads structured providerMeta without requiring text heuristics', () => {
    expect(
      detectContextualAttachmentRequest('أي رسالة عادية', { attachmentRequest: 'passport' })?.labelAr,
    ).toBe('إرفاق جواز السفر')
    expect(
      detectContextualAttachmentRequest('', {
        requestedAttachment: { kind: 'visa' },
      })?.kind,
    ).toBe('visa')
  })

  it('builds accept lists and labels for each kind', () => {
    const passport = buildAttachmentRequest('passport')
    expect(passport.accept).toContain('application/pdf')
    expect(passport.isImage).toBe(false)
    expect(labelForAttachmentKind('flight_ticket')).toBe('إرفاق التذكرة')

    const photo = buildAttachmentRequest('hotel_photo')
    expect(photo.accept).toContain('image/png')
    expect(photo.accept).not.toContain('pdf')
    expect(photo.isImage).toBe(true)
  })
})
