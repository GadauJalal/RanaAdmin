/**
 * Live backend adapter for the Network Operations console.
 *
 * Talks to the real Rana54 API through the same-origin proxy at /api. The
 * operational picture is assembled from the platform-wide list endpoints
 * (`GET /organisations`, `/sites`, `/devices`, `/jobs`, `/site-requests`,
 * `/audit`) plus the operator (`GET /me`), every platform user
 * (`GET /admin/users`), the installer roster (`GET /installers`) and API
 * health (`GET /health`). Each list is read independently and tolerantly, so a
 * missing permission or an older backend empties one collection instead of
 * failing the whole console.
 *
 * Writes call the real workflow endpoints: create an enterprise and provision
 * its first administrator (whose one-time temporary password is surfaced once
 * and never persisted), provision a site, decide a site request, create,
 * reassign, link and accept jobs, and suspend or restore staff and installers.
 * Operations the backend does not model yet (incidents, enterprise suspension,
 * support grants, diagnostics) are refused with a plain message.
 *
 * See docs/BACKEND_INTEGRATION_STATUS.md for the remaining gap list.
 */

import { operationalTimestamp } from "@/lib/format";
import type {
  AuditEvent,
  Device,
  Enterprise,
  Incident,
  Installer,
  Job,
  PlatformService,
  PlatformSite,
  SiteRequest,
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
  type CreateSiteInput,
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

/** Page size for the platform lists (the backend caps `limit` at 200). */
const PAGE = 200;

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
  tradingName?: string | null;
  email?: string;
  createdAt?: string;
}

interface BackendSite {
  id: string;
  name: string;
  organisationId: string;
  region: string | null;
  lifecycleStatus: string;
  createdAt?: string;
  address?: string | null;
}

interface BackendDevice {
  id: string;
  siteId: string;
  serialNumber: string;
  role: string;
  transmissionIntervalS: number;
  certStatus: string;
  certExpiry: string | null;
}

interface BackendSiteRequest {
  id: string;
  organisationId: string;
  type: string;
  targetType: string | null;
  targetId: string | null;
  stage: string;
  nextActor: string;
  payload: Record<string, unknown> | null;
  submittedAt: string;
  submittedBy: string;
  closedAt: string | null;
  outcome: "approved" | "returned" | null;
  contactName?: string | null;
  contactPhone?: string | null;
  accessNotes?: string | null;
}

interface BackendAuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  eventType: string;
  entityType: string;
  entityId: string;
  outcome: "succeeded" | "failed" | string;
  source: string;
  payload: Record<string, unknown> | null;
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
  blockers: { reason: string; note?: string | null }[];
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
/* Local memory for what the backend does not store                            */
/* -------------------------------------------------------------------------- */

const ENTERPRISES_KEY = "ranaops.live.enterprises";

/** Temporary passwords live only in memory for this session (shown once). */
const sessionPasswords = new Map<string, string>();

/**
 * The console-side details of an enterprise the backend has no field for
 * (region, products, the first administrator's name and user id). The
 * organisation itself is always read from the backend list.
 */
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
 * A failed request or a shape we do not recognise yields an empty list rather
 * than a crash, so one collection can never take the whole snapshot down.
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

/** "28 Aug 14:32" from an ISO timestamp, or a plain fallback. */
function when(iso: string | null | undefined, fallback = "Not recorded"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : operationalTimestamp(date);
}

function regionLabel(region: string | null | undefined): string {
  return region ? (REGION_LABELS[region] ?? capitalise(region)) : "Unassigned";
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

function mapInstaller(installer: BackendInstaller, jobs: BackendJob[]): Installer {
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
    region: regionLabel(installer.region),
    certification: installer.certExpiry ? `${cert} until ${installer.certExpiry.slice(0, 10)}` : cert,
    capacity: "Not reported",
    phone: installer.phone,
    activeJobs: jobs.filter(job => job.installerId === installer.id && job.status !== "completed")
      .length,
    status
  };
}

const SITE_STATUS: Record<string, string> = {
  provisioned: "Provisioned",
  active: "Active",
  decommissioned: "Decommissioned"
};

