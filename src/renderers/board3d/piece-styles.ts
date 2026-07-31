// v1.12 — 3D piece-style registry.
//
// Six alternative Staunton-style 3D renderings built on the SAME canonical
// LatheGeometry profile library (the Cburnett-equivalent silhouette vector
// stack used by Lichess/Chess.com). Each style tunes a different set of
// ornament parameters so the result reads as a distinct "set":
//
//   * classic  — DEFAULT. Marble-carved Staunton: smooth lathe (48 segs),
//                prominent cross/spikes/ball/merlons/muzzle, decorative
//                collar rings on the major pieces. The most ornate set.
//   * bold     — Tournament-felt Staunton: 36-segment chunky lathe, extra
//                thick ornaments, lower roughness for a polished-wood feel.
//   * outline  — Schematic-wood Staunton: same lathe, NO ornaments; reads
//                as unadorned turned forms. (Keeps the "essence" of chess
//                without the crests — for users who want the simplest
//                possible recognisable set.)
//   * filled   — Modernist Staunton: standard lathe + ornaments shrunk to
//                0.6× so they sit just inside the body silhouette. Reads
//                as a clean contemporary set with subtle crests.
//   * minimal  — Bare-Staunton: ornaments completely removed (outline
//                style's body lathe) — only the silhouettes and base
//                collars. Smooth turned-stone feel.
//   * ornate   — Gothic-Staunton: classic on every dimension PLUS extra
//                decorative finials — small spikes on the rook merlons,
//                a halo-ring around the king cross, a stacked twin ball
//                on the bishop, and a mane ridge on the knight.
//   * staunton — Real MIT-licensed STL geometry (clarkerubber/Staunton-Pieces).
//                Falls back to procedural classic if STL cache hasn't loaded.
//   * chess3d — GLTF Loader-based loading of the Sketchfab chess3d models
//                (chess3d/{p,n,b,r,q,k}/scene.gltf). Extracts per-kind Group
//                and caches it. Falls back to procedural classic if GLTF hasn't loaded yet.

import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import type { PieceSymbol, PieceStyleId } from '@/types'

export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

function pieceSymbolIsWhite(s: PieceSymbol): boolean { return s === s.toUpperCase() }

// ---- Cache-ready notification ----

let cacheReadyListeners: Array<() => void> = []

export function onGeometryCacheReady(fn: () => void): () => void {
  cacheReadyListeners.push(fn)
  return () => { cacheReadyListeners = cacheReadyListeners.filter((l) => l !== fn) }
}

function notifyCacheReady(): void {
  for (const fn of cacheReadyListeners) fn()
}

// ---- v1.13 — MIT Staunton geometry loader ----

// FIDE-standard heights (king=95mm reference, normalized to king=0.48 units)
// King 95mm, Queen 85mm, Bishop 70mm, Knight 60mm, Rook 55mm, Pawn 50mm
const TARGET_HEIGHT_BY_KIND: Record<PieceKind, number> = {
  p: 0.25, n: 0.30, b: 0.35, r: 0.28, q: 0.43, k: 0.48,
}

// Keep every 3D piece comfortably inside a 0.5 square.
const PIECE_MAX_WIDTH = 0.18

const STL_URL_BY_KIND: Record<PieceKind, string> = {
  p: `${import.meta.env.BASE_URL}assets/3d-pieces/staunton/Pawn.stl`,
  n: `${import.meta.env.BASE_URL}assets/3d-pieces/staunton/Knight.stl`,
  b: `${import.meta.env.BASE_URL}assets/3d-pieces/staunton/Bishop.stl`,
  r: `${import.meta.env.BASE_URL}assets/3d-pieces/staunton/Rook.stl`,
  q: `${import.meta.env.BASE_URL}assets/3d-pieces/staunton/Queen.stl`,
  k: `${import.meta.env.BASE_URL}assets/3d-pieces/staunton/King.stl`,
}

let stlLoader: STLLoader | null = null
function getLoader(): STLLoader {
  if (!stlLoader) stlLoader = new STLLoader()
  return stlLoader
}

