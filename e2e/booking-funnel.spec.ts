import { expect, test } from '@playwright/test'

/**
 * Production MVP browser journey:
 * login (demo) → search → results → booking review → checkout → payment preparation
 *
 * Stops at payment preparation (mock provider). Does not capture cards / Moyasar live.
 */
test.describe('Booking funnel (browser E2E)', () => {
  test('login → search → results → booking review → payment preparation', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'رحّال' })).toBeVisible()

    await page.getByTestId('login-demo').click()
    // Alpha routes demo login into the conversational experience.
    await expect(page).toHaveURL(/\/chat\/?$/)

    await page.goto('/search')
    await expect(page.locator('#ctrl-destination')).toBeVisible()

    await page.locator('#ctrl-destination').fill('Tokyo')
    await page.locator('#ctrl-departure-city').fill('Riyadh')
    await page.locator('#ctrl-departure-date').fill('2026-10-15')
    await page.locator('#ctrl-duration').fill('7')
    await page.locator('#ctrl-adults').fill('2')
    await page.locator('#ctrl-budget').fill('20000')
    await page.locator('#ctrl-currency').selectOption('SAR')

    const confirm = page.getByTestId('search-confirm')
    await expect(confirm).toBeVisible({ timeout: 15_000 })
    await confirm.click()

    const openResults = page.getByTestId('results-open')
    await expect(openResults).toBeVisible({ timeout: 60_000 })
    await openResults.click()
    await expect(page).toHaveURL(/\/results/)

    await expect(page.getByTestId('result-select').first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('result-select').first().click()

    await page.getByTestId('booking-continue').click()
    await expect(page).toHaveURL(/\/booking\/review/)

    const pay = page.getByTestId('pay-rahhal')
    await expect(pay).toBeVisible({ timeout: 20_000 })
    await pay.click()
    await expect(page).toHaveURL(/\/checkout/)

    await page.getByTestId('checkout-continue').click()
    await expect(page).toHaveURL(/\/checkout\/review/)

    // Review starts with empty traveler names; payment requires them.
    await page.getByPlaceholder('الاسم الأول').first().fill('أحمد')
    await page.getByPlaceholder('اسم العائلة').first().fill('العلي')

    await page.getByTestId('checkout-terms').check()
    await expect(page.getByTestId('checkout-to-payment')).toBeEnabled()
    await page.getByTestId('checkout-to-payment').click()
    await expect(page).toHaveURL(/\/checkout\/payment/)
    await expect(page.getByTestId('payment-ready')).toHaveText('الدفع')
  })
})
