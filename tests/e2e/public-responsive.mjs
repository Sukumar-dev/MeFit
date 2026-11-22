import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const origin = process.env.MEFIT_PUBLIC_URL
assert.ok(origin, 'Set MEFIT_PUBLIC_URL to the deployment origin.')

const viewports = [[360, 740], [390, 844], [414, 896], [667, 375], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1280, 800], [1440, 900], [1920, 1080]]
const publicPages = [
  ['/', 'Weekly fitness, with a plan.'],
  ['/login', 'Sign in to MeFit'],
  ['/register', 'Create your MeFit account'],
]

const browser = await chromium.launch()
try {
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) errors.push(message.text())
    })
    try {
      for (const [path, heading] of publicPages) {
        const response = await page.goto(new URL(path, origin).href, { waitUntil: 'domcontentloaded', timeout: 15_000 })
        assert.equal(response?.status(), 200, path)
        await page.getByRole('heading', { name: heading, exact: true }).waitFor()
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        assert.equal(overflows, false, `${path} overflows at ${width}px`)
        assert.deepEqual(errors.splice(0), [], path)
        console.log(`PRF-01 ${width}px ${path} passed`)
      }
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
}
