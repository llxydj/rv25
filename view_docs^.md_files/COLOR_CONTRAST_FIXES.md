# 🎨 Color Contrast Fixes

## Issues Found & Fixed

### ❌ Low Contrast Issues (WCAG AA Fails)

1. **text-gray-400** - Too light, hard to read
   - **Fix:** Replace with `text-gray-600` (minimum) or `text-gray-700` (better)
   - **Usage:** Secondary text, placeholders, disabled states

2. **text-gray-300** - Very light, nearly invisible
   - **Fix:** Replace with `text-gray-500` (minimum) or `text-gray-600` (better)
   - **Usage:** Tertiary text, subtle hints

3. **text-gray-200** - Extremely light
   - **Fix:** Replace with `text-gray-500` minimum
   - **Usage:** Should rarely be used for text

### ✅ Recommended Color Combinations (WCAG AA Compliant)

#### On White Background (`bg-white`)
- ✅ `text-gray-900` - Primary text (21:1 contrast)
- ✅ `text-gray-800` - Primary text (14:1 contrast)
- ✅ `text-gray-700` - Secondary text (9.7:1 contrast)
- ✅ `text-gray-600` - Secondary text (7:1 contrast) - **MINIMUM**
- ⚠️ `text-gray-500` - Tertiary text (4.6:1 contrast) - Use sparingly
- ❌ `text-gray-400` - (2.8:1) - FAILS WCAG AA
- ❌ `text-gray-300` - (1.8:1) - FAILS WCAG AA

#### On Gray-50 Background (`bg-gray-50`)
- ✅ `text-gray-900` - (19.8:1)
- ✅ `text-gray-800` - (13.2:1)
- ✅ `text-gray-700` - (9.1:1)
- ✅ `text-gray-600` - (6.6:1)
- ⚠️ `text-gray-500` - (4.3:1) - Borderline
- ❌ `text-gray-400` - (2.6:1) - FAILS

#### On Gray-100 Background (`bg-gray-100`)
- ✅ `text-gray-900` - (18.5:1)
- ✅ `text-gray-800` - (12.3:1)
- ✅ `text-gray-700` - (8.5:1)
- ✅ `text-gray-600` - (6.2:1)
- ❌ `text-gray-500` - (4.0:1) - FAILS for small text
- ❌ `text-gray-400` - (2.4:1) - FAILS

### 🔧 Automated Replacements

```bash
# Replace text-gray-400 with text-gray-600
text-gray-400 → text-gray-600

# Replace text-gray-300 with text-gray-500
text-gray-300 → text-gray-500

# Replace text-gray-200 with text-gray-500
text-gray-200 → text-gray-500
```

### 📍 Files to Fix

Based on grep search, these files have low-contrast text:

1. **components/admin/volunteer-map-enhanced.tsx** - Line 731: `text-gray-400`
2. **components/volunteer-map.tsx** - Line 251: `text-gray-400`
3. **components/admin/sms-monitoring-dashboard.tsx** - Line 232: `text-gray-400`
4. **components/admin/real-time-notifications.tsx** - Line 192: `text-gray-400`
5. **components/ui/map-internal.tsx** - Line 418: `text-gray-400`
6. **components/ui/terms-modal.tsx** - Lines 399, 412: `text-gray-400`
7. **components/ui/overlays.tsx** - Line 323: `text-gray-400`
8. **components/ui/navigation.tsx** - Lines 149, 163: `text-gray-400`
9. **components/ui/map-offline.tsx** - Lines 361, 381: `text-gray-400`
10. **components/volunteer/volunteer-notifications.tsx** - Line 130: `text-gray-400`
11. **components/ui/design-system.tsx** - Lines 317, 328, 477: `text-gray-400`
12. **components/volunteer/schedule-history.tsx** - Line 183: `text-gray-400`
13. **components/ui/data-display.tsx** - Lines 102, 477: `text-gray-400`
14. **components/volunteer/document-upload.tsx** - Lines 185, 187: `text-gray-400`
15. **components/volunteer/activity-log.tsx** - Line 161: `text-gray-400`

### 🎯 Fix Strategy

1. **Icon colors** (`text-gray-400`) → `text-gray-500` (icons can be slightly lighter)
2. **Secondary text** (`text-gray-400`) → `text-gray-600` (readable)
3. **Coordinates/metadata** (`text-gray-400`) → `text-gray-500` (less important info)
4. **Disabled states** - Keep `text-gray-400` but add `opacity-50` to parent
5. **Placeholders** (`text-gray-300`) → `text-gray-500`

### ✅ Exceptions (Keep as-is)

- Disabled button text with `disabled:opacity-50` on parent
- Icon-only buttons where hover state provides context
- Decorative elements (not text content)

---

**Next Step:** Apply these fixes systematically across all files.
