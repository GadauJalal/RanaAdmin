"use client";

import { useRouter } from "next/navigation";

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
import { api } from "@/lib/api";
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
  if (!enterprise) return <MissingRecord label="enterprise account" />;

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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openOverlay({ kind: "support-grant", enterpriseId: enterprise.id })}
          >
            <Icon name="shield" /> Grant read-only support
          </button>
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
          { label: "Last activity", value: enterprise.lastActivity }
        ]}
      />

      <DetailSection
        title="Initial organization administrator"
        action={
          <button
            type="button"
            className="link-button"
            onClick={() => openOverlay({ kind: "reissue-admin", id: enterprise.id })}
          >
            Reissue invite
          </button>
        }
      >
        <FunctionRow
          title={enterprise.adminName || "Not assigned"}
          meta={enterprise.adminEmail || "No invitation issued"}
          trailing={<Chip>{enterprise.adminName ? "Invited" : "Missing"}</Chip>}
        />
        {enterprise.adminTempPassword ? (
          <div className="temp-password" role="note">
            <strong>One-time temporary password</strong>
            <code>{enterprise.adminTempPassword}</code>
            <small>
              Give this to {enterprise.adminName || "the administrator"} for their first sign-in
              (they set a real password on the Organization Admin activate screen). It is shown
              only once and is not stored.
            </small>
          </div>
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
          <button
            type="button"
            className="link-button"
            onClick={() => openOverlay({ kind: "new-site", enterpriseId: enterprise.id })}
          >
            Provision site
          </button>
        }
      >
        {sites.length ? (
          <FunctionList>
            {sites.map(site => (
              <FunctionRow
                key={site.id}
                title={site.name}
                meta={`${site.id} · ${site.region} · Created ${site.created}`}
                trailing={<Chip>{site.status}</Chip>}
              />
            ))}
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
  const { openOverlay } = useWorkspace();
  const job = snapshot.jobs.find(record => record.id === id);
  if (!job) return <MissingRecord label="installation job" />;

  const request = snapshot.siteRequests.find(item => item.id === job.siteRequestId);
  const linked = snapshot.devices.find(item => item.id === job.linkedDevice);
  const approved = request?.status === "Approved";
  const canAccept = job.status === "Ready for acceptance";
  const canLink = approved && !job.linkedDevice && job.status !== "Completed";

  return (
    <Drawer
      title={job.site}
      footer={
        <>
          {job.status !== "Completed" ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openOverlay({ kind: "reassign-job", id: job.id })}
            >
              Reassign installer
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

      <DetailSection title="Completion evidence" action={<span>{job.progress}%</span>}>
        <Progress value={job.progress} />
        <div style={{ marginTop: 18 }}>
          <Timeline
            items={job.checklist.map(step => ({
              title: step,
              meta: `Recorded against ${job.id}`
            }))}
          />
        </div>
      </DetailSection>

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

  const grants = snapshot.supportGrants.filter(grant => grant.staff === person.name);
  const activePlatformOperators = snapshot.staff.filter(
    item => item.role === "Platform Operator" && item.status === "Active"
  ).length;
  const isFinalPlatformOperator =
    person.role === "Platform Operator" &&
    person.status === "Active" &&
    activePlatformOperators === 1;

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
      <DetailSection title="Tenant support grants">
        {grants.length ? (
          <FunctionList>
            {grants.map(grant => (
              <FunctionRow
                key={grant.id}
                title={grant.enterprise}
                meta={`${grant.mode} · expires ${grant.expires}`}
                trailing={<Chip>{grant.status}</Chip>}
              />
            ))}
          </FunctionList>
        ) : (
          <FunctionRow
            title="No tenant support access"
            meta="Create a time-limited grant only when support work requires it."
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

export function NotificationsDrawer() {
  const snapshot = useSnapshot();
  const { openOverlay, closeOverlay } = useWorkspace();
  const router = useRouter();
  const items = snapshot.incidents.filter(item => item.status === "Open").slice(0, 5);

  return (
    <Drawer
      title="Notifications"
      footer={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            closeOverlay();
            router.push("/incidents");
          }}
        >
          Open incident queue
        </button>
      }
    >
      <Notice>
        Notifications point to governed records. Operational decisions are completed inside the
        record itself.
      </Notice>
      <div className="attention-list">
        {items.length ? (
          items.map(item => (
            <button
              type="button"
              className="attention-item"
              key={item.id}
              style={{
                width: "100%",
                borderLeft: 0,
                borderRight: 0,
                borderTop: 0,
                background: "transparent",
                textAlign: "left"
              }}
              onClick={() => openOverlay({ kind: "incident", id: item.id })}
            >
              <span className={`severity-bar ${item.severity.toLowerCase()}`} />
              <div>
                <strong>{item.title}</strong>
                <p>
                  {item.enterprise} · {item.sla}
                </p>
              </div>
              <Severity level={item.severity} />
            </button>
          ))
        ) : (
          <EmptyState
            icon="check"
            title="No open incidents"
            description="Every incident in the queue has been acknowledged or resolved."
          />
        )}
      </div>
    </Drawer>
  );
}
