// Screenshot a page of the running dev server as the signed-in test user.
// Usage: node scripts/screenshot.mjs [path] [out.png] [--mobile]
// Needs a dev server started with E2E_TEST=true (see .claude/skills/view-app).
import { chromium, devices } from 'playwright'

const args = process.argv.slice(2)
const mobile = args.includes('--mobile')
const [path = '/cameras', out = 'screenshot.png'] = args.filter(
  (a) => a !== '--mobile',
)
const base = process.env.BASE_URL ?? 'http://localhost:3000'

const browser = await chromium.launch()
try {
  const page = await browser.newPage(
    mobile ? devices['iPhone 15'] : { viewport: { width: 1280, height: 900 } },
  )
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // /api/test-auth mints a session and redirects to `path`.
  const res = await page.goto(
    `${base}/api/test-auth?redirect=${encodeURIComponent(path)}`,
  )
  if (res?.status() === 403) {
    throw new Error(
      'test-auth is disabled: start the dev server with E2E_TEST=true',
    )
  }
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: out, fullPage: true })
  console.log(`saved ${out} (${page.url()})`)
  if (errors.length) console.log(`browser errors:\n${errors.join('\n')}`)
} finally {
  await browser.close()
}
