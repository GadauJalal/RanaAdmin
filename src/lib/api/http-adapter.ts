/**
 * Live backend adapter for the Network Operations console.
 *
 * Talks to the real Rana54 API through the same-origin proxy at /api. The
 * backend is single-tenant and id-addressed: it has no platform-wide snapshot
 * and no list endpoints for enterprises, jobs, site requests, devices or
 * incidents. So this adapter:
 *
 *   - assembles the snapshot from what does exist: the operator (GET /me),
 *     every platform user (GET /admin/users), the installer roster
 *     (GET /installers) and API health (GET /health);
 *   - remembers the enterprises this console creates (locally) and re-hydrates
 *     each from GET /organisations/{id} on load, since they cannot be listed;
 *   - performs the real create/transition flows that have endpoints, including
 *     provisioning an enterprise's first administrator, whose one-time
 *     temporary password is surfaced once and never persisted;
 *   - refuses, with a plain message, the operations the backend does not model
 *     yet (incidents, enterprise suspension, support grants, diagnostics).
 *
 * See docs/BACKEND_INTEGRATION_STATUS.md for the full gap list.
 */

import type {
  Device,
  Enterprise,
  Incident,
  Installer,
  Job,
  PlatformService,
  Snapshot,
  StaffMember,
  SupportGrant
} from "@/lib/types";

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
  type FailureCode,
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
import { clearSession, getAccessToken, getRefreshToken, redirectToLogin, setTokens } from "./session";

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

/* -------------------------------------------------------------------------- */
/* Backend wire shapes (only what this adapter reads)                          */
/* -------------------------------------------------------------------------- */

interface BackendIdentity {
  user: { id: string; email: string; fullName: string | null; role: string };
  permissions?: { roleLabel?: string; scopeDescription?: string };
}

interface BackendAdminUser {
  id: string;
  email: string;
  fullName: string | null;
  status: "pending_activation" | "active" | "suspended" | string;
  createdAt: string;
}

interface BackendInstaller {
  id: string;
  userId: string;
  name: string;
  region: string | null;
  certStatus: string;
  certExpiry: string | null;
  phone: string;
  status: "available" | "on_job" | "suspended" | string;
}

interface BackendOrganisation {
  id: string;
  name: string;
}

interface BackendOrgHeader {
  organisationId: string;
  name: string;
  accessibleSiteCount: number;
}

interface BackendProvisionedUser {
  user: { id: string; email: string; fullName: string | null; status: string };
  tempPassword: string;
}

interface BackendJob {
  id: string;
  requestId: string;
  organisationId: string;
  siteId: string | null;
  installerId: string;
  status: string;
  scheduledAt: string | null;
  note: string | null;
  deviceId: string | null;
  blockers: { reason: string }[];
}

interface BackendHealth {
  status: string;
  info?: Record<string, { status: string }>;
}

interface ErrorEnvelope {
  statusCode?: number;
  code?: string;
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* HTTP                                                                        */
/* -------------------------------------------------------------------------- */

type RequestOutcome<T> =
  | { ok: true; body: T; status: number }
  | { ok: false; status: number; code: string; message: string };

let refreshInFlight: Promise<boolean> | null = null;

/** Rotate the token pair once; concurrent 401s share one refresh. */
function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store"
      });
      if (!response.ok) return false;
      const pair = (await response.json()) as { accessToken?: string; refreshToken?: string };
      if (!pair.accessToken || !pair.refreshToken) return false;
      setTokens({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function fetchOnce(path: string, init: RequestInit): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : null),
      ...(token ? { Authorization: `Bearer ${token}` } : null),
      ...(init.headers ?? {})
    }
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<RequestOutcome<T>> {
  try {
    let response = await fetchOnce(path, init);

    // An expired access token: rotate once and replay. Auth routes are exempt.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      if (await refreshSession()) response = await fetchOnce(path, init);
      if (response.status === 401) {
        clearSession();
        redirectToLogin();
      }
    }

    const text = await response.text();
    const body = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      const error = (body ?? {}) as ErrorEnvelope;
      return {
        ok: false,
        status: response.status,
        code: error.code ?? "server_error",
        message:
          response.status === 429
            ? "Too many requests. Please wait a moment and try again."
            : (error.message ?? `The backend returned ${response.status}.`)
      };
    }
    return { ok: true, body: body as T, status: response.status };
  } catch (error) {
    console.error("Rana54 API request failed", error);
    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: "The Rana54 backend could not be reached. No change was recorded."
    };
  }
}

