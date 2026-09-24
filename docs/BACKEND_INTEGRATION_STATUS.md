# RanaAdmin (Network Operations) backend integration status

_Assessed against the Rana54 staging API (`https://staging.api.rana54.com`,
Swagger at `/api/docs`). Updated 2026-09-24 for organisation creation
inviting its first administrator and for installers activating before their
first job (the 2026-09-23 handover, sections 2 and 3); before that 2026-09-22
for the staff roster and roles, support grants, access reviews and enterprise
suspension, and 2026-09-16 for installer onboarding, device registration, the
staff checklist, job unblock, site lifecycle and the notification inbox._

## Summary

The Network Operations console is a **platform-wide** console: it lists every
enterprise, site, job, device, incident and staff member across all tenants.
As of the 2026-09-11 handover the backend exposes the platform-wide list
endpoints the console boots from, so the live adapter
(`NEXT_PUBLIC_DATA_SOURCE=http`) now assembles the operational picture from:

- `GET /organisations`, `GET /sites`, `GET /devices`, `GET /jobs`,
  `GET /site-requests`, `GET /audit` (each paged, `limit` up to 200), plus
- `GET /staff`, `GET /support-grants`, `GET /access-reviews` (the Access
  page; `StaffManage`), plus
- `GET /me`, `GET /admin/users`, `GET /installers`, `GET /health`.

Every list is read tolerantly: a missing permission (`AdminJobRead`,
`AuditRead`, `OrganisationManage`, `AdminDeviceService`, `StaffManage`) or an
older backend empties that one collection instead of failing the console. If
`GET /staff` answers 404 (a backend older than 2026-09-20) the roster falls
back to `GET /admin/users` and staff writes fall back to the platform user
routes (invite for Platform Operators only).

