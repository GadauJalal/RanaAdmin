# Operations API contract

What the Rana54 operations service has to serve for the workspace to run against
it with `NEXT_PUBLIC_DATA_SOURCE=http`.

The authoritative definitions are in code:

- [src/lib/types.ts](../src/lib/types.ts) — record shapes
- [src/lib/api/contract.ts](../src/lib/api/contract.ts) — operations, inputs, failure codes
- [src/lib/api/http-adapter.ts](../src/lib/api/http-adapter.ts) — the client that calls these routes
- [src/lib/api/mock-adapter.ts](../src/lib/api/mock-adapter.ts) — a working reference implementation of every rule below

## Transport

All routes are relative to `NEXT_PUBLIC_API_BASE_URL` (`/api` by default, which
the built-in Next.js proxy forwards to `OPERATIONS_API_URL`).

- Requests and responses are JSON.
- Requests are sent with `credentials: "include"`.
- **The audit actor comes from the session, never from the request body.** The
  client never tells the service who is acting.

## Response envelopes

Every mutation returns the complete operational picture after the change, so the
workspace never renders a partially-updated view.

**Success — 200**

```json
{
  "snapshot": { "...": "the full Snapshot" },
  "data": { "...": "the endpoint's payload, or null" }
}
```

**Rejection — 4xx / 5xx**

```json
{
  "code": "duplicate_gateway_identity",
  "message": "No link was created. Incident INC-P2-4821 is now open.",
  "snapshot": { "...": "optional" }
}
```

`message` is shown to the operator verbatim, so write it as operational copy —
it should say what was and was not recorded.

`snapshot` on a rejection is **required whenever the platform still changed
state**. Blocking a duplicate gateway identity, for example, blocks the job and
opens an incident even though the operator's action did not succeed; the
workspace must re-render to show both.

### Failure codes

| Code                          | Meaning                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `not_found`                   | The referenced record does not exist                    |
| `invalid_input`               | The payload failed validation                           |
| `site_not_approved`           | The source site request is not approved                 |
| `duplicate_gateway_identity`  | The serial already belongs to another gateway           |
| `installer_has_active_jobs`   | Reassign the installer's active jobs before suspending   |
| `final_platform_operator`     | The last active Platform Operator cannot be suspended    |
| `job_not_ready_for_acceptance`| Commissioning evidence is incomplete                     |
| `network_error`               | Client-side only; never returned by the service          |
| `server_error`                | Unhandled service failure                                |

## Routes

### Snapshot

| Method | Path        | `data` |
| ------ | ----------- | ------ |
| GET    | `/snapshot` | The `Snapshot` itself, not wrapped in an envelope |

`GET /snapshot` is the one route that returns a bare `Snapshot`. It is called on
load and whenever the workspace recovers from an error.

### Enterprises

| Method | Path                                  | Body                                                                    | `data`         |
| ------ | ------------------------------------- | ----------------------------------------------------------------------- | -------------- |
| POST   | `/enterprises`                        | `{ name, region, status, adminName, adminEmail, products[] }`            | `{ enterprise }` |
| POST   | `/enterprises/{id}/transitions`       | `{ transition: "Suspend" \| "Reactivate", reason }`                      | `{ enterprise }` |
| POST   | `/enterprises/{id}/admin-invitations` | `{ reason }`                                                             | `{ enterprise }` |

Rules: the stored `adminEmail` is masked (`a••••@company.com`) — the service
must never return the full address. Suspension revokes that tenant's active
support grants and retains every identifier, evidence record, and audit entry.

### Site requests

| Method | Path                            | Body                                              | `data` |
| ------ | ------------------------------- | ------------------------------------------------- | ------ |
| POST   | `/site-requests/{id}/decision`  | `{ decision: "Approved" \| "Returned", reason }`   | `null` |

Rules: approval creates the governed site identity and makes the request
eligible for an installation job. It does not link a gateway or create readings.
A return keeps the request and its history, and blocks any job that was waiting
on the approval, recording the reason as the blocker.

### Field operations

| Method | Path                        | Body                                                  | `data`     |
| ------ | --------------------------- | ----------------------------------------------------- | ---------- |
| POST   | `/jobs`                     | `{ requestId, installerId, date, time, note }`         | `{ job }`  |
| POST   | `/jobs/{id}/assignment`     | `{ installerId, reason }`                              | `{ job }`  |
| POST   | `/jobs/{id}/gateway-link`   | `{ serial, reason }`                                   | `{ device }` |
| POST   | `/jobs/{id}/acceptance`     | `{ reason }`                                           | `{ job }`  |
| POST   | `/installers/{id}/transitions` | `{ transition: "Suspend" \| "Restore", reason }`     | `null`     |

