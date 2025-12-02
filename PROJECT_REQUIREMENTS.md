# 🔧 Technical Requirements Questionnaire

> **📋 Document Status**: Based on codebase analysis  
> **📅 Analysis Date**: 2025-01-27  
> **🔍 Codebase**: RVOIS (Resident Volunteer Operations Information System)

## **1. Project Background**

### Application Metadata
- **Application Name**: **RVOIS** (Resident Volunteer Operations Information System)
- **Primary Purpose**: 
  - [x] Resident Management System
  - [x] Emergency Reporting Platform
  - [x] Multi-purpose Community Portal
  - [ ] Maintenance Request System
  - [ ] Other: `_________________`

### Current Architecture
- **Deployment Environment**: 
  - [x] Vercel (Production) - Region: Singapore (sin1)
  - [ ] Development/Staging
  - [ ] Other: `_________________`
- **Application Type**:
  - [ ] Single Page Application (SPA)
  - [x] Server-Side Rendered (SSR) - Next.js App Router
  - [ ] Static Site Generation (SSG)
  - [x] Hybrid (ISR/SSR) - Next.js 14 with App Router

---

## **2. Current Reporting Process (Resident Side)**

### Current User Flow
```
Step 1: Navigate to /resident/report?type=emergency or /resident/report?type=non-emergency
Step 2: System auto-captures GPS location (or user clicks "Use My Location")
Step 3: User fills form: Address (auto-filled from reverse geocode), Barangay (dropdown), Description (optional), Photos (optional, max 1-3), Voice (optional)
Step 4: User clicks "Submit" → Creates incident via POST /api/incidents → Redirects to dashboard
```

**Alternative Flow (SOS Button)**:
```
Step 1: User clicks floating SOS button (bottom-right, red circular button with AlertTriangle icon)
Step 2: Modal opens → Auto-fetches user profile + GPS location
Step 3: System creates EMERGENCY INCIDENT with priority 1 (highest)
Step 4: POST /api/incidents with incident_type="EMERGENCY INCIDENT", priority=1
```

### UI Components Analysis
- **SOS Button/Feature**:
  - Current Location in UI: **Fixed floating button, bottom-right (z-50), positioned above emergency call button**
  - Component Name/Path: **`src/components/resident/sos-button.tsx`** (export: `SOSButton`)
  - Trigger Mechanism: **onClick → Opens modal → Auto-fetches location → Creates EMERGENCY INCIDENT**
  - Associated API Endpoint: **`POST /api/incidents`** (same as regular reporting)
  - Visibility: **Only shown for `role='resident'`, hidden on `/resident/report` page**
  - Implementation: **403 lines, uses Supabase client, geolocation API, reverse geocoding**
  
- **PIN Feature**:
  - Current Location in UI: **Route guard - intercepts all routes except `/pin/setup`, `/pin/verify`, `/login`, `/auth/callback`, `/unauthorized`**
  - Component Name/Path: **`src/components/pin-guard.tsx`** (export: `PinGuard`) + **`src/components/pin-security-gate.tsx`** (export: `PinSecurityGate`)
  - Purpose/Function: **Additional security layer - 4-digit PIN authentication after login, session-based verification, rate limiting, brute force protection**
  - Associated API Endpoints: 
    - `GET /api/pin/status` - Check PIN setup status
    - `GET /api/pin/check-verified` - Verify PIN session cookie
    - `POST /api/pin/verify` - Verify PIN code
    - `POST /api/pin/set` - Set new PIN
    - `POST /api/pin/require-reverify` - Force re-verification
    - `POST /api/pin/clear-session` - Clear PIN session
    - `POST /api/pin/enable` - Enable PIN for user
    - `POST /api/pin/disable` - Disable PIN for user
  - Implementation: **Multiple components + lib files (`pin-auth-helper.ts`, `pin-security-helper.ts`, `pin-rate-limit.ts`, `pin-session.ts`)**
  - Exclusion: **Barangay users are excluded from PIN requirement**

### Current State Management
- **State Library**: 
  - [x] React Context API - Used in `useAuth` hook (`src/lib/auth.ts`)
  - [ ] Redux/Redux Toolkit
  - [ ] Zustand
  - [ ] Jotai
  - [ ] Other: `_________________`

