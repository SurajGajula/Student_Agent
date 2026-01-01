// Theme constants matching the original CSS - works for both web and native
export const colors = {
  background: '#f0f0f0',
  surface: '#e8e8e8',
  border: '#d0d0d0',
  text: '#0f0f0f',
  textSecondary: '#666',
  textLight: '#f0f0f0',
  white: '#ffffff',
  error: '#c62828',
  success: '#2e7d32',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 40,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '300' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '300' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '300' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    fontWeight: '300' as const,
    letterSpacing: 0.2,
  },
  small: {
    fontSize: 14,
    fontWeight: '300' as const,
    letterSpacing: 0.2,
  },
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 24,
  round: 9999,
};

