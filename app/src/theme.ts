/**
 * VOLTRIX design tokens — Linear-style precision dark UI.
 *
 * Darkness is the native medium: near-black canvas, luminance-stacked
 * surfaces (deeper = darker), whisper-thin semi-transparent white borders,
 * a single indigo-violet accent, and grayscale everywhere else.
 * No solid borders, no decorative shadows on cards — elevation comes from
 * background luminance steps and 1px translucent rims.
 */
import {Platform, TextStyle, ViewStyle} from 'react-native';

export const colors = {
  // --- surfaces (luminance stack) -----------------------------------------
  bg: '#08090a', // marketing black — app canvas
  panel: '#0f1011', // floating chrome (tab bar, sheets)
  surface: '#191a1b', // elevated cards
  surface2: '#28282c', // hover / pressed surfaces
  card: 'rgba(255,255,255,0.025)', // default bento card fill
  cardHover: 'rgba(255,255,255,0.05)',
  cardInset: 'rgba(255,255,255,0.035)',

  // --- borders (never solid on dark) --------------------------------------
  border: 'rgba(255,255,255,0.08)', // standard card rim
  borderSubtle: 'rgba(255,255,255,0.05)', // hairline / divider
  borderSolid: '#23252a', // pill rims, solid separators

  // --- brand (the ONLY chromatic color in the chrome) ----------------------
  accent: '#5e6ad2', // brand indigo — CTAs, active states
  accentBright: '#7170ff', // interactive accent — links, live values
  accentHover: '#828fff', // hover / pressed accent
  accentSoft: 'rgba(113,112,255,0.14)', // tinted fills
  accentSofter: 'rgba(113,112,255,0.08)',
  accentGlow: 'rgba(113,112,255,0.45)',

  // --- status (status colors only, never chrome) ---------------------------
  green: '#27a644', // active / success
  greenSoft: 'rgba(39,166,68,0.16)',
  emerald: '#10b981', // completion pills
  red: '#eb5757', // failure / danger
  redSoft: 'rgba(235,87,87,0.14)',

  // --- text (luminance hierarchy, never pure white) ------------------------
  text: '#f7f8f8', // primary
  text2: '#d0d6e0', // secondary / body
  text3: '#8a8f98', // muted / metadata
  text4: '#62666d', // timestamps, disabled, micro labels
  white: '#ffffff', // knob highlights only
} as const;

export const radii = {
  micro: 2, // inline badges, tags
  xs: 4, // small containers
  sm: 6, // buttons, inputs
  md: 8, // cards
  lg: 12, // panels, featured cards
  xl: 16, // hero cards, sheets
  panel: 22, // large panels
  pill: 999, // chips, pills, tab bar
} as const;

/** 8px-grid spacing scale (with Linear's 7/11 optical micro-steps). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  gutter: 20, // page side padding
} as const;

/** Type ramp — Inter system: 400 read / 500 emphasize / 600 announce. */
export const type = {
  display: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '600',
    letterSpacing: -1.05,
    color: colors.text,
  } as TextStyle,
  h1: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.6,
    color: colors.text,
  } as TextStyle,
  h2: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.25,
    color: colors.text,
  } as TextStyle,
  body: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: colors.text2,
  } as TextStyle,
  small: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '400',
    letterSpacing: -0.1,
    color: colors.text3,
  } as TextStyle,
  /** Uppercase micro-label — section headers, stat captions. */
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.9,
    color: colors.text4,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;

export const font = {
  /** Monospace face for the daemon log box. */
  mono: Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'}),
} as const;

/**
 * Shadow recipes. Cards intentionally have NONE (Linear stacks elevation
 * through luminance + rims); these are for genuinely floating chrome.
 */
export const shadow = {
  /** Floating tab bar / sheets — lifts off the canvas. */
  float: {
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 10},
  } as ViewStyle,
  /** Hero card — one soft anchor under the surface. */
  hero: {
    elevation: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 6},
  } as ViewStyle,
} as const;

/** Grouping helper: flat map of section/page paddings so spacing stays uniform. */
export const layout = {
  pagePadH: space.gutter,
  sectionGap: 22,
  cardPad: 16,
} as const;