- **Data Fetching**:
  - [ ] React Query/TanStack Query
  - [ ] SWR
  - [ ] Apollo Client
  - [x] Fetch API - Native fetch used throughout
  - [ ] Axios
  - [x] Supabase Client - Direct Supabase queries via `@supabase/supabase-js`
  - [ ] Other: `_________________`

### Rationale for Removal
- **Why remove SOS?**
  - [x] UX Confusion - **SOS button creates same incident type as emergency report form, redundant flow**
  - [x] Redundant with other features - **Emergency reporting already available via `/resident/report?type=emergency`**
  - [ ] Security concerns
  - [ ] Maintenance burden
  - [ ] User feedback
  - [ ] Other: **Simplify reporting to single direct flow**

- **Why remove PIN?**
  - [x] UX Confusion - **Additional authentication step after login may frustrate users**
  - [ ] Redundant with other features - **Supabase Auth already provides secure authentication**
  - [ ] Security concerns
  - [ ] Maintenance burden - **Complex PIN system with multiple components and API endpoints**
  - [ ] User feedback
  - [ ] Other: **Simplify authentication flow, reduce friction**

---

## **3. Desired New Process**

### User Experience Design
- **Interaction Model**:
  - [ ] One-click report (single button)
  - [ ] Two-step confirmation (button → confirm)
  - [ ] Form-based (fields required)
  - [ ] Category selection → details
  - [ ] Voice/audio input
  - [ ] Photo/video attachment
  - [ ] Hybrid approach: `_________________`

### Report Categories
- **Predefined Categories** (Current Implementation):
  1. **EMERGENCY INCIDENT** - Priority 1 (Critical) - Auto-assigned when `?type=emergency` or SOS button
  2. **COMMUNITY INCIDENT** - Priority 3 (Default) - Auto-assigned when `?type=non-emergency`
  3. **FIRE** - Requires skills: FIREFIGHTING, EMERGENCY RESPONSE
  4. **FLOOD** - Requires skills: WATER RESCUE, EMERGENCY RESPONSE
  5. **EARTHQUAKE** - Requires skills: SEARCH AND RESCUE, EMERGENCY RESPONSE
  6. **MEDICAL EMERGENCY** - Requires skills: FIRST AID, MEDICAL PROFESSIONAL
  7. **CRIME** - Requires skills: EMERGENCY RESPONSE, LEADERSHIP
  8. **TRAFFIC ACCIDENT** - Requires skills: FIRST AID, EMERGENCY RESPONSE
  9. **FALLEN TREE** - Requires skills: EMERGENCY RESPONSE
  10. **POWER OUTAGE** - Requires skills: EMERGENCY RESPONSE
  11. **WATER OUTAGE** - Requires skills: EMERGENCY RESPONSE
  12. **LANDSLIDE** - Requires skills: SEARCH AND RESCUE, EMERGENCY RESPONSE
  13. **OTHER** - Requires skills: EMERGENCY RESPONSE

- **Category Configuration**:
  - [x] Hardcoded in frontend - **Currently in `src/app/api/incidents/route.ts` (getRequiredSkillsForIncidentType function)**
  - [ ] Admin-configurable
  - [ ] Dynamic from API
  - [ ] User-defined

### Notification & Confirmation Flow
- **Immediate Actions** (Current Implementation):
  - [x] Send notification to admin/staff immediately - **Database trigger creates notifications, push notifications sent via web-push**
  - [x] Send confirmation to resident - **Toast notification: "Your incident report has been submitted successfully"**
  - [x] Create database record - **Inserts into `incidents` table, creates timeline entry in `incident_updates`**
  - [x] Trigger webhook/third-party integration - **Auto-assignment logic runs (finds nearby volunteers)**
  - [x] Send SMS/Email notification - **SMS sent to admins for critical incidents (if SMS_ENABLED=true)**
  - [x] Push notifications - **Web Push notifications sent to all admin devices via VAPID**

- **Confirmation UI** (Current Implementation):
  - [x] Toast notification - **Sonner toast library, 5-second duration**
  - [ ] Modal dialog
  - [ ] Inline message
  - [x] Redirect to status page - **Redirects to `/resident/dashboard?success=Incident reported successfully`**
  - [ ] No confirmation (silent)

