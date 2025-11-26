# 🎨 RVOIS UI/UX Style Guide

## Design System Overview

This comprehensive style guide ensures consistent, accessible, and professional UI/UX across all RVOIS components and pages.

## 🎨 Color Palette

### Primary Colors
```css
/* Red (Primary) */
--red-50: #fef2f2
--red-100: #fee2e2
--red-200: #fecaca
--red-300: #fca5a5
--red-400: #f87171
--red-500: #ef4444
--red-600: #dc2626  /* Main Primary */
--red-700: #b91c1c
--red-800: #991b1b
--red-900: #7f1d1d
```

### Neutral Colors
```css
/* Gray Scale */
--gray-50: #f9fafb
--gray-100: #f3f4f6
--gray-200: #e5e7eb
--gray-300: #d1d5db
--gray-400: #9ca3af
--gray-500: #6b7280
--gray-600: #4b5563
--gray-700: #374151
--gray-800: #1f2937
--gray-900: #111827
```

### Semantic Colors
```css
/* Success */
--green-600: #16a34a
--green-100: #dcfce7

/* Warning */
--yellow-600: #d97706
--yellow-100: #fef3c7

/* Danger */
--red-600: #dc2626
--red-100: #fee2e2

/* Info */
--blue-600: #2563eb
--blue-100: #dbeafe
```

## 📝 Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Font Sizes
```css
/* Base Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
```

### Font Weights
```css
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Line Heights
```css
--leading-tight: 1.25
--leading-normal: 1.5
--leading-relaxed: 1.75
```

## 📏 Spacing Scale

```css
/* Spacing Units */
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;    /* 20px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
--space-20: 5rem;      /* 80px */
--space-24: 6rem;      /* 96px */
```

## 🎯 Component Standards

### Buttons

#### Primary Button
```css
background: #dc2626;
color: white;
padding: 0.5rem 1rem;
border-radius: 0.375rem;
font-weight: 500;
transition: all 0.2s;
```

#### Secondary Button
```css
background: #6b7280;
color: white;
padding: 0.5rem 1rem;
border-radius: 0.375rem;
font-weight: 500;
transition: all 0.2s;
```

#### Outline Button
```css
background: transparent;
color: #374151;
border: 1px solid #d1d5db;
padding: 0.5rem 1rem;
border-radius: 0.375rem;
font-weight: 500;
transition: all 0.2s;
```

### Cards

#### Default Card
```css
background: white;
border: 1px solid #e5e7eb;
border-radius: 0.5rem;
box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
padding: 1.5rem;
```

#### Elevated Card
```css
background: white;
border: 1px solid #f3f4f6;
border-radius: 0.5rem;
box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
padding: 1.5rem;
```

### Forms

#### Input Fields
```css
background: white;
border: 1px solid #d1d5db;
border-radius: 0.375rem;
padding: 0.5rem 0.75rem;
font-size: 0.875rem;
transition: border-color 0.2s;
```

#### Input Focus
```css
border-color: #dc2626;
outline: none;
box-shadow: 0 0 0 3px rgb(220 38 38 / 0.1);
```

### Status Badges

#### Success Badge
```css
background: #dcfce7;
color: #166534;
border: 1px solid #bbf7d0;
padding: 0.25rem 0.75rem;
border-radius: 9999px;
font-size: 0.75rem;
font-weight: 500;
```

#### Warning Badge
```css
background: #fef3c7;
color: #92400e;
border: 1px solid #fde68a;
padding: 0.25rem 0.75rem;
border-radius: 9999px;
font-size: 0.75rem;
font-weight: 500;
```

#### Danger Badge
```css
background: #fee2e2;
color: #991b1b;
border: 1px solid #fecaca;
padding: 0.25rem 0.75rem;
border-radius: 9999px;
font-size: 0.75rem;
font-weight: 500;
```

## 📱 Responsive Breakpoints

```css
/* Mobile First Approach */
--sm: 640px;    /* Small devices */
--md: 768px;    /* Medium devices */
--lg: 1024px;   /* Large devices */
--xl: 1280px;   /* Extra large devices */
--2xl: 1536px;  /* 2X large devices */
```

## 🎨 Layout Guidelines

### Container Widths
```css
/* Container Sizes */
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;
```

### Grid System
```css
/* Grid Columns */
--grid-cols-1: repeat(1, minmax(0, 1fr));
--grid-cols-2: repeat(2, minmax(0, 1fr));
--grid-cols-3: repeat(3, minmax(0, 1fr));
--grid-cols-4: repeat(4, minmax(0, 1fr));
--grid-cols-6: repeat(6, minmax(0, 1fr));
--grid-cols-12: repeat(12, minmax(0, 1fr));
```

## ♿ Accessibility Standards

### Color Contrast
- **AA Standard**: Minimum 4.5:1 contrast ratio for normal text
- **AAA Standard**: Minimum 7:1 contrast ratio for normal text
- **Large Text**: Minimum 3:1 contrast ratio for text 18pt+ or 14pt+ bold

### Focus States
```css
/* Focus Ring */
focus:outline-none;
focus:ring-2;
focus:ring-red-500;
focus:ring-offset-2;
```

### Interactive Elements
- Minimum touch target size: 44px × 44px
- Clear visual feedback for all interactive states
- Keyboard navigation support for all components

## 🎭 Animation & Transitions

### Transition Timing
```css
/* Standard Transitions */
--transition-fast: 150ms;
--transition-normal: 200ms;
--transition-slow: 300ms;
```

### Easing Functions
```css
/* Easing */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

