// FIDE-style chess clock.
// Both sides tick downward in real-time. Increment is applied after a legal move.
// Supports pause, resume, and server-authoritative sync for online play.

import type { ClockSnapshot, Side } from '@/types'

export interface ClockListeners {
  onTick?: (snap: ClockSnapshot) => void
  onLowTime?: (side: Side) => void
  onFlag?: (side: Side) => void
}

export class Clock {
  private whiteMs: number
  private blackMs: number
  private incrementMs: number
  private active: Side | null = null
  private lastTickAt = 0
  private rafHandle = 0
  private listeners: ClockListeners = {}
  private lowTimeFired = { white: false, black: false }
  private flagFired = false
  private frozen = false

  constructor(initialSeconds: number, incrementSeconds = 0, listeners: ClockListeners = {}) {
    this.whiteMs = initialSeconds * 1000
    this.blackMs = initialSeconds * 1000
    this.incrementMs = incrementSeconds * 1000
    this.listeners = listeners
  }

  start(initialSide: Side): void {
    this.active = initialSide
    this.lastTickAt = performance.now()
    this.scheduleTick()
  }

  pause(): void {
    if (this.active === null) return
    this.tick()
    this.active = null
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle)
    this.rafHandle = 0
    this.emit()
  }

  resume(side: Side): void {
    this.active = side
    this.lastTickAt = performance.now()
    this.scheduleTick()
  }

  applyMove(side: Side): void {
    this.tick()
    if (side === 'white') this.whiteMs += this.incrementMs
    else this.blackMs += this.incrementMs
    this.lowTimeFired[side] = false
    this.active = side === 'white' ? 'black' : 'white'
    this.lastTickAt = performance.now()
    if (!this.frozen) this.scheduleTick()
    this.emit()
  }

  unapplyMove(side: Side): void {
    if (this.frozen) return
    if (side === 'white') this.whiteMs -= this.incrementMs
    else this.blackMs -= this.incrementMs
    this.lowTimeFired[side] = false
    this.active = side
    this.lastTickAt = performance.now()
    this.scheduleTick()
    this.emit()
  }

  finalize(): void {
    this.frozen = true
    this.active = null
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle)
    this.rafHandle = 0
    this.emit()
  }

  forceUpdate(whiteMs: number, blackMs: number, active: Side | null): void {
    this.whiteMs = Math.max(0, whiteMs)
    this.blackMs = Math.max(0, blackMs)
    this.active = active
    this.lastTickAt = performance.now()
    this.emit()
  }

  snapshot(): ClockSnapshot {
    return {
      whiteMs: this.whiteMs,
      blackMs: this.blackMs,
      active: this.active,
      flagFall: this.flagFired
        ? this.whiteMs <= 0
          ? 'white'
          : this.blackMs <= 0
            ? 'black'
            : undefined
        : undefined,
    }
  }

  private scheduleTick(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle)
    const loop = () => {
      this.tick()
      if (this.active !== null && !this.frozen) {
        this.rafHandle = requestAnimationFrame(loop)
      }
    }
    this.rafHandle = requestAnimationFrame(loop)
  }

  _testTick(): void {
    this.tick()
  }

  private tick(): void {
    if (this.active === null || this.frozen) return
    const now = performance.now()
    const dt = now - this.lastTickAt
    this.lastTickAt = now
    if (this.active === 'white') this.whiteMs -= dt
    else this.blackMs -= dt

    const activeMs = this.active === 'white' ? this.whiteMs : this.blackMs
    if (activeMs <= 10_000 && activeMs > 0 && !this.lowTimeFired[this.active]) {
      this.lowTimeFired[this.active] = true
      this.listeners.onLowTime?.(this.active)
    }

    if (!this.flagFired && (this.whiteMs <= 0 || this.blackMs <= 0)) {
      this.flagFired = true
      this.frozen = true
      this.active = null
      this.listeners.onFlag?.(this.whiteMs <= 0 ? 'white' : 'black')
    }

    this.emit()
  }

  private emit(): void {
    this.listeners.onTick?.(this.snapshot())
  }
}

export function formatMs(ms: number): string {
  if (ms < 0) ms = 0
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}