### Access: staff, support grants, access reviews
- **Rana54 staff** are the four platform roles `admin` (shown as "Platform
  Operator"), `data_operations`, `field_operations` and `support_analyst`.
  Inviting one (`POST /staff`) sends an activation email; no temporary
  password is returned. The scope is derived by the backend ("All tenants",
  or "Assigned tenants" for a support analyst).
- **A Support Analyst holds no standing access.** Every read into a tenant
  goes through a read-only, time-limited support grant (`POST /support-grants`,
  2, 4, 8 or 24 hours). The analyst cannot accept their own invitation until
  the first grant exists, so their "Invited" state legitimately waits for it.
  Only a support analyst can hold a grant (400 otherwise); the grant modal
  lists analysts only. Revoking (`POST /support-grants/{id}/revoke`) takes
  effect on the analyst's next request; a grant that already expired or was
  already revoked is refused (409), so the Revoke action is enabled only while
  the grant is Active.
- **Suspending a staff member** (`POST /staff/{id}/transitions`) revokes their
  active grants; the final active Platform Operator cannot be suspended (409
  `final_platform_operator`).
- **Access review** (`POST /access-reviews`, no body) records an immutable
  attestation with a snapshot of staff by role, privileged count and active
  grants; the history (`GET /access-reviews`) shows on **Access > Access
  review**.

### Enterprise creation and the first administrator
- `POST /admin/organisations` now takes `adminName` and `adminEmail` alongside
  `name`, `email` (the organisation's own contact address, validated and
  stored separately; the New Enterprise modal defaults it to the admin email
  when left blank), `phone` and `contractRef`, and invites the administrator
  in the same call: an organisation-wide `super_admin` in
  `pending_activation` with an activation email sent immediately. The
  response carries `adminUserId`. The separate `POST /admin/users` call is
  gone and **there is no temporary password**; the toast and the enterprise
  record say "An activation email was sent to <adminEmail>".
- The call is not transactional. The live adapter reads the two 409 cases by
  message: "An organisation with email ... already exists" means nothing was
  created (the toast says so); "A user with this email already exists" means
  the organisation **was** created but the invite could not claim that
  address, so the picture is reloaded (the new enterprise shows) and the
  operator is pointed to Resend invitation or to adding the person through
  Organization Admin. Any other failure re-reads `GET /organisations`; when
  the organisation is listed, the record is kept and the snapshot reloaded.
- **Resend invitation** calls `POST /organisations/{orgId}/users/{userId}/invite`
  with the `adminUserId` from the create response, or, for an enterprise not
  created in this console, looks the administrator up via
  `GET /organisations/{orgId}/users` (role `super_admin`, organisation-wide).
  The enterprise record reads the same list when it opens and shows the
  administrator as "Invited, activation email sent" until the platform reports
  them `active`.

### Installers can sign in before their first job
- `POST /installers` issues an inert grant at creation, so the activation
  email works immediately and the installer can log in before any job exists;
  the installer app shows an empty job list until a job is assigned. No roster
  change was needed here; only the Add installer copy was corrected.

### Enterprise suspension
- `GET /organisations` rows carry `status` (`suspended | onboarding | active`)
  and `suspendedAt`; the enterprise card and drawer show the backend status
  and "Suspended since". The console's site-based derivation is only a
  fallback when `status` is absent.
- `POST /organisations/{id}/transitions` (`Suspend | Restore`) suspends or
  restores an enterprise. Suspension revokes every Rana54 support grant into
  it and locks out its users on their next request; meter data keeps flowing.
  The reason lands on the organisation's own audit log and is visible to it
  once restored. "Provision site" and "Support access" are hidden for a
  suspended enterprise. 409 `enterprise_already_suspended` /
  `enterprise_not_suspended` when the transition changes nothing.
- Every 409 code from this slice (`final_platform_operator`,
  `staff_suspended`, `enterprise_suspended`, `enterprise_already_suspended`,
  `enterprise_not_suspended`, `support_grant_already_revoked`,
  `support_grant_expired`) is mapped to a readable toast in the live adapter's
  `toFailure`; the machine string is never shown raw.

### Site creation, end to end
1. An organisation administrator submits a site request from the Organization
   Admin app (`POST /organisations/{orgId}/site-requests`).
2. The request appears on **Enterprises > Site requests** here
   (`GET /site-requests`). Approving it (`POST /site-requests/{id}/decision`)
   is what creates the site; the new site then shows under the enterprise.
3. Rana54 can also provision a site directly from an enterprise record or the
   Enterprises page (**Provision site**, `POST /admin/sites`).
4. A job is created against the approved request (`POST /jobs`), the gateway
   is linked (the device must already be registered, **Devices > Register
   device**, `POST /admin/sites/{siteId}/devices`), the four staff checklist
   items are recorded from the job drawer (`POST /jobs/{id}/checklist`, the
   fourth moves the job to ready for acceptance), and acceptance
   (`POST /jobs/{id}/acceptance`) makes the site active.
5. A site can also be activated or decommissioned directly from the enterprise
   record (`PATCH /sites/{siteId}/lifecycle-status`).

## What the console needs vs. what the API provides

### Wired
- **Enterprises, sites, site requests, jobs, devices, audit** via the list
  endpoints above.
- **Staff roster** via `GET /staff`, **staff invite** via `POST /staff`
  (four roles, mandatory reason, activation email), **suspend / restore** via
  `POST /staff/{id}/transitions`. `POST /admin/users` now accepts only
  `role: admin` and is used solely as the fallback on an older backend.
- **Support grants** via `GET /support-grants`, `POST /support-grants`
  (support analysts only, 2/4/8/24 hours, always read only) and
  `POST /support-grants/{id}/revoke` (Access > Support grants, and the staff
  record).
- **Access reviews** via `GET /access-reviews` and `POST /access-reviews`
  (Access > Access review, with the history list).
- **Enterprise suspend / restore** via `POST /organisations/{id}/transitions`,
  with `status` and `suspendedAt` read from `GET /organisations`.
- **Installer roster** via `GET /installers`, `POST /installers` (**Field
  Operations > Installers > Add installer**) and `POST /installers/{id}/transitions`.
- **Devices** via `GET /devices` and `POST /admin/sites/{siteId}/devices`
  (**Devices > Register device**; a duplicate serial is refused with 409).
- **Workflow writes**: `POST /admin/organisations` (enterprise + first
  administrator invited by activation email, `adminUserId` returned),
  `POST /organisations/{orgId}/users/{userId}/invite` (Resend invitation, with
  `GET /organisations/{orgId}/users` to find the administrator),
  `POST /admin/sites`, `PATCH /sites/{id}/lifecycle-status` (activate or
  decommission from the enterprise record), `POST /site-requests/{id}/decision`,
  `POST /jobs`, `/jobs/{id}/assignment`, `/gateway-link`,
  `DELETE /jobs/{id}/devices/gateway`, `/jobs/{id}/unblock` (blocked jobs only,
  409 `job_not_blocked`), `/jobs/{id}/checklist` (the four staff items, 409 on a
  duplicate), `/acceptance`.
- **Job record** via `GET /jobs/{id}`: the job drawer reads `checklistItems`
  and `notes` when it opens, so the completion evidence and installer field
  notes come from the backend rather than the list row.
- **Notifications** via `GET /notifications`, `GET /notifications/unread-count`
  (the bell badge, polled every 60 seconds while signed in) and
  `POST /notifications/{id}/read`. Job-linked entries open the job drawer.

### Still missing on the backend
| Console area | Needs | Exists today? |
| --- | --- | --- |
| Incidents | the whole `/incidents` subsystem | No, not modelled at all (scope doc §5.5) |
| Device diagnostics, firmware, heartbeat | per-device telemetry | No (only certification state and interval) |
| Changing a staff member's role | a role mutation on `/staff/{id}` | No, the only staff mutations are create, suspend and restore |
| Regional staff scope | a "region" scope for Field Operations | No, `field_operations` reaches every tenant (scope doc §5.3b) |
| Enterprise "Needs attention" status | a fourth derived state on `GET /organisations` rows | Deliberately not returned; a client-side or future concern |
| Enterprise region / products | fields on the organisation | No, remembered in this browser only (the first administrator's name and state are now read from `GET /organisations/{orgId}/users`) |
| Job checklist on the list | `checklistItems` on `GET /jobs` rows | No, only on `GET /jobs/{id}` (the drawer reads it there) |
| Site lifecycle reason | a `reason` on `PATCH /sites/{id}/lifecycle-status` | No, the console's reason is confirmation-only |

The permission sets behind the three new staff roles are provisional on the
backend; the console gates nothing on the role name beyond the copy it shows.

### Contract-shape mismatches (fix when wiring, once lists exist)
The prototype's `http-adapter` assumes a contract that differs from the real API:
- **Mutation envelope**: prototype expects `{ snapshot, data }` from every
  write; the API returns only the changed entity, no snapshot.
- **Site decision**: prototype sends `decision: "Approved" | "Returned"`; the
  API expects lowercase `"approved" | "returned"`.
- **Installer transition**: prototype sends `"Suspend" | "Restore"`; the API
  expects `"Suspend" | "Reactivate"`.
- **Job create**: prototype sends `{ date, time, note }`; the API expects
  `{ requestId, installerId, scheduledAt, note }`.
- **Gateway link**: prototype expects `{ device }` back; the API returns
  `{ job }` (and may flip the job to `blocked` with a `duplicate_gateway_identity`
  conflict).
- **Job blockers**: the API's `job.blockers` is `JobBlocker[]`
  (`{ reason, note, blockedBy, blockedAt }`), not `string[]`.

## Recommendation

The remaining gaps are incidents, device telemetry and diagnostics, changing
a staff member's role and a regional staff scope. Everything else the console
shows is read from and
written to the backend; the demo adapter (`NEXT_PUBLIC_DATA_SOURCE=mock`)
stays fully viewable without a backend.
