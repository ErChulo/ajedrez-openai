// PBR material presets per theme with realistic wood shader.
// Generates canvas normal maps (Sobel) from wood textures for proper
// grain lighting. Uses MeshPhysicalMaterial with clearcoat, subtle
// transmission (ivory edges), directional sheen, and boosted envMapIntensity.

import * as THREE from 'three'
import type { ThemeData } from '@/types'

// ---- Normal map utilities ----

function canvasToNormalMap(
  source: HTMLCanvasElement,
  strength: number,
): HTMLCanvasElement {
  const w = source.width
  const h = source.height
  const srcCtx = source.getContext('2d')!
  const src = srcCtx.getImageData(0, 0, w, h).data

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const outCtx = out.getContext('2d')!
  const dst = outCtx.createImageData(w, h)

  const lum = (idx: number) =>
    0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2]

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1)
      const x1 = Math.min(w - 1, x + 1)
      const y0 = Math.max(0, y - 1)
      const y1 = Math.min(h - 1, y + 1)

      const tl = lum((y0 * w + x0) * 4)
      const t = lum((y0 * w + x) * 4)
      const tr = lum((y0 * w + x1) * 4)
      const l = lum((y * w + x0) * 4)
      const r = lum((y * w + x1) * 4)
      const bl = lum((y1 * w + x0) * 4)
      const b = lum((y1 * w + x) * 4)
      const br = lum((y1 * w + x1) * 4)

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl)
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr)

      const len = Math.sqrt(dx * dx * strength + dy * dy * strength + 1)

      const idx = (y * w + x) * 4
      dst.data[idx] = Math.round(((dx * strength) / len * 0.5 + 0.5) * 255)
      dst.data[idx + 1] = Math.round(((dy * strength) / len * 0.5 + 0.5) * 255)
      dst.data[idx + 2] = Math.round((1 / len * 0.5 + 0.5) * 255)
      dst.data[idx + 3] = 255

      void dst.data[idx + 2]
    }
  }

  outCtx.putImageData(dst, 0, 0)
  return out
}

// ---- Piece wood textures + normal maps ----

const woodTextures: Partial<Record<'white' | 'black', THREE.CanvasTexture>> = {}
const woodNormals: Partial<Record<'white' | 'black', THREE.CanvasTexture>> = {}

