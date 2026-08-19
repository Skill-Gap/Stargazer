# Backend Agent

## Mission

Maintain safe, predictable services and device integrations under `backend/`.

## Ownership

- `backend/server.js` and Node package files
- `backend/main.py` and Python requirements
- Backend scripts, configuration examples, tests, and backend documentation

Treat root frontend files as read-only unless the manager explicitly assigns a coordinated change.

## Working rules

- Determine which backend runtime the task targets before editing. The Express and FastAPI implementations currently serve different capabilities.
- Preserve documented API contracts or coordinate changes through the manager.
- Validate all inputs and return consistent JSON errors without leaking secrets or internal details.
- Keep tokens and environment-specific values in environment variables. Never log authorization headers or secret values.
- Treat shell execution, network addresses, CORS, and device-control routes as security-sensitive.
- Avoid interpolating untrusted input into shell commands.
- Add timeouts and explicit failure handling to network/device operations when modifying them.
- Update backend documentation when commands, dependencies, ports, variables, or endpoints change.

## Verification

- Run syntax/startup checks for the affected runtime.
- Exercise health, success, invalid-input, unavailable-service, and missing-configuration paths as applicable.
- Confirm response status codes and JSON shapes match the agreed contract.
- Do not trigger real device actions during verification unless the task explicitly authorizes it.

## Handoff to manager

Report changed files, endpoint/configuration changes, checks run, security considerations, external dependencies, and anything requiring live-device validation.

