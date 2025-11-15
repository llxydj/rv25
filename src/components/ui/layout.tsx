"use client"

import React from 'react'
import { cn } from '@/lib/utils'

// Enhanced Container Component
interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  center?: boolean
}

const Container: React.FC<ContainerProps> = ({
  size = 'lg',
  padding = 'md',
  center = true,
  className,
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  }

  const paddingClasses = {
    none: '',
    sm: 'px-4',
    md: 'px-6',
    lg: 'px-8'
  }

  return (
    <div
      className={cn(
        'w-full',
        sizeClasses[size],
        paddingClasses[padding],
        center ? 'mx-auto' : '',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Enhanced Grid Component
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  responsive?: boolean
}

const Grid: React.FC<GridProps> = ({
  cols = 3,
  gap = 'md',
  responsive = true,
  className,
  children,
  ...props
}) => {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  const gridClasses = responsive
    ? `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols}`
    : `grid grid-cols-${cols}`

  return (
    <div
      className={cn(
        gridClasses,
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Enhanced Flex Component
interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  wrap?: boolean
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

const Flex: React.FC<FlexProps> = ({
  direction = 'row',
  align = 'start',
  justify = 'start',
  wrap = false,
  gap = 'none',
  className,
  children,
  ...props
}) => {
  const directionClasses = {
    row: 'flex-row',
    column: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'column-reverse': 'flex-col-reverse'
  }

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline'
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly'
  }

  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  return (
    <div
      className={cn(
        'flex',
        directionClasses[direction],
        alignClasses[align],
        justifyClasses[justify],
        wrap ? 'flex-wrap' : 'flex-nowrap',
        gapClasses[gap],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Enhanced Stack Component (Vertical Flex)
interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  align?: 'start' | 'center' | 'end' | 'stretch'
}

const Stack: React.FC<StackProps> = ({
  spacing = 'md',
  align = 'stretch',
  className,
  children,
  ...props
}) => {
  const spacingClasses = {
    none: 'space-y-0',
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8'
  }

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }

  return (
    <div
      className={cn(
        'flex flex-col',
        spacingClasses[spacing],
        alignClasses[align],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Enhanced Section Component
interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  background?: 'white' | 'gray' | 'primary' | 'transparent'
  fullWidth?: boolean
}

const Section: React.FC<SectionProps> = ({
  padding = 'lg',
  background = 'white',
  fullWidth = false,
  className,
  children,
  ...props
}) => {
  const paddingClasses = {
    none: '',
    sm: 'py-4',
    md: 'py-8',
    lg: 'py-12',
    xl: 'py-16'
  }

  const backgroundClasses = {
    white: 'bg-white',
    gray: 'bg-gray-50',
    primary: 'bg-red-50',
    transparent: 'bg-transparent'
  }

  return (
    <section
      className={cn(
        paddingClasses[padding],
        backgroundClasses[background],
        fullWidth ? 'w-full' : '',
        className
      )}
      {...props}
    >
      {children}
    </section>
  )
}

// Enhanced Header Component
interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'gray' | 'white'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  align?: 'left' | 'center' | 'right'
}

const Header: React.FC<HeaderProps> = ({
  level = 1,
  size = 'lg',
  color = 'primary',
  weight = 'bold',
  align = 'left',
  className,
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  }

  const colorClasses = {
    primary: 'text-gray-900',
    secondary: 'text-gray-700',
    gray: 'text-gray-600',
    white: 'text-white'
  }

  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  }

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  }

  const Component = `h${level}` as keyof JSX.IntrinsicElements

  return (
    <Component
      className={cn(
        sizeClasses[size],
        colorClasses[color],
        weightClasses[weight],
        alignClasses[align],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

// Enhanced Text Component
interface TextProps extends React.HTMLAttributes<HTMLElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'gray' | 'white' | 'success' | 'warning' | 'danger'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  align?: 'left' | 'center' | 'right' | 'justify'
  as?: 'p' | 'span' | 'div' | 'label'
}

const Text: React.FC<TextProps> = ({
  size = 'md',
  color = 'primary',
  weight = 'normal',
  align = 'left',
  as: Component = 'p',
  className,
  children,
  ...props
}) => {
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  const colorClasses = {
    primary: 'text-gray-900',
    secondary: 'text-gray-700',
    gray: 'text-gray-600',
    white: 'text-white',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  }

  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  }

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  }

  return (
    <Component
      className={cn(
        sizeClasses[size],
        colorClasses[color],
        weightClasses[weight],
        alignClasses[align],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

// Enhanced Divider Component
interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  thickness?: 'thin' | 'medium' | 'thick'
  color?: 'light' | 'medium' | 'dark'
  spacing?: 'none' | 'sm' | 'md' | 'lg'
}

const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  thickness = 'thin',
  color = 'light',
  spacing = 'md',
  className,
  ...props
}) => {
  const orientationClasses = {
    horizontal: 'w-full',
    vertical: 'h-full'
  }

  const thicknessClasses = {
    thin: orientation === 'horizontal' ? 'h-px' : 'w-px',
    medium: orientation === 'horizontal' ? 'h-0.5' : 'w-0.5',
    thick: orientation === 'horizontal' ? 'h-1' : 'w-1'
  }

  const colorClasses = {
    light: 'bg-gray-200',
    medium: 'bg-gray-300',
    dark: 'bg-gray-400'
  }

  const spacingClasses = {
    none: '',
    sm: orientation === 'horizontal' ? 'my-2' : 'mx-2',
    md: orientation === 'horizontal' ? 'my-4' : 'mx-4',
    lg: orientation === 'horizontal' ? 'my-6' : 'mx-6'
  }

  return (
    <div
      className={cn(
        orientationClasses[orientation],
        thicknessClasses[thickness],
        colorClasses[color],
        spacingClasses[spacing],
        className
      )}
      {...props}
    />
  )
}

// Enhanced Spacer Component
interface SpacerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  axis?: 'horizontal' | 'vertical' | 'both'
}

const Spacer: React.FC<SpacerProps> = ({
  size = 'md',
  axis = 'vertical'
}) => {
  const sizeClasses = {
    xs: '4',
    sm: '8',
    md: '16',
    lg: '24',
    xl: '32',
    '2xl': '48'
  }

  const axisClasses = {
    horizontal: `w-${sizeClasses[size]}`,
    vertical: `h-${sizeClasses[size]}`,
    both: `w-${sizeClasses[size]} h-${sizeClasses[size]}`
  }

  return <div className={axisClasses[axis]} />
}

// Export all layout components
export {
  Container,
  Grid,
  Flex,
  Stack,
  Section,
  Header,
  Text,
  Divider,
  Spacer
}
