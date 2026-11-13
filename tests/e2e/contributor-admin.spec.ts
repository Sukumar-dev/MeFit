import { expect, test } from '@playwright/test'
import { registerAndCompleteMfa } from './support/register'

test('regular users are denied access to contributor authoring', async ({ page }) => {
  await registerAndCompleteMfa(page)
  await page.goto('/contribute')
  await expect(page.getByRole('alert')).toContainText(/permission/i)
})
