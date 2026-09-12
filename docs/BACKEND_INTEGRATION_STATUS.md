# RanaAdmin (Network Operations) backend integration status

_Assessed against the Rana54 staging API (`https://staging.api.rana54.com`,
Swagger at `/api/docs`). Updated 2026-09-12 for the platform list handover._

## Summary

The Network Operations console is a **platform-wide** console: it lists every
enterprise, site, job, device, incident and staff member across all tenants.
As of the 2026-09-11 handover the backend exposes the platform-wide list
endpoints the console boots from, so the live adapter
(`NEXT_PUBLIC_DATA_SOURCE=http`) now assembles the operational picture from:

- `GET /organisations`, `GET /sites`, `GET /devices`, `GET /jobs`,
  `GET /site-requests`, `GET /audit` (each paged, `limit` up to 200), plus
- `GET /me`, `GET /admin/users`, `GET /installers`, `GET /health`.

Every list is read tolerantly: a missing permission (`AdminJobRead`,
`AuditRead`, `OrganisationManage`, `AdminDeviceService`) or an older backend
empties that one collection instead of failing the console.

### Site creation, end to end
1. An organisation administrator submits a site request from the Organization
   Admin app (`POST /organisations/{orgId}/site-requests`).
2. The request appears on **Enterprises > Site requests** here
   (`GET /site-requests`). Approving it (`POST /site-requests/{id}/decision`)
   is what creates the site; the new site then shows under the enterprise.
3. Rana54 can also provision a site directly from an enterprise record or the
   Enterprises page (**Provision site**, `POST /admin/sites`).
4. A job is created against the approved request (`POST /jobs`), the gateway
   is linked, and acceptance (`POST /jobs/{id}/acceptance`) makes the site
   active.

## What the console needs vs. what the API provides

### Wired
- **Enterprises, sites, site requests, jobs, devices, audit** via the list
  endpoints above.
- **Staff / access** via `GET /admin/users` and the admin mutations
  (`POST /admin/users`, `.../invite`, `.../suspend`, `.../unsuspend`).
- **Installer roster** via `GET /installers` and `POST /installers/{id}/transitions`.
- **Workflow writes**: `POST /admin/organisations` + `POST /admin/users`
  (enterprise + first administrator, temp password shown once),
  `POST /admin/sites`, `POST /site-requests/{id}/decision`, `POST /jobs`,
  `/jobs/{id}/assignment`, `/gateway-link`, `/acceptance`.

### Still missing on the backend
| Console area | Needs | Exists today? |
| --- | --- | --- |
| Incidents | the whole `/incidents` subsystem | No, not modelled at all |
| Enterprise suspend / reactivate | an organisation lifecycle endpoint | No |
| Support grants | time-limited org-scoped grants for platform staff | No (grants are single-role) |
| Platform staff roles | Field Operations / Data Operations / Support Analyst | No, `Admin` only |
| Device diagnostics, firmware, heartbeat | per-device telemetry | No (only certification state and interval) |
| Enterprise region / products / first admin name | fields on the organisation | No, remembered in this browser only |
| Job checklist on the list | `checklistItems` on `GET /jobs` rows | No, only on `GET /jobs/{id}` |

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