function post<T>(path: string, payload?: unknown) {
  return request<T>(path, { method: "POST", body: payload === undefined ? undefined : JSON.stringify(payload) });
}

/** Map a backend rejection to the console's failure vocabulary. */
function toFailure(outcome: { status: number; code: string; message: string }, snapshot?: Snapshot) {
  const known: FailureCode[] = [
    "site_not_approved",
    "duplicate_gateway_identity",
    "installer_has_active_jobs",
    "job_not_ready_for_acceptance"
  ];
  const text = `${outcome.code} ${outcome.message}`;
  const matched = known.find(code => text.includes(code));
  const code: FailureCode = matched
    ? matched
    : outcome.status === 404
      ? "not_found"
      : outcome.status === 400 || outcome.status === 409
        ? "invalid_input"
        : outcome.code === "network_error"
          ? "network_error"
          : "server_error";
  return failure(code, outcome.message, snapshot);
}

/* -------------------------------------------------------------------------- */
/* Local memory for records the backend cannot list                            */
/* -------------------------------------------------------------------------- */

const ENTERPRISES_KEY = "ranaops.live.enterprises";

/** Temporary passwords live only in memory for this session (shown once). */
const sessionPasswords = new Map<string, string>();

function storedEnterprises(): Enterprise[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ENTERPRISES_KEY);
    return raw ? (JSON.parse(raw) as Enterprise[]) : [];
  } catch {
    return [];
  }
}

function storeEnterprises(list: Enterprise[]) {
  if (typeof window === "undefined") return;
  try {
    // Never persist the temporary password.
    const safe = list.map(({ adminTempPassword: _omit, ...rest }) => rest);
    window.localStorage.setItem(ENTERPRISES_KEY, JSON.stringify(safe));
  } catch {
    /* Storage unavailable: the record survives for this session only. */
  }
}

function rememberEnterprise(enterprise: Enterprise) {
  const rest = storedEnterprises().filter(item => item.id !== enterprise.id);
  storeEnterprises([enterprise, ...rest]);
}

/**
 * Read a list out of a response whether the backend sends a bare array or a
 * paginated envelope such as { installers: [...], total } or { items: [...] }.
 * A shape we do not recognise yields an empty list rather than a crash, so one
 * collection can never take the whole snapshot down.
 */
function asList<T>(outcome: RequestOutcome<unknown>, ...keys: string[]): T[] {
  if (!outcome.ok) return [];
  const body = outcome.body;
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    for (const key of [...keys, "items", "data", "results", "rows"]) {
      const value = (body as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
    console.warn("Unrecognised list shape from the backend", Object.keys(body as object));
  }
  return [];
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                     */
/* -------------------------------------------------------------------------- */

const REGION_LABELS: Record<string, string> = {
  north_central: "North Central",
  north_east: "North East",
  north_west: "North West",
  south_east: "South East",
  south_south: "South South",
  south_west: "South West"
};

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ") : value;
}

function mapStaff(user: BackendAdminUser): StaffMember {
  const status =
    user.status === "suspended" ? "Suspended" : user.status === "active" ? "Active" : "Invited";
  return {
    id: user.id,
    name: user.fullName || user.email,
    email: user.email,
    // Roles live on grants and are not part of the platform user list.
    role: "Platform user",
    scope: "Rana54 platform",
    status,
    lastAccess: "Not reported",
    privileged: false
  };
}

function mapInstaller(installer: BackendInstaller): Installer {
  const status =
    installer.status === "on_job"
      ? "On job"
      : installer.status === "suspended"
        ? "Suspended"
        : "Available";
  const cert = capitalise(installer.certStatus || "unknown");
  return {
    id: installer.id,
    name: installer.name,
    region: installer.region ? (REGION_LABELS[installer.region] ?? installer.region) : "Unassigned",
    certification: installer.certExpiry ? `${cert} until ${installer.certExpiry.slice(0, 10)}` : cert,
    capacity: "Not reported",
    phone: installer.phone,
    activeJobs: 0,
    status
  };
}

const JOB_STATUS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  awaiting_site_approval: "Awaiting site approval",
  blocked: "Blocked",
  ready_for_acceptance: "Ready for acceptance",
  completed: "Completed"
};