## 📐 Border Radius

```css
/* Border Radius Scale */
--radius-none: 0;
--radius-sm: 0.125rem;   /* 2px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-full: 9999px;
```

## 🌟 Shadows

```css
/* Shadow Scale */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

## 📋 Component Usage Guidelines

### Button Usage
- **Primary**: Main actions (Submit, Save, Create)
- **Secondary**: Secondary actions (Cancel, Back)
- **Danger**: Destructive actions (Delete, Remove)
- **Outline**: Subtle actions (View, Edit)

### Card Usage
- **Default**: Standard content containers
- **Elevated**: Important content that needs emphasis
- **Outlined**: Subtle content separation

### Badge Usage
- **Status**: Show current state (Active, Pending, Resolved)
- **Priority**: Show importance level (Critical, High, Medium, Low)
- **Role**: Show user type (Admin, Volunteer, Resident)

## 🎯 Implementation Checklist

### Visual Consistency
- [ ] All components use consistent color palette
- [ ] Typography follows established scale
- [ ] Spacing uses consistent scale
- [ ] Border radius follows established scale
- [ ] Shadows follow established scale

### Layout & Design
- [ ] All layouts properly aligned
- [ ] Consistent padding and margins
- [ ] Proper contrast and readability
- [ ] Images and icons properly scaled
- [ ] No overlapping or misaligned elements

### Accessibility
- [ ] Minimum 14px font size for body text
- [ ] AA standard color contrast
- [ ] Descriptive labels and alt texts
- [ ] Proper focus states
- [ ] Keyboard navigation support

### Responsiveness
- [ ] Mobile (375px) layout tested
- [ ] Tablet (768px) layout tested
- [ ] Desktop (1920px) layout tested
- [ ] No horizontal scrolling
- [ ] Modals resize correctly

### User Experience
- [ ] Clear navigation and flow
- [ ] Visible success/error messages
- [ ] Loading indicators for async actions
- [ ] Form validation with proper error highlights
- [ ] Smooth animations and transitions

## 🚀 Quick Start

### Import Components
```typescript
import { 
  Button, 
  Card, 
  Input, 
  StatusBadge, 
  DataTable 
} from '@/components/ui/design-system'
```

### Basic Usage
```typescript
// Button
<Button variant="primary" size="md">
  Click Me
</Button>

// Card
<Card variant="elevated" padding="lg">
  <h2>Card Title</h2>
  <p>Card content goes here</p>
</Card>

// Status Badge
<StatusBadge status="RESOLVED" size="md" />

// Data Table
<DataTable 
  data={incidents} 
  columns={columns} 
  loading={false}
/>
```

This style guide ensures consistent, professional, and accessible UI/UX across all RVOIS components and pages.
