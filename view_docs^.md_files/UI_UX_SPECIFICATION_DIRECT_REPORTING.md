# 🎨 UI/UX Specification: Direct Emergency Reporting

> **Design System**: RVOIS Emergency Reporting  
> **Target**: Mobile-First, Emergency-Ready Interface  
> **Accessibility**: WCAG 2.1 AA Compliant

---

## 📱 Screen Specifications

### 1. Resident Dashboard (Before Report)

#### **Layout Structure**
```
┌─────────────────────────────────────┐
│  [Header: RVOIS Logo + Profile]    │
├─────────────────────────────────────┤
│                                     │
│         ┌───────────────┐          │
│         │               │          │
│         │   🚨 REPORT   │          │
│         │   EMERGENCY   │          │
│         │               │          │
│         │  [Red Button] │          │
│         │               │          │
│         └───────────────┘          │
│                                     │
│    Tap to report emergency          │
│         instantly                   │
│                                     │
├─────────────────────────────────────┤
│  Recent Reports                     │
│  ┌─────────────────────────────┐   │
│  │ 🚨 #ABC123 - PENDING         │   │
│  │ Zone 5, Talisay              │   │
│  │ 2 minutes ago                │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ✅ #XYZ789 - RESOLVED        │   │
│  │ Zone 3, Talisay              │   │
│  │ 1 hour ago                   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### **Component Specifications**

**Emergency Button**
- **Dimensions**: 
  - Mobile: 200px × 200px (min touch target: 44px × 44px)
  - Desktop: 250px × 250px
- **Border Radius**: 50% (perfect circle)
- **Background**: 
  - Default: `#DC2626` (red-600)
  - Hover: `#B91C1C` (red-700)
  - Active: `#991B1B` (red-800)
  - Disabled: `#9CA3AF` (gray-400) at 50% opacity
- **Shadow**: 
  - Default: `0 20px 25px -5px rgba(220, 38, 38, 0.3)`
  - Hover: `0 25px 50px -12px rgba(220, 38, 38, 0.5)`
- **Icon**: 
  - AlertTriangle (Lucide React)
  - Size: 80px (mobile), 96px (desktop)
  - Color: White (`#FFFFFF`)
- **Text**: 
  - "REPORT EMERGENCY"
  - Font: Bold, 24px (mobile), 28px (desktop)
  - Color: White
  - Line height: 1.2
- **Animation**:
  - Pulse on load: `animate-pulse` (2s duration, 3 times)
  - Scale on tap: `scale-95` (100ms)
  - Hover: `scale-105` (200ms ease-out)

**Helper Text**
- **Content**: "Tap to report emergency instantly"
- **Font**: Regular, 14px
- **Color**: `#6B7280` (gray-500)
- **Position**: 16px below button
- **Alignment**: Center

#### **Accessibility**
- **ARIA Label**: `"Report emergency incident"`
- **Role**: `button`
- **Keyboard**: Tab-accessible, Enter/Space to activate
- **Screen Reader**: "Large red button, Report Emergency. Tap to report emergency instantly."

---

### 2. Reporting State (Loading)

```
┌─────────────────────────────────────┐
│  [Header]                           │
├─────────────────────────────────────┤
│                                     │
│         ┌───────────────┐          │
│         │               │          │
│         │   ⏳          │          │
│         │  [Spinner]    │          │
│         │               │          │
│         └───────────────┘          │
│                                     │
│    Reporting emergency...           │
│                                     │
└─────────────────────────────────────┘
```

**Loading State**
- **Spinner**: 
  - Loader2 icon (Lucide React)
  - Size: 80px
  - Color: White
  - Animation: `animate-spin` (1s linear infinite)
- **Text**: "Reporting emergency..."
- **Button**: Disabled, same size, gray background

---

### 3. Success Confirmation

