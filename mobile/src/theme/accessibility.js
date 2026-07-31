// getAccessibilityTheme(assistiveTech, overrides) is the SINGLE source of truth
// for every size, color, spacing, scan speed and dwell time in the app.
//
// Screens must read all of these from `theme` — never hardcode a size or color
// in a screen. This is what lets one profile change re-shape the whole UI.

import { brand, brandHighContrast, priority, emergency } from './colors';

// Baseline values shared by every profile. Individual profiles override.
const BASE = {
  targetSize: 56, // min interactive height/width in pt
  hitSlop: 12,
  scanEnabled: false, // custom auto-scan highlight loop
  scanSpeedMs: 1200,
  dwellMs: 0, // OS-pointer dwell hint (informational for our UI)
  voiceFirst: false, // voice-first layout (big mic, spoken confirmations)
  sparse: false, // extra whitespace, fewer items per view
  stickyClick: false, // avoid drag-required gestures
  fontScaleMul: 1, // user-tunable multiplier on top of OS font scaling
  highContrast: false,
};

// The six assistive-tech profiles and their key adaptations.
const PROFILES = {
  none: { targetSize: 56, scanEnabled: false },
  voice: { targetSize: 64, voiceFirst: true },
  eye_tracking: { targetSize: 80, dwellMs: 1500, sparse: true },
  head_mouse: { targetSize: 60, stickyClick: true },
  sip_puff: { targetSize: 90, scanEnabled: true, scanSpeedMs: 2200 },
  switch: { targetSize: 90, scanEnabled: true, scanSpeedMs: 2000 },
};

const RADIUS = { sm: 8, md: 14, lg: 22, pill: 999 };

// Font ramp (in pt) before the user multiplier. `allowFontScaling` on the Text
// components still layers OS Dynamic Type on top of this.
const FONT_BASE = {
  display: 34,
  title: 28,
  heading: 22,
  body: 18,
  label: 16,
  small: 14,
};

export function getAccessibilityTheme(assistiveTech = 'none', overrides = {}) {
  const profile = PROFILES[assistiveTech] || PROFILES.none;
  const cfg = { ...BASE, ...profile, ...overrides };

  const colors = cfg.highContrast ? brandHighContrast : brand;

  const mul = cfg.fontScaleMul;
  const font = Object.fromEntries(
    Object.entries(FONT_BASE).map(([k, v]) => [k, Math.round(v * mul)])
  );

  // Sparse profiles (eye tracking) get more breathing room so dwell targets
  // don't sit adjacent and cause mis-selection.
  const gap = cfg.sparse ? 20 : 14;

  return {
    key: assistiveTech,
    colors,
    priority, // clinical severity colors — never restyle
    emergency, // emergency screen palette
    highContrast: cfg.highContrast,

    // sizing
    targetSize: cfg.targetSize,
    hitSlop: {
      top: cfg.hitSlop,
      bottom: cfg.hitSlop,
      left: cfg.hitSlop,
      right: cfg.hitSlop,
    },
    radius: RADIUS,
    font,

    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 44,
      gap,
    },

    // custom scanner config — consumed by useScanner / ScanGroup
    scan: {
      enabled: cfg.scanEnabled,
      speedMs: cfg.scanSpeedMs,
      ringColor: colors.accent,
      ringWidth: 4,
    },

    // OS-pointer / dwell metadata (head-mouse, eye-tracking hardware)
    dwellMs: cfg.dwellMs,
    stickyClick: cfg.stickyClick,
    voiceFirst: cfg.voiceFirst,
    sparse: cfg.sparse,
  };
}

// TTS locale for a given app language.
export const speechLocale = (lang) => (lang === 'sw' ? 'sw-KE' : 'en-US');
