// 3D Chess Board — React Three Fiber + Three.js.
// Uses procedural Staunton geometry with PBR materials and IBL lighting.
// Click interaction via raycaster on the board plane.

import { useRef, useEffect, useState, useMemo, useCallback, type MutableRefObject } from 'react'
import type { BoardBridge } from '@/chess/view'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { setupLighting, setupRenderer } from './lighting'
import { buildPieceMaterial, buildBoardMaterial } from './materials'
import { buildPieceGeometry, prefetchPieceStyleAssets, onGeometryCacheReady, type PieceKind } from './piece-styles'
import { THEMES } from '@/features/themes'
import type {
  ApplyMoveInput,
  PieceStyleId,
  PieceSymbol,
  Side,
  Square,
  ThemeName,
} from '@/types'
import styles from './Board3D.module.css'

const BOARD = { size: 4.0, squareSize: 0.5, height: 0.1, baseY: 0 }
const PIECE_VISUAL_SCALE = 0.95

function fileIndex(sq: Square): number { return 'abcdefgh'.indexOf(sq[0]) }
function rankIndex(sq: Square): number { return 8 - parseInt(sq[1], 10) }
function worldX(sq: Square): number { return (fileIndex(sq) - 3.5) * BOARD.squareSize }
function worldZ(sq: Square): number { return (rankIndex(sq) - 3.5) * BOARD.squareSize }
function pieceSymbolIsWhite(s: PieceSymbol): boolean { return s === s.toUpperCase() }
function toPieceKind(s: PieceSymbol): PieceKind { return s.toLowerCase() as PieceKind }

function sqFromWorld(x: number, z: number, flipped: boolean): Square | null {
  const col = Math.round(x / BOARD.squareSize + 3.5)
  const row = Math.round(z / BOARD.squareSize + 3.5)
  if (col < 0 || col > 7 || row < 0 || row > 7) return null
  if (flipped) return `${'hgfedcba'[col]}${row + 1}` as Square
  return `${'abcdefgh'[col]}${8 - row}` as Square
}

// ---- Piece Mesh ----

interface PieceMeshProps {
  symbol: PieceSymbol
  square?: Square
  position?: [number, number, number]
  scale?: number
  opacity?: number
  material: THREE.Material
  pieceStyle: PieceStyleId
}

function PieceMesh({ symbol, square, position, scale, opacity, material, pieceStyle }: PieceMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [cacheVersion, setCacheVersion] = useState(0)
  const geometry = useMemo(
    () => buildPieceGeometry(toPieceKind(symbol), symbol, material, pieceStyle),
    [symbol, material, pieceStyle, cacheVersion],
  )
  const displayObject = useMemo(() => geometry.clone(), [geometry])

  useEffect(() => {
    return onGeometryCacheReady(() => setCacheVersion((n) => n + 1))
  }, [])

  const isKnight = toPieceKind(symbol) === 'n'
  const isWhite = pieceSymbolIsWhite(symbol)

  const groupPosition = position ?? [worldX(square!), BOARD.baseY + BOARD.height, worldZ(square!)]
  const pieceScale = scale ?? PIECE_VISUAL_SCALE

  useEffect(() => {
    displayObject.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const meshMaterial = object.material
      if (Array.isArray(meshMaterial)) {
        for (const mat of meshMaterial) {
          mat.transparent = opacity !== undefined ? opacity < 1 : mat.transparent
          if (opacity !== undefined) mat.opacity = opacity
        }
        return
      }
      meshMaterial.transparent = opacity !== undefined ? opacity < 1 : meshMaterial.transparent
      if (opacity !== undefined) meshMaterial.opacity = opacity
    })
  }, [displayObject, opacity])

  return (
    <group
      ref={groupRef}
      position={groupPosition}
      rotation={isKnight ? [0, isWhite ? -Math.PI / 2 : Math.PI / 2, 0] : undefined}
      scale={[pieceScale, pieceScale, pieceScale]}
    >
      <primitive object={displayObject} />
    </group>
  )
}

// ---- Board Squares with Highlight ----

interface BoardSquaresProps {
  lightMaterial: THREE.Material
  darkMaterial: THREE.Material
  selectedSq: Square | null
  legalTargets: Square[]
  lastMove?: { from: Square; to: Square } | null
  checkSquare?: Square | null
  flipped: boolean
}

