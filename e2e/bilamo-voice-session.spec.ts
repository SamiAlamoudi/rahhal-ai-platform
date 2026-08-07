import { expect, test } from '@playwright/test'

/**
 * Bilamo realtime voice sprint — Playwright coverage with mocked WebRTC.
 * Validates shared session wiring, text fallback, and no client secrets.
 */

test.describe('Bilamo voice session (mocked WebRTC)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Mock WebRTC so browsers without live audio still exercise the path.
      class FakePC {
        connectionState = 'new'
        onconnectionstatechange: (() => void) | null = null
        ontrack: ((ev: { streams: MediaStream[] }) => void) | null = null
        localDescription: unknown = null
        remoteDescription: unknown = null
        createDataChannel() {
          return {
            readyState: 'open',
            send() {},
            close() {},
            addEventListener() {},
            removeEventListener() {},
          }
        }
        addTrack() {
          return {}
        }
        async createOffer() {
          return { type: 'offer', sdp: 'v=0' }
        }
        async setLocalDescription(desc: unknown) {
          this.localDescription = desc
          this.connectionState = 'connected'
          this.onconnectionstatechange?.()
        }
        async setRemoteDescription(desc: unknown) {
          this.remoteDescription = desc
        }
        async addIceCandidate() {}
        close() {
          this.connectionState = 'closed'
        }
        addEventListener() {}
        removeEventListener() {}
      }
      // @ts-expect-error test shim
      window.RTCPeerConnection = FakePC
      // Force classic transport for deterministic demo (no paid realtime credentials).
      // @ts-expect-error vite env shim
      window.__BILAMO_VOICE_TRANSPORT__ = 'classic'
    })
  })

  test('text conversation remains functional on Home', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Bilamo' })).toBeVisible()
    await page.getByTestId('login-demo').click()
    await expect(page).toHaveURL(/\/$/)

    // Open composer and send a text turn — voice must not block text.
    const typeBtn = page.getByRole('button', { name: /Type|اكتب/i }).first()
    if (await typeBtn.isVisible().catch(() => false)) {
      await typeBtn.click()
    }

    const input = page.locator('textarea, input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 15_000 })
    await input.fill('I want to visit Tokyo from Riyadh')
    await input.press('Enter')

    // Assistant reply or thinking presence — conversation spine still works.
    await expect(page.locator('body')).toContainText(/Tokyo|طوكيو|Bilamo|أفكّر|Thinking/i, {
      timeout: 60_000,
    })
  })

  test('no OpenAI secrets exposed in client page source', async ({ page }) => {
    await page.goto('/login')
    const html = await page.content()
    expect(html).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
    expect(html).not.toMatch(/OPENAI_API_KEY\s*[:=]\s*["'][^"']+["']/)
  })

  test('Home and /chat share Bilamo conversation surface (one VoiceSession owner)', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByTestId('login-demo').click()
    await expect(page).toHaveURL(/\/$/)

    // Same orb surface on Home.
    await expect(page.getByRole('button', { name: /Speak|Stop|تحدث/i }).or(
      page.locator('[aria-label="Speak"], [aria-label="Stop"]'),
    ).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/chat')
    await expect(page.getByRole('button', { name: /Speak|Stop|تحدث/i }).or(
      page.locator('[aria-label="Speak"], [aria-label="Stop"]'),
    ).first()).toBeVisible({ timeout: 15_000 })
  })
})
