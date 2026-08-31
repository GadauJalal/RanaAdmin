/**
 * Prototype adapter.
 *
 * Holds the seeded network in browser localStorage and applies every safety
 * rule the platform is expected to enforce:
 *
 *   - privileged actions always append an audit event
 *   - gateway serials are checked for duplicate identity before linking
 *   - the final active Platform Operator cannot be suspended
 *   - an installer with active jobs cannot be suspended
 *   - a gateway can only be linked inside an approved job
 *   - nothing is hard deleted
 *
 * This file is the reference implementation of those rules. When the backend
 * owns them, set NEXT_PUBLIC_DATA_SOURCE=http and the HTTP adapter takes over
 * without a single component change.
 */

import { clockTime, maskEmail, operationalTimestamp, pastTense } from "@/lib/format";
import { SEED } from "@/lib/seed";
import { SNAPSHOT_COLLECTIONS, type Device, type Snapshot } from "@/lib/types";

import {
  failure,
  type AcceptInstallationInput,
  type ApiResult,
  type CreateEnterpriseInput,
  type CreateIncidentInput,
  type CreateJobInput,
  type CreateSupportGrantInput,
  type EnterpriseTransitionInput,
  type ExportKind,
  type IncidentTransitionInput,
  type InstallerTransitionInput,
  type InviteStaffInput,
  type LinkGatewayInput,
  type LinkGatewayResult,
  type OperationsApi,
  type ReassignJobInput,
  type ReissueAdminInviteInput,
  type SiteDecisionInput,
  type StaffTransitionInput
} from "./contract";

export const STORAGE_KEY = "rana54-control-centre-v2-state";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The operator this workspace session acts as. A backend derives it from the session. */
const ACTOR = "Platform operations";

let memory: Snapshot | null = null;

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return SNAPSHOT_COLLECTIONS.every(key => Array.isArray(record[key]));
}

function read(): Snapshot {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
      if (isSnapshot(saved)) {
        memory = saved;
        return memory;
      }
    } catch (error) {
      console.warn("Network Operations state could not be restored", error);
    }
  }
  memory = clone(SEED);
  return memory;
}

function commit(next: Snapshot): Snapshot {
  memory = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Network Operations changes could not be persisted", error);
    }
  }
  return clone(next);
}

function audit(
  snapshot: Snapshot,
  action: string,
  entity: string,
  outcome: string,
  reason: string
) {
  snapshot.audit.unshift({
    id: `AUD-${String(Date.now()).slice(-6)}`,
    time: operationalTimestamp(),
    actor: ACTOR,
    action,
    entity,
    outcome,
    reason
  });
}

/** Every mutation works on a copy so a rejected change never half-applies. */
function draft(): Snapshot {
  return clone(read());
}

function ok<T>(snapshot: Snapshot, data: T): ApiResult<T> {
  return { ok: true, snapshot: commit(snapshot), data };
}

const suffix = () => String(Date.now()).slice(-4);

