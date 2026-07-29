// Board theme definitions — four color sets with CSS variables and 3D material colors.

import type { ThemeData, ThemeName } from '@/types'

export const THEMES: Record<ThemeName, ThemeData> = {
  classic: {
    name: 'classic',
    label: 'Classic Walnut',
    boardLight: '#ead2a8',
    boardDark: '#8b5a2b',
    accent: '#d4a843',
    cssVars: {
      '--piece-fill': '#f5f0e1',
      '--piece-fill-2': '#2c2c2c',
      '--piece-stroke': '#333',
      '--piece-stroke-2': '#ccc',
      '--highlight-from': 'rgba(255,235,120,0.55)',
      '--highlight-to': 'rgba(150,210,120,0.55)',
      '--highlight-last': 'rgba(120,170,220,0.35)',
      '--highlight-check': 'rgba(255,80,80,0.55)',
    },
    three: {
      boardLight: 0xead2a8,
      boardDark: 0x8b5a2b,
      pieceWhite: { color: 0xf2e8d2, roughness: 0.55, metalness: 0.05 },
      pieceBlack: { color: 0x2a1f12, roughness: 0.55, metalness: 0.05 },
    },
  },
  slate: {
    name: 'slate',
    label: 'Slate Tournament',
    boardLight: '#c8cdd0',
    boardDark: '#5a6370',
    accent: '#4fc3f7',
    cssVars: {
      '--piece-fill': '#f0ede8',
      '--piece-fill-2': '#1a1a2e',
      '--piece-stroke': '#333',
      '--piece-stroke-2': '#ccc',
      '--highlight-from': 'rgba(255,235,120,0.55)',
      '--highlight-to': 'rgba(100,200,255,0.55)',
      '--highlight-last': 'rgba(120,170,220,0.35)',
      '--highlight-check': 'rgba(255,80,80,0.55)',
    },
    three: {
      boardLight: 0xc8cdd0,
      boardDark: 0x5a6370,
      pieceWhite: { color: 0xf0ede8, roughness: 0.45, metalness: 0.08 },
      pieceBlack: { color: 0x1a1a2e, roughness: 0.5, metalness: 0.08 },
    },
  },
  emerald: {
    name: 'emerald',
    label: 'Emerald Club',
    boardLight: '#d5d0c4',
    boardDark: '#1b5e3b',
    accent: '#e6a840',
    cssVars: {
      '--piece-fill': '#f5efe3',
      '--piece-fill-2': '#1c1210',
      '--piece-stroke': '#333',
      '--piece-stroke-2': '#ccc',
      '--highlight-from': 'rgba(255,235,120,0.55)',
      '--highlight-to': 'rgba(140,220,160,0.55)',
      '--highlight-last': 'rgba(110,180,255,0.35)',
      '--highlight-check': 'rgba(255,80,80,0.55)',
    },
    three: {
      boardLight: 0xd5d0c4,
      boardDark: 0x1b5e3b,
      pieceWhite: { color: 0xf5efe3, roughness: 0.5, metalness: 0.04 },
      pieceBlack: { color: 0x1c1210, roughness: 0.6, metalness: 0.04 },
    },
  },
  neon: {
    name: 'neon',
    label: 'Neon Cyberpunk',
    boardLight: '#2a3550',
    boardDark: '#131a2c',
    accent: '#00e5ff',
    cssVars: {
      '--piece-fill': '#e8f1ff',
      '--piece-fill-2': '#0a1426',
      '--piece-stroke': '#161b27',
      '--piece-stroke-2': '#00e5ff',
      '--highlight-from': 'rgba(255,235,120,0.55)',
      '--highlight-to': 'rgba(0,229,255,0.45)',
      '--highlight-last': 'rgba(255,61,240,0.32)',
      '--highlight-check': 'rgba(255,70,90,0.55)',
    },
    three: {
      boardLight: 0x2a3550,
      boardDark: 0x131a2c,
      pieceWhite: { color: 0xe8f1ff, roughness: 0.18, metalness: 0.4, emissive: 0x223355 },
      pieceBlack: { color: 0x0a1426, roughness: 0.22, metalness: 0.6, emissive: 0x661244 },
    },
  },
}

export function getTheme(name: ThemeName): ThemeData {
  return THEMES[name] ?? THEMES.classic
}

export const THEME_LIST: ThemeData[] = Object.values(THEMES)
