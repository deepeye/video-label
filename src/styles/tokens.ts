export const tokens = {
  color: {
    brand: { 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5' },
    accent: { 500: '#8B5CF6' },
    neutral: {
      0: '#FFFFFF',
      50: '#FAFAFA',
      100: '#F4F4F5',
      200: '#E4E4E7',
      400: '#A1A1AA',
      500: '#71717A',
      700: '#3F3F46',
      900: '#18181B',
    },
    success: { 50: '#ECFDF5', 500: '#10B981' },
    warning: { 50: '#FFF7ED', 500: '#F97316' },
    info: { 50: '#EFF6FF', 500: '#3B82F6' },
    danger: { 500: '#EF4444' },
    rejectedStroke: '#71717A',
  },
  brandGradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 8: 48, 10: 64 },
  shadow: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.10), 0 8px 10px rgba(0, 0, 0, 0.04)',
    brand: '0 4px 14px rgba(99, 102, 241, 0.30)',
  },
  ease: {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  duration: { fast: 120, base: 200, slow: 320 },
} as const;

export type Tokens = typeof tokens;