const kindGeometryCache = new Map<PieceKind, THREE.BufferGeometry>()
const kindLoadPromises = new Map<PieceKind, Promise<THREE.BufferGeometry>>()
const failedKindLoads = new Set<PieceKind>()
const failedGltfLoads = new Set<PieceKind>()

async function loadKindGeometry(kind: PieceKind): Promise<THREE.BufferGeometry> {
  const cached = kindGeometryCache.get(kind)
  if (cached) return cached
  const inflight = kindLoadPromises.get(kind)
  if (inflight) return inflight
  const url = STL_URL_BY_KIND[kind]
  const promise = (async () => {
    const geom = await getLoader().loadAsync(url)
    geom.center()
    geom.computeVertexNormals()
    geom.computeBoundingBox()
    const bb = geom.boundingBox!
    const height = bb.max.y - bb.min.y
    const target = TARGET_HEIGHT_BY_KIND[kind]
    const s = height > 0 ? target / height : 1
    geom.scale(s, s, s)
    geom.computeBoundingBox()
    const bbW = geom.boundingBox!
    const width = Math.max(bbW.max.x - bbW.min.x, bbW.max.z - bbW.min.z)
    if (width > PIECE_MAX_WIDTH) {
      const ws = PIECE_MAX_WIDTH / width
      geom.scale(ws, 1, ws)
      geom.computeBoundingBox()
    }
    const bb2 = geom.boundingBox!
    geom.translate(0, -bb2.min.y, 0)
    geom.computeBoundingBox()
    kindGeometryCache.set(kind, geom)
    kindLoadPromises.delete(kind)
    notifyCacheReady()
    return geom
  })().catch((e) => {
    console.warn('[staunton] failed to load', kind, e)
    kindLoadPromises.delete(kind)
    failedKindLoads.add(kind)
    throw e
  })
  kindLoadPromises.set(kind, promise)
  return promise
}

/** Eagerly loads the six MIT Staunton STLs. Resolves when ALL are done (or one fails). */
export function prefetchStauntonGeometries(): Promise<void> {
  const kinds: PieceKind[] = ['p', 'n', 'b', 'r', 'q', 'k']
  return Promise.all(
    kinds.map((k) => loadKindGeometry(k).catch(() => undefined)),
  ).then(() => undefined)
}

// ---- GLTF Sketchfab loader ----

const GLTF_URL_BY_KIND: Record<PieceKind, string> = {
  p: `${import.meta.env.BASE_URL}assets/3d-pieces/chess3d/pawn/scene.gltf`,
  n: `${import.meta.env.BASE_URL}assets/3d-pieces/chess3d/knight/scene.gltf`,
  b: `${import.meta.env.BASE_URL}assets/3d-pieces/chess3d/bishop/scene.gltf`,
  r: `${import.meta.env.BASE_URL}assets/3d-pieces/chess3d/rook/scene.gltf`,
  q: `${import.meta.env.BASE_URL}assets/3d-pieces/chess3d/queen/scene.gltf`,
  k: `${import.meta.env.BASE_URL}assets/3d-pieces/chess3d/king/scene.gltf`,
}

const GLTF_PIECE_HAS_TEXTURE: Record<PieceKind, boolean> = {
  p: false, n: false, b: true, r: true, q: true, k: false,
}

const CHESS3D_URL_BY_KIND = GLTF_URL_BY_KIND

const CHESS3D_TARGET_HEIGHT_BY_KIND: Record<PieceKind, number> = {
  p: 0.38, n: 0.58, b: 0.62, r: 0.54, q: 0.72, k: 0.78,
}
const CHESS3D_MAX_FOOTPRINT = 0.5 * 0.85
const CHESS3D_UPRIGHT_ROTATION_BY_KIND: Partial<Record<PieceKind, { x: number; y: number; z: number }>> = {
  n: { x: -Math.PI / 2, y: 0, z: 0 },
}

const chess3dGroupCache = new Map<PieceKind, THREE.Group>()
const chess3dLoadPromises = new Map<PieceKind, Promise<THREE.Group>>()

