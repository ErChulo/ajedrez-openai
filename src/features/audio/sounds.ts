// WebAudio sound system — all sounds synthesized at runtime (no audio files needed).
// Supports mute, volume control, and graceful iOS audio handling.

import type { SoundName } from '@/types'

export class SoundBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
  private volume = 0.5

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : this.volume
  }

  isMuted(): boolean {
    return this.muted
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master && !this.muted) this.master.gain.value = this.volume
  }

  getVolume(): number {
    return this.volume
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  play(name: SoundName): void {
    if (this.muted) return
    try {
      if (name === 'castle') {
        this.moveSound()
        setTimeout(() => this.moveSound(), 90)
        return
      }
      switch (name) {
        case 'move': return this.moveSound()
        case 'capture': return this.captureSound()
        case 'check': return this.checkSound()
        case 'promote': return this.fanfare([659.25, 830.61, 1046.5, 1318.51], 0.1)
        case 'illegal': return this.illegalSound()
        case 'gameStart': return this.fanfare([523.25, 659.25, 783.99])
        case 'gameEnd': return this.fanfare([392.0, 329.63, 261.63])
        case 'lowtime': return this.tick(880, 0.05, 'square')
        case 'tick': return this.tick(440, 0.04, 'sine')
      }
    } catch {
      /* Audio failure is non-fatal. */
    }
  }

  private env(node: GainNode, attack: number, decay: number, peak: number): void {
    const t0 = this.ctx!.currentTime
    const g = node.gain
    g.setValueAtTime(0, t0)
    g.linearRampToValueAtTime(peak, t0 + attack)
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)
  }

  private noiseBuffer(duration: number): AudioBuffer {
    const sr = this.ctx!.sampleRate
    const buf = this.ctx!.createBuffer(1, Math.ceil(sr * duration), sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    return buf
  }

  private moveSound(): void {
    const ctx = this.ensure()
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(0.05)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 0.9
    const g = ctx.createGain()
    src.connect(bp).connect(g).connect(this.master!)
    this.env(g, 0.005, 0.05, 0.5)
    src.start()
  }

  private captureSound(): void {
    const ctx = this.ensure()
    const click = ctx.createBufferSource()
    click.buffer = this.noiseBuffer(0.04)
    const bp = ctx.createBiquadFilter()
    bp.type = 'highpass'
    bp.frequency.value = 2200
    const gClick = ctx.createGain()
    click.connect(bp).connect(gClick).connect(this.master!)
    this.env(gClick, 0.002, 0.04, 0.6)
    click.start()
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 110
    const gOsc = ctx.createGain()
    osc.connect(gOsc).connect(this.master!)
    this.env(gOsc, 0.01, 0.18, 0.4)
    osc.start()
    osc.stop(this.ctx!.currentTime + 0.2)
  }

  private checkSound(): void {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880, this.ctx!.currentTime)
    osc.frequency.linearRampToValueAtTime(1320, this.ctx!.currentTime + 0.18)
    const g = ctx.createGain()
    osc.connect(g).connect(this.master!)
    this.env(g, 0.005, 0.2, 0.4)
    osc.start()
    osc.stop(this.ctx!.currentTime + 0.25)
  }

  private illegalSound(): void {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 90
    const g = ctx.createGain()
    osc.connect(g).connect(this.master!)
    this.env(g, 0.005, 0.18, 0.35)
    osc.start()
    osc.stop(this.ctx!.currentTime + 0.2)
  }

  private fanfare(notes: number[], gap = 0.13): void {
    const ctx = this.ensure()
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const g = ctx.createGain()
      osc.connect(g).connect(this.master!)
      this.env(g, 0.01, 0.18, 0.5)
      const t = this.ctx!.currentTime + i * gap
      osc.start(t)
      osc.stop(t + 0.25)
    })
  }

  private tick(freq: number, dur: number, type: OscillatorType): void {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    osc.connect(g).connect(this.master!)
    this.env(g, 0.005, dur, 0.3)
    osc.start()
    osc.stop(this.ctx!.currentTime + dur + 0.05)
  }
}

export const sounds = new SoundBus()