function makeWoodCanvas(color: 'white' | 'black'): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  const light = color === 'white'
  const base = light ? '#d8b77e' : '#4a2714'
  const mid = light ? '#f0d59f' : '#6b3b1f'
  const dark = light ? '#a9783f' : '#221008'

  const gradient = ctx.createLinearGradient(0, 0, 1024, 1024)
  gradient.addColorStop(0, dark)
  gradient.addColorStop(0.15, base)
  gradient.addColorStop(0.38, mid)
  gradient.addColorStop(0.62, base)
  gradient.addColorStop(0.82, mid)
  gradient.addColorStop(1, dark)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 1024)

  for (let y = 0; y < 1024; y++) {
    const wave = Math.sin(y * 0.06) * 12 + Math.sin(y * 0.018) * 28
    const alpha = light ? 0.08 : 0.12
    ctx.strokeStyle = `rgba(${light ? '88,48,16' : '220,150,80'},${alpha})`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(0, y + wave * 0.04)
    for (let x = 0; x <= 1024; x += 8) {
      const drift =
        Math.sin((x + y) * 0.028) * 6 +
        Math.sin(x * 0.012 + y * 0.005) * 10 +
        wave
      ctx.lineTo(x, y + drift * 0.06)
    }
    ctx.stroke()
  }

  for (let y = 0; y < 1024; y += 2) {
    const wave = Math.sin(y * 0.15 + 2.3) * 5
    const alpha = light ? 0.04 : 0.06
    ctx.strokeStyle = `rgba(${light ? '60,30,8' : '180,120,60'},${alpha})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, y + wave)
    for (let x = 0; x <= 1024; x += 12) {
      const drift = Math.sin((x + y) * 0.05) * 3 + wave
      ctx.lineTo(x, y + drift)
    }
    ctx.stroke()
  }

  for (let i = 0; i < 12; i++) {
    const x = (i * 83 + 17) % 1024
    const y = (i * 131 + 41) % 1024
    const rx = 14 + (i % 4) * 6
    const ry = 5 + (i % 3) * 3
    ctx.strokeStyle = light
      ? 'rgba(95,54,18,0.09)'
      : 'rgba(230,160,90,0.09)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, (i % 7) * 0.4, 0, Math.PI * 2)
    ctx.stroke()
  }

  return canvas
}

function getWoodTexture(color: 'white' | 'black'): THREE.CanvasTexture {
  const cached = woodTextures[color]
  if (cached) return cached
  const canvas = makeWoodCanvas(color)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.8, 1.8)
  woodTextures[color] = texture
  return texture
}

function getWoodNormal(color: 'white' | 'black'): THREE.CanvasTexture {
  const cached = woodNormals[color]
  if (cached) return cached
  const canvas = makeWoodCanvas(color)
  const normalCanvas = canvasToNormalMap(canvas, 1.2)
  const normal = new THREE.CanvasTexture(normalCanvas)
  normal.colorSpace = THREE.NoColorSpace
  normal.wrapS = THREE.RepeatWrapping
  normal.wrapT = THREE.RepeatWrapping
  normal.repeat.set(1.8, 1.8)
  woodNormals[color] = normal
  return normal
}

// ---- Board wood textures + normal maps ----

const boardTextures: Partial<Record<'light' | 'dark', THREE.CanvasTexture>> = {}
const boardNormals: Partial<Record<'light' | 'dark', THREE.CanvasTexture>> = {}

function makeBoardCanvas(palette: 'light' | 'dark'): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const light = palette === 'light'
  const base = light ? '#e8d0a8' : '#5a3018'
  const mid = light ? '#f5e0bf' : '#7a4525'
  const dark = light ? '#c4a06a' : '#381a0a'

  const gradient = ctx.createLinearGradient(0, 0, 512, 512)
  gradient.addColorStop(0, dark)
  gradient.addColorStop(0.2, base)
  gradient.addColorStop(0.5, mid)
  gradient.addColorStop(0.75, base)
  gradient.addColorStop(1, dark)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 512)

  for (let y = 0; y < 512; y++) {
    const wave = Math.sin(y * 0.07) * 8 + Math.sin(y * 0.025) * 16
    const alpha = light ? 0.06 : 0.1
    ctx.strokeStyle = `rgba(${light ? '80,44,14' : '200,130,60'},${alpha})`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(0, y + wave * 0.04)
    for (let x = 0; x <= 512; x += 10) {
      const drift =
        Math.sin((x + y) * 0.032) * 4 + wave
      ctx.lineTo(x, y + drift * 0.06)
    }
    ctx.stroke()
  }

  return canvas
}

function getBoardTexture(palette: 'light' | 'dark'): THREE.CanvasTexture {
  const cached = boardTextures[palette]
  if (cached) return cached
  const canvas = makeBoardCanvas(palette)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  boardTextures[palette] = texture
  return texture
}

function getBoardNormal(palette: 'light' | 'dark'): THREE.CanvasTexture {
  const cached = boardNormals[palette]
  if (cached) return cached
  const canvas = makeBoardCanvas(palette)
  const normalCanvas = canvasToNormalMap(canvas, 0.9)
  const normal = new THREE.CanvasTexture(normalCanvas)
  normal.colorSpace = THREE.NoColorSpace
  normal.wrapS = THREE.RepeatWrapping
  normal.wrapT = THREE.RepeatWrapping
  normal.repeat.set(2, 2)
  boardNormals[palette] = normal
  return normal
}

// ---- Material factories ----

export function buildPieceMaterial(color: 'white' | 'black', theme: ThemeData): THREE.Material {
  const spec = color === 'white' ? theme.three.pieceWhite : theme.three.pieceBlack
  const tex = getWoodTexture(color)
  const nor = getWoodNormal(color)
  const isWhite = color === 'white'

  const params: THREE.MeshPhysicalMaterialParameters = {
    color: new THREE.Color(spec.color).lerp(
      new THREE.Color(isWhite ? 0xf5d9a5 : 0x6d3b1f),
      0.68,
    ),
    map: tex,
    normalMap: nor,
    normalScale: new THREE.Vector2(0.72, 0.72),
    roughness: Math.max(spec.roughness, isWhite ? 0.34 : 0.4),
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.68,
    sheenRoughness: 0.22,
    sheenColor: new THREE.Color(isWhite ? 0xfff2da : 0x7a4527),
    envMapIntensity: 1.9,
  }

  if (isWhite) {
    params.transmission = 0.14
    params.thickness = 0.55
    params.ior = 1.45
  } else {
    params.transmission = 0.04
    params.thickness = 0.34
  }

  const emissive = new THREE.Color(isWhite ? 0x3d2b12 : 0x0a0603)
  params.emissive = emissive
  params.emissiveIntensity = 0.01
  return new THREE.MeshPhysicalMaterial(params)
}

export function buildBoardMaterial(theme: ThemeData): THREE.Material[] {
  const lightTex = getBoardTexture('light')
  const darkTex = getBoardTexture('dark')
  const lightNor = getBoardNormal('light')
  const darkNor = getBoardNormal('dark')

  const matLight = new THREE.MeshPhysicalMaterial({
    color: theme.three.boardLight,
    map: lightTex,
    normalMap: lightNor,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.18,
    sheen: 0.22,
    sheenRoughness: 0.34,
    sheenColor: new THREE.Color(0xf4e4c8),
    envMapIntensity: 1.45,
  })

  const matDark = new THREE.MeshPhysicalMaterial({
    color: theme.three.boardDark,
    map: darkTex,
    normalMap: darkNor,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.82,
    clearcoatRoughness: 0.2,
    sheen: 0.18,
    sheenRoughness: 0.34,
    sheenColor: new THREE.Color(0xb08965),
    envMapIntensity: 1.45,
  })

  return [matLight, matDark]
}