import { test, expect } from '@playwright/test'

test.describe('Chess App', () => {
  test('landing page renders with title and start button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('lobby-page')).toBeVisible()
    await expect(page.locator('h1')).toContainText('Chess')
    await expect(page.getByTestId('start-game-button')).toBeVisible()
  })

  test('landing page shows game configuration options', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('lobby-options-toggle').click()
    await expect(page.getByText('Your Name')).toBeVisible()
    await expect(page.getByText('Play as')).toBeVisible()
    await expect(page.getByText('AI Difficulty')).toBeVisible()
    await expect(page.getByText('Time Control')).toBeVisible()
  })

  test('clicking Start Game renders the 3D chess board by default', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('game-page')).toBeVisible()
    await expect(page.getByTestId('board-3d').locator('canvas')).toBeVisible()
  })

  test('3D board has canvas element attached', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    const canvas = page.getByTestId('board-3d').locator('canvas')
    await expect(canvas).toBeAttached()
  })

  test('3D board mode does not show 2D board', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('board-2d')).not.toBeVisible()
  })

  test('game shows clock displays', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('clock-display')).toHaveCount(2)
  })

  test('back to lobby navigates correctly from 3D', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()
    await expect(page.getByTestId('game-page')).toBeVisible()

    await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-testid="back-to-lobby-button"]')
      if (btns.length === 0) return
      ;(btns[0] as HTMLElement).click()
    })
    await expect(page.getByTestId('lobby-page')).toBeVisible()
  })
})