function BoardSquares({ lightMaterial, darkMaterial, selectedSq, legalTargets, lastMove, checkSquare, flipped }: BoardSquaresProps) {
  const squares = []

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sqName = flipped
        ? `${'hgfedcba'[col]}${row + 1}` as Square
        : `${'abcdefgh'[col]}${8 - row}` as Square
      const isLight = (row + col) % 2 === 1
      const x = (col - 3.5) * BOARD.squareSize
      const z = (row - 3.5) * BOARD.squareSize

      let highlightColor: number | null = null
      let highlightOpacity = 0.72
      let haloOpacity = 0.18
      if (selectedSq === sqName) highlightColor = 0xffeb78
      else if (checkSquare === sqName) {
        highlightColor = 0xff3b30
        highlightOpacity = 0.92
        haloOpacity = 0.34
      }
      else if (lastMove?.from === sqName || lastMove?.to === sqName) highlightColor = 0x50a0ff
      else if (legalTargets.includes(sqName)) highlightColor = 0x78eb82

squares.push(
          <mesh key={sqName} position={[x, BOARD.baseY + 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[BOARD.squareSize, BOARD.squareSize]} />
            {highlightColor ? (
              <meshStandardMaterial color={highlightColor} transparent opacity={highlightOpacity} depthWrite={false} />
            ) : (
              <primitive object={isLight ? lightMaterial : darkMaterial} attach="material" />
            )}
          </mesh>,
          highlightColor && (
            <mesh position={[x, BOARD.baseY + 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[BOARD.squareSize * 1.02, BOARD.squareSize * 1.02]} />
              <meshBasicMaterial color={highlightColor} transparent opacity={haloOpacity} depthWrite={false} />
            </mesh>
          ),
       )
    }
  }

  return <>{squares}</>
}

// ---- Scene Content ----

interface AnimatedPieceState {
  key: string
  symbol: PieceSymbol
  from: Square
  to: Square
  position: [number, number, number]
  scale?: number
  opacity?: number
  capturedSquare?: Square
}

interface SceneContentProps {
  board: Record<Square, PieceSymbol | null>
  theme: ThemeName
  pieceStyle: PieceStyleId
  flipped: boolean
  selectable: Side | null
  lastMove?: { from: Square; to: Square } | null
  checkSquare?: Square | null
  selectedSq: Square | null
  legalTargets: Square[]
  animatedPiece: AnimatedPieceState | null
  capturedPiece: AnimatedPieceState | null
  hiddenSquares: Square[]
  onSelect: (sq: Square) => void
  onMoveAttempt: (input: ApplyMoveInput) => void
}

