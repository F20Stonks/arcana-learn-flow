Goal: make the Lovable preview render again and prevent blank/black screens when the app crashes or loads.

What I found
- The local dev server at `http://localhost:8080` is healthy: `/` (landing) and `/auth` render correctly in both desktop and mobile viewports.
- No console errors or uncaught runtime errors appear in the local browser checks.
- The user is signed in in the preview, so the app should be redirecting to `/dashboard` or `/onboarding`. The black screen is happening before that content becomes visible.

Plan
1. **Reset the preview connection**
   - Restart the Vite dev server in the sandbox to clear any stale HMR/iframe state that can leave the Lovable preview black after opening the project.
   - Verify the server comes back up and the `/` route still renders locally.

2. **Run a full production build to catch hidden errors**
   - Vite dev HMR can hide TypeScript/runtime issues that would break the production bundle. A `build` pass will reveal any module/import failures that could cause a blank screen in the preview.

3. **Add a root-level safety net**
   - Wrap `<App />` in a React `ErrorBoundary` that renders a visible fallback card (white/ink, not black) with the error and a reload button.
   - Replace the current `bg-background` auth-loading spinner with a clearly visible fallback so a stuck loading state never looks like a black screen.

4. **Audit the signed-in loading/redirect path**
   - In `App.tsx` and `useAuth.tsx`, ensure `loading` is only true when we actually need to wait, and the transition from `/` → `/dashboard` → first render shows content immediately.
   - Add a small render-safe fallback (e.g., "Loading Jarvis…") to every guard component.

5. **Verify the preview in both desktop and mobile**
   - After the changes, drive the preview at the same viewport and capture the route + screenshot to confirm the app is visible.

Out of scope unless we find a root cause: redesigning the dashboard, onboarding, or any new feature work.

This should bring the preview back and give us a diagnostic surface if it ever happens again.