function mapSite(site: BackendSite, enterprises: BackendOrganisation[]): PlatformSite {
  return {
    id: site.id,
    name: site.name,
    enterpriseId: site.organisationId,
    enterprise: enterprises.find(item => item.id === site.organisationId)?.name ?? site.organisationId,
    region: regionLabel(site.region),
    status: SITE_STATUS[site.lifecycleStatus] ?? capitalise(site.lifecycleStatus),
    created: when(site.createdAt)
  };
}

/**
 * The backend organisation plus the console-side details remembered when it
 * was created here (region, products, first administrator). Site counts and
 * readiness are derived from the live sites list.
 */
function mapEnterprise(
  org: BackendOrganisation,
  sites: BackendSite[],
  remembered: Enterprise[]
): Enterprise {
  const extra = remembered.find(item => item.id === org.id);
  const orgSites = sites.filter(site => site.organisationId === org.id);
  const liveSites = orgSites.filter(site => site.lifecycleStatus === "active").length;
  const readiness = Math.min(
    100,
    20 + (extra?.adminUserId ? 20 : 0) + (orgSites.length ? 30 : 0) + (liveSites ? 30 : 0)
  );
  const password = sessionPasswords.get(org.id);
  return {
    id: org.id,
    name: org.name,
    region: extra?.region ?? "Nigeria",
    status: liveSites ? "Active" : "Onboarding",
    readiness,
    adminName: extra?.adminName ?? null,
    adminEmail: extra?.adminEmail ?? org.email ?? null,
    products: extra?.products?.length ? extra.products : ["Energy workspace"],
    sites: orgSites.length,
    liveSites,
    lastActivity: when(org.createdAt, "Not reported"),
    adminUserId: extra?.adminUserId,
    ...(password ? { adminTempPassword: password } : null)
  };
}

