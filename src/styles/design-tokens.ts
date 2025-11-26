/**
 * Design Tokens for RVOIS
 * Centralized design system for consistent UI/UX
 * DO NOT modify logic - UI styling only
 */

export const designTokens = {
  // Color Palette
  colors: {
    primary: {
      DEFAULT: 'bg-blue-600 hover:bg-blue-700',
      text: 'text-blue-600',
      light: 'bg-blue-50',
      dark: 'bg-blue-800',
    },
    secondary: {
      DEFAULT: 'bg-gray-600 hover:bg-gray-700',
      text: 'text-gray-600',
      light: 'bg-gray-50',
    },
    success: {
      DEFAULT: 'bg-green-600 hover:bg-green-700',
      text: 'text-green-600',
      light: 'bg-green-50',
    },
    danger: {
      DEFAULT: 'bg-red-600 hover:bg-red-700',
      text: 'text-red-600',
      light: 'bg-red-50',
    },
    warning: {
      DEFAULT: 'bg-yellow-500 hover:bg-yellow-600',
      text: 'text-yellow-600',
      light: 'bg-yellow-50',
    },
    info: {
      DEFAULT: 'bg-indigo-600 hover:bg-indigo-700',
      text: 'text-indigo-600',
      light: 'bg-indigo-50',
    },
  },

  // Typography Scale
  typography: {
    // Headings
    h1: 'text-3xl font-bold text-gray-900',
    h2: 'text-2xl font-bold text-gray-900',
    h3: 'text-xl font-semibold text-gray-900',
    h4: 'text-lg font-semibold text-gray-900',
    h5: 'text-base font-semibold text-gray-900',
    
    // Body text
    body: 'text-base text-gray-700',
    bodySmall: 'text-sm text-gray-600',
    bodyLarge: 'text-lg text-gray-700',
    
    // Labels
    label: 'text-sm font-medium text-gray-700',
    labelSmall: 'text-xs font-medium text-gray-600',
    
    // Muted text
    muted: 'text-sm text-gray-500',
    mutedSmall: 'text-xs text-gray-400',
  },

  // Spacing Scale
  spacing: {
    section: 'p-6 space-y-6',
    card: 'p-4 space-y-4',
    cardLarge: 'p-6 space-y-4',
    tight: 'p-2 space-y-2',
    list: 'space-y-2',
    listTight: 'space-y-1',
    grid: 'gap-4',
    gridLarge: 'gap-6',
  },

  // Button Styles
  buttons: {
    // Primary button
    primary: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    
    // Secondary button
    secondary: 'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    
    // Danger button
    danger: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    
    // Success button
    success: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    
    // Outline button
    outline: 'px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    
    // Ghost button
    ghost: 'px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    
    // Small variants
    primarySmall: 'px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    secondarySmall: 'px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200',
    
    // Icon button
    icon: 'p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200',
  },

  // Card Styles
  cards: {
    default: 'bg-white rounded-lg shadow-sm border border-gray-200 p-4',
    elevated: 'bg-white rounded-lg shadow-md border border-gray-200 p-6',
    interactive: 'bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer',
  },

  // Input Styles
  inputs: {
    default: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed',
    error: 'w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent',
    success: 'w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
  },

  // Badge Styles
  badges: {
    primary: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
    success: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
    danger: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
    warning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800',
    gray: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800',
  },

  // Alert Styles
  alerts: {
    info: 'bg-blue-50 border-l-4 border-blue-500 p-4 rounded',
    success: 'bg-green-50 border-l-4 border-green-500 p-4 rounded',
    warning: 'bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded',
    error: 'bg-red-50 border-l-4 border-red-500 p-4 rounded',
  },

  // Animation/Transition
  transitions: {
    default: 'transition-all duration-200 ease-in-out',
    fast: 'transition-all duration-150 ease-in-out',
    slow: 'transition-all duration-300 ease-in-out',
  },

  // Shadows
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  },

  // Border Radius
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },
} as const;

// Helper function to combine classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