```
┌─────────────────────────────────────┐
│  [Header]                           │
├─────────────────────────────────────┤
│                                     │
│         ┌───────────────┐          │
│         │      ✅       │          │
│         │   SUCCESS     │          │
│         └───────────────┘          │
│                                     │
│  Emergency Reported!                │
│                                     │
│  Your emergency has been sent       │
│  to the response team.              │
│                                     │
│  Incident ID: #ABC123               │
│  Location: Zone 5, Talisay City     │
│  Status: PENDING                    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [Add Description]            │   │
│  │ [Add Photo]                  │   │
│  │ [Add Voice]                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [View Status]                │   │
│  │ [Call Emergency: 09998064555]│   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Success Modal**
- **Background**: White (light mode), `#1F2937` (dark mode)
- **Border Radius**: 16px
- **Padding**: 24px
- **Shadow**: `0 20px 25px -5px rgba(0, 0, 0, 0.1)`
- **Icon**: CheckCircle, 64px, `#10B981` (green-500)
- **Title**: "Emergency Reported!", Bold, 24px
- **Description**: Regular, 16px, `#6B7280`

**Quick Action Buttons**
- **Layout**: Vertical stack, full width
- **Spacing**: 12px between buttons
- **Style**: Outline variant
- **Icons**: Left-aligned, 20px

---

### 4. Quick Actions Modal

```
┌─────────────────────────────────────┐
│  Add Details to Your Report    [X]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📝 Add Description          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📷 Add Photo                 │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🎤 Add Voice Message         │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Cancel]                            │
└─────────────────────────────────────┘
```

**Modal Specifications**
- **Width**: 90vw (mobile), 400px (desktop)
- **Max Height**: 80vh
- **Backdrop**: `rgba(0, 0, 0, 0.5)` with blur
- **Animation**: Fade in + slide up (300ms)

---

## 🎨 Design Tokens

### Colors

```css
/* Emergency Red */
--emergency-red: #DC2626;
--emergency-red-hover: #B91C1C;
--emergency-red-active: #991B1B;
--emergency-red-light: #FEE2E2;
--emergency-red-dark: #7F1D1D;

/* Success Green */
--success-green: #10B981;
--success-green-light: #D1FAE5;

/* Status Colors */
--status-pending: #F59E0B;
--status-assigned: #3B82F6;
--status-responding: #8B5CF6;
--status-arrived: #06B6D4;
--status-resolved: #10B981;
```

### Typography

```css
/* Headings */
--font-heading: 'Inter', system-ui, sans-serif;
--font-heading-weight-bold: 700;
--font-heading-size-xl: 24px;
--font-heading-size-lg: 20px;

/* Body */
--font-body: 'Inter', system-ui, sans-serif;
--font-body-weight-regular: 400;
--font-body-size-base: 16px;
--font-body-size-sm: 14px;

/* Button Text */
--font-button: 'Inter', system-ui, sans-serif;
--font-button-weight-bold: 700;
--font-button-size: 24px;
```

### Spacing

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
--shadow-emergency: 0 20px 25px -5px rgba(220, 38, 38, 0.3);
```

---

## 📐 Responsive Breakpoints

```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

**Button Sizes by Breakpoint**:
- Mobile (< 640px): 200px × 200px
- Tablet (640px - 1024px): 220px × 220px
- Desktop (> 1024px): 250px × 250px

---

## ⚡ Animation Specifications

### Button Pulse (On Load)
```css
@keyframes pulse-emergency {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

.emergency-button-pulse {
  animation: pulse-emergency 2s cubic-bezier(0.4, 0, 0.6, 1) 3;
}
```

### Button Tap
```css
.emergency-button:active {
  transform: scale(0.95);
  transition: transform 100ms ease-in;
}
```

### Success Modal Entrance
```css
@keyframes slide-up-fade {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.success-modal {
  animation: slide-up-fade 300ms ease-out;
}
```

---

## ♿ Accessibility Requirements

### WCAG 2.1 AA Compliance

1. **Color Contrast**
   - Button text: 4.5:1 minimum
   - Background: 3:1 minimum
   - Status indicators: 3:1 minimum

2. **Touch Targets**
   - Minimum: 44px × 44px
   - Emergency button: 200px × 200px ✅