export const mockAdapter: OperationsApi = {
  async getSnapshot() {
    return clone(read());
  },

  async resetSnapshot() {
    memory = clone(SEED);
    return commit(memory);
  },

  async createEnterprise(input: CreateEnterpriseInput) {
    const snapshot = draft();
    const id = `ENT-NEW-${suffix()}`;
    const masked = maskEmail(input.adminEmail.trim());
    const enterprise = {
      id,
      name: input.name.trim(),
      region: input.region,
      status: input.status,
      readiness: input.status === "Active" ? 35 : 18,
      adminName: input.adminName.trim(),
      adminEmail: masked,
      products: input.products.length ? input.products : ["Energy workspace"],
      sites: 0,
      liveSites: 0,
      lastActivity: "Just now"
    };
    snapshot.enterprises.unshift(enterprise);
    audit(
      snapshot,
      "Enterprise account created",
      id,
      "Created",
      `Initial administrator invitation issued to ${masked}`
    );
    return ok(snapshot, { enterprise });
  },

  async transitionEnterprise(input: EnterpriseTransitionInput) {
    const snapshot = draft();
    const enterprise = snapshot.enterprises.find(item => item.id === input.id);
    if (!enterprise) return failure("not_found", "That enterprise account no longer exists.");

    enterprise.status = input.transition === "Suspend" ? "Suspended" : "Active";
    enterprise.lastActivity = "Just now";

    // Suspension revokes live tenant support, it never deletes the tenant.
    if (enterprise.status === "Suspended") {
      snapshot.supportGrants
        .filter(grant => grant.enterprise === enterprise.name && grant.status === "Active")
        .forEach(grant => {
          grant.status = "Revoked";
        });
    }

    audit(
      snapshot,
      `Enterprise account ${pastTense(input.transition)}`,
      enterprise.id,
      enterprise.status,
      input.reason.trim()
    );
    return ok(snapshot, { enterprise });
  },

  async reissueAdminInvite(input: ReissueAdminInviteInput) {
    const snapshot = draft();
    const enterprise = snapshot.enterprises.find(item => item.id === input.id);
    if (!enterprise) return failure("not_found", "That enterprise account no longer exists.");
    enterprise.lastActivity = "Just now";
    audit(
      snapshot,
      "Initial administrator invite reissued",
      enterprise.id,
      "Invitation issued",
      input.reason.trim()
    );
    return ok(snapshot, { enterprise });
  },

  async decideSiteRequest(input: SiteDecisionInput) {
    const snapshot = draft();
    const request = snapshot.siteRequests.find(item => item.id === input.id);
    if (!request) return failure("not_found", "That site request no longer exists.");

    request.status = input.decision;

    snapshot.jobs
      .filter(job => job.siteRequestId === input.id && job.status === "Awaiting site approval")
      .forEach(job => {
        if (input.decision === "Approved") {
          job.status = "Scheduled";
          job.progress = Math.max(job.progress, 18);
          job.blockers = [];
        } else {
          job.status = "Blocked";
          job.blockers = [`Site request returned: ${input.reason.trim()}`];
        }
      });

    if (input.decision === "Approved") {
      const enterprise = snapshot.enterprises.find(item => item.id === request.enterpriseId);
      if (enterprise) {
        enterprise.sites += 1;
        enterprise.readiness = Math.min(100, enterprise.readiness + 5);
      }
    }

    audit(
      snapshot,
      `Site request ${pastTense(input.decision)}`,
      input.id,
      input.decision,
      input.reason.trim()
    );
    return ok(snapshot, undefined);
  },

  async createJob(input: CreateJobInput) {
    const snapshot = draft();
    const request = snapshot.siteRequests.find(item => item.id === input.requestId);
    const installer = snapshot.installers.find(item => item.id === input.installerId);

    if (!request || request.status !== "Approved" || !installer) {
      return failure(
        "site_not_approved",
        "Select an approved site request and an active installer."
      );
    }

    const now = new Date();
    const id = `JOB-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-${suffix()}`;
    const job = {
      id,
      enterpriseId: request.enterpriseId,
      enterprise: request.enterprise,
      siteRequestId: request.id,
      site: request.siteName,
      installerId: installer.id,
      installer: installer.name,
      status: "Scheduled",
      scheduled: `${input.date} ${input.time}`,
      progress: 8,
      blockers: [] as string[],
      checklist: [
        "Approved site request received",
        `Operations note: ${input.note.trim()}`
      ],
      linkedDevice: null
    };
    snapshot.jobs.unshift(job);
    installer.activeJobs += 1;

    audit(
      snapshot,
      "Installation job created",
      id,
      "Scheduled",
      `Assigned to ${installer.name}. ${input.note.trim()}`
    );
    return ok(snapshot, { job });
  },

  async reassignJob(input: ReassignJobInput) {
    const snapshot = draft();
    const job = snapshot.jobs.find(item => item.id === input.id);
    const next = snapshot.installers.find(item => item.id === input.installerId);
    if (!job || !next) return failure("not_found", "That job or installer no longer exists.");

    const previous = snapshot.installers.find(item => item.id === job.installerId);
    if (previous && previous.id !== next.id) {
      previous.activeJobs = Math.max(0, previous.activeJobs - 1);
    }
    if (job.installerId !== next.id) next.activeJobs += 1;

    job.installerId = next.id;
    job.installer = next.name;

    audit(snapshot, "Installation job reassigned", job.id, "Assigned", input.reason.trim());
    return ok(snapshot, { job });
  },

  async linkGateway(input: LinkGatewayInput): Promise<ApiResult<LinkGatewayResult>> {
    const snapshot = draft();
    const job = snapshot.jobs.find(item => item.id === input.jobId);
    const request = job
      ? snapshot.siteRequests.find(item => item.id === job.siteRequestId)
      : undefined;

    if (!job || request?.status !== "Approved") {
      return failure(
        "site_not_approved",
        "A gateway can only be linked inside an approved installation or replacement job."
      );
    }

    const normalized = input.serial.trim().toUpperCase();
    const duplicate = snapshot.devices.find(item => item.serial.toUpperCase() === normalized);

    // Duplicate identity: no link is created, the job is blocked, and an
    // incident is opened. The rejection still carries a snapshot because the
    // platform recorded real work.
    if (duplicate) {
      job.status = "Blocked";
      job.blockers = [`Gateway serial already belongs to ${duplicate.id}`];
      const incidentId = `INC-P2-${suffix()}`;
      snapshot.incidents.unshift({
        id: incidentId,
        title: "Duplicate gateway identity blocks installation",
        scope: "Installation",
        enterprise: job.enterprise,
        severity: "P2",
        status: "Open",
        owner: "Device operations",
        age: "Just now",
        sla: "6 hr remaining",
        deviceId: duplicate.id,
        notes: [`Serial ${normalized} is already assigned to ${duplicate.site}.`]
      });
      audit(
        snapshot,
        "Gateway link blocked",
        job.id,
        "Identity conflict",
        `${normalized}. ${input.reason.trim()}`
      );
      return failure(
        "duplicate_gateway_identity",
        `No link was created. Incident ${incidentId} is now open.`,
        commit(snapshot)
      );
    }

    const device: Device = {
      id: `GW-R54-NEW-${normalized.replace(/[^A-Z0-9]/g, "").slice(-4)}`,
      serial: normalized,
      type: "Rana Gateway",
      enterprise: job.enterprise,
      enterpriseId: job.enterpriseId,
      site: job.site,
      status: "Testing",
      heartbeat: "Awaiting first heartbeat",
      firmware: "Pending check",
      jobId: job.id,
      functions: request.functions.map(name => ({
        name,
        source: "Awaiting test",
        state: "Testing"
      })),
      lastDiagnostic: "Commissioning diagnostic not yet run"
    };

    snapshot.devices.unshift(device);
    job.linkedDevice = device.id;
    job.progress = Math.max(job.progress, 32);
    job.status = "In progress";
    job.checklist.push("Gateway identity linked");

    audit(snapshot, "Gateway linked", device.id, "Testing", `${job.id}. ${input.reason.trim()}`);
    return ok(snapshot, { device });
  },

  async acceptInstallation(input: AcceptInstallationInput) {
    const snapshot = draft();
    const job = snapshot.jobs.find(item => item.id === input.jobId);
    if (!job) return failure("not_found", "That installation job no longer exists.");
    if (job.status !== "Ready for acceptance") {
      return failure(
        "job_not_ready_for_acceptance",
        "This job is not ready for acceptance. Commissioning evidence must be complete first."
      );
    }

    job.status = "Completed";
    job.progress = 100;
    job.checklist.push("Installation accepted");

    const device = snapshot.devices.find(item => item.id === job.linkedDevice);
    if (device) {
      device.status = "Live";
      device.functions.forEach(fn => {
        fn.state = "Passing";
      });
    }

    const enterprise = snapshot.enterprises.find(item => item.id === job.enterpriseId);
    if (enterprise) {
      enterprise.liveSites = Math.min(enterprise.sites, enterprise.liveSites + 1);
      enterprise.readiness = Math.min(100, enterprise.readiness + 8);
    }

    audit(snapshot, "Installation accepted", job.id, "Completed", input.reason.trim());
    return ok(snapshot, { job });
  },

  async transitionInstaller(input: InstallerTransitionInput) {
    const snapshot = draft();
    const installer = snapshot.installers.find(item => item.id === input.id);
    if (!installer) return failure("not_found", "That installer no longer exists.");

    const activeJobs = snapshot.jobs.filter(
      job => job.installerId === installer.id && job.status !== "Completed"
    );

    if (input.transition === "Suspend" && activeJobs.length) {
      return failure(
        "installer_has_active_jobs",
        `Reassign ${activeJobs.length} active job${activeJobs.length === 1 ? "" : "s"} before suspending ${installer.name}.`
      );
    }

    installer.status = input.transition === "Suspend" ? "Suspended" : "Available";
    audit(
      snapshot,
      `Installer ${pastTense(input.transition)}`,
      installer.id,
      installer.status,
      input.reason.trim()
    );
    return ok(snapshot, undefined);
  },

  async createIncident(input: CreateIncidentInput) {
    const snapshot = draft();
    const id = `INC-${input.severity}-${suffix()}`;
    const incident = {
      id,
      title: input.title.trim(),
      scope: input.scope,
      enterprise: input.enterprise,
      severity: input.severity,
      status: "Open",
      owner: input.owner,
      age: "Just now",
      sla:
        input.severity === "P1"
          ? "30 min remaining"
          : input.severity === "P2"
            ? "6 hr remaining"
            : "3 days remaining",
      deviceId: null,
      notes: [input.note.trim()]
    };
    snapshot.incidents.unshift(incident);
    audit(snapshot, "Incident opened", id, "Open", input.note.trim());
    return ok(snapshot, { incident });
  },

  async transitionIncident(input: IncidentTransitionInput) {
    const snapshot = draft();
    const incident = snapshot.incidents.find(item => item.id === input.id);
    if (!incident) return failure("not_found", "That incident no longer exists.");

    if (input.transition === "Assign") {
      if (!input.owner) return failure("invalid_input", "Select an owner for this incident.");
      incident.owner = input.owner;
      if (incident.status === "Open") incident.status = "Acknowledged";
    } else if (input.transition === "Acknowledge") {
      incident.status = "Acknowledged";
      if (incident.owner === "Unassigned") incident.owner = "Platform operations";
    } else if (input.transition === "Resolve") {
      incident.status = "Resolved";
      incident.sla = "Met";
    } else if (input.transition === "Reopen") {
      incident.status = "Open";
      incident.sla = incident.severity === "P1" ? "30 min remaining" : "6 hr remaining";
    }

    incident.notes.unshift(`${input.transition}: ${input.reason.trim()}`);
    audit(
      snapshot,
      `Incident ${pastTense(input.transition)}`,
      incident.id,
      incident.status,
      input.reason.trim()
    );
    return ok(snapshot, { incident });
  },

  async inviteStaff(input: InviteStaffInput) {
    const snapshot = draft();
    const id = `STF-${input.role.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-3)}`;
    const privileged =
      ["Platform Operator", "Data Operations"].includes(input.role) &&
      input.scope === "All tenants";
    const staff = {
      id,
      name: input.name.trim(),
      email: maskEmail(input.email.trim()),
      role: input.role,
      scope: input.scope,
      status: "Invited",
      lastAccess: "Never",
      privileged
    };
    snapshot.staff.unshift(staff);
    audit(snapshot, "Rana54 staff invited", id, "Invitation issued", input.reason.trim());
    return ok(snapshot, { staff });
  },

  async transitionStaff(input: StaffTransitionInput) {
    const snapshot = draft();
    const person = snapshot.staff.find(item => item.id === input.id);
    if (!person) return failure("not_found", "That staff account no longer exists.");

    const isFinalPlatformOperator =
      input.transition === "Suspend" &&
      person.role === "Platform Operator" &&
      person.status === "Active" &&
      snapshot.staff.filter(
        item => item.role === "Platform Operator" && item.status === "Active"
      ).length === 1;

    if (isFinalPlatformOperator) {
      return failure(
        "final_platform_operator",
        "Activate another Platform Operator before suspending this final platform-wide operator."
      );
    }

    person.status = input.transition === "Suspend" ? "Suspended" : "Active";

    if (person.status === "Suspended") {
      snapshot.supportGrants
        .filter(grant => grant.staff === person.name && grant.status === "Active")
        .forEach(grant => {
          grant.status = "Revoked";
        });
    }

    audit(
      snapshot,
      `Staff access ${pastTense(input.transition)}`,
      person.id,
      person.status,
      input.reason.trim()
    );
    return ok(snapshot, undefined);
  },

  async createSupportGrant(input: CreateSupportGrantInput) {
    const snapshot = draft();
    const staff = snapshot.staff.find(item => item.id === input.staffId);
    const enterprise = snapshot.enterprises.find(item => item.id === input.enterpriseId);
    if (!staff || !enterprise) {
      return failure("not_found", "Select an active staff member and an enterprise.");
    }

    const expires = operationalTimestamp(new Date(Date.now() + input.duration * 3600000));
    const grant = {
      id: `GRANT-${suffix()}`,
      staff: staff.name,
      enterprise: enterprise.name,
      mode: "Read only",
      expires,
      reason: input.reason.trim(),
      status: "Active"
    };
    snapshot.supportGrants.unshift(grant);
    audit(
      snapshot,
      "Tenant support access granted",
      grant.id,
      "Read-only grant active",
      `${input.duration} hours. ${input.reason.trim()}`
    );
    return ok(snapshot, { grant });
  },

  async runDeviceDiagnostic(id: string) {
    const snapshot = draft();
    const device = snapshot.devices.find(item => item.id === id);
    if (!device) return failure("not_found", "That gateway no longer exists.");

    // Read only: identity, heartbeat, firmware and function states are checked.
    // Raw readings, configuration secrets and history are never touched.
    device.lastDiagnostic = `Safe identity, heartbeat, and function check completed at ${clockTime()}`;
    audit(
      snapshot,
      "Safe gateway diagnostic run",
      device.id,
      device.status === "Offline" ? "Offline confirmed" : "Completed",
      "Read-only operational diagnostic"
    );
    return ok(snapshot, { device });
  },

  async runServiceCheck(id: string) {
    const snapshot = draft();
    const service = snapshot.services.find(item => item.id === id);
    if (!service) return failure("not_found", "That service no longer exists.");
    audit(
      snapshot,
      "Platform service check run",
      service.id,
      service.status,
      "Read-only service health probe"
    );
    return ok(snapshot, undefined);
  },

  async completeAccessReview() {
    const snapshot = draft();
    audit(
      snapshot,
      "Privileged access review completed",
      "Rana54 staff",
      "Recorded",
      "Scheduled access review completed for all active privileged staff"
    );
    return ok(snapshot, undefined);
  },

  async recordExport(kind: ExportKind) {
    const snapshot = draft();
    if (kind === "audit") {
      audit(
        snapshot,
        "Audit history exported",
        "Rana54 Network Operations",
        "CSV prepared",
        "Platform operator requested immutable event export"
      );
    } else {
      audit(
        snapshot,
        "Gateway inventory exported",
        "Device fleet",
        "CSV prepared",
        "Platform operator requested identity and function inventory"
      );
    }
    return ok(snapshot, undefined);
  }
};
