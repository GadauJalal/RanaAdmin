# Rana54 Network Operations

The cross-tenant operations workspace for authorized Rana54 staff, built as a
Next.js application. It is intentionally separate from the enterprise dashboard,
enterprise administration, homeowner, and installer applications.

Every read and write goes through one API layer, so connecting the real backend
is a configuration change rather than a rewrite. Until then the workspace runs
on a seeded prototype adapter that enforces the same operational rules.

## Run it

```bash
npm install
npm run dev
```

Open http://127.0.0.1:4183 — the root redirects to `/overview`.

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Development server on port 4183               |
| `npm run build`     | Production build                              |
| `npm start`         | Serves the production build on port 4183      |
| `npm run lint`      | ESLint                                        |
| `npm run typecheck` | `tsc --noEmit`                                |

## Connecting the backend

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_DATA_SOURCE=http      # was "mock"
NEXT_PUBLIC_API_BASE_URL=/api     # the built-in server proxy
OPERATIONS_API_URL=https://operations.internal.rana54.com
OPERATIONS_API_TOKEN=…            # server-side only, never sent to the browser
```

That is the whole switch. No view, drawer, form, or component imports an
adapter directly — they all call `api` from [src/lib/api/index.ts](src/lib/api/index.ts),
which picks the implementation from `NEXT_PUBLIC_DATA_SOURCE`.

With `NEXT_PUBLIC_API_BASE_URL=/api` the browser only ever talks to this Next.js
server, and [src/app/api/[...path]/route.ts](src/app/api/%5B...path%5D/route.ts)
forwards to `OPERATIONS_API_URL`. That keeps the service token server-side and
avoids any CORS configuration. To have the browser reach the service directly,
point `NEXT_PUBLIC_API_BASE_URL` at the service instead and the proxy goes
unused.

The endpoints, request bodies, and response envelopes the backend has to satisfy
are specified in [docs/BACKEND_CONTRACT.md](docs/BACKEND_CONTRACT.md).

## What is inside

```
src/
  app/                        routes, root layout, global stylesheet, API proxy
    (workspace)/              the seven operational views, sharing one shell
    api/[...path]/route.ts    server-side proxy to the operations service
  components/
    layout/                   shell, sidebar, topbar, global search, overlay host
    views/                    Overview, Enterprises, Field, Devices, Incidents, Access, Platform
    drawers/                  record detail drawers
    modals/                   creation and state-change workflows
    ui/                       icons, chips, panels, tables, overlays, toasts
  lib/
    types.ts                  the domain model
    api/contract.ts           the operations API interface
    api/mock-adapter.ts       prototype adapter and reference rule implementation
    api/http-adapter.ts       backend adapter
    seed.ts                   seeded demo network
    format.ts                 masking, timestamps, chip tones, CSV export
  providers/
    workspace-provider.tsx    snapshot, overlays, toasts, keyboard shortcuts
docs/
  BACKEND_CONTRACT.md         endpoints and payloads the backend must serve
  DESIGN_HANDOFF.md           every view, button, and operational rule
legacy/                       the original no-build prototype, kept for reference
```

## Views

- **Overview** — cross-platform operational summary and platform health
- **Enterprises** — accounts, creation, first administrator invitation, site requests
- **Field Operations** — installation jobs, gateway linking, acceptance, installers
- **Devices** — gateway identity, mapped energy functions, safe diagnostics
- **Incidents** — one response queue with acknowledge, assign, resolve, reopen
- **Access** — Rana54 staff, time-limited support grants, privileged access review
- **Platform** — service health, safe checks, immutable audit history

## Control and safety model

These rules live in the adapter, not in the components, so the UI cannot route
around them and the backend inherits the same contract:

- Every entity uses an exact persistent identifier.
- Privileged actions require a reason and create an audit event.
- Tenant support access is read-only, time-limited, and audited.
- The final active Platform Operator cannot be suspended.
- An installer with active jobs cannot be suspended until those jobs are reassigned.
- A gateway can only be linked inside an approved installation or replacement job.
- Gateway serials are checked for duplicate identity before linking; a conflict
  blocks the job and opens an incident instead of overwriting the link.
- Safe diagnostics never edit raw readings, credentials, or historical evidence.
- Nothing is hard deleted.

## Good to know

- On `NEXT_PUBLIC_DATA_SOURCE=mock`, changes persist in the browser under the
  localStorage key `rana54-control-centre-v2-state`. Delete that key, or clear
  site data, to return to the seeded network.
- CSV exports are generated in the browser; the export itself is audited.
- Routes are real paths, so `/incidents` and `/access?tab=grants` are linkable.
- Press `/` to focus global search and `Esc` to dismiss an overlay.

## The legacy prototype

The original single-page prototype is preserved unchanged in [legacy/](legacy/).
It has no build step and no dependencies, and is excluded from TypeScript,
ESLint, and the Next.js build. To run it:

```bash
cd legacy
python3 -m http.server 4184
```

Then open http://127.0.0.1:4184/#/overview.