3. **Keyboard Navigation**
   - Tab order: Logical sequence
   - Focus indicators: Visible outline
   - Enter/Space: Activates buttons

4. **Screen Readers**
   - ARIA labels on all interactive elements
   - Status announcements for state changes
   - Descriptive button text

5. **Motion**
   - Respect `prefers-reduced-motion`
   - Disable animations if user preference

---

## 📱 Mobile Optimizations

### Touch Interactions
- **Tap Delay**: Removed (touch-action: manipulation)
- **Double Tap Zoom**: Disabled (user-scalable=no)
- **Swipe Gestures**: Not used (avoid accidental triggers)

### Performance
- **Image Optimization**: WebP format, lazy loading
- **Font Loading**: Preload critical fonts
- **Critical CSS**: Inline above-the-fold styles

### Offline Support
- **Service Worker**: Cache critical assets
- **Offline Queue**: Store reports locally
- **Sync Indicator**: Show when syncing

---

## 🌙 Dark Mode Support

### Color Adjustments

**Light Mode**:
- Background: White (`#FFFFFF`)
- Text: `#111827` (gray-900)
- Button: `#DC2626` (red-600)

**Dark Mode**:
- Background: `#111827` (gray-900)
- Text: `#F9FAFB` (gray-50)
- Button: `#DC2626` (red-600) - Same, high contrast

**Implementation**:
```css
@media (prefers-color-scheme: dark) {
  .dashboard {
    background-color: #111827;
    color: #F9FAFB;
  }
}
```

---

## 🧪 User Testing Scenarios

### Scenario 1: Emergency Report (Happy Path)
1. User opens app
2. Sees large red button
3. Taps button immediately
4. Sees success confirmation in < 3 seconds
5. Can add details if needed

**Expected**: 100% success rate, < 3 seconds

### Scenario 2: Offline Report
1. User opens app (offline)
2. Taps emergency button
3. Sees "Report queued" message
4. Goes online
5. Report syncs automatically

**Expected**: Seamless offline experience

### Scenario 3: Location Denied
1. User denies location permission
2. Taps emergency button
3. Uses profile address as fallback
4. Report succeeds

**Expected**: Graceful degradation

---

## 📊 Design Assets

### Icons
- **Emergency Button**: AlertTriangle (Lucide React)
- **Success**: CheckCircle (Lucide React)
- **Loading**: Loader2 (Lucide React)
- **Add Description**: FileText (Lucide React)
- **Add Photo**: Camera (Lucide React)
- **Add Voice**: Mic (Lucide React)

### Images
- **Placeholder**: None (icon-based design)
- **Background**: Solid colors (no images)

### Fonts
- **Primary**: Inter (Google Fonts)
- **Fallback**: system-ui, sans-serif

---

## 🔄 State Transitions

### Button States
```
Idle → Hover → Active → Loading → Success
  ↓       ↓       ↓        ↓         ↓
Normal  Scale   Scale   Spinner  Redirect
        Up      Down
```

### Modal States
```
Hidden → Opening → Visible → Closing → Hidden
  ↓         ↓         ↓         ↓         ↓
None    Fade In   Shown    Fade Out   None
```

---

## 📝 Copy & Messaging

### Button Text
- **Primary**: "REPORT EMERGENCY"
- **Loading**: (No text, spinner only)
- **Disabled**: "REPORT EMERGENCY" (grayed out)

### Success Messages
- **Title**: "Emergency Reported!"
- **Description**: "Your emergency has been sent to the response team. Help is on the way!"
- **Incident ID**: "Incident ID: #[ID]"
- **Status**: "Status: [PENDING/ASSIGNED/etc.]"

### Error Messages
- **Title**: "Report Failed"
- **Description**: "Please try again or call emergency services directly: 09998064555"
- **Retry**: "Try Again" button

### Helper Text
- **Below Button**: "Tap to report emergency instantly"
- **Offline**: "Offline - Report will be sent when online"
- **Location**: "Using your current location"

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Designer**: [Your Name]  
**Status**: Ready for Implementation