### Real-time Features
- **WebSocket/SSE Requirements** (Current Implementation):
  - [x] Real-time status updates - **Supabase Realtime subscriptions for incident status changes**
  - [x] Live admin notifications - **Real-time notification delivery via Supabase Realtime**
  - [x] Push notifications - **Web Push API with VAPID keys, Service Worker integration**
  - [x] Live location tracking - **Real-time volunteer location updates via Supabase Realtime**

---

## **4. Data and Backend Behavior**

### Data Schema Requirements

#### Report Entity Fields (Current Database Schema)
```typescript
// Based on Supabase schema analysis
interface Incident {
  // Required Fields
  id: string;                              // [x] UUID - Primary key
  reporter_id: string;                     // [x] Required - UUID foreign key to users table
  created_at: string;                     // [x] ISO 8601 - Auto-generated timestamp
  updated_at: string;                     // [x] ISO 8601 - Auto-updated timestamp
  
  // Report Content
  incident_type: string;                   // [x] String - "EMERGENCY INCIDENT" | "COMMUNITY INCIDENT" | "FIRE" | "FLOOD" | etc.
  description: string | null;              // [x] Optional - Text description
  priority: number;                        // [x] Required - 1-5 (1=Critical, 5=Low)
  severity: string;                        // [x] Auto-assigned - "CRITICAL" | "SEVERE" | "MODERATE" | "MINOR" (mapped from priority)
  
  // Location Data
  location_lat: number;                    // [x] Required - Latitude (decimal degrees)
  location_lng: number;                    // [x] Required - Longitude (decimal degrees)
  address: string;                         // [x] Required - Human-readable address
  barangay: string;                        // [x] Required - Barangay name (normalized)
  
  // Media Attachments
  photo_url: string | null;                // [x] Optional - Single photo URL (legacy)
  photo_urls: string[];                    // [x] Optional - Array of photo URLs (current)
  voice_url: string | null;               // [x] Optional - Voice message URL
  
  // Status Tracking
  status: string;                          // [x] Required - "PENDING" | "ASSIGNED" | "RESPONDING" | "ARRIVED" | "RESOLVED" | "CANCELLED"
  assigned_to: string | null;             // [x] Optional - UUID foreign key to users (volunteer)
  assigned_at: string | null;             // [x] Optional - ISO 8601 timestamp
  resolved_at: string | null;             // [x] Optional - ISO 8601 timestamp
  resolution_notes: string | null;         // [x] Optional - Text notes
  
  // Reference & Tracking
  reference_id: string | null;             // [x] Optional - Short reference ID (e.g., "AB123")
  created_at_local: string | null;        // [x] Optional - Local timestamp for offline submissions
  
  // Legacy Fields (for migration)
  sosFlag?: boolean;                      // [ ] Remove | [ ] Archive | [ ] Migrate - NOT FOUND in current schema
  pinCode?: string;                       // [ ] Remove | [ ] Archive | [ ] Migrate - NOT FOUND in incidents table
}
```

### Database Migration Strategy
- **Legacy Data Handling**:
  - [ ] Delete all SOS/PIN columns immediately
  - [ ] Archive to separate table before deletion
  - [ ] Migrate relevant data to new schema
  - [ ] Keep for historical reference (read-only)
  - [ ] Soft delete (mark as deprecated)

- **Migration Script Requirements**:
  - [ ] Data transformation script needed
  - [ ] Rollback plan required
  - [ ] Zero-downtime migration
  - [ ] Scheduled maintenance window acceptable

### API Endpoints

#### Required Endpoints (Current Implementation)
```
POST   /api/incidents                  // Create new incident report (✅ EXISTS)
GET    /api/incidents                  // List incidents (with filters) - Need to verify
GET    /api/incidents/:id              // Get single incident - Need to verify
PATCH  /api/incidents/:id/status       // Update incident status (✅ EXISTS)
PATCH  /api/incidents/:id/severity    // Update incident severity (✅ EXISTS)
DELETE /api/incidents/:id             // Delete incident (soft/hard) - Need to verify
POST   /api/incidents/upload           // Upload photo attachments (✅ EXISTS, maxDuration: 60s)
POST   /api/incidents/upload-voice     // Upload voice message (✅ EXISTS, maxDuration: 60s)
GET    /api/incidents/:id/timeline     // Get incident timeline (✅ EXISTS)
GET    /api/barangays                  // Get barangay list (✅ EXISTS)
GET    /api/geocode/reverse            // Reverse geocoding (✅ EXISTS)
```