const JOB_PROGRESS: Record<string, number> = {
  scheduled: 10,
  in_progress: 45,
  blocked: 45,
  ready_for_acceptance: 85,
  completed: 100
};

function mapJob(job: BackendJob, installers: Installer[], enterprises: Enterprise[]): Job {
  return {
    id: job.id,
    enterpriseId: job.organisationId,
    enterprise: enterprises.find(item => item.id === job.organisationId)?.name ?? job.organisationId,
    siteRequestId: job.requestId,
    site: job.siteId ?? "Site pending",
    installerId: job.installerId,
    installer: installers.find(item => item.id === job.installerId)?.name ?? job.installerId,
    status: JOB_STATUS[job.status] ?? capitalise(job.status),
    scheduled: job.scheduledAt ?? "Unscheduled",
    progress: JOB_PROGRESS[job.status] ?? 0,
    blockers: job.blockers.map(blocker => blocker.reason),
    checklist: [],
    linkedDevice: job.deviceId
  };
}

function mapHealth(health: BackendHealth | null): PlatformService[] {
  if (!health) {
    return [
      {
        id: "SVC-API",
        name: "Rana54 API",
        status: "Degraded",
        metric: "Unknown",
        detail: "Health endpoint did not respond"
      }
    ];
  }
  const database = health.info?.database?.status ?? "unknown";
  return [
    {
      id: "SVC-API",
      name: "Rana54 API",
      status: health.status === "ok" ? "Operational" : "Degraded",
      metric: health.status === "ok" ? "Up" : "Down",
      detail: `Database ${database}`
    }
  ];
}

/* -------------------------------------------------------------------------- */
/* Snapshot assembly                                                           */
/* -------------------------------------------------------------------------- */

const EMPTY_OPERATOR = { name: "Operator", scope: "Rana54 platform", permission: "Platform access" };

async function buildSnapshot(): Promise<Snapshot> {
  const [me, users, installers, health] = await Promise.all([
    request<BackendIdentity>("/me"),
    request<BackendAdminUser[]>("/admin/users"),
    request<BackendInstaller[]>("/installers?limit=200"),
    request<BackendHealth>("/health")
  ]);

  if (!me.ok && me.status === 401) {
    throw new Error("Sign in to load the operational picture.");
  }

  const currentOperator = me.ok
    ? {
        name: me.body.user.fullName || me.body.user.email,
        scope: me.body.permissions?.scopeDescription || "Rana54 platform",
        permission: me.body.permissions?.roleLabel || "Platform administrator"
      }
    : EMPTY_OPERATOR;

  // Enterprises cannot be listed; re-hydrate the ones this console created.
  const remembered = storedEnterprises();
  const enterprises = await Promise.all(
    remembered.map(async enterprise => {
      const header = await request<BackendOrgHeader>(`/organisations/${encodeURIComponent(enterprise.id)}`);
      const refreshed: Enterprise = header.ok
        ? { ...enterprise, name: header.body.name, sites: header.body.accessibleSiteCount }
        : enterprise;
      const password = sessionPasswords.get(enterprise.id);
      return password ? { ...refreshed, adminTempPassword: password } : refreshed;
    })
  );

  return {
    currentOperator,
    enterprises,
    siteRequests: [],
    installers: asList<BackendInstaller>(installers, "installers").map(mapInstaller),
    jobs: [],
    devices: [],
    incidents: [],
    staff: asList<BackendAdminUser>(users, "users").map(mapStaff),
    supportGrants: [],
    services: mapHealth(health.ok ? health.body : null),
    audit: []
  };
}

