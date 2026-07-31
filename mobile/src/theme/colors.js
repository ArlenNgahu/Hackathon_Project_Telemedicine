// AfyaConnect brand palette — light mode only.
// Derived from the logo (navy + teal). Do NOT introduce colors outside this file.

export const brand = {
  bg: '#FFFFFF', // screen background
  surface: '#F2F6FA', // cards, secondary fills
  text: '#0A1F3D', // primary text (navy)
  textMuted: '#5A6B85', // secondary text
  primary: '#0F8A7F', // teal — primary actions
  accent: '#1B3F8B', // navy — highlights, outline buttons, scan focus ring
  border: '#DCE6F0', // hairlines, unfocused borders
  white: '#FFFFFF',
};

// High-contrast variant. Kept WCAG-safe on the darker surfaces it introduces.
// Only colors that change for contrast are overridden; the rest fall through.
export const brandHighContrast = {
  ...brand,
  bg: '#FFFFFF',
  surface: '#E4ECF5',
  text: '#00122B',
  textMuted: '#33435F',
  primary: '#0B6E64', // darker teal for >=4.5:1 on white
  accent: '#122C63', // darker navy
  border: '#5A6B85',
};

// Triage severity colors are a CLINICAL SAFETY CONVENTION, not brand colors.
// Never restyle these for aesthetics. Text placed on them must be white.
export const priority = {
  critical: '#D32F2F', // red
  high: '#F57C00', // orange
  medium: '#F9A825', // amber
  low: '#2E7D32', // green
};

// Emergency screen background — deliberately the clinical red, not a brand color.
export const emergency = {
  bg: '#B71C1C',
  bgActive: '#8E1414',
  text: '#FFFFFF',
};