**PIN-Related Endpoints (TO BE REMOVED)**:
```
GET    /api/pin/status                 // Check PIN status (✅ EXISTS - REMOVE)
GET    /api/pin/check-verified         // Check PIN verification cookie (✅ EXISTS - REMOVE)
POST   /api/pin/verify                 // Verify PIN code (✅ EXISTS - REMOVE)
POST   /api/pin/set                    // Set new PIN (✅ EXISTS - REMOVE)
POST   /api/pin/require-reverify      // Force re-verification (✅ EXISTS - REMOVE)
POST   /api/pin/clear-session          // Clear PIN session (✅ EXISTS - REMOVE)
POST   /api/pin/enable                 // Enable PIN for user (✅ EXISTS - REMOVE)
POST   /api/pin/disable                // Disable PIN for user (✅ EXISTS - REMOVE)
```

#### Authentication & Authorization
- **Auth Method**:
  - [x] JWT tokens - **Supabase Auth uses JWT tokens**
  - [x] Session-based - **Cookie-based sessions via `@supabase/ssr`**
  - [ ] OAuth 2.0
  - [ ] API keys
  - [x] Other: **Supabase Auth (email/password) + Row Level Security (RLS) policies**

- **Role-Based Access Control (RBAC)**:
  - Resident permissions: **Create incidents, view own incidents, view incident history, update own profile**
  - Admin permissions: **Full access - view all incidents, assign volunteers, update status, manage users, view analytics, export reports**
  - Volunteer permissions: **View assigned incidents, update incident status, view volunteer dashboard, track location**
  - Barangay permissions: **View incidents in assigned barangay, create incidents, excluded from PIN requirement**

### Backend Validation Rules (Current Implementation)
- **Required Validations**:
  - [x] Resident ID exists and is active - **Validated via Supabase RLS + session check**
  - [x] Report type is valid enum/category - **Validated via Zod schema (`IncidentCreateSchema`)**
  - [ ] Description meets minimum length - **Description is optional, no minimum length**
  - [x] Location data is valid (if provided) - **Geofence validation: must be within Talisay City boundary (`isWithinTalisayCity`)**
  - [x] File uploads meet size/type restrictions - **Photos: max 3MB, JPEG only, processed with Sharp**
  - [x] Rate limiting (prevent spam) - **Rate limiting via `rate-limit.ts` (key-based rate limiting)**
  - [x] Priority validation - **Priority 1-5, must match incident_type (priority 1 for EMERGENCY INCIDENT)**
  - [x] Barangay normalization - **Barangay names normalized via `normalizeBarangay()` function**
  - [x] Severity mapping - **Auto-mapped from priority via `mapPriorityToSeverity()`**
  - [x] Reference ID generation - **Auto-generated short ID from UUID**

---

## **5. Admin Side Changes**

### Dashboard Requirements (Current Implementation)
- **Report List View**:
  - [x] Table with sorting/filtering - **`/admin/incidents` - Table view with filters**
  - [x] Card-based layout - **Dashboard cards for stats**
  - [x] Timeline/activity feed - **Incident timeline component (`incident-timeline.tsx`)**
  - [x] Map view (geographic) - **Map with incident markers, volunteer locations**
  - [ ] Calendar view

- **Filters & Search** (Current Implementation):
  - [x] By status - **Status filter dropdown**
  - [x] By category/type - **Incident type filter**
  - [x] By date range - **Date range picker**
  - [x] By resident - **Reporter filter**
  - [x] By assigned staff - **Assigned volunteer filter**
  - [x] Full-text search - **Search by description, address, barangay**
  - [x] Priority filter - **Priority level filter (1-5)**

- **Real-time Updates** (Current Implementation):
  - [x] WebSocket connection - **Supabase Realtime subscriptions**
  - [ ] Polling (interval: `_____` seconds)
  - [ ] Server-Sent Events (SSE)
  - [ ] Manual refresh only

