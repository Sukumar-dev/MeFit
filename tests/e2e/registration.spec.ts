import { expect, test } from '@playwright/test'
test('new users reach the enforced two-step verification setup after registration', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: 'Continue to registration' }).click()
  await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 15_000 })
  await page.locator('input[name="firstName"]').fill('MeFit')
  await page.locator('input[name="lastName"]').fill('TOTP Test')
  await page.locator('input[name="email"]').fill(`mefit-totp-${Date.now()}@example.test`)
  const username = page.locator('input[name="username"]')
  if (await username.isVisible()) await username.fill(`mefit-totp-${Date.now()}@example.test`)
  const password = 'MeFit-Local-Test-2026!'
  await page.locator('input[name="password"]').fill(password)
  await page.locator('input[name="password-confirm"]').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.locator('input[name="totp"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('input[name="totp"]')).toBeVisible()
})
