# Rana54 Network Operations

## Purpose

This is the cross-tenant operations workspace for authorized Rana54 staff. It is not an enterprise customer dashboard and it is not the Organization Admin.

The workspace gives Rana54 operational teams one place to:

- create and manage enterprise accounts
- review enterprise site requests
- create and oversee installation jobs
- manage installers
- inspect and safely diagnose gateways
- respond to operational incidents
- manage Rana54 staff and temporary tenant-support access
- observe platform services and immutable operational history

## Control and safety model

- Every entity uses an exact persistent identifier.
- Privileged actions require a reason and create an audit event.
- Enterprise, staff, installer, device, and incident history is retained.
- Tenant support access is read-only, time-limited, and audited.
- The final active Platform Operator cannot be suspended.
- An installer with active jobs cannot be suspended until those jobs are reassigned.
- Gateway serials are checked for duplicate identity before linking.
- Safe diagnostics do not edit raw readings or credentials.

## Global layout and controls

### Sidebar navigation

- **Overview** opens the network command summary.
- **Enterprises** opens enterprise accounts and site requests.
- **Field Operations** opens installation jobs and installers.
- **Devices** opens the gateway inventory.
- **Incidents** opens the operational response queue.
- **Access** opens Rana54 staff, support grants, and access reviews.
- **Platform** opens service health and audit history.
- Orange badges show records requiring attention.

### Top bar

- **Rana54 logo** returns to Overview.
- **Global search** finds enterprises, sites, requests, jobs, installers, devices, incidents, staff, and support grants by identifier or name.
- **Search result** opens the exact matching record.
- **Notification bell** opens active incident notifications.
- **Mobile menu icon** opens or closes navigation on smaller screens.

### Shared interaction rules

- Record details open in a right-side drawer.
- Creation and state-change workflows open in a modal.
- Cancel or Close dismisses without changing data.
- Important changes require a reason.
- Success creates an audit event and a confirmation message.

## 1. Overview

### What it contains

- network operating summary
- platform-health score and service states
- active-enterprise count
- priority-incident count
- blocked-field-work count
- gateway-attention count
- priority incident queue
- field jobs in motion

### Buttons

- **Find a record** focuses global search.
- **Create enterprise** opens the enterprise-creation form.
- **Review highest priority** opens the most urgent incident.
- **Create field job** opens the installation-job form.
- **Open incident** opens the selected incident record.
- **View all** navigates to Incidents.
- **Job row** opens the selected field job.
- **Field queue** navigates to Field Operations.

## 2. Enterprises

### Accounts tab

Shows enterprise identity, RanaID, plan, number of sites, current status, administrator invitation, and open incidents.

- **Open account** opens the enterprise detail drawer.
- **Create enterprise** collects enterprise name, country, plan, first administrator, and reason, then creates the account and invitation.
- **Support access** opens the temporary support-grant form.
- **Reissue invite** creates a new first-administrator invitation after a reason is provided.
- **Grant read-only support** opens a preselected support-grant form for the enterprise.
- **Suspend account** disables new tenant activity and support grants but preserves all identifiers, evidence, and history.
- **Reactivate account** restores normal tenant activity after an audited reason.
- **Done** closes the detail drawer.

### Site requests tab

Shows requested site, enterprise, location, requested energy functions, submission date, and status.

- **Review** opens the request details and readiness checks.
- **Approve request** requires a reason, creates the governed site identity, and makes the request eligible for installation-job creation.
- **Return with reason** returns the request to the enterprise without deleting its history.

## 3. Field Operations

### Installation jobs tab

Shows site, job ID, enterprise, installer, schedule, progress, and status.

- **Create job** selects an approved site request, active installer, date, time, and operations note.
- **Inspect** opens the complete job record.
- **Reassign installer** moves the job to another eligible installer after a reason.
- **Link gateway** checks a serial for identity conflicts and links it to the approved job with a commissioning note.
- **Linked gateway row** opens the gateway record.
- **Accept installation** requires a review note and confirmation that identity, mapped functions, commissioning evidence, and delivery testing were reviewed.
- **Done** closes the drawer when no further action is available.

### Installers tab

Shows installer identity, region, certification, active load, capacity, and status.

- **View** opens installer details and assigned jobs.
- **Assigned job row** opens that job.
- **Suspend installer** requires a reason and is disabled while active jobs remain.
- **Restore installer** restores access without deleting completed-job history.
- **Done** closes the installer drawer.

## 4. Devices

### What it contains

- gateway ID and serial
- enterprise and site assignment
- mapped energy functions
- firmware
- heartbeat
- device status
- filters for enterprise, status, and search

