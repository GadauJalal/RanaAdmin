/**
 * Prototype adapter.
 *
 * Holds the seeded network in browser localStorage and applies every safety
 * rule the platform is expected to enforce:
 *
 *   - privileged actions always append an audit event
 *   - gateway serials are checked for duplicate identity before linking
 *   - the final active Platform Operator cannot be suspended
 *   - only a support analyst holds a support grant, never into a suspended
 *     enterprise, and only an active grant can be revoked
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
  isPlatformOperator,
  isSupportAnalyst,
  NIGERIAN_REGIONS,
  STAFF_CHECKLIST,
  STAFF_ROLES,
  staffRoleLabel,
  type AcceptInstallationInput,
  type ApiResult,
  type CreateEnterpriseInput,
  type CreateIncidentInput,
  type CreateInstallerInput,
  type CreateJobInput,
  type CreateSiteInput,
  type CreateSupportGrantInput,
  type EnterpriseTransitionInput,
  type ExportKind,
  type IncidentTransitionInput,
  type InstallerTransitionInput,
  type InviteStaffInput,
  type JobDetail,
  type LinkGatewayInput,
  type LinkGatewayResult,
  type NotificationItem,
  type NotificationList,
  type OperationsApi,
  type ReassignJobInput,
  type RecordChecklistItemInput,
  type RegisterDeviceInput,
  type ReissueAdminInviteInput,
  type RevokeSupportGrantInput,
  type SetSiteLifecycleInput,
  type SiteDecisionInput,
  type StaffTransitionInput,
  type UnblockJobInput,
  type UnlinkGatewayInput
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

/** Notifications the operator has cleared this session. The inbox itself is derived. */
const readNotifications = new Set<string>();

const DEVICE_ROLE_LABEL: Record<string, string> = {
  grid: "Grid meter",
  inverter_output: "Inverter output meter"
};

const DEVICE_CERT_LABEL: Record<string, string> = {
  certified: "Certified",
  pending: "Pending certification",
  expired: "Certificate expired",
  uncertified: "Uncertified"
};

const capitalise = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ") : value;

/**
 * The prototype inbox is the open incident queue: one entry per open incident,
 * linked to the job its device came from when there is one.
 */
function notificationsFrom(snapshot: Snapshot): NotificationItem[] {
  return snapshot.incidents
    .filter(incident => incident.status === "Open")
    .map(incident => {
      const device = snapshot.devices.find(item => item.id === incident.deviceId);
      const id = `NTF-${incident.id}`;
      return {
        id,
        title: incident.title,
        detail: `${incident.severity} incident · ${incident.enterprise} · ${incident.sla}`,
        createdAt: incident.age,
        read: readNotifications.has(id),
        ...(device?.jobId ? { jobId: device.jobId } : null)
      };
    });
}