let gltfLoader: GLTFLoader | null = null
function getGltfLoader(): GLTFLoader {
  if (!gltfLoader) gltfLoader = new GLTFLoader()
  return gltfLoader
}

interface GltfResult {
  geometry: THREE.BufferGeometry
  material: THREE.Material | null
}
const gltfCache = new Map<PieceKind, GltfResult>()
const gltfLoadPromises = new Map<PieceKind, Promise<GltfResult>>()

function extractMeshFromScene(scene: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null
  scene.updateMatrixWorld(true)
  scene.traverse((obj) => {
    if (found) return
    if (obj instanceof THREE.Mesh) {
      found = obj
    }
  })
  return found
}

function extractGeometryFromGltf(gltf: GLTF, kind: PieceKind): GltfResult {
  const mesh = extractMeshFromScene(gltf.scene)
  if (!mesh) throw new GLTF_EMPTY_ERROR(kind)

  const worldGeo = mesh.geometry.clone()
  mesh.updateMatrixWorld(true)
  worldGeo.applyMatrix4(mesh.matrixWorld)

  worldGeo.computeVertexNormals()
  worldGeo.computeBoundingBox()
  const bb = worldGeo.boundingBox!
  const height = bb.max.y - bb.min.y
  const target = TARGET_HEIGHT_BY_KIND[kind]
  const s = height > 0 ? target / height : 1
  worldGeo.scale(s, s, s)
  worldGeo.computeBoundingBox()
  // Normalize width to fit within a square (max radius ~0.24)
  const bb2 = worldGeo.boundingBox!
  const width = Math.max(bb2.max.x - bb2.min.x, bb2.max.z - bb2.min.z)
  if (width > PIECE_MAX_WIDTH) {
    const ws = PIECE_MAX_WIDTH / width
    worldGeo.scale(ws, 1, ws)
    worldGeo.computeBoundingBox()
  }
  const bb3 = worldGeo.boundingBox!
  worldGeo.translate(0, -bb3.min.y, 0)
  worldGeo.computeBoundingBox()

  const hasTexture = GLTF_PIECE_HAS_TEXTURE[kind]
  const material: THREE.Material | null = hasTexture ? (mesh.material as THREE.Material) : null

  return { geometry: worldGeo, material }
}

class GLTF_EMPTY_ERROR extends Error {
  constructor(kind: PieceKind) {
    super(`[gltf] empty scene for ${kind}`)
    this.name = 'GLTF_EMPTY_ERROR'
  }
}

async function loadGltfGeometry(kind: PieceKind): Promise<GltfResult> {
  const cached = gltfCache.get(kind)
  if (cached) return cached
  const inflight = gltfLoadPromises.get(kind)
  if (inflight) return inflight
  const url = GLTF_URL_BY_KIND[kind]
  const promise = (async () => {
    const gltf = await getGltfLoader().loadAsync(url)
    const result = extractGeometryFromGltf(gltf, kind)
    gltfCache.set(kind, result)
    gltfLoadPromises.delete(kind)
    notifyCacheReady()
    return result
  })().catch((e) => {
    console.warn('[gltf] failed to load', kind, e)
    gltfLoadPromises.delete(kind)
    failedGltfLoads.add(kind)
    throw e
  })
  gltfLoadPromises.set(kind, promise)
  return promise
}

/** Eagerly loads GLTF pieces. Resolves when ALL are done (or one fails). */
export function prefetchGltfGeometries(): Promise<void> {
  const kinds: PieceKind[] = ['p', 'n', 'b', 'r', 'q', 'k']
  return Promise.all(
    kinds.map((k) => loadGltfGeometry(k).catch(() => undefined)),
  ).then(() => undefined)
}

export function prefetchPieceStyleAssets(styleId: PieceStyleId): Promise<void> {
  if (styleId === 'asset-pack') {
    const kinds: PieceKind[] = ['p', 'n', 'b', 'r', 'q', 'k']
    return Promise.all(kinds.map((k) => loadChess3dGroup(k).catch(() => undefined))).then(() => undefined)
  }
  if (styleId === 'staunton') return prefetchStauntonGeometries()
  return Promise.resolve()
}