function SceneContent({
  board, theme, pieceStyle, flipped, selectable, lastMove, checkSquare, selectedSq, legalTargets, animatedPiece, capturedPiece, hiddenSquares, onSelect, onMoveAttempt,
}: SceneContentProps) {
  const themeData = THEMES[theme]
  const pieceMaterials = useMemo(() => ({
    white: buildPieceMaterial('white', themeData),
    black: buildPieceMaterial('black', themeData),
  }), [themeData])
  const boardMaterials = useMemo(() => buildBoardMaterial(themeData), [themeData])
  const { camera, gl } = useThree()
  const selectedSqRef = useRef<Square | null>(null)
  const baseCameraPositionRef = useRef(new THREE.Vector3())
  const checkPulseRef = useRef(0)
  const prevCheckSquareRef = useRef<Square | null>(null)

  // Set camera position based on flipped state
  useEffect(() => {
    const z = flipped ? -6.75 : 6.75
    camera.position.set(0, 4.15, z)
    baseCameraPositionRef.current.set(0, 4.15, z)
    camera.lookAt(0, 0.12, 0)
  }, [flipped, camera])

  // Keep selectedSq in sync
  useEffect(() => { selectedSqRef.current = selectedSq }, [selectedSq])

  useEffect(() => {
    if (checkSquare && prevCheckSquareRef.current !== checkSquare) {
      checkPulseRef.current = 1
    }
    prevCheckSquareRef.current = checkSquare ?? null
  }, [checkSquare])

  useFrame((_, delta) => {
    if (checkPulseRef.current <= 0) return

    checkPulseRef.current = Math.max(0, checkPulseRef.current - delta * 1.7)
    const intensity = checkPulseRef.current
    const shake = Math.sin((1 - intensity) * Math.PI * 10) * 0.08 * intensity
    const push = 0.32 * intensity
    const base = baseCameraPositionRef.current
    camera.position.set(base.x + shake, base.y + 0.08 * intensity, base.z + (base.z > 0 ? -push : push))
    camera.lookAt(0, 0.12 + 0.03 * intensity, 0)
  })

  // Raycaster click handler — ignores drags (OrbitControls rotation/zoom)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD.baseY)

    const onPointerDown = (e: MouseEvent) => {
      pointerDownPos.current = { x: e.clientX, y: e.clientY }
    }
    const onPointerMove = (e: MouseEvent) => {
      if (!pointerDownPos.current) return
      const dx = e.clientX - pointerDownPos.current.x
      const dy = e.clientY - pointerDownPos.current.y
      if (dx * dx + dy * dy > 25) pointerDownPos.current = null
    }

    const onClick = (e: MouseEvent) => {
      if (!pointerDownPos.current) return
      if (!selectable) { pointerDownPos.current = null; return }
      pointerDownPos.current = null
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      const intersection = new THREE.Vector3()
      raycaster.ray.intersectPlane(plane, intersection)
      if (!intersection) return

      const sq = sqFromWorld(intersection.x, intersection.z, flipped)
      if (!sq) return

      const piece = board[sq]
      const isWhite = piece ? piece === piece.toUpperCase() : false
      const canControl = (selectable === 'white' && isWhite) || (selectable === 'black' && !isWhite)

      if (canControl) {
        onSelect(sq)
      } else if (selectedSqRef.current) {
        onMoveAttempt({ from: selectedSqRef.current, to: sq })
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('click', onClick)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('click', onClick)
    }
  }, [board, selectable, flipped, camera, gl, onSelect, onMoveAttempt])

  const hiddenSquareSet = new Set(hiddenSquares)
  const pieces = []
  for (const [sq, sym] of Object.entries(board) as [Square, PieceSymbol | null][]) {
    if (!sym || hiddenSquareSet.has(sq)) continue
    const mat = pieceSymbolIsWhite(sym) ? pieceMaterials.white : pieceMaterials.black
    pieces.push(<PieceMesh key={`${sq}-${sym}-${pieceStyle}`} symbol={sym} square={sq} material={mat} pieceStyle={pieceStyle} />)
  }

  if (animatedPiece) {
    const mat = pieceSymbolIsWhite(animatedPiece.symbol) ? pieceMaterials.white : pieceMaterials.black
    pieces.push(
      <PieceMesh
        key={animatedPiece.key}
        symbol={animatedPiece.symbol}
        position={animatedPiece.position}
        scale={animatedPiece.scale}
        opacity={animatedPiece.opacity}
        material={mat}
        pieceStyle={pieceStyle}
      />,
    )
  }

  if (capturedPiece) {
    const mat = pieceSymbolIsWhite(capturedPiece.symbol) ? pieceMaterials.white : pieceMaterials.black
    pieces.push(
      <PieceMesh
        key={capturedPiece.key}
        symbol={capturedPiece.symbol}
        position={capturedPiece.position}
        scale={capturedPiece.scale}
        opacity={capturedPiece.opacity}
        material={mat}
        pieceStyle={pieceStyle}
      />,
    )
  }

  return (
    <>
      <BoardSquares
        lightMaterial={boardMaterials[0]}
        darkMaterial={boardMaterials[1]}
        selectedSq={selectedSq}
        legalTargets={legalTargets}
        lastMove={lastMove}
        checkSquare={checkSquare}
        flipped={flipped}
      />
      {pieces}
      <mesh position={[0, BOARD.baseY - 0.05, 0]} receiveShadow>
        <boxGeometry args={[6, 0.1, 6]} />
        <meshStandardMaterial color={0x1a0f05} roughness={0.9} metalness={0} />
      </mesh>
    </>
  )
}

// ---- Main Board3D Component ----

interface Board3DProps {
  board: Record<Square, PieceSymbol | null>
  theme: ThemeName
  pieceStyle: PieceStyleId
  flipped: boolean
  selectable: Side | null
  lastMove?: { from: Square; to: Square } | null
  checkSquare?: Square | null
  onMoveAttempt: (input: ApplyMoveInput) => void
  onSelect: (sq: Square) => void
  boardBridgeRef?: MutableRefObject<BoardBridge | null>
}

