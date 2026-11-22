import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const origin = process.env.MEFIT_PUBLIC_URL
assert.ok(origin, 'Set MEFIT_PUBLIC_URL to the deployment origin.')

const widths = [360, 390, 768, 1024, 1280]
const publicPages = [
  ['/', 'Weekly fitness, with a plan.'],
  ['/login', 'Sign in to MeFit'],
  ['/register', 'Create your MeFit account'],
]

const browser = await chromium.launch()
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    try {
      for (const [path, heading] of publicPages) {
        const response = await page.goto(new URL(path, origin).href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
        assert.equal(response?.status(), 200, path)
        await page.getByRole('heading', { name: heading, exact: true }).waitFor()
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        assert.equal(overflows, false, `${path} overflows at ${width}px`)
        console.log(`PRF-01 ${width}px ${path} passed`)
      }
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}
