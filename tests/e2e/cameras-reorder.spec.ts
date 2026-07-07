import type { Page } from 'playwright/test'
import { test, expect } from 'playwright/test'

// Single-column layout (below sm:640px breakpoint) so verticalListSortingStrategy
// drag detection works reliably: tiles stack vertically and moving up/down
// crosses item boundaries.
const VIEWPORT = { width: 500, height: 900 }

// Mock cameras returned by FRIGATE_MOCK sorted alphabetically.
const MOCK_CAMERAS = [
  'backyard',
  'driveway',
  'front_door',
  'front_porch',
  'garage',
  'side_gate',
]

async function signIn(page: Page) {
  await page.goto('/api/test-auth?redirect=/cameras')
  await page.waitForURL('/cameras')
}

function cameraHeadings(page: Page) {
  return page.locator('[aria-label="Camera list"] h2').allTextContents()
}

test.use({ viewport: VIEWPORT })

test('pointer drag reorders cameras and persists across reload', async ({
  page,
}) => {
  // SSR hydration, the drag interaction, and re-applying the persisted order
  // after reload each add latency; give the whole flow a realistic budget.
  test.setTimeout(60_000)

  await signIn(page)

  // Wait for camera grid to render
  await page.waitForSelector('[aria-label="Camera list"]')

  // --- Pre-drag assertion ---
  const initialOrder = await cameraHeadings(page)
  expect(initialOrder).toEqual(MOCK_CAMERAS)

  // Enter Edit mode. Under dev SSR the toggle's click handler only fires once
  // React has hydrated, so retry the click until the drag handles appear.
  await expect(async () => {
    const alreadyEditing = await page
      .getByRole('button', { name: 'Done reordering cameras' })
      .count()
    if (alreadyEditing === 0) {
      await page.getByRole('button', { name: 'Reorder cameras' }).click()
    }
    await expect(
      page.getByRole('button', { name: 'Reorder backyard' }),
    ).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })

  // --- Drag tile[1] (driveway) above tile[0] (backyard) ---
  const handle1 = page.getByRole('button', { name: 'Reorder driveway' })
  const tile0 = page.locator('[aria-label="Camera list"] > div').first()

  const handle1Box = await handle1.boundingBox()
  const tile0Box = await tile0.boundingBox()
  if (!handle1Box || !tile0Box)
    throw new Error('Could not locate drag elements')

  const startX = handle1Box.x + handle1Box.width / 2
  const startY = handle1Box.y + handle1Box.height / 2
  const targetX = startX // same x column
  const targetY = tile0Box.y + tile0Box.height / 4 // upper quarter of tile[0]

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Move past the 8px activation distance incrementally
  await page.mouse.move(startX, startY - 10, { steps: 3 })
  // Move to target in small steps so dnd-kit tracks the drag
  await page.mouse.move(targetX, targetY, { steps: 20 })
  await page.mouse.up()

  // Wait for dnd-kit to commit the reorder to React state
  await expect(
    page.locator('[aria-label="Camera list"] h2').first(),
  ).toHaveText('driveway', { timeout: 2000 })

  // --- Post-drag assertion ---
  const afterDragOrder = await cameraHeadings(page)
  expect(afterDragOrder[0]).toBe('driveway')
  expect(afterDragOrder[1]).toBe('backyard')
  expect(afterDragOrder.slice(2)).toEqual(MOCK_CAMERAS.slice(2))

  // Exit Edit mode
  await page.getByRole('button', { name: 'Done reordering cameras' }).click()

  // --- Reload and verify persistence ---
  await page.reload()
  await page.waitForSelector('[aria-label="Camera list"]')

  // SSR renders the default (alphabetical) order; the persisted order is
  // re-applied from localStorage only after hydration, so wait for it.
  await expect(
    page.locator('[aria-label="Camera list"] h2').first(),
  ).toHaveText('driveway', { timeout: 10_000 })

  const afterReloadOrder = await cameraHeadings(page)
  expect(afterReloadOrder[0]).toBe('driveway')
  expect(afterReloadOrder[1]).toBe('backyard')

  // --- localStorage introspection ---
  const stored = await page.evaluate(() =>
    localStorage.getItem('camera-order:v1'),
  )
  expect(stored).toBe(
    JSON.stringify([
      'driveway',
      'backyard',
      'front_door',
      'front_porch',
      'garage',
      'side_gate',
    ]),
  )
})
