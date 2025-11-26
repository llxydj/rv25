// Design System Constants for RVOIS
export const DESIGN_TOKENS = {
  // Colors
  colors: {
    primary: "hsl(0, 0%, 9%)",
    primaryForeground: "hsl(0, 0%, 98%)",
    secondary: "hsl(0, 0%, 96.1%)",
    secondaryForeground: "hsl(0, 0%, 9%)",
    destructive: "hsl(0, 84.2%, 60.2%)",
    destructiveForeground: "hsl(0, 0%, 98%)",
    muted: "hsl(0, 0%, 96.1%)",
    mutedForeground: "hsl(0, 0%, 45.1%)",
    accent: "hsl(0, 0%, 96.1%)",
    accentForeground: "hsl(0, 0%, 9%)",
    border: "hsl(0, 0%, 89.8%)",
    input: "hsl(0, 0%, 89.8%)",
    ring: "hsl(0, 0%, 3.9%)",
    background: "hsl(0, 0%, 100%)",
    foreground: "hsl(0, 0%, 3.9%)",
    card: "hsl(0, 0%, 100%)",
    cardForeground: "hsl(0, 0%, 3.9%)",
  },
  
  // Spacing scale
  spacing: {
    '3xs': '0.125rem',  // 2px
    '2xs': '0.25rem',   // 4px
    xs: '0.5rem',       // 8px
    sm: '0.75rem',      // 12px
    md: '1rem',         // 16px
    lg: '1.5rem',       // 24px
    xl: '2rem',         // 32px
    '2xl': '3rem',      // 48px
    '3xl': '4rem',      // 64px
  },
  
  // Font sizes
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
  },
  
  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Border radius
  borderRadius: {
    xs: '0.125rem',     // 2px
    sm: '0.25rem',      // 4px
    md: '0.375rem',     // 6px
    lg: '0.5rem',       // 8px
    xl: '0.75rem',      // 12px
    '2xl': '1rem',      // 16px
    full: '9999px',
  },
  
  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
}

export type ColorKey = keyof typeof DESIGN_TOKENS.colors
export type SpacingKey = keyof typeof DESIGN_TOKENS.spacing
export type FontSizeKey = keyof typeof DESIGN_TOKENS.fontSize
export type FontWeightKey = keyof typeof DESIGN_TOKENS.fontWeight
export type LineHeightKey = keyof typeof DESIGN_TOKENS.lineHeight
export type BorderRadiusKey = keyof typeof DESIGN_TOKENS.borderRadius

export default DESIGN_TOKENS