### Notification System (Current Implementation)
- **Admin Notifications**:
  - [x] In-app notification badge - **Notification bell component with unread count**
  - [x] Browser push notifications - **Web Push API with VAPID keys**
  - [ ] Email notifications
  - [x] SMS notifications - **iProgSMS API integration (if SMS_ENABLED=true)**
  - [ ] Slack/Discord webhook
  - [x] Other: **Database trigger creates notification records, real-time delivery via Supabase Realtime**

- **Notification Triggers** (Current Implementation):
  - [x] New report created - **Database trigger on `incidents` table insert**
  - [x] High-priority report - **Priority 1 incidents trigger SMS alerts**
  - [x] Report status changed - **Timeline updates trigger notifications**
  - [x] Report assigned - **Assignment triggers push notification to volunteer**
  - [x] Report resolved - **Resolution triggers notification to resident**
  - [x] Custom rules: **Overdue incident monitoring (5+ minutes for priority 1) triggers critical alerts**

### Admin Actions
- **Available Actions**:
  - [ ] Acknowledge report
  - [ ] Assign to staff member
  - [ ] Change status
  - [ ] Add internal notes
  - [ ] Escalate priority
  - [ ] Resolve report
  - [ ] Archive report
  - [ ] Delete report
  - [ ] Export reports (CSV/PDF)
  - [ ] Bulk operations

### Configuration Panel
- **Admin-Configurable Settings**:
  - [ ] Report categories (CRUD)
  - [ ] Priority levels
  - [ ] Auto-assignment rules
  - [ ] Notification preferences
  - [ ] Response time SLAs
  - [ ] Custom fields
  - [ ] Other: `_________________`

---

## **6. Additional Enhancements**

### UI/UX Improvements
- **Accessibility**:
  - [ ] WCAG 2.1 AA compliance
  - [ ] Keyboard navigation
  - [ ] Screen reader support
  - [ ] High contrast mode
  - [ ] Font size adjustments

- **Responsive Design**:
  - [ ] Mobile-first approach
  - [ ] Tablet optimization
  - [ ] Desktop enhancements
  - [ ] PWA capabilities

- **Performance Optimizations**:
  - [ ] Code splitting
  - [ ] Lazy loading
  - [ ] Image optimization
  - [ ] Caching strategy
  - [ ] Bundle size reduction

### Technical Debt & Issues
- **Known Issues**:
  1. `_________________`
  2. `_________________`
  3. `_________________`

- **Performance Concerns**:
  - [ ] Slow API responses
  - [ ] Large bundle size
  - [ ] Memory leaks
  - [ ] Database query optimization
  - [ ] Image/media handling
  - [ ] Other: `_________________`

### Vercel Deployment Considerations (Current Configuration)
- **Environment Variables**:
  - Required: 
    - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
    - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
    - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - VAPID public key for push notifications
    - `VAPID_PRIVATE_KEY` - VAPID private key
  - Optional: 
    - `SMS_API_URL` - SMS service API URL
    - `SMS_API_KEY` - SMS service API key
    - `SMS_ENABLED` - Enable/disable SMS service

- **Build Configuration**:
  - Build command: **`pnpm run build`** (from `vercel.json`)
  - Output directory: **`.next`** (Next.js default)
  - Framework preset: **`nextjs`** (from `vercel.json`)

- **Edge Functions/Serverless**:
  - [x] API routes as serverless functions - **All API routes in `src/app/api/` are serverless**
  - [x] Edge middleware - **`src/middleware.ts` runs on Edge Runtime**
  - [ ] Edge config
  - [ ] Vercel KV (Redis)
  - [ ] Vercel Postgres - **Using Supabase Postgres instead**
  - [ ] Vercel Blob Storage - **Using Supabase Storage instead**

- **Deployment Pipeline**:
  - [x] CI/CD integration - **Automatic deployments from Git**
  - [x] Preview deployments - **Vercel preview deployments for PRs**
  - [ ] Staging environment
  - [x] Production deployment strategy - **Production region: Singapore (sin1)**

### New Features to Consider
- **Feature Requests**:
  1. `_________________`
  2. `_________________`
  3. `_________________`

---

## **7. Technical Stack**

