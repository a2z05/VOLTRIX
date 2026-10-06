/**
 * VOLTRIX design tokens — ported from the old web UI palette
 * (webroot/index.html): dark navy surfaces, indigo accent, gold stats.
 * RN has no backdrop blur / gradients here, so surfaces are plain colors.
 */
import { Platform } from 'react-native';

export const colors = {
  bg: '#0b0c14',
  surface: '#161826',
  surface2: '#1e2133',
  surface3: '#282c42',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.09)',
  accent: '#5e7cff',
  accentSoft: 'rgba(94,124,255,0.14)',
  accentGlow: 'rgba(94,124,255,0.40)',
  gold: '#ffd23f',
  red: '#ff5c72',
  redSoft: 'rgba(255,92,114,0.14)',
  green: '#3ddc97',
  greenSoft: 'rgba(61,220,151,0.14)',
  text: '#f2f3f8',
  text2: '#9498b3',
  text3: '#5c6080',
  white: '#ffffff',
} as const;

export const radii = {
  sm: 8,
  md: 13,
  lg: 16,
  xl: 22,
} as const;

export const font = {
  /** Monospace face for the daemon log box. */
  mono: Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'}),
} as const;

/** Grouping helper: flat map of section/page paddings so spacing stays uniform. */
export const layout = {
  pagePadH: 20,
  sectionGap: 22,
  cardPad: 16,
} as const;
