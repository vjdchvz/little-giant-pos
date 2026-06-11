// src/theme/index.ts
// Little Giant POS — Brand Theme

export const Colors = {
  // Brand
  primary:     '#D85A30',  // Coral fire — main brand color
  primaryDark: '#993C1D',
  primaryLight:'#F0997B',
  primaryBg:   '#FAECE7',

  // Success / money
  success:     '#1D9E75',
  successDark: '#0F6E56',
  successLight:'#E1F5EE',

  // Warning
  warning:     '#BA7517',
  warningLight:'#FAEEDA',

  // Danger
  danger:      '#E24B4A',
  dangerLight: '#FCEBEB',

  // Neutrals
  black:       '#1a1a1a',
  gray900:     '#2C2C2A',
  gray700:     '#5F5E5A',
  gray500:     '#888780',
  gray300:     '#D3D1C7',
  gray100:     '#F1EFE8',
  white:       '#FFFFFF',

  // Backgrounds
  bgPrimary:   '#FFFFFF',
  bgSecondary: '#F7F6F2',
  bgTertiary:  '#F1EFE8',

  // Text
  textPrimary:   '#1a1a1a',
  textSecondary: '#5F5E5A',
  textMuted:     '#888780',

  // Border
  border:      'rgba(0,0,0,0.1)',
  borderStrong:'rgba(0,0,0,0.2)',
};

export const Typography = {
  // Font sizes
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  hero: 38,

  // Weights
  regular: '400' as const,
  medium:  '500' as const,
  bold:    '700' as const,

  // Line heights
  tight:  1.2,
  normal: 1.5,
  loose:  1.7,
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
  xxxl:40,
};

export const Radius = {
  sm:  6,
  md:  10,
  lg:  14,
  xl:  20,
  full:999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
};

export default { Colors, Typography, Spacing, Radius, Shadow };