### Frontend Stack (Current Implementation)
- **Framework**:
  - [x] React - **React 18.3.1**
  - [x] Next.js (version: **14.2.18**) - **App Router (Next.js 13+)**
  - [ ] Remix
  - [ ] SvelteKit
  - [ ] Other: `_________________`

- **UI Library/Framework**:
  - [x] Tailwind CSS - **Tailwind CSS 3.4.17**
  - [ ] Material-UI (MUI)
  - [ ] Chakra UI
  - [ ] Ant Design
  - [x] shadcn/ui - **Component library built on Radix UI**
  - [x] Custom CSS - **Global styles in `src/app/globals.css`**
  - [x] Other: **Radix UI primitives (20+ components)**

- **Type Safety**:
  - [x] TypeScript (version: **5.x**) - **Strict mode enabled**
  - [ ] JavaScript (ES6+)
  - [ ] Flow
  - [ ] PropTypes

- **Form Handling**:
  - [x] React Hook Form - **React Hook Form 7.54.1**
  - [ ] Formik
  - [ ] React Final Form
  - [x] Native HTML forms - **Used in resident report page**
  - [x] Other: **Zod 3.24.1 for validation schema**

- **Routing**:
  - [x] Next.js Router - **App Router with file-based routing**
  - [ ] React Router
  - [ ] TanStack Router
  - [ ] Other: `_________________`

### Backend Stack (Current Implementation)
- **Runtime**:
  - [x] Node.js (version: **22.21.0**) - **Managed via Volta**
  - [ ] Deno
  - [ ] Bun
  - [ ] Other: `_________________`

- **Framework**:
  - [x] Next.js API Routes - **All API endpoints in `src/app/api/`**
  - [ ] Express.js
  - [ ] Fastify
  - [ ] Koa
  - [ ] tRPC
  - [ ] GraphQL (Apollo/Relay)
  - [ ] Other: `_________________`

- **Backend Service**:
  - [x] Vercel Serverless Functions - **All API routes deployed as serverless functions**
  - [ ] Firebase Functions
  - [ ] AWS Lambda
  - [ ] Custom server
  - [ ] Other: `_________________`

### Database & ORM (Current Implementation)
- **Database**:
  - [x] PostgreSQL - **PostgreSQL via Supabase**
  - [ ] MySQL
  - [ ] MongoDB
  - [ ] SQLite
  - [x] Supabase - **Primary database platform**
  - [ ] Firebase Firestore
  - [ ] Vercel Postgres
  - [ ] Other: `_________________`

- **ORM/Query Builder**:
  - [ ] Prisma
  - [ ] TypeORM
  - [ ] Sequelize
  - [ ] Drizzle ORM
  - [ ] Mongoose (MongoDB)
  - [x] Raw SQL - **Supabase client with TypeScript types**
  - [x] Other: **`@supabase/supabase-js` query builder**

- **Database Connection**:
  - Connection string format: **Supabase client initialization with URL + keys**
  - Connection pooling: [x] Yes | [ ] No - **Supabase handles connection pooling**
  - Migration tool: **Supabase CLI (`supabase gen types`) + SQL migrations**

### Authentication & Authorization (Current Implementation)
- **Auth Provider**:
  - [ ] NextAuth.js (Auth.js)
  - [ ] Clerk
  - [ ] Auth0
  - [ ] Firebase Auth
  - [x] Supabase Auth - **Email/password authentication**
  - [ ] Custom JWT
  - [x] Other: **`@supabase/auth-helpers-nextjs` + `@supabase/ssr` for SSR support**

### File Storage (Current Implementation)
- **Storage Solution**:
  - [ ] Vercel Blob
  - [ ] AWS S3
  - [ ] Cloudinary
  - [ ] Firebase Storage
  - [x] Supabase Storage - **Photo and voice file storage**
  - [ ] Local filesystem
  - [x] Other: **Image processing with Sharp before upload**

### Monitoring & Analytics
- **Error Tracking**:
  - [ ] Sentry
  - [ ] LogRocket
  - [ ] Rollbar
  - [ ] Custom logging
  - [ ] None

- **Analytics**:
  - [ ] Vercel Analytics
  - [ ] Google Analytics
  - [ ] Plausible
  - [ ] Custom
  - [ ] None

