# Stargazer Implementation Plan

## Current status

- Landing, dashboard navigation, styling, and the localStorage journal work without a backend.
- Home Assistant UI and Express routes exist but use a hard-coded browser API origin and have incomplete error handling.
- Pi telemetry UI expects FastAPI's response at the wrong port and therefore does not work end-to-end.
- Pi connect works only when the Express gateway is running locally on Windows.
- Desktop status is randomized, Desktop SSH contains a malformed address, and several visible device actions have no checked-in service implementation.
- There were no automated tests at the start of sprint one.

## Sprint 1 — Honest end-to-end dashboard

Priority 0:

1. Establish Express as the single browser-facing origin and document FastAPI as the Pi telemetry agent.
2. Add the tested Express `GET /api/pi/status` proxy defined in `ARCHITECTURE.md`.
3. Change frontend Pi and Home Assistant requests to relative gateway URLs.
4. Replace false/random/dead controls with deterministic status or clearly disabled unavailable states.
5. Add loading, success, offline, configuration-error, and upstream-error presentation.

Priority 1:

6. Separate Express app creation from process startup and add automated route tests with mocked upstream services and launcher behavior.
7. Add request timeouts and sanitized API errors.
8. Serve the existing frontend from Express without exposing secrets or backend-only files.
9. Improve keyboard semantics, focus visibility, live status announcements, and safe activity-log rendering in touched UI.
10. Update setup documentation for the two-service deployment.

Acceptance criteria:

- One documented command starts the Express gateway and dashboard.
- The served frontend reaches gateway health and Pi status without cross-origin requests.
- Mocked success and failure paths are covered by automated backend tests.
- The dashboard never invents device status.
- Every enabled device control maps to an implemented, documented route.
- Missing devices or credentials produce an honest unavailable/configuration state without console crashes or leaked secrets.
- Existing landing, navigation, journal, and implemented Home Assistant behavior remain available.

## Product priority order

1. Live dashboard devices: real lights, online/offline indicators, overview counts, and system stats.
2. Desktop-backed journal persistence while retaining the current journal experience.
3. Complete Home Assistant connectivity and control.
4. Add a 3D Printer device slot beginning with the Bambu P1S.
5. Add an Existing Prints catalog for completed and future builds.

The outward-facing portfolio and inward-facing command center remain separate presentation modes built on the same Stargazer application.

## Sprint 2 — Live device foundation

1. Add the aggregate `GET /api/devices/status` gateway contract documented in `ARCHITECTURE.md`.
2. Use Pi telemetry plus Tailscale-first/local-fallback probes for configured workstation devices.
3. Drive all visible device indicators and the overview system count from live results.
4. Show configured, offline, and unavailable states distinctly without simulated data.
5. Keep device action controls disabled until their action contracts and security model exist.
6. Add deterministic tests for online, fallback, offline, partially configured, and telemetry failure states.

## Sprint 3 — Desktop journal persistence

1. Define a safe local journal storage API and file location.
2. Preserve localStorage as an offline cache/migration source.
3. Add create/list/update/delete contracts, validation, atomic writes, backup behavior, and tests.
4. Add synchronization and conflict/error states to the existing journal interface.

## Sprint 4 — Home Assistant completion

1. Validate the configured Home Assistant connection and entity mapping.
2. Add authenticated access and origin protection for state-changing operations.
3. Improve device refresh, confirmation, audit activity, and unavailable-state behavior.

## Sprint 5 — 3D printing and build catalog

1. Add a generic printer device model and a Bambu P1S slot.
2. Choose and integrate a supported local printer telemetry source.
3. Add the Existing Prints tab and catalog schema for completed builds, images, materials, settings, and notes.
4. Seed the catalog with Dante's sword and the favorite-sword project after their metadata/assets are supplied.

## Later — Secure device operations

1. Choose an authentication model for state-changing LAN operations.
2. Add CSRF/origin protection and tighten CORS/network binding.
3. Define ownership and contracts for Desktop status/connect and Pi desktop/share/log operations.
4. Implement only approved operations with allowlisted targets, timeouts, and audit logging.
5. Add end-to-end browser tests against mocked device services.

## Sprint 3 — Deployment and observability

1. Add service definitions/containerization appropriate to Windows and Raspberry Pi.
2. Add structured logging, health aggregation, and operational diagnostics.
3. Add configuration templates and deployment-specific origin policies.
4. Decide whether usage justifies retaining two runtimes or consolidating them.
