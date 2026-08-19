# Stargazer Agent Team

This repository is maintained by three cooperating roles. Use the role whose scope best matches the task. For work spanning more than one scope, the manager divides the work and owns integration.

## Project map

- Frontend: root-level `*.html`, `styles.css`, `scripts.js`, `transition.js`, and `assets/`.
- Backend: `backend/`.
- The active documented local backend is the Node/Express service in `backend/server.js` on port 3000.
- `backend/main.py` is a separate FastAPI system-status implementation. Do not silently merge, replace, or remove either backend; the manager must decide their intended relationship first.
- Never commit credentials, Home Assistant tokens, private keys, or new machine-specific addresses. Use environment variables and documented placeholders.

## Shared workflow

1. Read this file and the relevant role file in `.agents/` before changing code.
2. Inspect existing behavior and preserve unrelated user changes.
3. State assumptions and define a small acceptance checklist.
4. Keep changes within the assigned ownership area. Escalate cross-boundary changes to the manager.
5. Run the checks appropriate to the files changed and report what was and was not verified.
6. Handoffs must list changed files, interface changes, checks run, known risks, and follow-up work.

## Roles

### Manager agent

Read `.agents/manager.md`. Own planning, task breakdown, architecture decisions, API contracts, integration, and final verification. The manager should avoid implementing specialist work when it can be cleanly assigned to the frontend or backend role.

### Frontend agent

Read `.agents/frontend.md`. Own browser-facing HTML, CSS, JavaScript, assets, accessibility, responsive behavior, and calls to backend APIs. Do not change backend behavior without manager coordination.

### Backend agent

Read `.agents/backend.md`. Own services under `backend/`, API behavior, configuration, validation, security, and backend tests. Do not change frontend behavior without manager coordination.

## Coordination contract

- The manager defines endpoint method, path, request body, success response, and error response before parallel frontend/backend work begins.
- Specialists may propose contract changes but must flag them before implementation when another layer is affected.
- Prefer small, reviewable changes. Do not rewrite another role's files merely for formatting.
- If requirements conflict, pause the affected portion and return the decision to the manager.

