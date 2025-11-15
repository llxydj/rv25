# Resident Google OAuth Migration: Audit and Plan

## 1. Current System Assessment

- **[login page]** `src/app/login/page.tsx`
  - Uses email + password via `signIn(email, password)` from `src/lib/auth.ts`.
  - Shows a link to `/register` for residents. No Google OAuth button present.
- **[register page]** `src/app/register/page.tsx`
  - Uses `signUpResident(...)` from `src/lib/auth.ts`, which calls `supabase.auth.signUp` with `emailRedirectTo: /auth/callback` and creates a `users` row with `role: 'resident'`.
  - Email confirmation phrase UX present; assumes email link verification.
- **[auth lib]** `src/lib/auth.ts`
  - `signUpResident()` uses `supabase.auth.signUp` (email/password), then inserts into `users` table with role.
  - `signIn()` uses `supabase.auth.signInWithPassword`.
  - `useAuth` hook (note: there is another hook in `src/hooks/use-auth.tsx`) listens to Supabase auth state, fetches `users.role`, and redirects to dashboards by role.
  - `verifyEmail()`, `resetPassword`, etc. are present.
- **[auth hook]** `src/hooks/use-auth.tsx`
  - Provides `AuthProvider` used by layouts. Pulls session and role from `users` table, keeps `user.role` in context.
- **[route handler]** `src/app/auth/callback/route.ts`
  - Exchanges the `code` for session using `@supabase/auth-helpers-nextjs` and redirects to `/login`.
- **[middleware]** `src/middleware.ts`
  - Public paths: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`.
  - If already authenticated and visiting `/login`, redirects to a dashboard based on `users.role`.
- **[layouts/guards]**
  - `src/components/layout/auth-layout.tsx` and `src/components/auth-guard.tsx` gate pages by `allowedRoles` using `users.role`.
- **[providers/config observed in code]**
  - No references to Google OAuth or `signIn({ provider: 'google' })` in the codebase.

### Observations / Risks
- **Residents currently register via email/password + confirmation**; hard ties into email link patterns and the `confirmation_phrase` concept.
- **Admins/volunteers also use email flows** (no dedicated admin login split in `login/page.tsx`).
- **Two parallel auth hooks (`src/lib/auth.ts` and `src/hooks/use-auth.tsx`)**; both rely on Supabase client session + `users` table.
- **RLS depends on auth.uid()**; no specific change needed for OAuth vs email, but flows must ensure `users` row exists for residents after Google login.
- **Callback route configured** (`/auth/callback`) and used by email signup. This will also be used for Google OAuth.

## 2. Goals for New Resident Login

- **Residents:** Google OAuth only; remove email link flow for residents.
- **Post first OAuth login:** redirect resident to a registration form; email is read-only, taken from Google.
- **Resident-only restriction:**
  - Enforce via email domain allowlist (e.g., `@resident-domain.com`) OR whitelist check in DB.
  - Block non-resident Google logins gracefully with clear error.
- **Admins/volunteers/barangay:** keep existing email/password auth.

## 3. Supabase Settings Checklist

- **Enable Google provider** in Supabase Auth → Providers.
- **Authorized redirect URL:** `https://<site>/auth/callback` (staging + production).
- **App URL / Site URL:** set to staging/prod domains.
- **PKCE / Code exchange:** handled by `@supabase/auth-helpers-nextjs` callback.
- **JWT / RLS:** unchanged; policies continue to use `auth.uid()`.

## 4. Proposed Implementation Plan (High-Level)

- **[A] UI split for login**
  - Update `src/app/login/page.tsx` to show two sections:
    - Residents: "Sign in with Google" button → calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback' } })`.
    - Admins/Volunteers/Barangay: keep email/password login.
  - Remove/Hide "Register as Resident" link for the resident path.

