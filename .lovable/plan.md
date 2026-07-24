## Goal
Make the preview stop failing as a black/empty page by removing the common blank-screen failure modes and adding visible recovery states wherever the app can currently hang silently.

## What I verified
- The app has a root `ErrorBoundary`, but it only catches React render errors after React mounts.
- The current auth flow can still remain visually empty/spinner-only if session/profile loading or profile creation gets stuck.
- The backend has a `handle_new_user()` profile function, but the project context shows no database triggers are installed, so new users are not guaranteed to get a profile automatically.
- The dashboard does multiple nested data fetches before rendering; if one request stalls or returns unexpected data, the user can get a “nothing useful visible” state.
- There are no captured browser console errors or failed network entries from the user's preview snapshot, so this needs a defensive frontend/backend hardening pass rather than chasing one visible stack trace.

## Plan
1. **Make auth loading impossible to hang forever**
   - Add a bounded auth/profile loading state with a timeout fallback.
   - If profile fetch/create fails, synthesize a safe local profile shape so the app still renders instead of staying blank.
   - Keep retry/refresh behavior available without blocking the whole UI.

2. **Fix profile creation at the backend source**
   - Add the missing new-user trigger for the existing `handle_new_user()` function.
   - Add/verify minimal grants and profile policies needed for a signed-in user to read/create/update only their own profile.
   - This makes Google/email signups reliably land in the app with a profile row.

3. **Make the dashboard render before optional data finishes**
   - Replace the all-or-nothing dashboard loader with a visible shell immediately after auth is known.
   - Load tracks, counts, hub stats, and next-action data independently with soft failure states.
   - Remove unsafe assumptions like `user!.id` inside async code by early-return guards.

4. **Add a visible “app could not start” fallback outside React**
   - Add a minimal startup fallback in the root HTML/container flow so even module-load or mount failures show a message instead of a black screen.
   - Keep the existing React error boundary, but make it token-aligned and add a retry/sign-out action.

5. **Contain risky child components**
   - Wrap dashboard panels such as Hub, General Chat, Next Action, and Knowledge Map in small local boundaries so one broken feature cannot blank the whole page.
   - Each failed panel shows a compact fallback while the rest of the app remains usable.

6. **Verify the actual preview paths**
   - Check `/`, `/auth`, `/dashboard`, and `/onboarding` locally with a restored signed-in session when available.
   - Confirm the rendered page is not blank, and that failures show visible fallbacks instead of black/empty screens.

## Expected result
Even if auth, profile creation, an edge function, or a dashboard data query fails, the user should always see either the app shell, a clear recovery panel, or a sign-in/retry path — never a silent black preview.