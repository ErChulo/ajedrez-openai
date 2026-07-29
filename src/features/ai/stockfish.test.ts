import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChessEngine } from '@/chess/engine'
import { FallbackAI, StockfishAI, createAI } from './stockfish'

class MockWorker {
  static failLoad = false
  listeners = new Map<string, Set<(event: MessageEvent) => void>>()

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(listener)
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(message: string) {
    if (message === 'uci') {
      queueMicrotask(() => this.emit(MockWorker.failLoad ? 'engine_load_failed' : 'uciok'))
      return
    }
    if (message === 'isready') {
      queueMicrotask(() => this.emit('readyok'))
      return
    }
    if (message.startsWith('go movetime')) {
      queueMicrotask(() => this.emit('bestmove e2e4'))
    }
  }

  terminate() {}

  private emit(line: string) {
    const event = { data: line } as MessageEvent
    for (const listener of this.listeners.get('message') ?? []) listener(event)
  }
}

describe('AI adapters', () => {
  beforeEach(() => {
    MockWorker.failLoad = false
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker)
  })

  it('FallbackAI returns a legal move', async () => {
    const ai = new FallbackAI()
    const move = await ai.requestMove(new ChessEngine().fen(), 'beginner')

    expect(move).not.toBeNull()
    expect(new ChessEngine().isLegal(move!)).toBe(true)
  })

  it('StockfishAI boots the worker and returns the bestmove as coordinates', async () => {
    const ai = new StockfishAI()
    const move = await ai.requestMove(new ChessEngine().fen(), 'easy')

    expect(move).toEqual({ from: 'e2', to: 'e4', promotion: undefined })
  })

  it('createAI falls back when stockfish worker fails to load', async () => {
    MockWorker.failLoad = true

    const ai = await createAI()

    expect(ai).toBeInstanceOf(FallbackAI)
  })
})
