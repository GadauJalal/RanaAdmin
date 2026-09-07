# Backend integration status

_Network Operations console (rana54-network-operations)._

This app still runs on the seeded mock adapter (`NEXT_PUBLIC_DATA_SOURCE=mock`).
Unlike the Organization Admin and Enterprise apps, it cannot yet be pointed at
the deployed Rana54 backend, because two things the app depends on do not exist
on the backend today. Both are backend gaps, not frontend work.

## Why it cannot be wired yet

### 1. No read or list endpoints

Every mutation this console performs takes ids as input that an operator obtains
by browsing a list first:

| Action | Ids it needs | Where an operator gets them |
| --- | --- | --- |
| Decide a site request | site-request id | the site-requests list |
| Create a job | `requestId`, `installerId` | the requests and installers lists |
| Reassign a job | `jobId`, `installerId` | the jobs and installers lists |
| Link a gateway / accept | `jobId` | the jobs list |
| Suspend / reactivate installer | installer id | the installers list |

The backend exposes only lookup-by-id and the mutations. It has **no**
`GET /jobs`, `GET /installers`, or `GET /organisations/{orgId}/site-requests`
(the site-requests handover explicitly flags the last one as unbuilt). With no
list endpoint there is no way to obtain a real id, and ids taken from the mock
lists do not exist on the backend, so every mutation would fail with 404 or 409.

### 2. The app is built around a snapshot the backend does not return

`src/lib/api/contract.ts` requires every mutation to resolve to
`{ snapshot, data }`, where `snapshot` is the complete cross-tenant picture, and
the workspace re-renders from it after each change (`getSnapshot()` is the single
read). The deployed backend returns only the entity it changed (`{ job }`,
`{ installer }`, `{ siteRequest }`) and exposes no `GET /snapshot`. The http
adapter therefore cannot construct a valid result, and the response envelope and
error shape (`{ statusCode, code, message }`) differ from what the adapter
expects.

## What the backend needs to add before wiring

1. **List/read endpoints** for the console's tenants so real ids exist and the
   views can be populated. At minimum: jobs, installers, and an organisation's
   site requests.
2. **Either** a `GET /snapshot` that returns the full operational picture,
   **or** a decision to refactor this app off its snapshot-per-mutation model
   toward per-entity reads and local state updates.
3. Confirmation of the mutation response envelope. The backend returns the
   changed entity only; this app currently expects `{ snapshot, data }` on
   success and `{ code, message, snapshot? }` on failure.

## The 2026-09-06 installer-app rounds do not unblock this console

The installer-app handover (rounds 1 to 3) adds installer-facing endpoints only,
so it does not remove either blocker above:

- `GET /jobs/me` is the *caller's own* assigned jobs (assignee-scoped), not a
  staff list of all jobs across enterprises. The staff console still has no way
  to enumerate jobs it did not create.
- `POST /jobs/:jobId/evidence`, `POST /jobs/:jobId/block`, and the newly
  installer-callable `POST /jobs/:jobId/gateway-link` are gated on installer
  permissions (`job:evidence`, `job:block`, `job:update`). Staff actions
  (`checklist`, `unblock`, `reassign`, `acceptance`) still require `JobWrite`
  and still take ids only a list could provide.

One breaking change from that round is reflected in this app already: `blockers`
on every job-returning endpoint changed from `string[]` to an array of
`{ reason, note, blockedBy, blockedAt }`. The app's `Job` type, seed, mock
adapter and job drawer have been updated to that shape so nothing breaks when a
backend arrives. The staff `POST /jobs/:jobId/checklist` now also returns 409 on
a duplicate item rather than silently adding a row; the mock does not yet model
that (harmless, since the console cannot reach the backend).

## Mutations that are already documented and ready to map

These backend routes exist and are described in the site-requests / jobs /
installers handover. Their request shapes are captured in
`docs/BACKEND_CONTRACT.md` and `src/lib/api/http-adapter.ts`; only the response
handling (per-entity, no snapshot) and the id source above are outstanding.

- `POST /site-requests/{id}/decision`
- `POST /jobs`, `POST /jobs/{jobId}/assignment`,
  `POST /jobs/{jobId}/gateway-link`, `POST /jobs/{jobId}/checklist`,
  `POST /jobs/{jobId}/acceptance`
- `GET /jobs/{jobId}`, `GET /site-requests/{id}`, `GET /installers/{id}`
- `POST /installers/{id}/transitions`

Note: `POST /jobs/{jobId}/checklist` records one of four exact items
(`Owner confirmed`, `Gateway linked`, `Functions mapped`,
`Delivery test passed`) and the job auto-advances to `ready_for_acceptance`
once all four are recorded. The mock currently models the checklist as an
implicit side effect of gateway-link and acceptance rather than four explicit
records.

## Domains with no backend at all

Enterprises, incidents, staff, support grants, devices, services, access
reviews and exports are prototype-only in this console. Nothing in the handover
documents provides endpoints for them, so they stay on the mock.