// ---- Builders ----

// ---- Builders ----

function buildStauntonMesh(kind: PieceKind, sym: PieceSymbol, material: THREE.Material): THREE.Mesh {
  const cached = kindGeometryCache.get(kind)
  if (cached) {
    const cloned = cached.clone()
    const mesh = new THREE.Mesh(cloned, material)
    ;(mesh.userData as { symbol: PieceSymbol }).symbol = sym
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  if (failedKindLoads.has(kind)) {
    return buildProceduralMesh(kind, sym, material, 'classic')
  }
  loadKindGeometry(kind).catch((e) => console.warn('[staunton-fallback] load failed', kind, e))
  const placeholder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.10, TARGET_HEIGHT_BY_KIND[kind], 16),
    material,
  )
  ;(placeholder.userData as { symbol: PieceSymbol }).symbol = sym
  placeholder.castShadow = true
  placeholder.receiveShadow = true
  return placeholder
}

function buildGltfMesh(kind: PieceKind, sym: PieceSymbol, fallbackMaterial: THREE.Material): THREE.Mesh {
  const cached = gltfCache.get(kind)
  if (cached) {
    const mat = cached.material ? cached.material.clone() : fallbackMaterial
    if (cached.material) {
      const isWhite = pieceSymbolIsWhite(sym)
      const tinted = mat as THREE.MeshStandardMaterial
      tinted.color.lerp(new THREE.Color(isWhite ? 0xf5d9a5 : 0x6d3b1f), 0.68)
      tinted.emissive = new THREE.Color(isWhite ? 0x2f1b08 : 0x120804)
      tinted.emissiveIntensity = isWhite ? 0.02 : 0.015
      tinted.needsUpdate = true
    }
    const mesh = new THREE.Mesh(cached.geometry.clone(), mat)
    ;(mesh.userData as { symbol: PieceSymbol }).symbol = sym
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  if (failedGltfLoads.has(kind)) {
    return buildProceduralMesh(kind, sym, fallbackMaterial, 'classic')
  }
  loadGltfGeometry(kind).catch((e) => console.warn('[gltf-fallback] load failed', kind, e))
  const placeholder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.10, TARGET_HEIGHT_BY_KIND[kind], 16),
    fallbackMaterial,
  )
  ;(placeholder.userData as { symbol: PieceSymbol }).symbol = sym
  placeholder.castShadow = true
  placeholder.receiveShadow = true
  return placeholder
}

function applyChess3dUprightCorrection(kind: PieceKind, root: THREE.Group): void {
  const explicit = CHESS3D_UPRIGHT_ROTATION_BY_KIND[kind]
  if (explicit) {
    root.rotation.x += explicit.x
    root.rotation.y += explicit.y
    root.rotation.z += explicit.z
    root.updateMatrixWorld(true)
    return
  }
  root.updateMatrixWorld(true)
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
  if (size.z > size.y * 1.15 && size.z >= size.x) {
    root.rotation.x -= Math.PI / 2
    root.updateMatrixWorld(true)
  } else if (size.x > size.y * 1.15 && size.x >= size.z) {
    root.rotation.z += Math.PI / 2
    root.updateMatrixWorld(true)
  }
}

async function loadChess3dGroup(kind: PieceKind): Promise<THREE.Group> {
  const cached = chess3dGroupCache.get(kind)
  if (cached) return cached
  const inflight = chess3dLoadPromises.get(kind)
  if (inflight) return inflight
  const promise = (async () => {
    const gltf = await getGltfLoader().loadAsync(CHESS3D_URL_BY_KIND[kind])
    const root = gltf.scene
    applyChess3dUprightCorrection(kind, root)
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const heightScale = size.y > 0 ? CHESS3D_TARGET_HEIGHT_BY_KIND[kind] / size.y : 1
    const footprint = Math.max(size.x, size.z)
    const footprintScale = footprint > 0 ? CHESS3D_MAX_FOOTPRINT / footprint : 1
    root.scale.setScalar(Math.min(heightScale, footprintScale))
    root.updateMatrixWorld(true)
    const normalized = new THREE.Box3().setFromObject(root)
    const center = normalized.getCenter(new THREE.Vector3())
    root.position.x -= center.x
    root.position.y -= normalized.min.y
    root.position.z -= center.z
    root.updateMatrixWorld(true)
    chess3dGroupCache.set(kind, root)
    chess3dLoadPromises.delete(kind)
    notifyCacheReady()
    return root
  })().catch((e) => {
    console.warn('[chess3d] failed to load', kind, e)
    chess3dLoadPromises.delete(kind)
    throw e
  })
  chess3dLoadPromises.set(kind, promise)
  return promise
}

