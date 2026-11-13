import { expect, test } from '@playwright/test'

test('protected routes send unauthenticated users to the login screen', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to MeFit' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible()
})

test('sign-in opens the configured Keycloak authorization page', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue to sign in' }).click()
  await expect(page).toHaveURL(/localhost:8080\/realms\/mefit\/protocol\/openid-connect\/auth/)
  await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 15_000 })
})

test('registration opens the identity-provider registration form', async ({ page }) => {
  await page.goto('/register')
  await page.getByRole('button', { name: 'Continue to registration' }).click()
  await expect(page).toHaveURL(/localhost:8080\/realms\/mefit\/protocol\/openid-connect\/auth/)
  await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 15_000 })
})
