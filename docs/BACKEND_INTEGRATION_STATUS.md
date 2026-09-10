# RanaAdmin (Network Operations) — backend integration status

_Assessed against the Rana54 staging API (`https://staging.api.rana54.com`,
Swagger at `/api/docs`) on 2026-09-10._

## Summary

The Network Operations console is a **platform-wide** console: it lists every
enterprise, site, job, device, incident and staff member across all tenants.
The Rana54 API today is built around **single-tenant, id-addressed** access, and
does **not** expose the platform-wide **list** endpoints this console is built
on. As a result RanaAdmin stays on its bundled demo data
(`NEXT_PUBLIC_DATA_SOURCE=mock`, the default) until the endpoints below exist.

Roughly a quarter of the console is backable today (staff/access and the
installer roster); the rest has no list endpoint to populate it, so wiring it
now would leave most views empty. This is a backend gap, not a frontend one.

## What the console needs vs. what the API provides

### Available now (could be wired)
- **Staff / access** — `GET /admin/users` lists every platform user, and the
  admin mutations exist: `POST /admin/users`, `.../grants`,
  `DELETE .../grants/{grantId}`, `.../invite`, `.../suspend`, `.../unsuspend`.
- **Installer roster** — `GET /installers`, `GET /installers/{id}`,
  `POST /installers`, `POST /installers/{id}/transitions`.
- **Act-by-id workflow** — a job or site request can be acted on when its id is
  already known: `POST /jobs`, `/jobs/{id}/assignment`, `/gateway-link`,
  `/block`, `/unblock`, `/checklist`, `/acceptance`; `POST /site-requests/{id}/decision`.

### Missing — blocks the console (no list/aggregate endpoint)
| Console area | Needs | Exists today? |
| --- | --- | --- |
| Whole-workspace boot | `GET /snapshot` (or equivalent aggregate) | No — the app expects one call returning all collections |
| Enterprises list | `GET /organisations` (all tenants) | No — only `POST /admin/organisations` (create) and `GET /organisations/{orgId}` (by id) |
| Sites (platform-wide) | `GET /sites` across tenants | No — only `GET /organisations/{orgId}/sites` (per tenant) |
| Jobs queue | `GET /jobs` (all jobs for staff) | No — only `GET /jobs/me` (caller's own) and `GET /jobs/{id}` |
| Site requests queue | `GET /site-requests` (pending decisions) | No — only `GET /site-requests/{id}` |
| Devices | `GET /devices` (platform-wide) | No — only `GET /sites/{siteId}/devices` and register |
| Incidents | the whole `/incidents` subsystem | No — not modelled at all |
| Audit (platform) | a platform-level audit feed | No — only per-organisation `GET /organisations/{orgId}/audit` |

### Contract-shape mismatches (fix when wiring, once lists exist)
The prototype's `http-adapter` assumes a contract that differs from the real API:
- **Mutation envelope** — prototype expects `{ snapshot, data }` from every
  write; the API returns only the changed entity, no snapshot.
- **Site decision** — prototype sends `decision: "Approved" | "Returned"`; the
  API expects lowercase `"approved" | "returned"`.
- **Installer transition** — prototype sends `"Suspend" | "Restore"`; the API
  expects `"Suspend" | "Reactivate"`.
- **Job create** — prototype sends `{ date, time, note }`; the API expects
  `{ requestId, installerId, scheduledAt, note }`.
- **Gateway link** — prototype expects `{ device }` back; the API returns
  `{ job }` (and may flip the job to `blocked` with a `duplicate_gateway_identity`
  conflict).
- **Job blockers** — the API's `job.blockers` is `JobBlocker[]`
  (`{ reason, note, blockedBy, blockedAt }`), not `string[]`.

## Recommendation

Add `GET /snapshot` (or the individual platform-wide list endpoints above) and
an incidents subsystem, then RanaAdmin can be wired the same way the
Organization Admin app was (an env-gated server proxy mapping backend shapes to
the workspace types). Until then it runs on demo data and is fully viewable
without a backend.
