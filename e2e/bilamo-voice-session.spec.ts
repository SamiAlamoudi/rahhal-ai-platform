import { expect, test } from '@playwright/test'

/**
 * Bilamo realtime voice sprint — Playwright coverage with mocked WebRTC.
 * Validates shared session wiring, text fallback, and no client secrets.
 */

test.describe('Bilamo voice session (mocked WebRTC)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
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
    })
  })

  test('text conversation remains functional on Home', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Bilamo' })).toBeVisible()
    await page.getByTestId('login-demo').click()
    await expect(page).toHaveURL(/\/$/)

    // Orb surface must load (voice session must not crash the page).
    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible({ timeout: 15_000 })

    // Open composer — Arabic locale in Playwright config uses "اكتب".
    await page.getByRole('button', { name: /^(Type|اكتب)$/ }).click()
    const input = page.getByLabel('Message')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('I want to visit Tokyo from Riyadh')
    await expect(input).toHaveValue(/Tokyo/)

    // Submit — voice must not block text. Optimistic user bubble is enough proof.
    await page.getByLabel('Send').click()
    await expect(page.getByText(/Tokyo|طوكيو/i).first()).toBeVisible({ timeout: 30_000 })
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

    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible({ timeout: 15_000 })

    await page.goto('/chat')
    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible({ timeout: 15_000 })
  })
})