function buildChess3dModel(kind: PieceKind, sym: PieceSymbol, material: THREE.Material): THREE.Object3D | null {
  const cached = chess3dGroupCache.get(kind)
  if (!cached) {
    void loadChess3dGroup(kind)
    return null
  }
  const hasTexture = GLTF_PIECE_HAS_TEXTURE[kind]
  const clone = cached.clone(true)
  clone.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry = mesh.geometry.clone()
    if (!hasTexture) mesh.material = material
    mesh.castShadow = true
    mesh.receiveShadow = true
    ;(mesh.userData as { symbol: PieceSymbol }).symbol = sym
  })
  return clone
}

// ---- Public builder ----

function buildProceduralMesh(kind: PieceKind, sym: PieceSymbol, material: THREE.Material, styleId: PieceStyleId): THREE.Mesh {
  const cfg = (STYLE_CFG as Record<string, StyleCfg>)[styleId] ?? STYLE_CFG.classic
  const profile = pieceProfile(kind)
  const lathe = new THREE.LatheGeometry(profile, cfg.latheSegments)
  const host = new THREE.Mesh(lathe, material)
  ;(host.userData as { symbol: PieceSymbol }).symbol = sym
  host.castShadow = true
  host.receiveShadow = true
  applyOrnaments(host, kind, sym, material, cfg)
  if (cfg.edgeOverlay && host.geometry) {
    const edges = new THREE.EdgesGeometry(host.geometry, 12)
    const lineMat = new THREE.LineBasicMaterial({
      color: pieceSymbolIsWhite(sym) ? 0x1a1005 : 0xe3c193,
      transparent: true,
      opacity: 0.85,
    })
    const lines = new THREE.LineSegments(edges, lineMat)
    ;(lines.userData as { symbol: PieceSymbol }).symbol = sym
    host.add(lines)
  }
  return host
}

export function buildPieceGeometry(kind: PieceKind, sym: PieceSymbol, material: THREE.Material, styleId: PieceStyleId): THREE.Object3D {
  if (styleId === 'asset-pack') {
    const model = buildChess3dModel(kind, sym, material)
    if (model) return model
  }
  if (styleId === 'staunton') {
    const cached = kindGeometryCache.get(kind)
    if (cached) return buildStauntonMesh(kind, sym, material)
    void loadKindGeometry(kind)
  }
  if (gltfCache.has(kind)) return buildGltfMesh(kind, sym, material)
  if (styleId === 'asset-pack') loadChess3dGroup(kind).catch((e) => console.warn('[chess3d] load failed', kind, e))
  if (styleId === 'staunton') loadKindGeometry(kind).catch((e) => console.warn('[staunton] load failed', kind, e))
  loadGltfGeometry(kind).catch((e) => console.warn('[gltf] load failed', kind, e))
  return buildProceduralMesh(kind, sym, material, 'classic')
}


// ---- Base mesh helpers ----

function addCollarRing(host: THREE.Object3D, kind: PieceKind, sym: PieceSymbol, material: THREE.Material): void {
  if (kind !== 'k' && kind !== 'q' && kind !== 'r' && kind !== 'b') return
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(kind === 'r' ? 0.18 : 0.16, 0.025, 10, 32),
    material,
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.86
  ring.castShadow = true
  ;(ring.userData as { symbol: PieceSymbol }).symbol = sym
  host.add(ring)
}

// ---- Per-piece-style detail builders ----

