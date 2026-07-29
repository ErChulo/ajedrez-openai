// Multi-style SVG piece renderer.
// Cburnett envelope styles (classic/bold/outline/filled/minimal/ornate/staunton)
// plus full-SVG art sets (fantasy/merida/kaneo/chessnut/rhosgfx).

import type { PieceSymbol, PieceStyleId } from '@/types'

const ASSET_PIECE_NAME: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
}

function renderAssetPiece(sym: PieceSymbol): string {
  const isWhite = sym === sym.toUpperCase()
  const side = isWhite ? 'w' : 'b'
  const piece = ASSET_PIECE_NAME[sym.toLowerCase()] ?? 'Pawn'
  return `<img src="/assets/2d-pieces/unknuffig/${side}_${piece}.png" alt="" aria-hidden="true" draggable="false" data-piece-art="unknuffig" />`
}

// ---- Full-SVG art set imports ----
import { fantasyPieces, fantasyViewBox } from '@/piece-data/fantasy'
import { meridaPieces, meridaViewBox } from '@/piece-data/merida'
import { kaneoPieces, kaneoViewBox } from '@/piece-data/kaneo'
import { chessnutPieces, chessnutViewBox } from '@/piece-data/chessnut'
import { rhosgfxPieces, rhosgfxViewBox } from '@/piece-data/rhosgfx'

export const PIECE_STYLE_META: Record<PieceStyleId, { id: PieceStyleId; name: string; blurb: string; viewBox: string }> = {
  classic:  { id: 'classic', name: 'Classic Staunton', blurb: 'FIDE standard ivory/ebony with drop-shadow.', viewBox: '0 0 45 45' },
  bold:     { id: 'bold', name: 'Bold', blurb: 'Heavier outlines, stronger shadow.', viewBox: '0 0 45 45' },
  outline:  { id: 'outline', name: 'Outline', blurb: 'Fill removed, line-only — schematic etching.', viewBox: '0 0 45 45' },
  filled:   { id: 'filled', name: 'Filled Silhouette', blurb: 'Stroke removed, pure silhouette with shadow.', viewBox: '0 0 45 45' },
  minimal:  { id: 'minimal', name: 'Minimal Modern', blurb: 'Hairline stroke, soft shadow — sleek modern.', viewBox: '0 0 45 45' },
  ornate:   { id: 'ornate', name: 'Ornate Carved', blurb: 'Classic + outer halo, pewter-carved look.', viewBox: '0 0 45 45' },
  staunton: { id: 'staunton', name: 'Staunton Marble', blurb: 'Real MIT-licensed Staunton geometry (3D only — 2D falls back to Classic).', viewBox: '0 0 45 45' },
  chess3d: { id: 'chess3d', name: 'Chess3D Sketchfab', blurb: 'Real GLTF Sketchfab model (3D only — 2D falls back to Classic).', viewBox: '0 0 45 45' },
  modern:   { id: 'modern', name: 'Modern Minimal', blurb: 'Clean geometric shapes, no ornaments — sleek contemporary set.', viewBox: '0 0 45 45' },
  fantasy:  { id: 'fantasy', name: 'Fantasy', blurb: 'Whimsical, gradient-rich, jewel-adorned. MIT.', viewBox: fantasyViewBox },
  merida:   { id: 'merida', name: 'Merida', blurb: 'Classic typographic, angular tournament set. GPLv2+.', viewBox: meridaViewBox },
  kaneo:    { id: 'kaneo', name: 'Kaneo', blurb: 'Bold rounded, Neo-inspired modern design. CC BY 4.0.', viewBox: kaneoViewBox },
  chessnut: { id: 'chessnut', name: 'Chessnut', blurb: 'Intricate line-work, ornate embossed look. Apache 2.0.', viewBox: chessnutViewBox },
  rhosgfx:  { id: 'rhosgfx', name: 'Rhosgfx', blurb: 'Warm-toned flat design, friendly tabletop feel. CC0.', viewBox: rhosgfxViewBox },
}

// ---- Envelope styles (Cburnett-based) ----

type StyleCfg = {
  fill: 'var' | 'none'
  stroke: 'var' | 'none'
  sw: number
  outerStrokeSw?: number
  shadow: string | null
}

const ENVELOPE_CFG: Record<string, StyleCfg> = {
  classic:  { fill: 'var', stroke: 'var', sw: 2.5, shadow: '0 1.5px 2px rgba(0,0,0,0.5)' },
  bold:     { fill: 'var', stroke: 'var', sw: 4, shadow: '0 2px 3px rgba(0,0,0,0.65)' },
  outline:  { fill: 'none', stroke: 'var', sw: 3, shadow: null },
  filled:   { fill: 'var', stroke: 'none', sw: 0, shadow: '0 1.5px 2px rgba(0,0,0,0.5)' },
  minimal:  { fill: 'var', stroke: 'var', sw: 1.5, shadow: '0 1px 1.5px rgba(0,0,0,0.35)' },
  ornate:   { fill: 'var', stroke: 'var', sw: 2.5, outerStrokeSw: 4, shadow: '0 2px 3px rgba(0,0,0,0.55)' },
  staunton: { fill: 'var', stroke: 'var', sw: 2.5, shadow: '0 1.5px 2px rgba(0,0,0,0.5)' },
  modern:   { fill: 'var', stroke: 'var', sw: 1.0, shadow: '0 1px 1px rgba(0,0,0,0.25)' },
}

// ---- Full-SVG art sets ----