Rules:

- A job may only be created from an approved site request that no open job is
  already delivering. Otherwise reject with `site_not_approved`.
- A gateway may only be linked inside an approved job. Otherwise reject with
  `site_not_approved`.
- The serial is normalised (trimmed, upper-cased) and compared against every
  existing gateway. On a match, reject with `duplicate_gateway_identity`, block
  the job, open a P2 installation incident naming the conflicting gateway, and
  return the resulting `snapshot`. Never overwrite the existing link.
- Acceptance requires `status === "Ready for acceptance"`; otherwise reject with
  `job_not_ready_for_acceptance`. On success the job completes, the linked
  gateway goes `Live` with all functions `Passing`, and the enterprise's live
  site count and readiness increase.
- Suspending an installer with any job not `Completed` is rejected with
  `installer_has_active_jobs`, and the message should name the count and the
  installer.

### Devices

| Method | Path                        | Body | `data`       |
| ------ | --------------------------- | ---- | ------------ |
| POST   | `/devices/{id}/diagnostics` | —    | `{ device }` |

Rules: read only. It checks identity, heartbeat, firmware, and mapped function
states, and updates `lastDiagnostic`. It must not alter raw readings,
configuration secrets, or historical evidence.

### Incidents

| Method | Path                          | Body                                                                              | `data`       |
| ------ | ----------------------------- | --------------------------------------------------------------------------------- | ------------ |
| POST   | `/incidents`                  | `{ title, severity: "P1"\|"P2"\|"P3", scope, enterprise, owner, note }`             | `{ incident }` |
| POST   | `/incidents/{id}/transitions` | `{ transition: "Assign"\|"Acknowledge"\|"Resolve"\|"Reopen", owner?, reason }`      | `{ incident }` |

Rules: `owner` is required for `Assign`; reject with `invalid_input` otherwise.
`Assign` on an open incident also acknowledges it. `Acknowledge` assigns
`Platform operations` when the incident is unowned. `Resolve` sets the SLA to
`Met`. `Reopen` restores an SLA window from the severity. Every transition
prepends `"{Transition}: {reason}"` to the incident's notes.

### Access

| Method | Path                       | Body                                                    | `data`     |
| ------ | -------------------------- | ------------------------------------------------------- | ---------- |
| POST   | `/staff`                   | `{ name, email, role, scope, reason }`                   | `{ staff }` |
| POST   | `/staff/{id}/transitions`  | `{ transition: "Suspend" \| "Restore", reason }`         | `null`     |
| POST   | `/support-grants`          | `{ staffId, enterpriseId, duration, reason }`            | `{ grant }` |
| POST   | `/access-reviews`          | —                                                        | `null`     |

Rules:

- Staff email is stored and returned masked. New staff start as `Invited`.
- A staff member is `privileged` when the role is `Platform Operator` or
  `Data Operations` **and** the scope is `All tenants`.
- Suspending the last active `Platform Operator` is rejected with
  `final_platform_operator`. Suspension revokes that person's active grants.
- `duration` is in hours. A grant is always `Read only`, always carries a reason,
  and always has an expiry. Support access never impersonates a tenant user and
  keeps personal data masked.

### Platform

| Method | Path                     | Body               | `data` |
| ------ | ------------------------ | ------------------ | ------ |
| POST   | `/services/{id}/checks`  | —                  | `null` |
| POST   | `/exports`               | `{ kind: "audit" \| "devices" }` | `null` |

Rules: a service check is a read-only probe — it must not retry, reconfigure, or
expose credentials. `/exports` records that an operator exported data; the file
itself is generated in the browser from the current snapshot.

## Audit

Every mutation above appends one `AuditEvent` to `snapshot.audit`, newest first:

```json
{
  "id": "AUD-482913",
  "time": "28 Aug 14:32",
  "actor": "Lami Abdullahi",
  "action": "Enterprise account suspended",
  "entity": "ENT-NRB-0031",
  "outcome": "Suspended",
  "reason": "Contract under review by legal"
}
```

`action` is written in the past tense. `reason` is the operator's own text,
trimmed. The history is append-only: events are never edited or removed.