function applyOrnaments(host: THREE.Mesh, kind: PieceKind, sym: PieceSymbol, material: THREE.Material, cfg: StyleCfg): void {
  if (cfg.ornamentScale === 0) return
  const sc = cfg.ornamentScale
  const orn = cfg.ornaments

  if (kind === 'k' && orn.kingCross) {
    const v = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 * sc, 0.30 * sc, 0.06 * sc),
      material,
    )
    v.position.y = 1.32
    v.castShadow = true
    ;(v.userData as { symbol: PieceSymbol }).symbol = sym
    host.add(v)
    const h = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * sc, 0.05 * sc, 0.05 * sc),
      material,
    )
    h.position.y = 1.27
    h.castShadow = true
    ;(h.userData as { symbol: PieceSymbol }).symbol = sym
    host.add(h)
    if (orn.kingCrossHalo) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.012, 8, 28),
        material,
      )
      halo.rotation.x = Math.PI / 2
      halo.position.y = 1.21
      ;(halo.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(halo)
    }
  }

  if (kind === 'q' && orn.queenSpikes > 0) {
    const n = orn.queenSpikes
    const spikeScale = orn.queenSpikeScale * sc
    const ringR = 0.16
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.055 * spikeScale, 0.20 * spikeScale, 8),
        material,
      )
      spike.position.set(Math.cos(a) * ringR, 0.96, Math.sin(a) * ringR)
      spike.castShadow = true
      ;(spike.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(spike)
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 * spikeScale, 12, 8),
        material,
      )
      tip.position.set(Math.cos(a) * ringR, 1.10, Math.sin(a) * ringR)
      ;(tip.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(tip)
    }
    if (orn.queenHalo) {
      const innerN = 12
      for (let i = 0; i < innerN; i++) {
        const a = ((i + 0.5) / innerN) * Math.PI * 2
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.025 * sc, 8, 6),
          material,
        )
        dot.position.set(Math.cos(a) * (ringR + 0.02), 0.84, Math.sin(a) * (ringR + 0.02))
        ;(dot.userData as { symbol: PieceSymbol }).symbol = sym
        host.add(dot)
      }
    }
  }

  if (kind === 'b' && orn.bishopBall) {
    const ballR = 0.10 * sc
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballR, 16, 12),
      material,
    )
    ball.position.y = 0.94
    ball.castShadow = true
    ;(ball.userData as { symbol: PieceSymbol }).symbol = sym
    host.add(ball)
    if (orn.bishopFinial) {
      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 * sc, 12, 8),
        material,
      )
      finial.position.y = 1.10
      ;(finial.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(finial)
    }
  }

  if (kind === 'r' && orn.rookMerlons > 0) {
    const n = orn.rookMerlons
    const merlonScale = orn.rookMerlonScale * sc
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n + Math.PI / n
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(0.10 * merlonScale, 0.13 * merlonScale, 0.10 * merlonScale),
        material,
      )
      c.position.set(Math.cos(a) * 0.16, 0.96, Math.sin(a) * 0.16)
      c.castShadow = true
      ;(c.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(c)
      if (orn.rookMerlonSpike) {
        const sp = new THREE.Mesh(
          new THREE.ConeGeometry(0.025 * sc, 0.10 * sc, 6),
          material,
        )
        sp.position.set(Math.cos(a) * 0.16, 1.10, Math.sin(a) * 0.16)
        ;(sp.userData as { symbol: PieceSymbol }).symbol = sym
        host.add(sp)
      }
    }
  }

  if (kind === 'n' && (orn.knightEars || orn.knightMuzzle)) {
    if (orn.knightEars) {
      const ear1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.07 * sc, 0.18 * sc, 8),
        material,
      )
      ear1.position.set(0.05, 1.05, 0.0)
      ear1.rotation.z = -Math.PI / 6
      ear1.castShadow = true
      ;(ear1.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(ear1)
      const ear2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.06 * sc, 0.16 * sc, 8),
        material,
      )
      ear2.position.set(-0.07, 1.02, 0.0)
      ear2.rotation.z = Math.PI / 5
      ear2.castShadow = true
      ;(ear2.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(ear2)
    }
    if (orn.knightMuzzle) {
      const muzzle = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * sc, 0.10 * sc, 0.10 * sc),
        material,
      )
      muzzle.position.set(0.10 * sc, 0.85, 0.0)
      muzzle.rotation.z = Math.PI / 12
      muzzle.castShadow = true
      ;(muzzle.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(muzzle)
    }
    if (orn.knightMane) {
      const mane1 = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 * sc, 10, 8),
        material,
      )
      mane1.position.set(0.10 * sc, 1.00, 0.0)
      ;(mane1.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(mane1)
      const mane2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 * sc, 8, 6),
        material,
      )
      mane2.position.set(0.13 * sc, 0.92, 0.0)
      ;(mane2.userData as { symbol: PieceSymbol }).symbol = sym
      host.add(mane2)
    }
  }

  if (orn.collarRing) addCollarRing(host, kind, sym, material)
}