const FULL_SVG_SETS: Record<string, { pieces: Record<string, string>; viewBox: string }> = {
  fantasy:  { pieces: fantasyPieces, viewBox: fantasyViewBox },
  merida:   { pieces: meridaPieces, viewBox: meridaViewBox },
  kaneo:    { pieces: kaneoPieces, viewBox: kaneoViewBox },
  chessnut: { pieces: chessnutPieces, viewBox: chessnutViewBox },
  rhosgfx:  { pieces: rhosgfxPieces, viewBox: rhosgfxViewBox },
}

// ---- Cburnett inner-path library (paths only; no <g> envelope) ----

function pawnPath(): string {
  return '<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>'
}

function knightPath(f: string): string {
  return `<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-5.5 6-8 9-8z"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="${f}"/>`
}

function bishopPath(): string {
  return '<path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0-.5-4-3-7-3-12 0-5 3-9 3-12 0-2-2-3-4-3-3.5 0-5 3-7 3-1 0-2-1-2-2 0-1 .5-2 .5-2-1.5 1-3 4-3 7 0 5 3 9 3 12 0 5-2.5 8-3 12zM25 8a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z"/>'
}

function rookPath(): string {
  return '<path d="M9 39h27v-3H9v3zm3.5-7l1.5-2.5h17l1.5 2.5h-20zm-.5-27v3h3v-3h-3zm9 0v3h3v-3h-3zm9 0v3h3v-3h-3zm-9 4.5V9h12v4.5h-12zM7 33.5l2-5h26l2 5H7z"/><path d="M14 11.5v20.5h17V11.5h-17zm-1 0h-3v18h3v-18zm22 0h-3v18h3v-18z"/>'
}

function queenPath(): string {
  return '<path d="M8.5 13.5L11 16l3-3 3 3 3-3 3 3 3-3 3 3 2.5-2.5L31 16l-2 2v9c0 2.5-1.5 4.5-4 5.5-2 1-4 1-6 1s-4 0-6-1c-2.5-1-4-3-4-5.5v-9l-2-2z"/><circle cx="11" cy="9" r="1.5"/><circle cx="22.5" cy="6" r="1.5"/><circle cx="34" cy="9" r="1.5"/><path d="M11 14l-3 6v8h28v-8l-3-6-3 6h-16l-3-6z"/><path d="M9 35c.5 1.5 1.5 3 3 4.5 2 1.5 4 1.5 7 1.5h6c3 0 5 0 7-1.5 1.5-1.5 2.5-3 3-4.5H9z"/><path d="M14 38c0 1.5 1 3 3 4h10c2-1 3-2.5 3-4H14z"/>'
}

function kingPath(): string {
  return '<path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/>'
}

function cburnettInnerPath(sym: PieceSymbol): string {
  const isWhite = sym === sym.toUpperCase()
  const f = isWhite ? 'var(--piece-fill)' : 'var(--piece-fill-2)'
  switch (sym.toLowerCase()) {
    case 'p': return pawnPath()
    case 'n': return knightPath(f)
    case 'b': return bishopPath()
    case 'r': return rookPath()
    case 'q': return queenPath()
    case 'k': return kingPath()
  }
  return ''
}

// ---- Envelope assembly (Cburnett styles) ----

function envelopeFor(sym: PieceSymbol, cfg: StyleCfg): string {
  const isWhite = sym === sym.toUpperCase()
  const fill = cfg.fill === 'var'
    ? (isWhite ? 'var(--piece-fill)' : 'var(--piece-fill-2)')
    : 'none'
  const stroke = cfg.stroke === 'var'
    ? (isWhite ? 'var(--piece-stroke)' : 'var(--piece-stroke-2)')
    : (isWhite ? 'var(--piece-stroke)' : 'var(--piece-stroke-2)')

  let halo = ''
  if (cfg.outerStrokeSw && cfg.outerStrokeSw > 0) {
    const haloFill = isWhite ? 'var(--piece-stroke)' : 'var(--piece-stroke-2)'
    halo = `<g fill="${haloFill}" stroke="${haloFill}" stroke-width="${cfg.outerStrokeSw}" stroke-linejoin="round" stroke-linecap="round" opacity="0.85" aria-hidden="true">${cburnettInnerPath(sym)}</g>`
  }

  const filterStyle = cfg.shadow ? ` style="filter: drop-shadow(${cfg.shadow});"` : ''
  const strokeWidthAttr = cfg.sw > 0 ? ` stroke-width="${cfg.sw}"` : ''
  const strokeAttr = cfg.stroke === 'none' ? '' : ` stroke="${stroke}"`

  return `${halo}<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${filterStyle}><g fill="${fill}"${strokeAttr}${strokeWidthAttr} vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round">${cburnettInnerPath(sym)}</g></svg>`
}

// ---- Full-SVG art set assembly ----

function fullSvgFor(sym: PieceSymbol, set: { pieces: Record<string, string>; viewBox: string }): string {
  const key = (sym === sym.toUpperCase() ? 'w' : 'b') + sym.toUpperCase()
  const inner = set.pieces[key] ?? ''
  return `<svg viewBox="${set.viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`
}

// ---- Public API ----

export function renderPieceSvg(sym: PieceSymbol, styleId: PieceStyleId = 'classic'): string {
  if (styleId === 'chess3d') return renderAssetPiece(sym)
  const fullSvg = FULL_SVG_SETS[styleId]
  if (fullSvg) return fullSvgFor(sym, fullSvg)

  const cfg = ENVELOPE_CFG[styleId] ?? ENVELOPE_CFG.classic
  return envelopeFor(sym, cfg)
}