export function Board3D({
  board, theme, pieceStyle, flipped, selectable, lastMove, checkSquare, onMoveAttempt, onSelect, boardBridgeRef,
}: Board3DProps) {
  const [selectedSq, setSelectedSq] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [animatedPiece, setAnimatedPiece] = useState<AnimatedPieceState | null>(null)
  const [capturedPiece, setCapturedPiece] = useState<AnimatedPieceState | null>(null)
  const [hiddenSquares, setHiddenSquares] = useState<Square[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Prefetch piece style assets (re-runs when pieceStyle changes)
  useEffect(() => { prefetchPieceStyleAssets(pieceStyle) }, [pieceStyle])


  const handleSelect = useCallback((sq: Square) => {
    setSelectedSq(sq)
    onSelect(sq)
  }, [onSelect])

  const handleMoveAttempt = useCallback((input: ApplyMoveInput) => {
    setSelectedSq(null)
    setLegalTargets([])
    onMoveAttempt(input)
  }, [onMoveAttempt])

  // Expose imperative API for hook
  useEffect(() => {
    if (!boardBridgeRef) return
    boardBridgeRef.current = {
      animateMove: async (record) => {
        const symbol = board[record.from] ?? (record.piece === record.piece.toUpperCase() ? record.piece : record.piece.toLowerCase() as PieceSymbol)
        if (!symbol) {
          await new Promise((resolve) => setTimeout(resolve, 120))
          return
        }

        const pieceY = BOARD.baseY + BOARD.height
        const fromPosition: [number, number, number] = [worldX(record.from), pieceY, worldZ(record.from)]
        const toPosition: [number, number, number] = [worldX(record.to), pieceY, worldZ(record.to)]
        const captureSquare = record.captured ? record.to : undefined
        const capturedSymbol = captureSquare ? board[captureSquare] : null

        setHiddenSquares(captureSquare ? [record.from, captureSquare] : [record.from])
        if (captureSquare && capturedSymbol) {
          setCapturedPiece({
            key: `capture-${record.lan}-${record.ply}`,
            symbol: capturedSymbol,
            from: captureSquare,
            to: captureSquare,
            position: [worldX(captureSquare), pieceY, worldZ(captureSquare)],
            scale: PIECE_VISUAL_SCALE,
            opacity: 1,
          })
        } else {
          setCapturedPiece(null)
        }
        setAnimatedPiece({
          key: `${record.lan}-${record.ply}`,
          symbol,
          from: record.from,
          to: record.to,
          capturedSquare: captureSquare,
          position: fromPosition,
        })

        await new Promise<void>((resolve) => {
          const started = performance.now()
          const duration = 260
          const step = (now: number) => {
            const t = Math.min(1, (now - started) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            const arc = Math.sin(Math.PI * t) * 0.18
            setAnimatedPiece((current) => {
              if (!current) return current
              return {
                ...current,
                position: [
                  fromPosition[0] + (toPosition[0] - fromPosition[0]) * eased,
                  pieceY + arc,
                  fromPosition[2] + (toPosition[2] - fromPosition[2]) * eased,
                ],
              }
            })
            setCapturedPiece((current) => {
              if (!current) return current
              return {
                ...current,
                position: [current.position[0], pieceY + t * 0.12, current.position[2]],
                scale: PIECE_VISUAL_SCALE * (1 - t * 0.35),
                opacity: 1 - t,
              }
            })
            if (t < 1) requestAnimationFrame(step)
            else {
              setAnimatedPiece(null)
              setCapturedPiece(null)
              setHiddenSquares([])
              resolve()
            }
          }
          requestAnimationFrame(step)
        })
      },
      animateRookMove: async (from, to) => {
        const symbol = board[from]
        if (!symbol) return
        const pieceY = BOARD.baseY + BOARD.height
        const fromPosition: [number, number, number] = [worldX(from), pieceY, worldZ(from)]
        const toPosition: [number, number, number] = [worldX(to), pieceY, worldZ(to)]

        setHiddenSquares((current) => Array.from(new Set([...current, from])))
        setAnimatedPiece({
          key: `rook-${from}-${to}`,
          symbol,
          from,
          to,
          position: fromPosition,
        })

        await new Promise<void>((resolve) => {
          const started = performance.now()
          const duration = 220
          const step = (now: number) => {
            const t = Math.min(1, (now - started) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setAnimatedPiece((current) => {
              if (!current) return current
              return {
                ...current,
                position: [
                  fromPosition[0] + (toPosition[0] - fromPosition[0]) * eased,
                  pieceY,
                  fromPosition[2] + (toPosition[2] - fromPosition[2]) * eased,
                ],
              }
            })
            if (t < 1) requestAnimationFrame(step)
            else {
              setAnimatedPiece(null)
              setHiddenSquares([])
              resolve()
            }
          }
          requestAnimationFrame(step)
        })
      },
      setLegalTargets: (origin: Square, targets: Square[]) => {
        setSelectedSq(origin)
        setLegalTargets(targets)
      },
      clearSelection: () => {
        setSelectedSq(null)
        setLegalTargets([])
      },
    }
    return () => {
      if (boardBridgeRef.current) boardBridgeRef.current = null
    }
  }, [board, boardBridgeRef])

  return (
    <div
      ref={containerRef}
      className={styles.board3dHost}
      data-testid="board-3d"
    >
      <Canvas
        shadows
        camera={{ fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl, scene }) => {
          setupRenderer(gl)
          setupLighting(scene, gl)
        }}
      >
        <SceneContent
          board={board}
          theme={theme}
          pieceStyle={pieceStyle}
          flipped={flipped}
          selectable={selectable}
          lastMove={lastMove}
          checkSquare={checkSquare}
          selectedSq={selectedSq}
          legalTargets={legalTargets}
          animatedPiece={animatedPiece}
          capturedPiece={capturedPiece}
          hiddenSquares={hiddenSquares}
          onSelect={handleSelect}
          onMoveAttempt={handleMoveAttempt}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          target={[0, 0.12, 0]}
          minDistance={2.5}
          maxDistance={18}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.05}
          enablePan
          panSpeed={0.5}
          rotateSpeed={0.6}
          zoomSpeed={1.2}
        />
      </Canvas>
    </div>
  )
}