export const mockAdapter: OperationsApi = {
  async getSnapshot() {
    return clone(read());
  },

  async resetSnapshot() {
    memory = clone(SEED);
    return commit(memory);
  },

  /**
   * Creating the enterprise invites its first administrator in the same step:
   * an activation email, no temporary password. The organisation's own
   * contact email is validated separately and falls back to the admin's.
   */
  async createEnterprise(input: CreateEnterpriseInput) {
    const snapshot = draft();
    const id = `ENT-NEW-${suffix()}`;
    const adminEmail = input.adminEmail.trim();
    const contactEmail = input.email?.trim() || adminEmail;
    if (!adminEmail.includes("@") || !contactEmail.includes("@")) {
      return failure("invalid_input", "Both the organisation contact email and the administrator email must be valid addresses.");
    }
    const masked = maskEmail(adminEmail);
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
      lastActivity: "Just now",
      adminUserId: `USR-${suffix()}`,
      adminStatus: "Invited"
    };
    snapshot.enterprises.unshift(enterprise);
    audit(
      snapshot,
      "Enterprise account created",
      id,
      "Created",
      `Initial administrator activation email sent to ${masked}`
    );
    return ok(snapshot, { enterprise });
  },

  async transitionEnterprise(input: EnterpriseTransitionInput) {
    const snapshot = draft();
    const enterprise = snapshot.enterprises.find(item => item.id === input.id);
    if (!enterprise) return failure("not_found", "That enterprise account no longer exists.");

    const suspended = enterprise.status === "Suspended";
    if (input.transition === "Suspend" && suspended) {
      return failure("enterprise_already_suspended", "This enterprise is already suspended.");
    }
    if (input.transition !== "Suspend" && !suspended) {
      return failure(
        "enterprise_not_suspended",
        "This enterprise is not suspended, so there is nothing to restore."
      );
    }

    enterprise.status = input.transition === "Suspend" ? "Suspended" : "Active";
    enterprise.lastActivity = "Just now";

    // Suspension revokes live tenant support, it never deletes the tenant.
    if (enterprise.status === "Suspended") {
      enterprise.suspendedSince = operationalTimestamp();
      snapshot.supportGrants
        .filter(
          grant =>
            (grant.enterpriseId === enterprise.id || grant.enterprise === enterprise.name) &&
            grant.status === "Active"
        )
        .forEach(grant => {
          grant.status = "Revoked";
        });
    } else {
      delete enterprise.suspendedSince;
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
    if (!enterprise.adminName || !enterprise.adminEmail) {
      return failure(
        "not_found",
        "No organisation-wide administrator is listed for this enterprise, so there is no invitation to resend. Add one through Organization Admin."
      );
    }
    enterprise.lastActivity = "Just now";
    enterprise.adminUserId = enterprise.adminUserId ?? `USR-${suffix()}`;
    if (enterprise.adminStatus !== "Active") enterprise.adminStatus = "Invited";
    audit(
      snapshot,
      "Initial administrator invitation resent",
      enterprise.id,
      "Activation email sent",
      input.reason.trim()
    );
    return ok(snapshot, { enterprise });
  },

  async getEnterpriseAdmin(enterpriseId: string) {
    const enterprise = read().enterprises.find(item => item.id === enterpriseId);
    if (!enterprise?.adminName || !enterprise.adminEmail) return null;
    return {
      userId: enterprise.adminUserId ?? `USR-${enterprise.id}`,
      name: enterprise.adminName,
      email: enterprise.adminEmail,
      status: enterprise.adminStatus ?? "Active"
    };
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
      // Approval is what creates the governed site identity.
      snapshot.sites.unshift({
        id: `SITE-NEW-${suffix()}`,
        name: request.siteName,
        enterpriseId: request.enterpriseId,
        enterprise: request.enterprise,
        region: request.location,
        status: "Provisioned",
        created: operationalTimestamp()
      });
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

  async createSite(input: CreateSiteInput) {
    const snapshot = draft();
    const enterprise = snapshot.enterprises.find(item => item.id === input.enterpriseId);
    if (!enterprise) return failure("not_found", "That enterprise account no longer exists.");
    if (!input.name.trim()) return failure("invalid_input", "A site name is required.");

    const site = {
      id: `SITE-NEW-${suffix()}`,
      name: input.name.trim(),
      enterpriseId: enterprise.id,
      enterprise: enterprise.name,
      region: input.address.trim() || "Unassigned",
      status: "Provisioned",
      created: operationalTimestamp()
    };
    snapshot.sites.unshift(site);
    enterprise.sites += 1;
    enterprise.lastActivity = "Just now";

    audit(snapshot, "Site provisioned", site.id, "Provisioned", `${site.name} for ${enterprise.name}`);
    return ok(snapshot, { site });
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

  async unlinkGateway(input: UnlinkGatewayInput) {
    const snapshot = draft();
    const job = snapshot.jobs.find(item => item.id === input.jobId);
    if (!job) return failure("not_found", "That job no longer exists.");
    if (!job.linkedDevice) return failure("invalid_input", "This job has no gateway to unlink.");
    if (job.status !== "In progress") {
      return failure("invalid_input", "Only a job in progress can have its gateway unlinked.");
    }

    const deviceId = job.linkedDevice;
    snapshot.devices = snapshot.devices.filter(item => item.id !== deviceId);
    job.linkedDevice = null;
    job.status = "Scheduled";
    job.progress = Math.min(job.progress, 18);
    job.checklist = job.checklist.filter(step => step !== "Gateway identity linked");
    job.checklist.push("Gateway unlinked for rescan");

    audit(snapshot, "Gateway unlinked", deviceId, "Scheduled", `${job.id}. ${input.reason.trim()}`);
    return ok(snapshot, { job });
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

  async createInstaller(input: CreateInstallerInput) {
    const snapshot = draft();
    const name = input.name.trim() || input.fullName.trim();
    if (!name || !input.email.trim()) {
      return failure("invalid_input", "An installer needs a name and an email address.");
    }
    const region = NIGERIAN_REGIONS.find(item => item.value === input.region)?.label ?? capitalise(input.region);
    const cert = capitalise(input.certStatus);
    const installer = {
      id: `INS-NEW-${suffix()}`,
      name,
      region,
      certification: input.certExpiry ? `${cert} until ${input.certExpiry.slice(0, 10)}` : cert,
      capacity: "3 slots",
      phone: input.phone.trim(),
      activeJobs: 0,
      status: "Available"
    };
    snapshot.installers.unshift(installer);
    audit(
      snapshot,
      "Installer added",
      installer.id,
      "Invitation issued",
      `Activation link sent to ${maskEmail(input.email.trim())}`
    );
    return ok(snapshot, { installer });
  },

  async registerDevice(input: RegisterDeviceInput) {
    const snapshot = draft();
    const site = snapshot.sites.find(item => item.id === input.siteId);
    if (!site) return failure("not_found", "That site no longer exists.");

    const serial = input.serialNumber.trim().toUpperCase();
    if (!serial) return failure("invalid_input", "A serial number is required.");
    const duplicate = snapshot.devices.find(item => item.serial.toUpperCase() === serial);
    if (duplicate) {
      return failure(
        "invalid_input",
        `Serial ${serial} is already registered as ${duplicate.id} at ${duplicate.site}.`
      );
    }

    const role = DEVICE_ROLE_LABEL[input.role] ?? capitalise(input.role);
    const cert = DEVICE_CERT_LABEL[input.certStatus] ?? capitalise(input.certStatus);
    const device: Device = {
      id: `GW-R54-NEW-${serial.replace(/[^A-Z0-9]/g, "").slice(-4)}`,
      serial,
      type: role,
      enterprise: site.enterprise,
      enterpriseId: site.enterpriseId,
      site: site.name,
      status: cert,
      heartbeat: `Reports every ${input.transmissionIntervalS}s`,
      firmware: "Not reported",
      jobId: "",
      functions: [{ name: role, source: "Measured", state: cert }],
      lastDiagnostic: input.certExpiry
        ? `Certificate valid until ${input.certExpiry.slice(0, 10)}`
        : "Not run"
    };
    snapshot.devices.unshift(device);
    audit(snapshot, "Device registered", device.id, cert, `${serial} at ${site.name}`);
    return ok(snapshot, { device });
  },

  async unblockJob(input: UnblockJobInput) {
    const snapshot = draft();
    const job = snapshot.jobs.find(item => item.id === input.jobId);
    if (!job) return failure("not_found", "That installation job no longer exists.");
    if (job.status !== "Blocked") {
      return failure("job_not_blocked", "Only a blocked job can be resumed.");
    }

    job.status = job.linkedDevice ? "In progress" : "Scheduled";
    job.blockers = [];
    job.checklist.push("Blocker resolved");
    audit(snapshot, "Installation job unblocked", job.id, job.status, input.resolutionNote.trim());
    return ok(snapshot, { job });
  },

  async getJobDetail(jobId: string): Promise<JobDetail> {
    const job = read().jobs.find(item => item.id === jobId);
    if (!job) throw new Error("That installation job no longer exists.");
    return { checklist: [...job.checklist], notes: [] };
  },

  async recordChecklistItem(input: RecordChecklistItemInput) {
    const snapshot = draft();
    const job = snapshot.jobs.find(item => item.id === input.jobId);
    if (!job) return failure("not_found", "That installation job no longer exists.");
    if (job.status === "Completed") {
      return failure("invalid_input", "A completed job's evidence is append-only history.");
    }
    if (job.checklist.includes(input.item)) {
      return failure("invalid_input", `${input.item} was already recorded for ${job.id}.`);
    }

    job.checklist.push(input.item);
    const recorded = STAFF_CHECKLIST.filter(item => job.checklist.includes(item)).length;
    job.progress = Math.max(job.progress, recorded * 25);
    if (recorded === STAFF_CHECKLIST.length && job.status !== "Blocked") {
      job.status = "Ready for acceptance";
    }

    audit(snapshot, "Commissioning evidence recorded", job.id, input.item, `${recorded} of ${STAFF_CHECKLIST.length} staff items recorded`);
    return ok(snapshot, { checklistItem: { item: input.item, recordedAt: operationalTimestamp() } });
  },

  async setSiteLifecycle(input: SetSiteLifecycleInput) {
    const snapshot = draft();
    const site = snapshot.sites.find(item => item.id === input.siteId);
    if (!site) return failure("not_found", "That site no longer exists.");

    const target = input.status === "active" ? "Active" : "Decommissioned";
    const legal =
      (site.status === "Provisioned" && (target === "Active" || target === "Decommissioned")) ||
      (site.status === "Active" && target === "Decommissioned");
    if (!legal) {
      return failure(
        "invalid_input",
        `A ${String(site.status).toLowerCase()} site cannot move to ${target.toLowerCase()}.`
      );
    }

    const enterprise = snapshot.enterprises.find(item => item.id === site.enterpriseId);
    if (enterprise) {
      if (target === "Active") enterprise.liveSites = Math.min(enterprise.sites, enterprise.liveSites + 1);
      if (site.status === "Active" && target === "Decommissioned") {
        enterprise.liveSites = Math.max(0, enterprise.liveSites - 1);
      }
      enterprise.lastActivity = "Just now";
    }
    site.status = target;

    audit(snapshot, `Site ${target.toLowerCase()}`, site.id, target, input.reason.trim());
    return ok(snapshot, { site });
  },

  async listNotifications(): Promise<NotificationList> {
    const items = notificationsFrom(read());
    return { items, unreadCount: items.filter(item => !item.read).length };
  },

  async markNotificationRead(id: string) {
    const known = notificationsFrom(read()).some(item => item.id === id);
    if (!known) return failure("not_found", "That notification is no longer in the inbox.");
    readNotifications.add(id);
    return { ok: true as const };
  },

  async unreadNotificationCount() {
    return notificationsFrom(read()).filter(item => !item.read).length;
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
    const role = STAFF_ROLES.find(item => item.value === input.role);
    if (!role) return failure("invalid_input", "Select one of the four Rana54 staff roles.");
    if (!input.reason.trim()) return failure("invalid_input", "An access reason is required.");
    const email = input.email.trim();
    if (snapshot.staff.some(item => item.email === maskEmail(email))) {
      return failure("invalid_input", "A staff account with this email already exists.");
    }

    const id = `STF-${role.label.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-3)}`;
    const staff = {
      id,
      name: input.name.trim(),
      email: maskEmail(email),
      role: role.label,
      roleKey: role.value,
      scope: role.scope,
      status: "Invited",
      lastAccess: "Never",
      privileged: role.privileged
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
      isPlatformOperator(person) &&
      person.status === "Active" &&
      snapshot.staff.filter(item => isPlatformOperator(item) && item.status === "Active")
        .length === 1;

    if (isFinalPlatformOperator) {
      return failure(
        "final_platform_operator",
        "Activate another Platform Operator before suspending this final platform-wide operator."
      );
    }

    person.status = input.transition === "Suspend" ? "Suspended" : "Active";

    // Suspension revokes the member's active support grants in the same step.
    if (person.status === "Suspended") {
      snapshot.supportGrants
        .filter(
          grant =>
            (grant.staffId === person.id || grant.staff === person.name) &&
            grant.status === "Active"
        )
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
      return failure("not_found", "Select a support analyst and an enterprise.");
    }
    // Only a support analyst works through grants; every other role already
    // reaches every tenant through its standing platform access.
    if (!isSupportAnalyst(staff)) {
      return failure(
        "invalid_input",
        `Only a Support Analyst can hold a support grant; this staff member is a ${staffRoleLabel(staff.roleKey ?? staff.role)}.`
      );
    }
    if (staff.status === "Suspended") {
      return failure(
        "staff_suspended",
        "This staff member is suspended. Restore their access before granting support access."
      );
    }
    if (enterprise.status === "Suspended") {
      return failure(
        "enterprise_suspended",
        "This enterprise is suspended, so support access into it cannot be granted until it is restored."
      );
    }

    const expires = operationalTimestamp(new Date(Date.now() + input.duration * 3600000));
    const grant = {
      id: `GRANT-${suffix()}`,
      staff: staff.name,
      enterprise: enterprise.name,
      mode: "Read only",
      expires,
      reason: input.reason.trim(),
      status: "Active",
      staffId: staff.id,
      enterpriseId: enterprise.id,
      granted: operationalTimestamp()
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

  async revokeSupportGrant(input: RevokeSupportGrantInput) {
    const snapshot = draft();
    const grant = snapshot.supportGrants.find(item => item.id === input.id);
    if (!grant) return failure("not_found", "That support grant no longer exists.");
    if (grant.status === "Revoked") {
      return failure("support_grant_already_revoked", "This support grant was already revoked.");
    }
    if (grant.status === "Expired") {
      return failure(
        "support_grant_expired",
        "This support grant already expired on its own, so there is nothing to revoke."
      );
    }

    grant.status = "Revoked";
    audit(snapshot, "Tenant support access revoked", grant.id, "Revoked", input.reason.trim());
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
    const staffByRole: Record<string, number> = {};
    snapshot.staff
      .filter(item => item.status !== "Suspended")
      .forEach(item => {
        staffByRole[item.role] = (staffByRole[item.role] ?? 0) + 1;
      });
    const review = {
      id: `REV-${suffix()}`,
      at: operationalTimestamp(),
      reviewer: snapshot.currentOperator.name,
      staffByRole,
      privilegedCount: snapshot.staff.filter(item => item.privileged && item.status === "Active")
        .length,
      activeSupportGrants: snapshot.supportGrants.filter(item => item.status === "Active").length
    };
    snapshot.accessReviews.unshift(review);
    audit(
      snapshot,
      "Privileged access review completed",
      review.id,
      "Recorded",
      `${review.privilegedCount} privileged staff and ${review.activeSupportGrants} active support grants attested`
    );
    return ok(snapshot, { review });
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
