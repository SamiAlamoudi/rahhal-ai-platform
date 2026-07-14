import { test, expect } from '@playwright/test'

test('login page shows Arabic copy and form fields', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'رحّال' })).toBeVisible()
  await expect(page.getByText('البريد الإلكتروني')).toBeVisible()
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.locator('form')).toBeVisible()
})
