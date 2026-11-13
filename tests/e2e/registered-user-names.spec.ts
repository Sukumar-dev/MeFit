import { expect, test } from '@playwright/test'
import { registerAndCompleteMfa } from './support/register'

test('persists each registrant name and isolates authenticated user profiles', async ({ page, browser }) => {
  const rahul = await registerAndCompleteMfa(page, { firstName: 'Rahul', lastName: 'Kumar' })
  const secondContext = await browser.newContext({ baseURL: 'http://localhost:5173' })
  try {
    const secondPage = await secondContext.newPage()
    const priya = await registerAndCompleteMfa(secondPage, { firstName: 'Priya', lastName: 'Sharma' })

    const rahulUser = await page.request.get(`http://localhost:4000/api/user/${rahul.userId}`, { headers: { Authorization: `Bearer ${rahul.accessToken}` } })
    const priyaUser = await secondPage.request.get(`http://localhost:4000/api/user/${priya.userId}`, { headers: { Authorization: `Bearer ${priya.accessToken}` } })
    expect((await rahulUser.json()).first_name).toBe('Rahul')
    expect((await rahulUser.json()).last_name).toBe('Kumar')
    expect((await priyaUser.json()).first_name).toBe('Priya')
    expect((await priyaUser.json()).last_name).toBe('Sharma')

    const crossAccount = await page.request.get(`http://localhost:4000/api/user/${priya.userId}`, { headers: { Authorization: `Bearer ${rahul.accessToken}` } })
    expect(crossAccount.status()).toBe(403)
  } finally {
    await secondContext.close()
  }
})
