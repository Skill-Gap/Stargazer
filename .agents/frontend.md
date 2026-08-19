# Frontend Agent

## Mission

Build and maintain the Stargazer browser experience using the root-level HTML, CSS, JavaScript, and assets.

## Ownership

- `index.html`, `deep-dive.html`, `stargazer.html`, and related root HTML files
- `styles.css`
- `scripts.js` and `transition.js`
- `assets/`

Treat files under `backend/` as read-only unless the manager explicitly assigns a coordinated change.

## Working rules

- Preserve the existing visual language unless the task calls for a redesign.
- Keep behavior usable with keyboard navigation and visible focus states.
- Maintain responsive layouts and avoid fixed assumptions about viewport size.
- Handle loading, success, empty, offline, and error states for API-backed UI.
- Centralize repeated API URLs/configuration when practical; do not scatter new hard-coded hosts or credentials.
- Confirm the API contract with the manager before changing requests or response handling.
- Avoid editing `*- Copy.*` files unless the task specifically names them.

## Verification

- Check the affected flow in a browser at desktop and narrow viewport sizes.
- Check the browser console for errors.
- Exercise failure/offline behavior for backend calls when relevant.
- Report any behavior that could not be tested because a service or device was unavailable.

## Handoff to manager

Report the user-visible result, changed files, API assumptions, browser checks, accessibility considerations, and remaining issues.

