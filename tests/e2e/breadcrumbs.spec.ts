import type { Page } from 'playwright/test'
import { test, expect } from 'playwright/test'

async function signIn(page: Page, redirect: string) {
  await page.goto(`/api/test-auth?redirect=${encodeURIComponent(redirect)}`)
  await page.waitForURL((url) => url.pathname + url.search !== '/api/test-auth')
}

const eventLinks = (page: Page) => page.locator('a[href^="/camera-events/"]')

/** Favorite the first event on the Events list (retries until hydrated). */
async function favoriteFirstEvent(page: Page): Promise<string> {
  await signIn(page, '/camera-events')
  await expect(eventLinks(page).first()).toBeVisible()
  const href = (await eventLinks(page).first().getAttribute('href')) as string
  const id = href.split('?')[0].split('/').pop() as string
  await expect(async () => {
    const add = page.getByRole('button', { name: 'Add to favorites' }).first()
    if (await add.isVisible()) await add.click()
    await expect(
      page.getByRole('button', { name: 'Remove from favorites' }).first(),
    ).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 15_000 })
  return id
}

const breadcrumb = (page: Page) =>
  page.getByRole('navigation', { name: 'Breadcrumb' })

test.describe('desktop', () => {
  test('events list with filters: crumb keeps camera/type, parent returns to origin', async ({
    page,
  }) => {
    await signIn(page, '/camera-events?camera=front_door')
    await expect(eventLinks(page).first()).toBeVisible()
    const href = (await eventLinks(page).first().getAttribute('href')) as string
    expect(href).toContain('from=events')
    expect(href).toContain('camera=front_door')

    await eventLinks(page).first().click()
    await page.waitForURL(/\/camera-events\/[^/?]+\?/)
    const url = new URL(page.url())
    expect(url.searchParams.get('from')).toBe('events')
    expect(url.searchParams.get('camera')).toBe('front_door')

    const nav = breadcrumb(page)
    await expect(nav).toBeVisible()
    const parent = nav.getByRole('link', { name: 'Events' })
    await expect(parent).toHaveAttribute('href', /camera=front_door/)
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
    await expect(nav.locator('[aria-current="page"]')).toContainText(' · ')

    await parent.click()
    await page.waitForURL(/\/camera-events\?.*camera=front_door/)
    expect(new URL(page.url()).pathname).toBe('/camera-events')
  })

  test('favorites origin: trail shows Favorites, parent returns to /favorites', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await favoriteFirstEvent(page)
    await page.goto('/favorites')
    await expect(eventLinks(page).first()).toBeVisible()
    await expect(eventLinks(page).first()).toHaveAttribute(
      'href',
      /from=favorites/,
    )
    await eventLinks(page).first().click()
    await page.waitForURL(/\/camera-events\/[^/?]+\?from=favorites/)

    const nav = breadcrumb(page)
    await expect(nav.getByRole('link', { name: 'Favorites' })).toBeVisible()
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
    await expect(nav.locator('[aria-current="page"]')).toContainText(' · ')

    await nav.getByRole('link', { name: 'Favorites' }).click()
    await page.waitForURL('**/favorites')
  })

  test('cold deep link falls back to Events', async ({ page }) => {
    await signIn(page, '/camera-events')
    await expect(eventLinks(page).first()).toBeVisible()
    const href = (await eventLinks(page).first().getAttribute('href')) as string
    const path = href.split('?')[0]

    await page.goto(path)
    const nav = breadcrumb(page)
    await expect(nav.getByRole('link', { name: 'Events' })).toBeVisible()
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  })

  test('tampered from=settings falls back to Events', async ({ page }) => {
    await signIn(page, '/camera-events')
    await expect(eventLinks(page).first()).toBeVisible()
    const href = (await eventLinks(page).first().getAttribute('href')) as string
    const path = href.split('?')[0]

    await page.goto(`${path}?from=settings`)
    const nav = breadcrumb(page)
    await expect(nav.getByRole('link', { name: 'Events' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  })

  test('live view shows Cameras > Camera trail', async ({ page }) => {
    await signIn(page, '/live/front_door')
    const nav = breadcrumb(page)
    await expect(nav.getByRole('link', { name: 'Cameras' })).toBeVisible()
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
    await expect(nav.locator('[aria-current="page"]')).toHaveText('Front Door')
  })

  test('burst navigation keeps from and does not grow history', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await signIn(page, '/camera-events')
    await expect(eventLinks(page).first()).toBeVisible()
    const hrefs = await eventLinks(page).evaluateAll((els) =>
      els.slice(0, 12).map((e) => e.getAttribute('href') as string),
    )
    // Find an event that has a burst neighbour (mock data is random).
    let neighbour = page.getByRole('link', { name: /^(Next|Previous)/ })
    let found = false
    for (const href of hrefs) {
      await page.goto(`${href.split('?')[0]}?from=favorites`)
      const burst = page.getByRole('navigation', { name: /^More from/ })
      await expect(burst).toBeVisible()
      neighbour = burst.getByRole('link', { name: /^(Next|Previous)/ })
      await page.waitForTimeout(500)
      if ((await neighbour.count()) > 0) {
        found = true
        break
      }
    }
    test.skip(!found, 'mock data has no burst neighbour among first events')
    const historyBefore = await page.evaluate(() => history.length)
    const startUrl = page.url()
    await neighbour.first().click()
    await page.waitForURL((u) => u.toString() !== startUrl)
    expect(new URL(page.url()).searchParams.get('from')).toBe('favorites')
    expect(await page.evaluate(() => history.length)).toBe(historyBefore)
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('header back link and Favorites tab highlight', async ({ page }) => {
    await signIn(page, '/camera-events')
    await expect(eventLinks(page).first()).toBeVisible()
    const href = (await eventLinks(page).first().getAttribute('href')) as string
    await page.goto(`${href.split('?')[0]}?from=favorites`)

    const back = page.getByRole('link', { name: 'Back to Favorites' })
    await expect(back).toBeVisible()
    await expect(breadcrumb(page)).toBeHidden()
    await expect(
      page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name: 'Favorites' }),
    ).toHaveAttribute('aria-current', 'page')

    await back.click()
    await page.waitForURL('**/favorites')
  })
})
