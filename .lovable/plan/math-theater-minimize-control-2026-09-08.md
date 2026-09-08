# Math Theater minimize control

## Goal
Make the Math Theater panel easy to put away and restore, while preserving its current resize and maximize behavior and keeping the active visualization intact.

## Current state
- The shared floating-panel header already supports resize, expand/restore, fold, and minimize controls.
- Math Theater is already connected to the minimize action in the session workspace.
- Minimized panels already have a dock that can restore them with one click.

## Implementation
1. Verify the Math Theater title bar exposes the minimize control in normal, resized, and maximized states.
2. Ensure minimizing from a maximized state first exits expansion cleanly, removes only the panel from view, and does not reset its visualization, controls, or session state.
3. Keep the minimized Math Theater represented by a clearly labelled item in the bottom dock; restoring it should return the same live visualization at its previous size and position.
4. Check that resize handles remain available when restored and that maximize/restore still works afterward.
5. Validate keyboard and accessibility behavior: labelled controls, useful tooltips, and Escape restoring an expanded panel.

## Verification
- Walk through resize → maximize → minimize → restore → resize in a real session.
- Confirm the visualization and adjusted parameters survive every transition.
- Check desktop and narrow viewport layouts for overlap with the prompt/composer and dock.
- Run the app typecheck and relevant session tests.

## Scope
Only the session workspace and its shared floating-panel/dock controls are in scope. No changes to lesson content, AI behavior, or other app areas.