### Testing (Current Implementation)
- **Testing Framework**:
  - [x] Jest - **Jest 29.7.0**
  - [ ] Vitest
  - [ ] Playwright
  - [ ] Cypress
  - [x] React Testing Library - **@testing-library/react 14.0.0**
  - [ ] None

---

## **8. Implementation Timeline & Priorities**

### Phase 1: Core Removal
- [ ] Remove SOS feature from frontend
- [ ] Remove PIN feature from frontend
- [ ] Remove SOS/PIN from backend API
- [ ] Database migration (remove/archive columns)

### Phase 2: New Reporting Flow
- [ ] Design new UI/UX
- [ ] Implement frontend components
- [ ] Create new API endpoints
- [ ] Update database schema
- [ ] Implement validation

### Phase 3: Admin Enhancements
- [ ] Update admin dashboard
- [ ] Implement notification system
- [ ] Add filtering/search
- [ ] Configuration panel

### Phase 4: Testing & Deployment
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance testing
- [ ] Security audit
- [ ] Deploy to staging
- [ ] Deploy to production

### Priority Level
- **Critical**: `_________________`
- **High**: `_________________`
- **Medium**: `_________________`
- **Low**: `_________________`

---

## **9. Additional Notes**

### Constraints
- Budget: `_________________`
- Timeline: `_________________`
- Team size: `_________________`
- Technical constraints: `_________________`

### Success Metrics
- User satisfaction: `_________________`
- Performance targets: `_________________`
- Adoption rate: `_________________`
- Error rate: `_________________`

### Questions for Clarification
1. `_________________`
2. `_________________`
3. `_________________`

---

---

## **10. Codebase Analysis Summary**

### **Files to Remove (SOS Feature)**
- `src/components/resident/sos-button.tsx` - SOS button component (403 lines)
- Import in `src/components/layout/resident-layout.tsx` (line 17, 255)
- Documentation: `SOS_FLOW_DOCUMENTATION.md` (can be archived)

### **Files to Remove (PIN Feature)**
- `src/components/pin-guard.tsx` - Route guard component (107 lines)
- `src/components/pin-security-gate.tsx` - Security gate component
- `src/components/pin-management.tsx` - PIN management UI
- `src/lib/pin-auth-helper.ts` - PIN authentication helpers
- `src/lib/pin-security-helper.ts` - PIN security utilities
- `src/lib/pin-rate-limit.ts` - PIN rate limiting
- `src/lib/pin-session.ts` - PIN session management
- API routes in `src/app/api/pin/` (8 files):
  - `status/route.ts`
  - `check-verified/route.ts`
  - `verify/route.ts`
  - `set/route.ts`
  - `require-reverify/route.ts`
  - `clear-session/route.ts`
  - `enable/route.ts`
  - `disable/route.ts`
- PIN-related pages: `/pin/setup`, `/pin/verify` (if they exist)

### **Database Tables to Check**
- `users` table - Check for `pin_code`, `pin_enabled`, `pin_expires_at` columns
- `incidents` table - Verify no `sos_flag` column exists
- `pin_attempts` table (if exists) - May need to archive or remove
- `pin_sessions` table (if exists) - May need to archive or remove

### **Current Reporting Flow (Resident)**
**Location**: `src/app/resident/report/page.tsx` (1354 lines)

**Key Features**:
- Auto-location capture on mount
- Reverse geocoding for address auto-fill
- Photo upload with watermarking (max 1-3 photos)
- Voice recording support
- Offline submission support (localStorage queue)
- Form validation (location, address, barangay required)
- Real-time submission with progress stages

**Submission Process**:
1. Validates form (location, address, barangay)
2. Checks authentication (useAuth hook + session fallback)
3. Handles offline mode (saves to localStorage)
4. Online: Calls `createIncident()` from `src/lib/incidents.ts`
5. Uploads photos via `/api/incidents/upload`
6. Creates incident record via `POST /api/incidents`
7. Shows toast notification
8. Redirects to dashboard

---

**Document Version**: 1.1  
**Last Updated**: 2025-01-27  
**Prepared By**: Codebase Analysis  
**Analysis Method**: Static code analysis + file system exploration

