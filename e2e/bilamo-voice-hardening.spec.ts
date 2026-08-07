import { expect, test } from '@playwright/test'

/**
 * Hardening sprint — browser validation with fake media devices.
 * Real Safari/iPhone mic pass remains a human staging checklist (see PR).
 */

test.use({
  permissions: ['microphone'],
})

test.describe('Bilamo voice hardening (fake media)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      class FakePC {
        connectionState = 'new'
        onconnectionstatechange: (() => void) | null = null
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

  test('orb + text recovery remain usable (Chrome desktop fake mic)', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-demo').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible({ timeout: 15_000 })

    // Tap orb — classic path may start SpeechRecognition or surface recovery; must not crash.
    await page.getByRole('button', { name: 'Speak' }).click()
    await page.waitForTimeout(800)
    await expect(page.getByRole('heading', { name: /Something went wrong/i })).toHaveCount(0)

    // Text mode always available.
    const typeBtn = page.getByRole('button', { name: /^(Type|اكتب)$/ })
    if (await typeBtn.isVisible()) {
      await typeBtn.click()
    }
    const input = page.getByLabel('Message')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Tokyo trip for two from Riyadh')
    await page.getByLabel('Send').click()
    await expect(page.getByText(/Tokyo|Riyadh|طوكيو|الرياض/i).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('Home and /chat keep single Speak surface after navigation', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-demo').click()
    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible({ timeout: 15_000 })
    await page.goto('/chat')
    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible({ timeout: 15_000 })
    // Still one orb — no crash from shared session remount.
    await expect(page.getByRole('button', { name: 'Speak' })).toHaveCount(1)
  })

  test('no permanent OpenAI secrets in client bundle HTML', async ({ page }) => {
    await page.goto('/')
    // May redirect to login — still check DOM/source.
    const html = await page.content()
    expect(html).not.toMatch(/sk-[a-zA-Z0-9]{20,}/)
    expect(html).not.toMatch(/OPENAI_API_KEY\s*[:=]\s*["']sk-/)
  })
})
