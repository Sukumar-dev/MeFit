import { expect, test } from '@playwright/test'
import { registerAndCompleteMfa } from './support/register'

test('regular users are denied access to contributor authoring', async ({ page }) => {
  await registerAndCompleteMfa(page)
  await page.goto('/contribute')
  await expect(page.getByRole('alert')).toContainText(/permission/i)
})

test('all admin authoring selectors fit and can be activated at narrow widths', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('mefit.session', JSON.stringify({
      authProvider: 'keycloak',
      accessToken: 'layout-fixture-token',
      expiresAt: Date.now() + 60_000,
      user: { id: 'layout-fixture', email: 'qa@example.test', displayName: 'QA', roles: ['ADMIN'], hasProfile: true },
    }))
  })
  await page.route('**/api/**', route => route.fulfill({
    json: {},
    headers: { 'access-control-allow-origin': 'http://localhost:5173' },
  }))
  await page.goto('/contribute')
  await expect(page.getByRole('heading', { name: 'Manage fitness content' })).toBeVisible()
  for (const width of [320, 360, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const kind of ['exercises', 'workouts', 'programs']) {
      const control = page.getByRole('button', { name: kind, exact: true })
      await expect(control).toBeInViewport()
      const bounds = await control.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      await control.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: kind, exact: true, pressed: true })).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
})