function mapSiteRequest(
  item: BackendSiteRequest,
  enterprises: BackendOrganisation[],
  users: BackendAdminUser[]
): SiteRequest {
  const payload = item.payload ?? {};
  const functions = Array.isArray(payload.functions) ? payload.functions.map(String) : [];
  const status =
    item.outcome === "approved" ? "Approved" : item.outcome === "returned" ? "Returned" : "Pending review";
  const submitter = users.find(user => user.id === item.submittedBy);
  return {
    id: item.id,
    enterpriseId: item.organisationId,
    enterprise: enterprises.find(org => org.id === item.organisationId)?.name ?? item.organisationId,
    siteName: typeof payload.siteName === "string" && payload.siteName ? payload.siteName : "Unnamed site",
    location: typeof payload.location === "string" ? payload.location : "",
    requestedBy: item.contactName || submitter?.fullName || submitter?.email || "Organisation administrator",
    submitted: when(item.submittedAt),
    status,
    functions
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

interface Lookups {
  enterprises: BackendOrganisation[];
  sites: BackendSite[];
  installers: BackendInstaller[];
  siteRequests: BackendSiteRequest[];
}

function siteNameFor(job: BackendJob, lookups: Lookups): string {
  const site = lookups.sites.find(item => item.id === job.siteId);
  if (site) return site.name;
  const request = lookups.siteRequests.find(item => item.id === job.requestId);
  const name = request?.payload?.siteName;
  return typeof name === "string" && name ? name : "Site pending";
}

function mapJob(job: BackendJob, lookups: Lookups): Job {
  return {
    id: job.id,
    enterpriseId: job.organisationId,
    enterprise:
      lookups.enterprises.find(item => item.id === job.organisationId)?.name ?? job.organisationId,
    siteRequestId: job.requestId,
    site: siteNameFor(job, lookups),
    installerId: job.installerId,
    installer: lookups.installers.find(item => item.id === job.installerId)?.name ?? job.installerId,
    status: JOB_STATUS[job.status] ?? capitalise(job.status),
    scheduled: when(job.scheduledAt, "Unscheduled"),
    progress: JOB_PROGRESS[job.status] ?? 0,
    blockers: job.blockers.map(blocker =>
      blocker.note ? `${capitalise(blocker.reason)}: ${blocker.note}` : capitalise(blocker.reason)
    ),
    checklist: [],
    linkedDevice: job.deviceId
  };
}

const DEVICE_ROLE: Record<string, string> = {
  grid: "Grid meter",
  inverter_output: "Inverter output meter"
};

const DEVICE_STATUS: Record<string, string> = {
  certified: "Certified",
  pending: "Pending certification",
  expired: "Certificate expired",
  uncertified: "Uncertified"
};

function mapDevice(device: BackendDevice, lookups: Lookups, jobs: BackendJob[]): Device {
  const site = lookups.sites.find(item => item.id === device.siteId);
  const enterprise = lookups.enterprises.find(item => item.id === site?.organisationId);
  const job = jobs.find(item => item.deviceId === device.id);
  const role = DEVICE_ROLE[device.role] ?? capitalise(device.role);
  return {
    id: device.id,
    serial: device.serialNumber,
    type: role,
    enterprise: enterprise?.name ?? site?.organisationId ?? "Unknown enterprise",
    enterpriseId: site?.organisationId ?? "",
    site: site?.name ?? device.siteId,
    status: DEVICE_STATUS[device.certStatus] ?? capitalise(device.certStatus),
    heartbeat: device.transmissionIntervalS
      ? `Reports every ${device.transmissionIntervalS}s`
      : "Not reported",
    firmware: "Not reported",
    jobId: job?.id ?? "",
    functions: [{ name: role, source: "Measured", state: capitalise(device.certStatus) }],
    lastDiagnostic: device.certExpiry
      ? `Certificate valid until ${device.certExpiry.slice(0, 10)}`
      : "Not run"
  };
}

function mapAudit(entry: BackendAuditEntry): AuditEvent {
  const payload = entry.payload ?? {};
  const reason = typeof payload.reason === "string" ? payload.reason : "";
  return {
    id: entry.id,
    time: when(entry.at),
    actor: entry.actorName || entry.actorId,
    action: capitalise(entry.eventType),
    entity: `${capitalise(entry.entityType)} ${entry.entityId}`,
    outcome: capitalise(entry.outcome),
    reason
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
  const [me, users, installers, health, organisations, sites, devices, jobs, siteRequests, audit] =
    await Promise.all([
      request<BackendIdentity>("/me"),
      request<unknown>("/admin/users"),
      request<unknown>(`/installers?limit=${PAGE}`),
      request<BackendHealth>("/health"),
      request<unknown>(`/organisations?limit=${PAGE}`),
      request<unknown>(`/sites?limit=${PAGE}`),
      request<unknown>(`/devices?limit=${PAGE}`),
      request<unknown>(`/jobs?limit=${PAGE}`),
      request<unknown>(`/site-requests?limit=${PAGE}`),
      request<unknown>(`/audit?limit=${PAGE}`)
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

  const orgRows = asList<BackendOrganisation>(organisations, "organisations");
  const siteRows = asList<BackendSite>(sites, "sites");
  const deviceRows = asList<BackendDevice>(devices, "devices");
  const jobRows = asList<BackendJob>(jobs, "jobs");
  const requestRows = asList<BackendSiteRequest>(siteRequests, "siteRequests");
  const auditRows = asList<BackendAuditEntry>(audit, "entries");
  const userRows = asList<BackendAdminUser>(users, "users");
  const installerRows = asList<BackendInstaller>(installers, "installers");

  // Enterprises this console created but the list did not return (an older
  // backend, or beyond the first page) are still shown from local memory.
  const remembered = storedEnterprises();
  const listed = new Set(orgRows.map(org => org.id));
  const allOrgs: BackendOrganisation[] = [
    ...orgRows,
    ...remembered
      .filter(item => !listed.has(item.id))
      .map(item => ({ id: item.id, name: item.name, email: item.adminEmail ?? undefined }))
  ];

  const lookups: Lookups = {
    enterprises: allOrgs,
    sites: siteRows,
    installers: installerRows,
    siteRequests: requestRows
  };

  return {
    currentOperator,
    enterprises: allOrgs.map(org => mapEnterprise(org, siteRows, remembered)),
    sites: siteRows.map(site => mapSite(site, allOrgs)),
    siteRequests: requestRows.map(item => mapSiteRequest(item, allOrgs, userRows)),
    installers: installerRows.map(installer => mapInstaller(installer, jobRows)),
    jobs: jobRows.map(job => mapJob(job, lookups)),
    devices: deviceRows.map(device => mapDevice(device, lookups, jobRows)),
    incidents: [],
    staff: userRows.map(mapStaff),
    supportGrants: [],
    services: mapHealth(health.ok ? health.body : null),
    audit: auditRows.map(mapAudit)
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

/** Find the job in a freshly built snapshot, falling back to a direct mapping. */
function jobFromSnapshot(snapshot: Snapshot, job: BackendJob): Job {
  return (
    snapshot.jobs.find(item => item.id === job.id) ??
    mapJob(job, { enterprises: [], sites: [], installers: [], siteRequests: [] })
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
      readiness: 20,
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

    const snapshot = await buildSnapshot();
    const listed = snapshot.enterprises.find(item => item.id === enterprise.id);
    return { ok: true, snapshot, data: { enterprise: listed ?? enterprise } };
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

  /** Approve or return a site request. Approval is what creates the site. */
  async decideSiteRequest({ id, decision, reason }: SiteDecisionInput) {
    const result = await post<unknown>(`/site-requests/${encodeURIComponent(id)}/decision`, {
      decision: decision.toLowerCase(),
      reason
    });
    if (!result.ok) return toFailure(result);
    return ok(undefined);
  },

  /** Provision a site directly for an enterprise (POST /admin/sites). */
  async createSite(input: CreateSiteInput) {
    const result = await post<BackendSite | { site: BackendSite }>("/admin/sites", {
      organisationId: input.enterpriseId,
      name: input.name.trim(),
      address: input.address.trim()
    });
    if (!result.ok) return toFailure(result);

    const body = result.body as { site?: BackendSite } & Partial<BackendSite>;
    const created = body.site ?? (body as BackendSite);
    const snapshot = await buildSnapshot();
    const site =
      snapshot.sites.find(item => item.id === created.id) ??
      ({
        id: created.id ?? "",
        name: created.name ?? input.name.trim(),
        enterpriseId: input.enterpriseId,
        enterprise:
          snapshot.enterprises.find(item => item.id === input.enterpriseId)?.name ?? input.enterpriseId,
        region: regionLabel(created.region),
        status: SITE_STATUS[created.lifecycleStatus ?? "provisioned"] ?? "Provisioned",
        created: "Just now"
      } satisfies PlatformSite);
    return { ok: true, snapshot, data: { site } };
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
    return { ok: true, snapshot, data: { job: jobFromSnapshot(snapshot, result.body.job) } };
  },

  async reassignJob({ id, installerId, reason }: ReassignJobInput) {
    const result = await post<{ job: BackendJob }>(`/jobs/${encodeURIComponent(id)}/assignment`, {
      installerId,
      reason
    });
    if (!result.ok) return toFailure(result);
    const snapshot = await buildSnapshot();
    return { ok: true, snapshot, data: { job: jobFromSnapshot(snapshot, result.body.job) } };
  },

  async linkGateway({ jobId, serial, reason }: LinkGatewayInput) {
    const result = await post<{ job: BackendJob }>(`/jobs/${encodeURIComponent(jobId)}/gateway-link`, {
      serial,
      reason
    });
    if (!result.ok) return toFailure(result, await buildSnapshot());
    const job = result.body.job;
    const snapshot = await buildSnapshot();
    const device: Device = snapshot.devices.find(item => item.id === job.deviceId) ?? {
      id: job.deviceId ?? serial,
      serial,
      type: "Gateway",
      enterprise: snapshot.enterprises.find(item => item.id === job.organisationId)?.name ?? job.organisationId,
      enterpriseId: job.organisationId,
      site: snapshot.sites.find(item => item.id === job.siteId)?.name ?? "Site pending",
      status: "Testing",
      heartbeat: "Awaiting first reading",
      firmware: "Not reported",
      jobId: job.id,
      functions: [],
      lastDiagnostic: "Not run"
    };
    return { ok: true, snapshot, data: { device } satisfies LinkGatewayResult };
  },

  async acceptInstallation({ jobId, reason }: AcceptInstallationInput) {
    const result = await post<{ job: BackendJob }>(`/jobs/${encodeURIComponent(jobId)}/acceptance`, { reason });
    if (!result.ok) return toFailure(result);
    const snapshot = await buildSnapshot();
    return { ok: true, snapshot, data: { job: jobFromSnapshot(snapshot, result.body.job) } };
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