async function ok<T>(data: T): Promise<ApiResult<T>> {
  return { ok: true, snapshot: await buildSnapshot(), data };
}

function notAvailable<T>(what: string): Promise<ApiResult<T>> {
  return Promise.resolve(
    failure("server_error", `${what} is not available on the backend yet.`)
  );
}

/* -------------------------------------------------------------------------- */
/* The adapter                                                                 */
/* -------------------------------------------------------------------------- */

export const httpAdapter: OperationsApi = {
  async getSnapshot() {
    return buildSnapshot();
  },

  async resetSnapshot() {
    // Seeded state is a prototype concept; against the backend re-read the picture.
    return buildSnapshot();
  },

  /**
   * Create the organisation, then provision its first administrator. The
   * backend returns that administrator's temporary password exactly once;
   * it is attached to the returned enterprise for this session only.
   */
  async createEnterprise(input: CreateEnterpriseInput) {
    const created = await post<BackendOrganisation>("/admin/organisations", {
      name: input.name.trim(),
      email: input.adminEmail.trim(),
      phone: input.phone?.trim() || undefined
    });
    if (!created.ok) return toFailure(created);

    const enterprise: Enterprise = {
      id: created.body.id,
      name: created.body.name,
      region: input.region,
      status: input.status || "Onboarding",
      readiness: input.status === "Active" ? 35 : 18,
      adminName: input.adminName.trim(),
      adminEmail: input.adminEmail.trim(),
      products: input.products.length ? input.products : ["Energy workspace"],
      sites: 0,
      liveSites: 0,
      lastActivity: "Just now"
    };
    rememberEnterprise(enterprise);

    const provisioned = await post<BackendProvisionedUser>("/admin/users", {
      email: input.adminEmail.trim(),
      fullName: input.adminName.trim(),
      role: "super_admin",
      scopeType: "organisation",
      scopeId: enterprise.id
    });
    if (!provisioned.ok) {
      return toFailure(
        {
          ...provisioned,
          message: `The enterprise was created, but its administrator could not be provisioned: ${provisioned.message}`
        },
        await buildSnapshot()
      );
    }

    enterprise.adminUserId = provisioned.body.user.id;
    enterprise.adminTempPassword = provisioned.body.tempPassword;
    sessionPasswords.set(enterprise.id, provisioned.body.tempPassword);
    rememberEnterprise(enterprise);
    return ok({ enterprise });
  },

  transitionEnterprise(_input: EnterpriseTransitionInput) {
    return notAvailable<{ enterprise: Enterprise }>("Suspending or reactivating an enterprise");
  },

  async reissueAdminInvite({ id }: ReissueAdminInviteInput) {
    const enterprise = storedEnterprises().find(item => item.id === id);
    if (!enterprise?.adminUserId) {
      return failure("not_found", "This enterprise's administrator was not provisioned from this console.");
    }
    const sent = await post<void>(`/admin/users/${encodeURIComponent(enterprise.adminUserId)}/invite`);
    if (!sent.ok) return toFailure(sent);
    return ok({ enterprise });
  },

  async decideSiteRequest({ id, decision, reason }: SiteDecisionInput) {
    const result = await post<unknown>(`/site-requests/${encodeURIComponent(id)}/decision`, {
      decision: decision.toLowerCase(),
      reason
    });
    if (!result.ok) return toFailure(result);
    return ok(undefined);
  },

  async createJob(input: CreateJobInput) {
    const scheduledAt =
      input.date && input.time
        ? new Date(`${input.date}T${input.time}`).toISOString()
        : input.date
          ? new Date(input.date).toISOString()
          : undefined;
    const result = await post<{ job: BackendJob }>("/jobs", {
      requestId: input.requestId,
      installerId: input.installerId,
      scheduledAt,
      note: input.note || undefined
    });
    if (!result.ok) return toFailure(result);
    const snapshot = await buildSnapshot();
    return { ok: true, snapshot, data: { job: mapJob(result.body.job, snapshot.installers, snapshot.enterprises) } };
  },

  async reassignJob({ id, installerId, reason }: ReassignJobInput) {
    const result = await post<{ job: BackendJob }>(`/jobs/${encodeURIComponent(id)}/assignment`, {
      installerId,
      reason
    });
    if (!result.ok) return toFailure(result);
    const snapshot = await buildSnapshot();
    return { ok: true, snapshot, data: { job: mapJob(result.body.job, snapshot.installers, snapshot.enterprises) } };
  },

  async linkGateway({ jobId, serial, reason }: LinkGatewayInput) {
    const result = await post<{ job: BackendJob }>(`/jobs/${encodeURIComponent(jobId)}/gateway-link`, {
      serial,
      reason
    });
    if (!result.ok) return toFailure(result, await buildSnapshot());
    const job = result.body.job;
    const device: Device = {
      id: job.deviceId ?? serial,
      serial,
      type: "Gateway",
      enterprise: job.organisationId,
      enterpriseId: job.organisationId,
      site: job.siteId ?? "Site pending",
      status: "Testing",
      heartbeat: "Awaiting first reading",
      firmware: "Not reported",
      jobId: job.id,
      functions: [],
      lastDiagnostic: "Not run"
    };
    return ok<LinkGatewayResult>({ device });
  },

  async acceptInstallation({ jobId, reason }: AcceptInstallationInput) {
    const result = await post<{ job: BackendJob }>(`/jobs/${encodeURIComponent(jobId)}/acceptance`, { reason });
    if (!result.ok) return toFailure(result);
    const snapshot = await buildSnapshot();
    return { ok: true, snapshot, data: { job: mapJob(result.body.job, snapshot.installers, snapshot.enterprises) } };
  },

  async transitionInstaller({ id, transition, reason }: InstallerTransitionInput) {
    const result = await post<unknown>(`/installers/${encodeURIComponent(id)}/transitions`, {
      transition: transition === "Restore" ? "Reactivate" : "Suspend",
      reason
    });
    if (!result.ok) return toFailure(result);
    return ok(undefined);
  },

  createIncident(_input: CreateIncidentInput) {
    return notAvailable<{ incident: Incident }>("The incidents subsystem");
  },

  transitionIncident(_input: IncidentTransitionInput) {
    return notAvailable<{ incident: Incident }>("The incidents subsystem");
  },

  /** Platform staff are provisioned as platform admins; the temp password is returned once. */
  async inviteStaff(input: InviteStaffInput) {
    const result = await post<BackendProvisionedUser>("/admin/users", {
      email: input.email.trim(),
      fullName: input.name.trim(),
      role: "admin",
      scopeType: "platform"
    });
    if (!result.ok) return toFailure(result);
    const staff: StaffMember = {
      id: result.body.user.id,
      name: input.name.trim(),
      email: input.email.trim(),
      role: input.role,
      scope: input.scope,
      status: "Invited",
      lastAccess: "Never",
      privileged: true,
      tempPassword: result.body.tempPassword
    };
    return ok({ staff });
  },

  async transitionStaff({ id, transition }: StaffTransitionInput) {
    const action = transition === "Restore" ? "unsuspend" : "suspend";
    const result = await post<unknown>(`/admin/users/${encodeURIComponent(id)}/${action}`);
    if (!result.ok) return toFailure(result);
    return ok(undefined);
  },

  createSupportGrant(_input: CreateSupportGrantInput) {
    // A platform admin's grants are platform-scoped and single-role, so a
    // time-limited organisation-scoped support grant cannot be expressed yet.
    return notAvailable<{ grant: SupportGrant }>("Time-limited support access");
  },

  runDeviceDiagnostic(_id: string) {
    return notAvailable<{ device: Device }>("Device diagnostics");
  },

  async runServiceCheck(_id: string) {
    // Re-reads GET /health as part of rebuilding the snapshot.
    return ok(undefined);
  },

  async completeAccessReview() {
    return ok(undefined);
  },

  async recordExport(_kind: ExportKind) {
    return ok(undefined);
  }
};
