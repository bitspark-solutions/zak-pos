/**
 * POS design tokens — high contrast, huge targets, readable at arm's length.
 * Built on the app's existing palette (constants/theme.ts tint #0a7ea4);
 * shared by POS screens (G1b) and G1c's add-product flow.
 */
export const POS_COLORS = {
  primary: '#0a7ea4', // app tint
  primaryDark: '#085f7d',
  success: '#1faa59', // checkout / confirm
  successPressed: '#178a48',
  danger: '#e03131', // remove / errors
  warningBg: '#fff3cd',
  warningBorder: '#f0ad4e',
  warningText: '#7a5b00',
  errorBg: '#fde8e8',
  errorBorder: '#f1a3a3',
  errorText: '#96201f',
  ink: '#101418', // near-black text for max contrast
  inkMuted: '#4c5560',
  surface: '#ffffff',
  surfaceAlt: '#f2f5f8',
  line: '#dfe4ea',
  keyBg: '#f4f6f8',
  scanOverlay: 'rgba(0,0,0,0.55)',
} as const;

/** Minimum tap target — deliberately huge for gloved/busy hands. */
export const POS_SIZES = {
  buttonHeight: 64,
  stepperButton: 56,
  chipHeight: 48,
  keyHeight: 72,
  radius: 14,
  gap: 12,
} as const;

export const POS_FONT = {
  huge: 30,
  big: 22,
  body: 17,
  label: 15,
  tiny: 13,
} as const;
