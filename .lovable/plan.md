## Plan to get the preview working

1. **Reproduce the preview failure locally**
   - Open the running app as a signed-in user on `/dashboard`.
   - Capture the visible page state, console errors, and failed network calls.

2. **Check the likely signed-in dashboard path**
   - Inspect `Dashboard`, auth/profile loading, and any data queries used on first render.
   - Confirm whether the app is stuck loading, crashing after render, or failing due to backend/auth data.

3. **Apply the smallest fix**
   - If it is a frontend runtime crash, patch the component/hook causing the blank view.
   - If it is a backend/RLS/data issue, patch the database policies/grants or query handling without changing the app design.
   - Keep the existing UI and feature behavior unchanged.

4. **Verify**
   - Flush the preview update.
   - Re-open `/dashboard` and `/auth` to confirm the app renders and there are no blocking console/runtime errors.