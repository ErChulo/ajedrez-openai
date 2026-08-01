import { test, expect } from '@playwright/test'

test.describe('Chess App', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

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

  test('clicking Start Game renders the 2D chess board by default', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('game-page')).toBeVisible()
    await expect(page.getByTestId('board-2d')).toBeVisible()
  })

  test('2D board renders 64 squares in an 8x8 grid', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('square')).toHaveCount(64)
  })

  test('2D board pieces fill their squares', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    const piece = page.getByTestId('piece').first()
    await expect(piece).toBeVisible()

    const square = page.getByTestId('square').first()
    const pieceBox = await piece.boundingBox()
    const squareBox = await square.boundingBox()

    expect(pieceBox).not.toBeNull()
    expect(squareBox).not.toBeNull()

    const pieceWidthRatio = (pieceBox!.width) / (squareBox!.width)
    const pieceHeightRatio = (pieceBox!.height) / (squareBox!.height)

    expect(pieceWidthRatio).toBeGreaterThan(0.7)
    expect(pieceHeightRatio).toBeGreaterThan(0.7)
  })

  test('2D board fits within viewport without scrolling', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    const hasVerticalScroll = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight
    })

    expect(hasVerticalScroll).toBe(false)
  })

  test('2D board fits viewport without scrolling at 1920x1080', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByTestId('start-game-button').click()
    await expect(page.getByTestId('board-2d')).toBeVisible()

    const hasScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
    expect(hasScroll).toBe(false)
    await page.close()
  })

  test('2D board fits viewport without scrolling at 1366x768', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByTestId('start-game-button').click()
    await expect(page.getByTestId('board-2d')).toBeVisible()

    const hasScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
    expect(hasScroll).toBe(false)
    await page.close()
  })

  test('2D board fits viewport without scrolling at 375x667 (mobile)', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByTestId('start-game-button').click()
    await expect(page.getByTestId('board-2d')).toBeVisible()

    const hasScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
    expect(hasScroll).toBe(false)
    await page.close()
  })

  test('2D board stays square at wide viewport', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByTestId('start-game-button').click()
    await expect(page.getByTestId('board-2d')).toBeVisible()

    const ratio = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="board-2d"]') as HTMLElement
      const r = board.getBoundingClientRect()
      return { w: r.width, h: r.height, ratio: r.height / r.width }
    })
    expect(ratio.ratio).toBeGreaterThan(0.95)
    expect(ratio.ratio).toBeLessThan(1.05)
    await page.close()
  })

  test('can switch to 3D mode from 2D', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('board-2d')).toBeVisible()

    await page.getByTestId('render-mode-toggle').click()

    await expect(page.getByTestId('board-3d').locator('canvas')).toBeVisible()
  })

  test('3D board renders at 1920x1080', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByTestId('start-game-button').click()
    await expect(page.getByTestId('board-2d')).toBeVisible()

    await page.getByTestId('render-mode-toggle').click()
    await expect(page.getByTestId('board-3d').locator('canvas')).toBeVisible()

    const canvasSize = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return { w: canvas?.width, h: canvas?.height }
    })
    expect(canvasSize.w).toBeGreaterThan(0)
    expect(canvasSize.h).toBeGreaterThan(0)
    await page.close()
  })

  test('3D board renders at 375x667 (mobile)', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } })
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByTestId('start-game-button').click()
    await expect(page.getByTestId('board-2d')).toBeVisible()

    await page.getByTestId('render-mode-toggle').click()
    await expect(page.getByTestId('board-3d').locator('canvas')).toBeVisible()

    const canvasSize = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return { w: canvas?.width, h: canvas?.height }
    })
    expect(canvasSize.w).toBeGreaterThan(0)
    expect(canvasSize.h).toBeGreaterThan(0)
    await page.close()
  })

  test('3D board has canvas element attached', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await page.getByTestId('render-mode-toggle').click()

    const canvas = page.getByTestId('board-3d').locator('canvas')
    await expect(canvas).toBeAttached()
  })

  test('toggling render mode switches between 2D and 3D boards', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('board-2d')).toBeVisible()

    await page.getByTestId('render-mode-toggle').click()

    await expect(page.getByTestId('board-3d').locator('canvas')).toBeVisible()
  })

  test('game shows clock displays', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('start-game-button').click()

    await expect(page.getByTestId('clock-display')).toHaveCount(2)
  })

  test('back to lobby navigates correctly', async ({ page }) => {
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