- **[B] First-login registration for residents**
  - Create `src/app/resident/register-google/page.tsx`:
    - Loads current session from Supabase.
    - Prefills read-only email from session.user.email.
    - Collects resident profile fields (name/address/contact/barangay, etc.).
    - Submits to `/api/resident/register-google` to create/update `users` row with `role='resident'` and profile fields.

- **[C] Backend enforcement**
  - Create `src/app/api/resident/register-google/route.ts`:
    - Validate session, get `auth.uid()` and `email`.
    - Enforce resident-only:
      - Domain allowlist: `email.endsWith(@resident-domain.com)` (configurable via env `RESIDENT_EMAIL_DOMAIN`), OR
      - DB allowlist table (future extension): `resident_allowlist(email)`.
    - Upsert `users` row with `role='resident'` and provided profile fields. Return envelope.
  - Add a lightweight check on login redirect (middleware or after callback) to route new resident sessions to `/resident/register-google` if no `users` row with `role='resident'` exists.

- **[D] Retire resident email-link flow**
  - In `src/app/register/page.tsx` and `src/lib/auth.ts`:
    - Keep for admin/volunteer creation flows and password reset pages.
    - Hide/disable resident path from the public register page; replace CTA with "Use Google to sign in" for residents.

- **[E] RLS / Policies**
  - No change required to policies that use `auth.uid()`.
  - Ensure residents get a `users` row created promptly after OAuth to pass RLS checks across the app.

- **[F] Error handling**
  - Non-resident Google email → show a friendly error and sign out the session.
  - Missing profile after OAuth → redirect to `/resident/register-google` until completion.

- **[G] Testing plan (staging)**
  - Resident Google sign-in success → redirect → prefilled email, registration completes → access resident dashboard.
  - Non-resident Google email → denied with error; session cleared; stays on login.
  - Admin / volunteer email login remains fully functional (login, redirects, pages).
  - Validate interactions with notifications, Admin Documents, volunteer features (ensuring `users` row and role exist).

## 5. Audit Inventory (Files/Flows Affected)

- **Login**: `src/app/login/page.tsx`
- **Register**: `src/app/register/page.tsx`
- **Callback**: `src/app/auth/callback/route.ts`
- **Auth libs**: `src/lib/auth.ts`, `src/hooks/use-auth.tsx`
- **Layouts/Guards**: `src/components/layout/auth-layout.tsx`, `src/components/auth-guard.tsx`
- **Middleware**: `src/middleware.ts`
- **New (to add)**: `src/app/resident/register-google/page.tsx`, `src/app/api/resident/register-google/route.ts`

## 6. Rollout Steps (Detailed)

1. **Enable Google provider in Supabase** and add redirect URLs for staging/prod.
2. **Update login UI** to present Google-only for residents; keep email login for others.
3. **Add `/resident/register-google` page** with read-only email and form fields.
4. **Add `/api/resident/register-google`** route with domain allowlist check and `users` upsert.
5. **Post-auth redirect logic**:
   - After `/auth/callback`, check if `users` row with role exists. If none and email domain matches residents, redirect to `/resident/register-google`.
6. **Deprecate resident email registration CTA** on `/register` page, add note to use Google.
7. **QA on staging**: end-to-end flows (resident allowed, resident denied, admin/volunteer unchanged), plus RLS-gated features.

## 7. Env/Config Additions

- `RESIDENT_EMAIL_DOMAIN=@resident-domain.com` (or comma-separated list for multiple domains).
- Supabase: Google provider client ID/secret configured; callback URL `/auth/callback`.

## 8. Open Questions

- Do we accept all Google emails that pass domain allowlist OR also maintain a DB allowlist table for explicit approval?
- Should we auto-create `users` row upon first callback success or only after `/resident/register-google` form submission?

## 9. Conclusion

Step 1 (audit) is complete. The above plan is designed to be additive, minimize risk to existing non-resident flows, and keep RLS intact by ensuring `users` rows exist for residents after OAuth. Next, I will implement the staged changes behind environment-configured domain restrictions and test thoroughly before production.