// ---- Style configuration ----

type StyleCfg = {
  latheSegments: number
  ornaments: {
    kingCross: boolean
    queenSpikes: number
    queenSpikeScale: number
    bishopBall: boolean
    bishopFinial: boolean
    rookMerlons: number
    rookMerlonScale: number
    knightEars: boolean
    knightMuzzle: boolean
    knightMane: boolean
    collarRing: boolean
    kingCrossHalo: boolean
    rookMerlonSpike: boolean
    queenHalo: boolean
  }
  ornamentScale: number
  edgeOverlay: boolean
}

const FULL_ORNAMENTS = {
  kingCross: true,
  queenSpikes: 7,
  queenSpikeScale: 1.0,
  bishopBall: true,
  bishopFinial: true,
  rookMerlons: 4,
  rookMerlonScale: 1.0,
  knightEars: true,
  knightMuzzle: true,
  knightMane: false,
  collarRing: true,
  kingCrossHalo: false,
  rookMerlonSpike: false,
  queenHalo: false,
}

type Style3DId = 'classic' | 'bold' | 'outline' | 'filled' | 'minimal' | 'ornate' | 'staunton' | 'chess3d' | 'modern'

const STYLE_CFG: Record<Style3DId, StyleCfg> = {
  classic: {
    latheSegments: 48,
    ornaments: { ...FULL_ORNAMENTS },
    ornamentScale: 1.0,
    edgeOverlay: false,
  },
  bold: {
    latheSegments: 36,
    ornaments: { ...FULL_ORNAMENTS, queenSpikeScale: 1.4, rookMerlonScale: 1.4 },
    ornamentScale: 1.25,
    edgeOverlay: false,
  },
  outline: {
    latheSegments: 32,
    ornaments: {
      kingCross: false, queenSpikes: 0, queenSpikeScale: 0,
      bishopBall: false, bishopFinial: false,
      rookMerlons: 0, rookMerlonScale: 0,
      knightEars: false, knightMuzzle: false, knightMane: false,
      collarRing: false, kingCrossHalo: false, rookMerlonSpike: false, queenHalo: false,
    },
    ornamentScale: 0,
    edgeOverlay: true,
  },
  filled: {
    latheSegments: 48,
    ornaments: { ...FULL_ORNAMENTS, queenSpikeScale: 0.7, rookMerlonScale: 0.7 },
    ornamentScale: 0.7,
    edgeOverlay: false,
  },
  minimal: {
    latheSegments: 48,
    ornaments: {
      ...FULL_ORNAMENTS,
      kingCross: false,
      queenSpikes: 0,
      bishopBall: true,
      bishopFinial: false,
      rookMerlons: 4,
      rookMerlonScale: 0.85,
      knightEars: false,
      knightMuzzle: true,
      knightMane: false,
      collarRing: true,
      kingCrossHalo: false,
      rookMerlonSpike: false,
      queenHalo: false,
    },
    ornamentScale: 0.85,
    edgeOverlay: false,
  },
  ornate: {
    latheSegments: 64,
    ornaments: {
      ...FULL_ORNAMENTS,
      knightMane: true,
      collarRing: true,
      kingCrossHalo: true,
      rookMerlonSpike: true,
      queenHalo: true,
    },
    ornamentScale: 1.10,
    edgeOverlay: false,
  },
  staunton: {
    latheSegments: 48,
    ornaments: { ...FULL_ORNAMENTS },
    ornamentScale: 1.0,
    edgeOverlay: false,
  },
  chess3d: {
    latheSegments: 48,
    ornaments: { ...FULL_ORNAMENTS },
    ornamentScale: 1.0,
    edgeOverlay: false,
  },
  modern: {
    latheSegments: 48,
    ornaments: {
      kingCross: false,
      queenSpikes: 0,
      queenSpikeScale: 0,
      bishopBall: false,
      bishopFinial: false,
      rookMerlons: 0,
      rookMerlonScale: 0,
      knightEars: false,
      knightMuzzle: false,
      knightMane: false,
      collarRing: false,
      kingCrossHalo: false,
      rookMerlonSpike: false,
      queenHalo: false,
    },
    ornamentScale: 0,
    edgeOverlay: false,
  },
}

