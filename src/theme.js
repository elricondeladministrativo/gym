/** Paleta de la app: oscura, alto contraste, acento naranja eléctrico. */
export const colors = {
  // Fondos
  bg: '#0D0D0D',
  bgElevated: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#242424',
  border: '#2A2A2A',

  // Acentos
  accent: '#FF6B35',
  accentPressed: '#E85A28',
  accentSoft: 'rgba(255, 107, 53, 0.12)',
  accentBorder: 'rgba(255, 107, 53, 0.35)',

  steel: '#457B9D',
  steelDeep: '#1D3557',
  steelSoft: 'rgba(69, 123, 157, 0.16)',
  steelBorder: 'rgba(69, 123, 157, 0.4)',

  // Texto
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#6E6E6E',
  textOnAccent: '#0D0D0D',

  // Semánticos
  success: '#2A9D8F',
  successSoft: 'rgba(42, 157, 143, 0.14)',
  danger: '#E63946',
  dangerSoft: 'rgba(230, 57, 70, 0.14)',
  rest: '#457B9D',
  restSoft: 'rgba(69, 123, 157, 0.14)',
};

export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  displayRegular: 'BarlowCondensed_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = (n) => n * 4;