### Buttons

- **Export inventory** downloads a CSV of the current device inventory.
- **Inspect** opens the gateway detail drawer.
- **Open source job** opens the installation job that produced the device assignment.
- **Run safe diagnostic** refreshes safe operational checks and records the action. It must not alter raw readings, configuration secrets, or historical evidence.
- **Done** closes the drawer.

## 5. Incidents

### What it contains

- severity from P1 to P3
- incident title and ID
- affected enterprise and scope
- owner
- SLA
- status
- filters for severity, status, scope, and search

### Buttons

- **Open incident** creates an incident with title, severity, scope, enterprise, initial owner, and initial evidence.
- **Open** opens the selected incident record.
- **Linked device** opens the related gateway when available.
- **Assign owner** requires an assignee and a reason.
- **Acknowledge** records that an open incident is being handled.
- **Resolve** requires a resolution note and closes the incident.
- **Reopen** reactivates a resolved incident after a reason.

## 6. Access

### Rana54 staff tab

Shows staff identity, role, scope, privilege level, last access, and status.

- **Invite staff** creates a staff invitation with an explicit role, operating scope, and access reason.
- **Manage** opens staff access details.
- **Suspend access** removes access while retaining identity and history. It is disabled for the final active Platform Operator.
- **Restore access** reactivates the account after a reason.
- **Done** closes the drawer.

### Support grants tab

Shows staff member, enterprise, read-only mode, reason, creation time, expiry, and status.

- **Grant support access** creates an explicit read-only, time-limited support grant.
- The form selects staff, enterprise, duration, and reason.
- Support access never impersonates an enterprise user and keeps personal data masked.

### Access review tab

Shows privileged Rana54 accounts requiring periodic review and the enforced safety rules.

- **Complete review** records completion of the current privileged-access review.

## 7. Platform

### Service health tab

Shows each core service, current state, operational detail, and recent service metric.

- **Run safe check** refreshes the selected service check without exposing credentials or changing customer data.
- **Export audit** downloads operational audit history.

### Audit history tab

Shows timestamp, actor, action, entity, outcome, and reason for every operational change.

- **Export CSV** downloads the append-only history.

## Notifications

- The bell lists open incidents in priority order.
- **Incident notification row** opens the related incident.
- **Open incident queue** navigates to Incidents.

## Forms and confirmation buttons

- **Cancel** closes a modal without saving.
- **Create and invite** creates an enterprise and issues the initial administrator invitation.
- **Confirm approved** approves a site request.
- **Confirm returned** returns a site request.
- **Create and assign** creates and assigns an installation job.
- **Send invitation** creates a Rana54 staff invitation.
- **Grant temporary access** creates a time-limited support grant.
- **Open incident** creates a new incident record.
- **Confirm assign, acknowledge, resolve, or reopen** applies the selected incident transition.
- **Confirm suspend, restore, reactivate, or reassign** applies the selected audited transition.
- **Check and link** validates and links a gateway serial.
- **Accept installation** commits the installation acceptance record.
- **Reissue invite** renews the initial organization-administrator invitation.

## Implementation

- Routing, views, drawers, modals, and forms are React components under `src/`.
- Every read and write goes through the operations API layer in `src/lib/api`;
  no component talks to a data source directly.
- Operational rules (duplicate gateway identity, the final Platform Operator,
  installers with active jobs, approval-gated gateway linking) live in the
  adapter, so the UI cannot route around them.
- With `NEXT_PUBLIC_DATA_SOURCE=mock` the workspace runs on the seeded network
  in `src/lib/seed.ts` and persists changes in browser `localStorage`. With
  `http` it runs against the operations service.
- CSV files are generated in the browser; the export itself is audited.
- Routes are real paths, so `/incidents` and `/access?tab=grants` are linkable.

## Files

- `src/app/`: routes, root layout, the design-system stylesheet, and the API proxy
- `src/components/views/`: the seven operational views
- `src/components/drawers/`: record detail drawers
- `src/components/modals/`: creation and state-change workflows
- `src/components/ui/`: icons, chips, panels, tables, overlays, toasts
- `src/lib/types.ts`: the domain model
- `src/lib/api/`: the operations API contract and its two adapters
- `src/lib/seed.ts`: seeded demo network
- `src/providers/workspace-provider.tsx`: snapshot, overlays, toasts, shortcuts
- `public/assets/rana54-mark.png`: official mark used in the interface
- `public/fonts/`: Jagerlay and Goli brand fonts
- `docs/BACKEND_CONTRACT.md`: endpoints and payloads the backend must serve
- `legacy/`: the original no-build prototype, kept for reference

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4183/overview`.
