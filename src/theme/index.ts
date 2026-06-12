// src/theme/index.ts
// Little Giant POS — Brand Theme

export const Colors = {
  // Brand — Little Giant Store (navy + gold)
  primary:     '#1B3060',  // Navy blue (logo background)
  primaryDark: '#0F1E3F',
  primaryLight:'#2E4F99',
  primaryBg:   '#E8EDF7',

  // Accent gold
  accent:      '#E8A020',
  accentDark:  '#B87A10',
  accentLight: '#FDF0D5',

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
  gray900:     '#1B3060',
  gray700:     '#4A5568',
  gray500:     '#718096',
  gray300:     '#CBD5E0',
  gray100:     '#F0EDE6',
  white:       '#FFFFFF',

  // Backgrounds — warm cream from logo
  bgPrimary:   '#FFFFFF',
  bgSecondary: '#F5F0E8',
  bgTertiary:  '#EDE8DF',

  // Text
  textPrimary:   '#1B3060',
  textSecondary: '#4A5568',
  textMuted:     '#718096',

  // Border
  border:      'rgba(27,48,96,0.12)',
  borderStrong:'rgba(27,48,96,0.25)',
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

export const CATEGORY_COLORS: Record<number, string> = {
  1:  '#FF6B35', // Street Food
  2:  '#F4A72A', // Pnoysilogan
  3:  '#E8923A', // Mojos
  4:  '#F5C518', // Fries
  5:  '#4CAF50', // Budget Meal
  6:  '#E53935', // Wings
  7:  '#BF360C', // Inasal
  8:  '#FF8C00', // Golden Noodles
  9:  '#EC407A', // Siomai
  10: '#7B1FA2', // Additional
  11: '#8E24AA', // Milk Shake
  12: '#F06292', // Ice Cream
  13: '#1E88E5', // Water
  14: '#D32F2F', // Softdrinks
  15: '#5D4037', // Milk Tea
  16: '#2E7D32', // Tsaí Refresher
  17: '#4E342E', // Frappe
  18: '#3E2723', // Iced Coffee
  19: '#00897B', // Tsaí Fruity
  20: '#1B5E20', // All Matcha
};

export default { Colors, Typography, Spacing, Radius, Shadow, CATEGORY_COLORS };
