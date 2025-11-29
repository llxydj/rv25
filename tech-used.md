# RVOIS Technology Stack Documentation

Complete documentation of all technologies, frameworks, libraries, services, and tools used in the RVOIS (Resident Volunteer Operations Information System) project.

---

## 📋 Table of Contents

1. [Core Framework & Runtime](#core-framework--runtime)
2. [Frontend Technologies](#frontend-technologies)
3. [Backend & API](#backend--api)
4. [Database & Data Management](#database--data-management)
5. [UI/UX Libraries & Components](#uiux-libraries--components)
6. [Maps & Geolocation](#maps--geolocation)
7. [Authentication & Security](#authentication--security)
8. [Notifications & Communication](#notifications--communication)
9. [File Processing & Export](#file-processing--export)
10. [Testing & Quality Assurance](#testing--quality-assurance)
11. [Development Tools](#development-tools)
12. [Deployment & Infrastructure](#deployment--infrastructure)
13. [External Services & APIs](#external-services--apis)
14. [Package Management](#package-management)

---

## 🚀 Core Framework & Runtime

### **Next.js 14.2.18**
- **Purpose**: React-based full-stack framework for production
- **Usage**: 
  - Server-side rendering (SSR)
  - API routes (`src/app/api/`)
  - File-based routing
  - Middleware for authentication
  - Image optimization
- **Configuration**: `next.config.mjs`
- **Features Used**:
  - App Router (Next.js 13+)
  - Server Components
  - Client Components
  - Dynamic imports
  - Service Worker support (PWA)

### **React 18.3.1**
- **Purpose**: UI library for building user interfaces
- **Usage**: Component-based architecture throughout the application
- **Features Used**:
  - Hooks (useState, useEffect, useMemo, useCallback)
  - Context API
  - Server Components
  - Client Components
  - Suspense boundaries

### **TypeScript 5.x**
- **Purpose**: Type-safe JavaScript
- **Configuration**: `tsconfig.json`
- **Usage**: 
  - Full type coverage across the codebase
  - Type definitions for Supabase
  - Custom type definitions in `src/types/`
- **Features**:
  - Strict mode enabled
  - Path aliases (`@/*`)
  - Module resolution: bundler

### **Node.js 22.21.0**
- **Purpose**: JavaScript runtime environment
- **Version Management**: Volta (via `package.json`)
- **Usage**: Server-side execution, API routes, build processes

---

## 🎨 Frontend Technologies

### **Tailwind CSS 3.4.17**
- **Purpose**: Utility-first CSS framework
- **Configuration**: `tailwind.config.js`
- **Features**:
  - Custom color palette (primary red theme)
  - Dark mode support (media-based)
  - Custom animations
  - Responsive design utilities
- **Plugins**:
  - `@tailwindcss/forms` - Form styling
  - `@tailwindcss/typography` - Typography utilities
  - `tailwindcss-animate` - Animation utilities

### **PostCSS 8.x**
- **Purpose**: CSS processing tool
- **Configuration**: `postcss.config.cjs`
- **Usage**: Processes Tailwind CSS and autoprefixer

### **Autoprefixer 10.4.20**
- **Purpose**: Automatically adds vendor prefixes to CSS
- **Usage**: Post-processing CSS for browser compatibility

### **CSS Modules & Global Styles**
- **Location**: `src/app/globals.css`
- **Features**: CSS custom properties, design tokens

---

## 🔧 Backend & API

### **Next.js API Routes**
- **Purpose**: Serverless API endpoints
- **Location**: `src/app/api/`
- **Features**:
  - RESTful API design
  - Server-side authentication
  - File upload handling
  - Webhook endpoints

### **Middleware**
- **File**: `src/middleware.ts`
- **Purpose**: Request interception, authentication checks, route protection

---

## 🗄️ Database & Data Management

### **Supabase**
- **Purpose**: Backend-as-a-Service (BaaS) platform
- **Version**: Latest (`@supabase/supabase-js`, `@supabase/ssr`)
- **Usage**:
  - PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Authentication
  - Storage

#### **Supabase Client Libraries**
- **`@supabase/supabase-js`**: Core Supabase JavaScript client
- **`@supabase/ssr`**: Server-side rendering support for Next.js
- **`@supabase/auth-helpers-nextjs`**: Authentication helpers

#### **Database Features**
- **PostgreSQL**: Relational database
- **Real-time**: WebSocket-based real-time updates
- **RLS Policies**: Row-level security for data access control
- **Functions**: Database functions and triggers
- **Migrations**: SQL migration files in `src/migrations/`

#### **Type Safety**
- **Generated Types**: `src/types/supabase.ts`
- **Command**: `pnpm gen-types` (generates TypeScript types from Supabase schema)

---

## 🎭 UI/UX Libraries & Components

### **Radix UI** (Headless UI Components)
Comprehensive set of accessible, unstyled UI primitives:

- **`@radix-ui/react-accordion`** - Collapsible content sections
- **`@radix-ui/react-alert-dialog`** - Modal dialogs for alerts
- **`@radix-ui/react-avatar`** - User avatar component
- **`@radix-ui/react-checkbox`** - Checkbox input
- **`@radix-ui/react-collapsible`** - Collapsible content
- **`@radix-ui/react-context-menu`** - Right-click context menus
- **`@radix-ui/react-dialog`** - Modal dialogs
- **`@radix-ui/react-dropdown-menu`** - Dropdown menus
- **`@radix-ui/react-hover-card`** - Hover cards
- **`@radix-ui/react-label`** - Form labels
- **`@radix-ui/react-menubar`** - Menu bar navigation
- **`@radix-ui/react-navigation-menu`** - Navigation menus
- **`@radix-ui/react-popover`** - Popover components
- **`@radix-ui/react-progress`** - Progress indicators
- **`@radix-ui/react-radio-group`** - Radio button groups
- **`@radix-ui/react-scroll-area`** - Custom scrollbars
- **`@radix-ui/react-select`** - Select dropdowns
- **`@radix-ui/react-separator`** - Visual separators
- **`@radix-ui/react-slider`** - Range sliders
- **`@radix-ui/react-slot`** - Slot component for composition
- **`@radix-ui/react-switch`** - Toggle switches
- **`@radix-ui/react-tabs`** - Tab navigation
- **`@radix-ui/react-toast`** - Toast notifications
- **`@radix-ui/react-toggle`** - Toggle buttons
- **`@radix-ui/react-toggle-group`** - Toggle button groups
- **`@radix-ui/react-tooltip`** - Tooltips

### **Shadcn/ui** (Component Library)
- **Purpose**: Pre-built, accessible components built on Radix UI
- **Configuration**: `components.json`
- **Location**: `src/components/ui/`
- **Components**: Buttons, cards, badges, forms, dialogs, etc.

### **Lucide React 0.454.0**
- **Purpose**: Icon library
- **Usage**: 1000+ icons used throughout the application
- **Features**: Tree-shakeable, customizable icons

### **Sonner 1.7.1**
- **Purpose**: Toast notification library
- **Usage**: User feedback for actions (success, error, info)

### **Next Themes 0.4.4**
- **Purpose**: Dark mode theme management
- **Usage**: System preference detection and theme switching

### **CMDK 1.0.4**
- **Purpose**: Command menu component (⌘K interface)
- **Usage**: Quick command palette for navigation

### **Vaul 0.9.6**
- **Purpose**: Drawer component library
- **Usage**: Bottom sheet drawers for mobile interfaces

### **React Resizable Panels 2.1.7**
- **Purpose**: Resizable panel layouts
- **Usage**: Dashboard layouts with adjustable panels

### **Embla Carousel React 8.5.1**
- **Purpose**: Carousel/slider component
- **Usage**: Image carousels, content sliders

### **Input OTP 1.4.1**
- **Purpose**: OTP/PIN input component
- **Usage**: PIN authentication interface

---

## 🗺️ Maps & Geolocation

### **Leaflet (Latest)**
- **Purpose**: Open-source JavaScript library for interactive maps
- **Usage**: Primary mapping library for all map components

### **React Leaflet 4.2.1**
- **Purpose**: React components for Leaflet
- **Usage**: 
  - Map containers
  - Markers
  - Popups
  - Tile layers
  - Custom icons

### **React Leaflet Cluster 3.1.1**
- **Purpose**: Marker clustering for Leaflet
- **Usage**: Clustering multiple markers on maps for better performance

### **GeoJSON**
- **Purpose**: Geographic data format
- **Usage**: 
  - Talisay City boundary (`talisay.geojson`)
  - Polygon boundaries
  - Geofencing

### **Custom Map Icons**
- **Location**: `src/lib/map-icons.ts`
- **Features**:
  - Teardrop pin design (SVG-based)
  - Status-based colors
  - Custom markers for incidents, volunteers, users

---

## 🔐 Authentication & Security

### **Supabase Auth**
- **Purpose**: Authentication service
- **Features**:
  - Email/password authentication
  - Session management
  - Cookie-based sessions
  - Row Level Security (RLS)

### **bcryptjs 2.4.3**
- **Purpose**: Password hashing
- **Usage**: Secure password storage and verification

### **PIN Authentication**
- **Custom Implementation**: `src/lib/pin-*.ts`
- **Features**:
  - 4-digit PIN for additional security
  - Rate limiting
  - Brute force protection
  - Session management

### **Security Headers**
- **Configuration**: `next.config.mjs`, `vercel.json`
- **Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 📱 Notifications & Communication

### **Web Push Notifications**
- **Library**: `web-push 3.6.7`
- **Purpose**: Browser push notifications
- **Features**:
  - VAPID keys for authentication
  - Service Worker integration
  - Subscription management
  - Cross-browser support

### **Service Worker**
- **File**: `public/sw.js`
- **Purpose**: Background service for push notifications and offline support
- **Features**:
  - Push event handling
  - Notification display
  - Cache management
  - Offline support

### **Next PWA 5.6.0**
- **Purpose**: Progressive Web App (PWA) support
- **Features**:
  - Service worker generation
  - Offline support
  - App manifest
  - Install prompts

### **SMS Service**
- **Custom Implementation**: `src/lib/sms-service.ts`
- **External API**: iProgSMS API
- **Features**:
  - Template-based messaging
  - Rate limiting (10/min, 100/hour)
  - Retry logic
  - Delivery tracking
  - Philippine number formatting

### **Notification Services**
- **Push Notification Service**: `src/lib/push-notification-service.ts`
- **Notification Delivery Service**: `src/lib/notification-delivery-service.ts`
- **Notification Subscription Service**: `src/lib/notification-subscription-service.ts`

---

## 📄 File Processing & Export

### **PDF Generation**

#### **Puppeteer 24.31.0**
- **Purpose**: Headless Chrome for PDF generation
- **Usage**: Server-side PDF rendering
- **Location**: `src/lib/pdf-generator-puppeteer.ts`

#### **React PDF Renderer 4.3.1**
- **Purpose**: React-based PDF generation
- **Usage**: Client-side PDF creation
- **Location**: `src/lib/pdf-templates/`

#### **jsPDF 3.0.3**
- **Purpose**: JavaScript PDF generation
- **Usage**: Simple PDF creation
- **Plugin**: `jspdf-autotable 5.0.2` - Table generation in PDFs

### **Image Processing**

#### **Sharp 0.33.5**
- **Purpose**: High-performance image processing
- **Usage**: Image optimization, resizing, format conversion

#### **Jimp 0.22.12**
- **Purpose**: JavaScript image manipulation
- **Usage**: Image processing and manipulation

### **CSV Export**
- **Custom Implementation**: `src/lib/enhanced-csv-export.ts`
- **Features**: Formatted CSV exports with proper encoding

---

## 📊 Data Visualization & Analytics

### **Recharts 2.15.0**
- **Purpose**: Composable charting library for React
- **Usage**: 
  - Analytics dashboards
  - Incident statistics
  - Volunteer performance charts
  - Time-series data visualization

---

## 📝 Forms & Validation

### **React Hook Form 7.54.1**
- **Purpose**: Performant form library
- **Usage**: Form state management and validation

### **Zod 3.24.1**
- **Purpose**: TypeScript-first schema validation
- **Usage**: Form validation, API request validation
- **Integration**: `@hookform/resolvers 3.9.1` - React Hook Form resolver

### **Date-fns 2.30.0**
- **Purpose**: Date utility library
- **Usage**: Date formatting, manipulation, and calculations

### **React Day Picker 8.10.1**
- **Purpose**: Date picker component
- **Usage**: Date selection in forms

---

## 🧪 Testing & Quality Assurance

### **Jest 29.7.0**
- **Purpose**: JavaScript testing framework
- **Configuration**: `jest.config.cjs`
- **Features**:
  - Unit testing
  - Integration testing
  - Coverage reports

### **Testing Library**
- **`@testing-library/react 14.0.0`**: React component testing
- **`@testing-library/jest-dom`**: DOM matchers for Jest

### **Jest Environment**
- **`jest-environment-jsdom 30.2.0`**: Browser-like environment for tests
- **`ts-jest 29.1.1`**: TypeScript support for Jest

### **ESLint 9.39.1**
- **Purpose**: Code linting and quality checks
- **Configuration**: `eslint.config.js`
- **Plugins**:
  - `@typescript-eslint/eslint-plugin 8.47.0`
  - `@typescript-eslint/parser 8.47.0`
  - `eslint-plugin-react-hooks 7.0.1`
  - `@next/eslint-plugin-next 15.5.6`

---

## 🛠️ Development Tools

### **TypeScript ESLint**
- **Purpose**: TypeScript-specific linting rules
- **Usage**: Type safety checks, code quality

### **Chokidar CLI 3.0.0**
- **Purpose**: File watching utility
- **Usage**: Watch mode for linting (`pnpm lint:watch`)

### **Rimraf 6.0.1**
- **Purpose**: Cross-platform `rm -rf` utility
- **Usage**: Clean build directories

### **Cross-env 7.0.3**
- **Purpose**: Cross-platform environment variable setting
- **Usage**: Setting NODE_OPTIONS for Jest

### **ts-node 10.9.2**
- **Purpose**: TypeScript execution environment
- **Usage**: Running TypeScript scripts directly

---

## 🚀 Deployment & Infrastructure

### **Vercel**
- **Purpose**: Hosting and deployment platform
- **Configuration**: `vercel.json`
- **Features**:
  - Automatic deployments
  - Edge functions
  - Serverless functions
  - CDN distribution
  - Region: Singapore (sin1)

### **Environment Variables**
- **Required Variables**:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key for push notifications
  - `VAPID_PRIVATE_KEY` - VAPID private key
  - `SMS_API_URL` - SMS service API URL
  - `SMS_API_KEY` - SMS service API key
  - `SMS_ENABLED` - Enable/disable SMS service

---

## 🌐 External Services & APIs

### **iProgSMS API**
- **Purpose**: SMS delivery service
- **Usage**: Sending SMS notifications to users
- **Format**: Philippine mobile numbers (639XXXXXXXXX)
- **Features**: Template-based messaging, delivery tracking

### **OpenStreetMap**
- **Purpose**: Map tile provider
- **Usage**: Base map tiles for Leaflet maps
- **URL**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

### **Facebook SDK**
- **Purpose**: Facebook integration
- **Usage**: Social media sharing, Facebook posts
- **Component**: `src/components/facebook-sdk-loader.tsx`

---

## 📦 Package Management

### **pnpm 10.19.0**
- **Purpose**: Fast, disk space efficient package manager
- **Version Management**: Volta (via `package.json`)
- **Configuration**: `pnpm-workspace.yaml`
- **Features**:
  - Workspace support
  - Faster installs
  - Disk space efficiency

### **Volta**
- **Purpose**: JavaScript tool manager
- **Usage**: Node.js and pnpm version management
- **Configuration**: `package.json` volta field

---

## 🎯 Utility Libraries

### **Class Variance Authority 0.7.1**
- **Purpose**: Component variant management
- **Usage**: Conditional class name generation

### **clsx 2.1.1**
- **Purpose**: Conditional class names
- **Usage**: Dynamic className generation

### **Tailwind Merge 2.6.0**
- **Purpose**: Merge Tailwind CSS classes
- **Usage**: Resolving class conflicts

### **UUID 13.0.0**
- **Purpose**: Unique identifier generation
- **Usage**: Generating unique IDs for records

---

## 📚 Additional Libraries

### **System Clock Component**
- **Custom Implementation**: `src/components/system-clock.tsx`
- **Purpose**: Real-time clock display

### **Audio Player**
- **Component**: `src/components/audio-player.tsx`
- **Purpose**: Voice message playback

### **Voice Recorder**
- **Component**: `src/components/voice-recorder.tsx`
- **Purpose**: Recording voice messages for incidents

---

## 🔄 Real-time Features

### **Supabase Realtime**
- **Purpose**: Real-time database subscriptions
- **Usage**:
  - Live incident updates
  - Volunteer location tracking
  - Notification delivery
  - Status changes

### **WebSocket Connections**
- **Purpose**: Persistent connections for real-time data
- **Usage**: Live updates without polling

---

## 📱 Progressive Web App (PWA)

### **PWA Features**
- **Service Worker**: Offline support
- **Manifest**: App installation
- **Offline Storage**: Cache API, IndexedDB
- **Install Prompts**: Custom install prompts

### **Offline Support**
- **Location**: `src/lib/offline-storage.ts`
- **Features**:
  - Offline incident reporting
  - Queue management
  - Sync when online

---

## 🗂️ Project Structure

```
rvois-project/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utility libraries
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   └── migrations/       # Database migrations
├── public/               # Static assets
├── scripts/             # Build and utility scripts
└── supabase/            # Supabase configuration
```

---

## 🔧 Build & Scripts

### **Available Scripts**
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests
- `pnpm gen-types` - Generate Supabase TypeScript types
- `pnpm backup:start` - Start backup service
- `pnpm backup:manual` - Manual backup
- `pnpm backup:restore` - Restore from backup

---

## 📊 Technology Summary

### **Frontend Stack**
- Next.js 14 (React 18)
- TypeScript 5
- Tailwind CSS 3
- Radix UI + Shadcn/ui

### **Backend Stack**
- Next.js API Routes
- Supabase (PostgreSQL)
- Serverless Functions

### **Database**
- PostgreSQL (via Supabase)
- Real-time subscriptions
- Row Level Security

### **Maps & Location**
- Leaflet + React Leaflet
- GeoJSON
- Custom SVG markers

### **Notifications**
- Web Push (VAPID)
- SMS (iProgSMS API)
- Service Worker

### **File Processing**
- Puppeteer (PDF)
- Sharp (Images)
- Custom CSV export

### **Testing**
- Jest
- Testing Library
- TypeScript ESLint

### **Deployment**
- Vercel
- Serverless architecture
- Edge functions

---

## 📝 Notes

- All dependencies are managed via `pnpm`
- TypeScript is used throughout for type safety
- The project follows Next.js 14 App Router conventions
- Supabase provides backend services (database, auth, storage)
- Real-time features use Supabase Realtime subscriptions
- PWA features enable offline functionality
- Security is enforced via RLS policies and middleware

---

**Last Updated**: November 2025  
**Project Version**: 0.1.0  
**Node Version**: 22.21.0  
**Package Manager**: pnpm 10.19.0

