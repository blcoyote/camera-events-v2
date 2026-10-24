import type { Page } from 'playwright/test'
import { test, expect } from 'playwright/test'

const DARK_COLOR = '#0b1424'
const LIGHT_COLOR = '#eef6ff'

const themeButton = (page: Page) =>
  page.getByRole('button', { name: /^Theme:/ })

const rootClass = (page: Page) =>
  page.evaluate(() => document.documentElement.className)

const themeColor = (page: Page) =>
  page.evaluate(
    () =>
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content') ?? null,
  )

// Under dev SSR the click handler only works once React has hydrated, so retry
// the click until the button label changes to the expected one.
async function clickThemeUntil(page: Page, expectedLabel: string) {
  await expect(async () => {
    if (
      (await themeButton(page).getAttribute('aria-label')) !== expectedLabel
    ) {
      await themeButton(page).click()
    }
    await expect(themeButton(page)).toHaveAttribute(
      'aria-label',
      expectedLabel,
      { timeout: 1000 },
    )
  }).toPass({ timeout: 10_000 })
}

test('stored dark theme is applied before first paint (no light flash)', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem('theme', 'dark')
  })
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      ;(window as unknown as Record<string, unknown>).__themeAtDcl = {
        className: document.documentElement.className,
        themeColor:
          document
            .querySelector('meta[name="theme-color"]')
            ?.getAttribute('content') ?? null,
      }
    })
  })

  await page.goto('/')

  const atDcl = await page.evaluate(
    () =>
      (window as unknown as Record<string, unknown>).__themeAtDcl as {
        className: string
        themeColor: string | null
      },
  )
  expect(atDcl.className).toContain('dark')
  expect(atDcl.themeColor).toBe(DARK_COLOR)
})

test('system dark preference yields dark when no theme is stored', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  expect(await rootClass(page)).toContain('dark')
  expect(await themeColor(page)).toBe(DARK_COLOR)
})

test('header toggle cycles light -> dark -> system -> light and persists', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('theme', 'light'))
  await page.reload()

  await expect(themeButton(page)).toHaveAttribute(
    'aria-label',
    'Theme: Light. Switch to Dark.',
  )
  expect(await rootClass(page)).toContain('light')
  expect(await themeColor(page)).toBe(LIGHT_COLOR)

  await clickThemeUntil(page, 'Theme: Dark. Switch to System.')
  expect(await rootClass(page)).toContain('dark')
  expect(await themeColor(page)).toBe(DARK_COLOR)

  // Persisted across reload.
  await page.reload()
  expect(await rootClass(page)).toContain('dark')
  await expect(themeButton(page)).toHaveAttribute(
    'aria-label',
    'Theme: Dark. Switch to System.',
  )

  await clickThemeUntil(page, 'Theme: System. Switch to Light.')
  // Default emulated scheme is light, so system resolves to light.
  expect(await rootClass(page)).toContain('light')

  await clickThemeUntil(page, 'Theme: Light. Switch to Dark.')
  expect(await rootClass(page)).toContain('light')
  expect(await themeColor(page)).toBe(LIGHT_COLOR)

  await page.reload()
  await expect(themeButton(page)).toHaveAttribute(
    'aria-label',
    'Theme: Light. Switch to Dark.',
  )
  expect(await rootClass(page)).toContain('light')
})

test('Settings Dark button updates the header toggle (shared state)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await page.goto('/api/test-auth?redirect=/settings')
  await page.waitForURL('/settings')
  await page.evaluate(() => localStorage.setItem('theme', 'light'))
  await page.reload()

  const group = page.getByRole('group', { name: 'Theme' })
  await expect(group).toBeVisible()

  await expect(async () => {
    await group.getByRole('button', { name: 'Dark' }).click()
    await expect(themeButton(page)).toHaveAttribute(
      'aria-label',
      'Theme: Dark. Switch to System.',
      { timeout: 1000 },
    )
  }).toPass({ timeout: 10_000 })

  await expect(group.getByRole('button', { name: 'Dark' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(await rootClass(page)).toContain('dark')
})
