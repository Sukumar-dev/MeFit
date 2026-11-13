import { createHmac } from 'node:crypto'
import { expect, type Page } from '@playwright/test'

function base32Decode(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of value.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(char)
    if (index < 0) throw new Error('Invalid base32 TOTP secret')
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  return Buffer.from(bytes)
}

function totp(secret: string): string {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const digest = createHmac('sha1', base32Decode(secret)).update(message).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const binary = ((digest[offset]! & 0x7f) << 24) | ((digest[offset + 1]! & 0xff) << 16) | ((digest[offset + 2]! & 0xff) << 8) | (digest[offset + 3]! & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

export async function registerAndCompleteMfa(page: Page, name = { firstName: 'MeFit', lastName: 'Test User' }) {
  const email = `mefit-${Date.now()}@example.test`
  await page.goto('/register')
  await page.getByRole('button', { name: 'Continue to registration' }).click()
  await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 15_000 })
  await page.locator('input[name="firstName"]').fill(name.firstName)
  await page.locator('input[name="lastName"]').fill(name.lastName)
  await page.locator('input[name="email"]').fill(email)
  const username = page.locator('input[name="username"]')
  if (await username.isVisible()) await username.fill(email)
  const password = 'MeFit-Local-Test-2026!'
  await page.locator('input[name="password"]').fill(password)
  await page.locator('input[name="password-confirm"]').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.locator('input[name="totp"]')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('link', { name: 'Unable to scan?' }).click()
  await expect(page.locator('input[name="totpSecret"]')).toBeAttached()
  const secret = (await page.locator('main').innerText()).match(/enter the key:\s*([A-Z2-7 ]{35,50})/i)?.[1]?.replace(/\s/g, '')
  if (!secret) throw new Error('Keycloak did not show a TOTP secret')
  const submit = page.getByRole('button', { name: 'Submit' })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator('input[name="totp"]').fill(totp(secret))
    const deviceName = page.locator('input[name="userLabel"]')
    if (await deviceName.isVisible()) await deviceName.fill('MeFit browser test')
    await Promise.all([page.waitForLoadState('domcontentloaded'), submit.click()])
    try { await page.waitForURL(/\/auth\/callback(?:\?|$)/, { timeout: 7000 }); break }
    catch { if (attempt === 2) throw new Error('Keycloak did not accept the authenticator setup code') }
  }
  await expect(page.getByRole('heading', { name: /set up your fitness profile/i })).toBeVisible({ timeout: 20_000 })
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mefit.session') ?? 'null') as { accessToken?: string } | null)
  expect(session?.accessToken).toBeTruthy()
  await page.getByRole('button', { name: 'Save profile and continue' }).click()
  await expect(page.getByRole('button', { name: 'Request Contributions' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Request Contributions' }).click()
  await expect(page.getByRole('heading', { name: `Welcome, ${name.firstName} ${name.lastName}.` })).toBeVisible({ timeout: 15_000 })
  const userResponse = await page.request.get('http://localhost:4000/api/user', { headers: { Authorization: `Bearer ${session!.accessToken}` }, maxRedirects: 0 })
  expect(userResponse.status()).toBe(303)
  const resourceUrl = userResponse.headers().location
  expect(resourceUrl).toMatch(/\/api\/user\/[0-9a-f-]+$/i)
  const resourceResponse = await page.request.get(resourceUrl!, { headers: { Authorization: `Bearer ${session!.accessToken}` } })
  expect(resourceResponse.ok()).toBeTruthy()
  const provisioned = await resourceResponse.json() as { id: string; email: string; first_name: string | null; last_name: string | null; roles: string[] }
  expect(provisioned.email).toBe(email)
  expect(provisioned.roles).toContain('USER')
  expect(provisioned.first_name).toBe(name.firstName)
  expect(provisioned.last_name).toBe(name.lastName)
  await page.reload()
  await expect(page.getByRole('heading', { name: `Welcome, ${name.firstName} ${name.lastName}.` })).toBeVisible()
  await expect(page.locator('header').getByText(`${name.firstName} ${name.lastName}`, { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText(email, { exact: true })).toHaveCount(1)
  return { email, userId: provisioned.id, accessToken: session!.accessToken }
}
