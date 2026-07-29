import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Clock, formatMs } from './Clock'

describe('Clock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts and counts down for the active side', () => {
    const clock = new Clock(60)
    clock.start('white')

    vi.advanceTimersByTime(1500)

    const snap = clock.snapshot()
    expect(snap.active).toBe('white')
    expect(snap.whiteMs).toBeLessThan(60000)
    expect(snap.blackMs).toBe(60000)
  })

  it('applies increment and switches active side after a move', () => {
    const clock = new Clock(60, 2)
    clock.start('white')

    vi.advanceTimersByTime(1000)
    clock.applyMove('white')

    const snap = clock.snapshot()
    expect(snap.active).toBe('black')
    expect(snap.whiteMs).toBeGreaterThan(60000)
  })

  it('fires low-time once per side', () => {
    const onLowTime = vi.fn()
    const clock = new Clock(10, 0, { onLowTime })
    clock.start('white')

    vi.advanceTimersByTime(500)
    vi.advanceTimersByTime(500)

    expect(onLowTime).toHaveBeenCalledTimes(1)
    expect(onLowTime).toHaveBeenCalledWith('white')
  })

  it('fires flag and freezes the clock on timeout', () => {
    const onFlag = vi.fn()
    const clock = new Clock(1, 0, { onFlag })
    clock.start('white')

    vi.advanceTimersByTime(1200)

    const snap = clock.snapshot()
    expect(onFlag).toHaveBeenCalledWith('white')
    expect(snap.active).toBeNull()
    expect(snap.flagFall).toBe('white')
  })

  it('finalize freezes further ticking', () => {
    const clock = new Clock(60)
    clock.start('white')
    vi.advanceTimersByTime(500)
    clock.finalize()
    const frozen = clock.snapshot().whiteMs

    vi.advanceTimersByTime(2000)

    expect(clock.snapshot().whiteMs).toBe(frozen)
    expect(clock.snapshot().active).toBeNull()
  })

  it('forceUpdate replaces both times and active side', () => {
    const clock = new Clock(60)
    clock.forceUpdate(1234, 5678, 'black')

    expect(clock.snapshot()).toMatchObject({
      whiteMs: 1234,
      blackMs: 5678,
      active: 'black',
    })
  })
})

describe('formatMs', () => {
  it('formats mm:ss under an hour', () => {
    expect(formatMs(61000)).toBe('01:01')
  })

  it('formats hh:mm:ss over an hour', () => {
    expect(formatMs(3661000)).toBe('01:01:01')
  })

  it('clamps negative values to zero', () => {
    expect(formatMs(-1)).toBe('00:00')
  })
})
