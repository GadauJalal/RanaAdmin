"use client";

import { useEffect, useState } from "react";

import {
  DetailGrid,
  DetailHero,
  DetailSection,
  FunctionList,
  FunctionRow,
  FunctionRowButton,
  Timeline
} from "@/components/ui/detail";
import { Icon } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Overlay";
import { Chip, EmptyState, Notice, Progress, Severity } from "@/components/ui/primitives";
import {
  api,
  isPlatformOperator,
  isSupportAnalyst,
  STAFF_CHECKLIST,
  type ChecklistItem,
  type EnterpriseAdmin,
  type JobDetail,
  type NotificationItem,
  type NotificationList
} from "@/lib/api";
import { pluralise } from "@/lib/format";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

function DoneButton() {
  const { closeOverlay } = useWorkspace();
  return (
    <button type="button" className="btn btn-primary" onClick={closeOverlay}>
      Done
    </button>
  );
}

/** A record that has since been removed still needs a graceful drawer. */
function MissingRecord({ label }: { label: string }) {
  return (
    <Drawer title="Record unavailable">
      <EmptyState
        icon="info"
        title={`This ${label} is no longer in the operational picture`}
        description="It may have been reloaded from the service after this view opened."
      />
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

export function EnterpriseDrawer({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const enterprise = snapshot.enterprises.find(record => record.id === id);

  /*
   * The first administrator is whoever holds the organisation-wide super admin
   * role, and their state (invited, active) lives on the organisation's own
   * user list, so it is read when the drawer opens. Until it arrives, or when
   * the platform does not report it, the record's own admin details stand in.
   */
  const [admin, setAdmin] = useState<EnterpriseAdmin | null>(null);
  useEffect(() => {
    let cancelled = false;
    setAdmin(null);
    api
      .getEnterpriseAdmin(id)
      .then(loaded => {
        if (!cancelled && loaded) setAdmin(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!enterprise) return <MissingRecord label="enterprise account" />;

  const adminName = admin?.name || enterprise.adminName;
  const adminEmail = admin?.email || enterprise.adminEmail;
  const adminStatus = admin?.status ?? enterprise.adminStatus ?? null;
  const adminInvited = adminStatus === "Invited";

  const requests = snapshot.siteRequests.filter(request => request.enterpriseId === id);
  const sites = snapshot.sites.filter(site => site.enterpriseId === id);
  const incidents = snapshot.incidents.filter(
    incident => incident.enterprise === enterprise.name && incident.status !== "Resolved"
  );
  const suspended = enterprise.status === "Suspended";

  return (
    <Drawer
      title={enterprise.name}
      footer={
        <>
          {suspended ? null : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openOverlay({ kind: "support-grant", enterpriseId: enterprise.id })}
            >
              <Icon name="shield" /> Grant read-only support
            </button>
          )}
          <button
            type="button"
            className={`btn ${suspended ? "btn-secondary" : "btn-danger"}`}
            onClick={() =>
              openOverlay({
                kind: "enterprise-transition",
                id: enterprise.id,
                transition: suspended ? "Reactivate" : "Suspend"
              })
            }
          >
            {suspended ? "Reactivate account" : "Suspend account"}
          </button>
          <DoneButton />
        </>
      }
    >
      <DetailHero
        kicker="Enterprise account"
        title={enterprise.name}
        meta={`${enterprise.id} · ${enterprise.region}`}
      />
      <DetailGrid
        cells={[
          { label: "Status", value: <Chip>{enterprise.status}</Chip> },
          { label: "Readiness", value: `${enterprise.readiness}%` },
          { label: "Live sites", value: `${enterprise.liveSites} of ${enterprise.sites}` },
          suspended
            ? { label: "Suspended since", value: enterprise.suspendedSince ?? "Not recorded" }
            : { label: "Last activity", value: enterprise.lastActivity }
        ]}
      />
      {suspended ? (
        <Notice icon="shield" tone="danger">
          Suspended since {enterprise.suspendedSince ?? "an unrecorded time"}. Its users are
          locked out and Rana54 support grants into it were revoked; meter data keeps flowing.
          Site provisioning and support access resume once the account is reactivated.
        </Notice>
      ) : null}

      <DetailSection
        title="Initial organization administrator"
        action={
          <button
            type="button"
            className="link-button"
            onClick={() => openOverlay({ kind: "reissue-admin", id: enterprise.id })}
          >
            Resend invitation
          </button>
        }
      >
        <FunctionRow
          title={adminName || "Not assigned"}
          meta={
            adminInvited
              ? `${adminEmail ?? "Unknown address"} · Invited, activation email sent`
              : adminEmail || "No administrator listed"
          }
          trailing={
            <Chip>{adminStatus ?? (adminName ? "Invited" : "Missing")}</Chip>
          }
        />
        {adminInvited ? (
          <Notice icon="info">
            An activation email was sent to {adminEmail ?? "the administrator"}. They set their
            own password from that link. Use Resend invitation if it did not arrive.
          </Notice>
        ) : null}
      </DetailSection>

      <DetailSection title="Enabled products">
        <FunctionList>
          {enterprise.products.map(product => (
            <FunctionRow
              key={product}
              title={product}
              meta="Enabled for this tenant"
              trailing={<Chip>Active</Chip>}
            />
          ))}
        </FunctionList>
      </DetailSection>

      <DetailSection
        title="Sites"
        action={
          suspended ? null : (
            <button
              type="button"
              className="link-button"
              onClick={() => openOverlay({ kind: "new-site", enterpriseId: enterprise.id })}
            >
              Provision site
            </button>
          )
        }
      >
        {sites.length ? (
          <FunctionList>
            {sites.map(site => {
              const provisioned = site.status === "Provisioned";
              const retirable = provisioned || site.status === "Active";
              return (
                <FunctionRow
                  key={site.id}
                  title={site.name}
                  meta={`${site.id} · ${site.region} · Created ${site.created}`}
                  trailing={
                    <span className="function-row-actions">
                      <Chip>{site.status}</Chip>
                      {provisioned ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            openOverlay({ kind: "site-lifecycle", id: site.id, status: "active" })
                          }
                        >
                          Activate
                        </button>
                      ) : null}
                      {retirable ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            openOverlay({
                              kind: "site-lifecycle",
                              id: site.id,
                              status: "decommissioned"
                            })
                          }
                        >
                          Decommission
                        </button>
                      ) : null}
                    </span>
                  }
                />
              );
            })}
          </FunctionList>
        ) : (
          <EmptyState
            title="No sites yet"
            description="Approve a site request from this enterprise, or provision a site directly."
          />
        )}
      </DetailSection>

      <DetailSection title="Open site requests">
        {requests.length ? (
          <FunctionList>
            {requests.map(request => (
              <FunctionRowButton
                key={request.id}
                title={request.siteName}
                meta={`${request.id} · ${request.location}`}
                trailing={<Chip>{request.status}</Chip>}
                onClick={() => openOverlay({ kind: "site-request", id: request.id })}
              />
            ))}
          </FunctionList>
        ) : (
          <EmptyState title="No site requests" />
        )}
      </DetailSection>

      {incidents.length ? (
        <DetailSection title="Open incidents">
          <FunctionList>
            {incidents.map(incident => (
              <FunctionRowButton
                key={incident.id}
                title={incident.title}
                meta={incident.id}
                trailing={<Severity level={incident.severity} />}
                onClick={() => openOverlay({ kind: "incident", id: incident.id })}
              />
            ))}
          </FunctionList>
        </DetailSection>
      ) : null}
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

export function SiteRequestDrawer({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const request = snapshot.siteRequests.find(record => record.id === id);
  if (!request) return <MissingRecord label="site request" />;

  const pending = request.status === "Pending review";

  return (
    <Drawer
      title={request.siteName}
      footer={
        pending ? (
          <>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                openOverlay({ kind: "site-decision", id: request.id, decision: "Returned" })
              }
            >
              Return with reason
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                openOverlay({ kind: "site-decision", id: request.id, decision: "Approved" })
              }
            >
              <Icon name="check" /> Approve request
            </button>
          </>
        ) : (
          <DoneButton />
        )
      }
    >
      <DetailHero
        kicker="Site request"
        title={request.siteName}
        meta={`${request.id} · ${request.location}`}
      />
      <Notice>
        Approval creates the governed site identity and makes this request eligible for an
        installation job. It does not link a gateway or create readings.
      </Notice>
      <DetailGrid
        cells={[
          { label: "Enterprise", value: request.enterprise },
          { label: "Status", value: <Chip>{request.status}</Chip> },
          { label: "Requested by", value: request.requestedBy },
          { label: "Submitted", value: request.submitted }
        ]}
      />
      <DetailSection title="Requested energy functions">
        <FunctionList>
          {request.functions.map(fn => (
            <FunctionRow
              key={fn}
              title={fn}
              meta="Function requested. Source identity is established during commissioning."
              trailing={<Chip>Requested</Chip>}
            />
          ))}
        </FunctionList>
      </DetailSection>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

export function JobDrawer({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { openOverlay, run } = useWorkspace();
  const job = snapshot.jobs.find(record => record.id === id);

  /*
   * Recorded evidence and field notes live on the job's own record, not the
   * list row, so they are read when the drawer opens and again after every
   * item recorded here. Until they arrive the list row's checklist stands in.
   */
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDetailError(null);
    api
      .getJobDetail(id)
      .then(loaded => {
        if (!cancelled) setDetail(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDetailError(
            error instanceof Error ? error.message : "The job's evidence could not be loaded."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  if (!job) return <MissingRecord label="installation job" />;

  const request = snapshot.siteRequests.find(item => item.id === job.siteRequestId);
  const linked = snapshot.devices.find(item => item.id === job.linkedDevice);
  const approved = request?.status === "Approved";
  const completed = job.status === "Completed";
  const blocked = job.status === "Blocked";
  const canAccept = job.status === "Ready for acceptance";
  const canLink = approved && !job.linkedDevice && !completed;
  const canUnlink = Boolean(job.linkedDevice) && job.status === "In progress";

  const recordedItems = detail ? detail.checklist : job.checklist;
  const recorded = STAFF_CHECKLIST.filter(item => recordedItems.includes(item));
  const progress = detail ? recorded.length * (100 / STAFF_CHECKLIST.length) : job.progress;
  const history = recordedItems.filter(
    step => !(STAFF_CHECKLIST as readonly string[]).includes(step)
  );

  function recordItem(item: ChecklistItem) {
    void run(() => api.recordChecklistItem({ jobId: id, item }), {
      failureTitle: "Evidence could not be recorded",
      keepOverlay: true,
      success: ({ checklistItem }) => ({
        title: `${checklistItem.item} recorded`,
        detail:
          recorded.length + 1 >= STAFF_CHECKLIST.length
            ? "All four staff items are recorded. The job is ready for acceptance."
            : `${recorded.length + 1} of ${STAFF_CHECKLIST.length} staff items recorded for ${job?.id}.`
      }),
      onSuccess: () => setVersion(value => value + 1)
    });
  }

  return (
    <Drawer
      title={job.site}
      footer={
        <>
          {!completed ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openOverlay({ kind: "reassign-job", id: job.id })}
            >
              Reassign installer
            </button>
          ) : null}
          {blocked ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openOverlay({ kind: "unblock-job", id: job.id })}
            >
              <Icon name="refresh" /> Unblock job
            </button>
          ) : null}
          {canAccept ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openOverlay({ kind: "accept-installation", id: job.id })}
            >
              <Icon name="check" /> Accept installation
            </button>
          ) : (
            <DoneButton />
          )}
        </>
      }
    >
      <DetailHero
        kicker="Installation job"
        title={job.site}
        meta={`${job.id} · ${job.enterprise}`}
      />
      {job.blockers.length ? (
        <Notice icon="incident" tone="danger">
          {job.blockers.join(" ")}
        </Notice>
      ) : (
        <Notice icon="shield">
          Gateway linking is available only inside an approved installation or replacement job.
        </Notice>
      )}
      <DetailGrid
        cells={[
          { label: "Status", value: <Chip>{job.status}</Chip> },
          { label: "Installer", value: job.installer },
          { label: "Schedule", value: job.scheduled },
          {
            label: "Site request",
            value: `${job.siteRequestId} · ${request?.status ?? "Not found"}`
          }
        ]}
      />

      <DetailSection title="Completion evidence" action={<span>{Math.round(progress)}%</span>}>
        <Progress value={progress} />
        {detailError ? (
          <div style={{ marginTop: 14 }}>
            <Notice icon="incident" tone="warning">
              Recorded evidence could not be loaded from the job record: {detailError}
            </Notice>
          </div>
        ) : null}
        <div style={{ marginTop: 18 }}>
          <FunctionList>
            {STAFF_CHECKLIST.map(item => {
              const done = recorded.includes(item);
              return (
                <FunctionRow
                  key={item}
                  title={item}
                  meta={
                    done
                      ? `Recorded against ${job.id}. Evidence is append-only.`
                      : completed
                        ? "Not recorded before acceptance."
                        : "Staff evidence, recorded once the check is confirmed."
                  }
                  trailing={
                    done ? (
                      <Chip>Recorded</Chip>
                    ) : completed ? (
                      <Chip>Pending</Chip>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        disabled={!detail && !detailError}
                        onClick={() => recordItem(item)}
                      >
                        <Icon name="check" /> Record
                      </button>
                    )
                  }
                />
              );
            })}
          </FunctionList>
        </div>
        {history.length ? (
          <div style={{ marginTop: 18 }}>
            <Timeline
              items={history.map(step => ({
                title: step,
                meta: `Recorded against ${job.id}`
              }))}
            />
          </div>
        ) : null}
      </DetailSection>

      {detail?.notes.length ? (
        <DetailSection title="Field notes">
          <Timeline
            items={detail.notes.map(note => ({
              title: note.text,
              meta: `Installer note · ${note.recordedAt}`
            }))}
          />
        </DetailSection>
      ) : null}

      <DetailSection
        title="Linked gateway"
        action={
          canLink ? (
            <button
              type="button"
              className="link-button"
              onClick={() => openOverlay({ kind: "link-gateway", id: job.id })}
            >
              Link gateway
            </button>
          ) : canUnlink ? (
            <button
              type="button"
              className="link-button"
              onClick={() => openOverlay({ kind: "unlink-gateway", id: job.id })}
            >
              Unlink gateway
            </button>
          ) : undefined
        }
      >
        {linked ? (
          <FunctionRowButton
            title={linked.id}
            meta={`${linked.serial} · ${linked.functions.length} mapped functions`}
            trailing={<Chip>{linked.status}</Chip>}
            onClick={() => openOverlay({ kind: "device", id: linked.id })}
          />
        ) : (
          <FunctionRow
            title="No gateway linked"
            meta={
              approved
                ? "This approved job is eligible for gateway linking."
                : "Approve the site request before linking a device."
            }
            trailing={<Chip>{approved ? "Available" : "Blocked"}</Chip>}
          />
        )}
      </DetailSection>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

export function InstallerDrawer({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const installer = snapshot.installers.find(record => record.id === id);
  if (!installer) return <MissingRecord label="installer" />;

  const jobs = snapshot.jobs.filter(job => job.installerId === id);
  const activeJobs = jobs.filter(job => job.status !== "Completed");
  const suspended = installer.status === "Suspended";

  return (
    <Drawer
      title={installer.name}
      footer={
        <>
          {suspended ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                openOverlay({
                  kind: "installer-transition",
                  id: installer.id,
                  transition: "Restore"
                })
              }
            >
              Restore installer
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              disabled={activeJobs.length > 0}
              onClick={() =>
                openOverlay({
                  kind: "installer-transition",
                  id: installer.id,
                  transition: "Suspend"
                })
              }
            >
              Suspend installer
            </button>
          )}
          <DoneButton />
        </>
      }
    >
      <DetailHero
        kicker="Installer profile"
        title={installer.name}
        meta={`${installer.id} · ${installer.region}`}
      />
      <DetailGrid
        cells={[
          { label: "Status", value: <Chip>{installer.status}</Chip> },
          { label: "Certification", value: installer.certification },
          { label: "Capacity", value: installer.capacity },
          { label: "Contact", value: installer.phone }
        ]}
      />
      <DetailSection title="Assigned jobs">
        <FunctionList>
          {jobs.map(job => (
            <FunctionRowButton
              key={job.id}
              title={job.site}
              meta={job.id}
              trailing={<Chip>{job.status}</Chip>}
              onClick={() => openOverlay({ kind: "job", id: job.id })}
            />
          ))}
        </FunctionList>
      </DetailSection>
      {activeJobs.length > 0 && !suspended ? (
        <Notice tone="warning">
          Reassign {activeJobs.length} active {pluralise(activeJobs.length, "job")} before
          suspending this installer.
        </Notice>
      ) : null}
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

export function DeviceDrawer({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { openOverlay, run } = useWorkspace();
  const device = snapshot.devices.find(record => record.id === id);
  if (!device) return <MissingRecord label="gateway" />;

  const job = snapshot.jobs.find(item => item.id === device.jobId);

  function runDiagnostic() {
    void run(() => api.runDeviceDiagnostic(id), {
      failureTitle: "Diagnostic could not run",
      keepOverlay: true,
      success: () => ({
        title: "Safe diagnostic complete",
        detail:
          "Identity, heartbeat, firmware, and mapped function states were checked without editing readings."
      })
    });
  }

  return (
    <Drawer
      title={device.id}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={runDiagnostic}>
            <Icon name="refresh" /> Run safe diagnostic
          </button>
          <DoneButton />
        </>
      }
    >
      <DetailHero
        kicker="Gateway identity"
        title={device.id}
        meta={`Serial ${device.serial} · ${device.site}`}
      />
      <Notice icon="lock">
        Diagnostics are read only. Raw readings cannot be edited here, and credentials remain
        masked.
      </Notice>
      <DetailGrid
        cells={[
          { label: "Status", value: <Chip>{device.status}</Chip> },
          { label: "Heartbeat", value: device.heartbeat },
          { label: "Firmware", value: device.firmware },
          { label: "Source job", value: device.jobId }
        ]}
      />
      <DetailSection
        title="Mapped energy functions"
        action={<span className="eyebrow">Not meter count</span>}
      >
        <FunctionList>
          {device.functions.map(fn => (
            <FunctionRow
              key={fn.name}
              title={fn.name}
              meta={`Source ${fn.source}`}
              trailing={<Chip>{fn.state}</Chip>}
            />
          ))}
        </FunctionList>
      </DetailSection>
      <DetailSection title="Last diagnostic">
        <FunctionRow
          title={device.lastDiagnostic}
          meta="Diagnostic output is recorded, not editable."
          trailing={<Icon name="terminal" />}
        />
      </DetailSection>
      {job ? (
        <DetailSection>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openOverlay({ kind: "job", id: job.id })}
          >
            Open source job <Icon name="arrow" />
          </button>
        </DetailSection>
      ) : null}
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

export function IncidentDrawer({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const incident = snapshot.incidents.find(record => record.id === id);
  if (!incident) return <MissingRecord label="incident" />;

  const linkedDevice = incident.deviceId
    ? snapshot.devices.find(device => device.id === incident.deviceId)
    : undefined;
  const resolved = incident.status === "Resolved";

  return (
    <Drawer
      title={incident.id}
      footer={
        resolved ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() =>
              openOverlay({ kind: "incident-transition", id: incident.id, transition: "Reopen" })
            }
          >
            Reopen
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                openOverlay({
                  kind: "incident-transition",
                  id: incident.id,
                  transition: "Assign"
                })
              }
            >
              Assign owner
            </button>
            {incident.status === "Open" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  openOverlay({
                    kind: "incident-transition",
                    id: incident.id,
                    transition: "Acknowledge"
                  })
                }
              >
                Acknowledge
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                openOverlay({
                  kind: "incident-transition",
                  id: incident.id,
                  transition: "Resolve"
                })
              }
            >
              <Icon name="check" /> Resolve
            </button>
          </>
        )
      }
    >
      <DetailHero
        kicker={`${incident.severity} incident`}
        title={incident.title}
        meta={`${incident.enterprise} · Open for ${incident.age}`}
      />
      <DetailGrid
        cells={[
          { label: "Status", value: <Chip>{incident.status}</Chip> },
          { label: "Severity", value: <Severity level={incident.severity} /> },
          { label: "Owner", value: incident.owner },
          { label: "SLA", value: incident.sla }
        ]}
      />
      {linkedDevice ? (
        <DetailSection title="Linked device">
          <FunctionRowButton
            title={linkedDevice.id}
            meta={`${linkedDevice.site} · ${linkedDevice.status}`}
            trailing={<Icon name="arrow" />}
            onClick={() => openOverlay({ kind: "device", id: linkedDevice.id })}
          />
        </DetailSection>
      ) : null}
      <DetailSection title="Operational notes">
        <Timeline
          items={incident.notes.map((note, index) => ({
            title: note,
            meta: index === 0 ? "Initial evidence" : "Platform operations update"
          }))}
        />
      </DetailSection>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

export function StaffDrawer({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const person = snapshot.staff.find(record => record.id === id);
  if (!person) return <MissingRecord label="staff account" />;

  const grants = snapshot.supportGrants.filter(grant =>
    grant.staffId ? grant.staffId === person.id : grant.staff === person.name
  );
  const analyst = isSupportAnalyst(person);
  const activePlatformOperators = snapshot.staff.filter(
    item => isPlatformOperator(item) && item.status === "Active"
  ).length;
  const isFinalPlatformOperator =
    isPlatformOperator(person) && person.status === "Active" && activePlatformOperators === 1;

  return (
    <Drawer
      title={person.name}
      footer={
        <>
          {person.status === "Active" ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={isFinalPlatformOperator}
              onClick={() =>
                openOverlay({ kind: "staff-transition", id: person.id, transition: "Suspend" })
              }
            >
              Suspend access
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                openOverlay({ kind: "staff-transition", id: person.id, transition: "Restore" })
              }
            >
              Restore access
            </button>
          )}
          <DoneButton />
        </>
      }
    >
      <DetailHero
        kicker="Rana54 staff access"
        title={person.name}
        meta={`${person.id} · ${person.email}`}
      />
      <Notice icon="shield">
        Role permissions and tenant support grants are separate. This screen never reveals
        credentials or full personal data.
      </Notice>
      <DetailGrid
        cells={[
          { label: "Status", value: <Chip>{person.status}</Chip> },
          { label: "Role", value: person.role },
          { label: "Scope", value: person.scope },
          { label: "Last access", value: person.lastAccess }
        ]}
      />
      {analyst && person.status === "Invited" ? (
        <Notice icon="info">
          A Support Analyst cannot accept their invitation until their first support grant is
          issued. This pending state is expected until support access is granted.
        </Notice>
      ) : null}
      <DetailSection
        title="Tenant support grants"
        action={
          analyst && person.status !== "Suspended" ? (
            <button
              type="button"
              className="link-button"
              onClick={() => openOverlay({ kind: "support-grant" })}
            >
              Grant access
            </button>
          ) : null
        }
      >
        {grants.length ? (
          <FunctionList>
            {grants.map(grant => (
              <FunctionRow
                key={grant.id}
                title={grant.enterprise}
                meta={`${grant.id} · ${grant.mode} · expires ${grant.expires} · ${grant.reason}`}
                trailing={
                  <span className="function-row-actions">
                    <Chip>{grant.status}</Chip>
                    {grant.status === "Active" ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => openOverlay({ kind: "revoke-grant", id: grant.id })}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </span>
                }
              />
            ))}
          </FunctionList>
        ) : (
          <FunctionRow
            title="No tenant support access"
            meta={
              analyst
                ? "Create a time-limited grant only when support work requires it."
                : "This role reaches every tenant through its standing platform access and holds no support grants."
            }
            trailing={<Chip>None</Chip>}
          />
        )}
      </DetailSection>
      {isFinalPlatformOperator ? (
        <Notice icon="shield" tone="warning">
          Invite and activate another Platform Operator before suspending this final
          platform-wide operator.
        </Notice>
      ) : null}
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The operator's inbox. Entries are read from the platform when the drawer
 * opens; a job-linked entry opens its job (and is marked read on the way),
 * anything else can be marked read in place.
 */
export function NotificationsDrawer() {
  const snapshot = useSnapshot();
  const { openOverlay, pushToast } = useWorkspace();
  const [list, setList] = useState<NotificationList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .listNotifications()
      .then(loaded => {
        if (!cancelled) setList(loaded);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "The inbox could not be loaded.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function markRead(item: NotificationItem): Promise<boolean> {
    if (item.read) return true;
    setBusyId(item.id);
    try {
      const result = await api.markNotificationRead(item.id);
      if (!result.ok) {
        pushToast("Notification not marked read", result.message, "blocked");
        return false;
      }
      setList(current =>
        current
          ? {
              items: current.items.map(entry =>
                entry.id === item.id ? { ...entry, read: true } : entry
              ),
              unreadCount: Math.max(0, current.unreadCount - 1)
            }
          : current
      );
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function open(item: NotificationItem) {
    const job = item.jobId ? snapshot.jobs.find(record => record.id === item.jobId) : undefined;
    await markRead(item);
    if (job) openOverlay({ kind: "job", id: job.id });
    else pushToast("Job not in the picture", `${item.jobId} is not in the current operational picture.`, "blocked");
  }

  const items = list?.items ?? [];
  const unread = list?.unreadCount ?? 0;

  return (
    <Drawer
      title="Notifications"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setVersion(value => value + 1)}
          >
            <Icon name="refresh" /> Refresh
          </button>
          <DoneButton />
        </>
      }
    >
      <Notice>
        {list
          ? unread
            ? `${unread} unread. Notifications point to governed records; decisions are completed inside the record itself.`
            : "Nothing unread. Notifications point to governed records; decisions are completed inside the record itself."
          : "Notifications point to governed records. Operational decisions are completed inside the record itself."}
      </Notice>
      {error ? (
        <Notice icon="incident" tone="warning">
          The inbox could not be loaded: {error}
        </Notice>
      ) : null}
      <div className="notification-list">
        {items.length ? (
          items.map(item => {
            const linkedJob = item.jobId
              ? snapshot.jobs.find(record => record.id === item.jobId)
              : undefined;
            return (
              <div
                className={`notification-item ${item.read ? "read" : "unread"}`}
                key={item.id}
                data-notification-id={item.id}
              >
                <span className="notification-dot" aria-hidden="true" />
                {item.jobId ? (
                  <button
                    type="button"
                    className="notification-open"
                    disabled={busyId === item.id}
                    onClick={() => void open(item)}
                  >
                    <strong>{item.title}</strong>
                    <p>
                      {item.detail}
                      {linkedJob ? ` · ${linkedJob.site} (${linkedJob.id})` : ` · ${item.jobId}`}
                    </p>
                    <time>{item.createdAt}</time>
                  </button>
                ) : (
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <time>{item.createdAt}</time>
                  </div>
                )}
                <span className="notification-actions">
                  {item.read ? (
                    <Chip>Read</Chip>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      disabled={busyId === item.id}
                      onClick={() => void markRead(item)}
                    >
                      Mark read
                    </button>
                  )}
                </span>
              </div>
            );
          })
        ) : list ? (
          <EmptyState
            icon="check"
            title="No notifications"
            description="Job, grant and account events for your scope will appear here."
          />
        ) : error ? null : (
          <EmptyState title="Loading notifications" />
        )}
      </div>
    </Drawer>
  );
}