// ---- Lathe profile library ----

function pieceProfile(kind: PieceKind): THREE.Vector2[] {
  switch (kind) {
    case 'p': return [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.22, 0.00), new THREE.Vector2(0.22, 0.04),
      new THREE.Vector2(0.10, 0.06), new THREE.Vector2(0.10, 0.36), new THREE.Vector2(0.14, 0.40),
      new THREE.Vector2(0.14, 0.46), new THREE.Vector2(0.10, 0.50), new THREE.Vector2(0.13, 0.55),
      new THREE.Vector2(0.13, 0.62), new THREE.Vector2(0.00, 0.70),
    ]
    case 'b': return [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.24, 0.00), new THREE.Vector2(0.24, 0.05),
      new THREE.Vector2(0.10, 0.07), new THREE.Vector2(0.10, 0.55), new THREE.Vector2(0.16, 0.62),
      new THREE.Vector2(0.16, 0.74), new THREE.Vector2(0.13, 0.78), new THREE.Vector2(0.16, 0.84),
      new THREE.Vector2(0.13, 0.94), new THREE.Vector2(0.10, 0.96), new THREE.Vector2(0.00, 1.00),
    ]
    case 'k': return [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.26, 0.00), new THREE.Vector2(0.26, 0.05),
      new THREE.Vector2(0.11, 0.07), new THREE.Vector2(0.11, 0.78), new THREE.Vector2(0.16, 0.86),
      new THREE.Vector2(0.16, 0.95), new THREE.Vector2(0.13, 1.00), new THREE.Vector2(0.10, 1.04),
      new THREE.Vector2(0.00, 1.00),
    ]
    case 'q': return [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.26, 0.00), new THREE.Vector2(0.26, 0.05),
      new THREE.Vector2(0.11, 0.07), new THREE.Vector2(0.11, 0.70), new THREE.Vector2(0.18, 0.78),
      new THREE.Vector2(0.18, 0.92), new THREE.Vector2(0.13, 0.98), new THREE.Vector2(0.10, 1.02),
      new THREE.Vector2(0.00, 1.08),
    ]
    case 'r': return [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.26, 0.00), new THREE.Vector2(0.26, 0.05),
      new THREE.Vector2(0.11, 0.07), new THREE.Vector2(0.11, 0.66), new THREE.Vector2(0.18, 0.74),
      new THREE.Vector2(0.18, 0.84), new THREE.Vector2(0.13, 0.90), new THREE.Vector2(0.13, 1.00),
      new THREE.Vector2(0.00, 1.05),
    ]
    case 'n': return [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.24, 0.00), new THREE.Vector2(0.24, 0.05),
      new THREE.Vector2(0.10, 0.07), new THREE.Vector2(0.10, 0.55), new THREE.Vector2(0.16, 0.63),
      new THREE.Vector2(0.18, 0.72), new THREE.Vector2(0.16, 0.82), new THREE.Vector2(0.10, 0.90),
      new THREE.Vector2(0.00, 0.95),
    ]
  }
}

