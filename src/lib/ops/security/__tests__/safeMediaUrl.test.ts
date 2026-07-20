import { describe, expect, it } from 'vitest'
import { isSafeMediaUrl, safeMediaUrl } from '../safeMediaUrl'

describe('safeMediaUrl', () => {
  it('allows https and http URLs', () => {
    expect(isSafeMediaUrl('https://cdn.example.com/a.png')).toBe(true)
    expect(isSafeMediaUrl('http://localhost:3000/x')).toBe(true)
  })

  it('allows same-origin relative paths', () => {
    expect(isSafeMediaUrl('/storage/v1/object/public/a.png')).toBe(true)
  })

  it('rejects javascript and protocol-relative URLs', () => {
    expect(isSafeMediaUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeMediaUrl('//evil.example/x')).toBe(false)
    expect(safeMediaUrl('javascript:alert(1)')).toBeNull()
  })

  it('allows image data URLs only', () => {
    expect(isSafeMediaUrl('data:image/png;base64,abc')).toBe(true)
    expect(isSafeMediaUrl('data:text/html,<script>')).toBe(false)
  })
})
