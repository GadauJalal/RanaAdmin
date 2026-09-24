/**
 * Live backend adapter for the Network Operations console.
 *
 * Talks to the real Rana54 API through the same-origin proxy at /api. The
 * operational picture is assembled from the platform-wide list endpoints
 * (`GET /organisations`, `/sites`, `/devices`, `/jobs`, `/site-requests`,
 * `/audit`) plus the operator (`GET /me`), the Rana54 staff roster
 * (`GET /staff`, falling back to `GET /admin/users` on an older backend),
 * support grants (`GET /support-grants`), access reviews
 * (`GET /access-reviews`), the installer roster (`GET /installers`) and API
 * health (`GET /health`). Each list is read independently and tolerantly, so a
 * missing permission or an older backend empties one collection instead of
 * failing the whole console.
 *
 * Writes call the real workflow endpoints: create an enterprise (which invites
 * its first administrator by activation email in the same call) and resend
 * that invitation, suspend or restore an enterprise, provision a site and
 * move it through its lifecycle, register a device, decide a site request,
 * onboard installers, create, reassign, link, unblock, evidence and accept
 * jobs, invite, suspend or restore staff and installers, issue and revoke
 * time-limited support grants, record an access review, and read or clear the
 * operator's notification inbox. Operations the backend does not model yet
 * (incidents, diagnostics) are refused with a plain message.
 *
 * See docs/BACKEND_INTEGRATION_STATUS.md for the remaining gap list.
 */

import { operationalTimestamp } from "@/lib/format";
import type {
  AccessReview,
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
  type EnterpriseAdmin,
  type EnterpriseTransitionInput,
  type ExportKind,
  type FailureCode,
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
  /** Derived by the backend on every read; absent on an older backend. */
  status?: "suspended" | "onboarding" | "active" | string;
  suspendedAt?: string | null;
  /** POST /admin/organisations only: the first administrator invited by the same call. */
  adminUserId?: string;
}

/** GET /organisations/{orgId}/users row: an organisation's own staff member. */
interface BackendOrgUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: "pending_activation" | "active" | "suspended" | string;
  scopes?: { scopeType: string; scopeId?: string | null }[];
  scopeLabel?: string;
}

/** GET /staff row: the Rana54 roster, with the wire role and derived scope. */
interface BackendStaff {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  scope: "All tenants" | "Assigned tenants" | string;
  status: "Active" | "Invited" | "Suspended" | string;
  lastAccess: string | null;
  privileged: boolean;
}

interface BackendSupportGrant {
  id: string;
  staffId: string | null;
  staffName: string | null;
  organisationId: string;
  organisationName: string | null;
  mode: "Read only" | string;
  status: "Active" | "Expired" | "Revoked" | string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

interface BackendAccessReview {
  id: string;
  at: string;
  reviewerId: string;
  reviewerName: string;
  snapshot: {
    staffByRole: Record<string, number>;
    privilegedCount: number;
    activeSupportGrants: number;
  };
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

interface BackendChecklistItem {
  item: string;
  recordedAt: string;
  recordedBy: string;
}

interface BackendJobNote {
  text: string;
  recordedAt: string;
  recordedBy: string;
}

/** GET /jobs/{id}: the row plus its recorded evidence and field notes. */
interface BackendJobDetail {
  job: BackendJob;
  checklistItems?: BackendChecklistItem[];
  notes?: BackendJobNote[];
}

interface BackendNotification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

interface BackendNotificationList {
  notifications: BackendNotification[];
  total: number;
  unreadCount: number;
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

function patch<T>(path: string, payload: unknown) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(payload) });
}

function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

/**
 * The backend's stable conflict codes (carried in `message`) and the sentence
 * the operator reads for each. A machine string is never shown raw.
 */
const CONFLICT_MESSAGES: Record<string, string> = {
  final_platform_operator:
    "Activate another Platform Operator before suspending this final platform-wide operator.",
  staff_suspended:
    "This staff member is suspended. Restore their access before granting support access.",
  enterprise_suspended:
    "This enterprise is suspended, so support access into it cannot be granted until it is restored.",
  enterprise_already_suspended: "This enterprise is already suspended.",
  enterprise_not_suspended: "This enterprise is not suspended, so there is nothing to restore.",
  support_grant_already_revoked: "This support grant was already revoked.",
  support_grant_expired:
    "This support grant already expired on its own, so there is nothing to revoke.",
  installer_has_active_jobs: "Reassign this installer's active jobs before suspending them.",
  job_not_ready_for_acceptance:
    "This job is not ready for acceptance. Commissioning evidence must be complete first.",
  job_not_blocked: "Only a blocked job can be resumed.",
  site_not_approved: "Select an approved site request first.",
  duplicate_gateway_identity: "That gateway serial already belongs to another device."
};

/** Backend validation messages that quote wire values, rewritten for the operator. */
function readableValidation(message: string): string {
  const grantRole = message.match(/^Only a support_analyst can hold a support grant; this staff member is "([^"]+)"/);
  if (grantRole) {
    return `Only a Support Analyst can hold a support grant; this staff member is a ${staffRoleLabel(grantRole[1])}.`;
  }
  const staffRoute = message.match(/^Role "([^"]+)" is provisioned through POST \/staff/);
  if (staffRoute) {
    return `${staffRoleLabel(staffRoute[1])} accounts are invited through the staff roster, not the platform user route.`;
  }
  return message;
}

/** Map a backend rejection to the console's failure vocabulary. */
function toFailure(outcome: { status: number; code: string; message: string }, snapshot?: Snapshot) {
  const known: FailureCode[] = [
    "site_not_approved",
    "duplicate_gateway_identity",
    "installer_has_active_jobs",
    "final_platform_operator",
    "job_not_ready_for_acceptance",
    "job_not_blocked",
    "staff_suspended",
    "enterprise_already_suspended",
    "enterprise_not_suspended",
    "enterprise_suspended",
    "support_grant_already_revoked",
    "support_grant_expired"
  ];
  const text = `${outcome.code} ${outcome.message}`;
  // The exact code first; a longer code that merely contains a shorter one
  // ("enterprise_already_suspended") must not be read as the shorter one.
  const matched =
    known.find(code => outcome.message.trim() === code) ??
    [...known].sort((a, b) => b.length - a.length).find(code => text.includes(code));
  const code: FailureCode = matched
    ? matched
    : outcome.status === 404
      ? "not_found"
      : outcome.status === 400 || outcome.status === 409
        ? "invalid_input"
        : outcome.code === "network_error"
          ? "network_error"
          : "server_error";
  const message =
    matched && outcome.message.trim() === matched
      ? (CONFLICT_MESSAGES[matched] ?? outcome.message)
      : readableValidation(outcome.message);
  return failure(code, message, snapshot);
}

/* -------------------------------------------------------------------------- */
/* Local memory for what the backend does not store                            */
/* -------------------------------------------------------------------------- */

const ENTERPRISES_KEY = "ranaops.live.enterprises";

/**
 * The console-side details of an enterprise the backend has no field for
 * (region, products, the first administrator's name, user id and last known
 * state). The organisation itself is always read from the backend list.
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
    window.localStorage.setItem(ENTERPRISES_KEY, JSON.stringify(list));
  } catch {
    /* Storage unavailable: the record survives for this session only. */
  }
}

function rememberEnterprise(enterprise: Enterprise) {
  const rest = storedEnterprises().filter(item => item.id !== enterprise.id);
  storeEnterprises([enterprise, ...rest]);
}

const ORG_USER_STATUS: Record<string, string> = {
  pending_activation: "Invited",
  active: "Active",
  suspended: "Suspended"
};

function mapOrgUserStatus(status: string | undefined): string {
  return status ? (ORG_USER_STATUS[status] ?? capitalise(status)) : "Invited";
}

/** An organisation-wide grant (no scope rows, or one naming the organisation). */
function isOrganisationWide(user: BackendOrgUser): boolean {
  return !user.scopes?.length || user.scopes.some(scope => scope.scopeType === "organisation");
}

/**
 * The enterprise's first administrator is not a stored field: it is whoever
 * holds the organisation-wide super_admin role (GET /organisations/{id}/users).
 * A pending or active holder is preferred over a suspended one. A list that
 * could not be read is reported as such, not as "no administrator".
 */
async function findOrganisationAdmin(
  orgId: string
): Promise<{ ok: true; admin: BackendOrgUser | null } | { ok: false; status: number; code: string; message: string }> {
  const result = await request<unknown>(`/organisations/${encodeURIComponent(orgId)}/users`);
  if (!result.ok) return result;
  const admins = asList<BackendOrgUser>(result, "users").filter(
    user => user.role === "super_admin" && isOrganisationWide(user)
  );
  return { ok: true, admin: admins.find(user => user.status !== "suspended") ?? admins[0] ?? null };
}

function mapEnterpriseAdmin(user: BackendOrgUser): EnterpriseAdmin {
  return {
    userId: user.id,
    name: user.fullName,
    email: user.email,
    status: mapOrgUserStatus(user.status)
  };
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

/** An older backend without GET /staff: platform users stand in for the roster. */
function mapLegacyStaff(user: BackendAdminUser): StaffMember {
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

const STAFF_STATUS: Record<string, string> = {
  Active: "Active",
  Invited: "Invited",
  Suspended: "Suspended"
};

function mapStaff(member: BackendStaff): StaffMember {
  const role = STAFF_ROLES.find(item => item.value === member.role);
  return {
    id: member.id,
    name: member.name || member.email,
    email: member.email,
    role: staffRoleLabel(member.role),
    roleKey: member.role,
    scope: member.scope || role?.scope || "All tenants",
    status: STAFF_STATUS[member.status] ?? capitalise(member.status),
    lastAccess: when(member.lastAccess, "Never"),
    privileged: typeof member.privileged === "boolean" ? member.privileged : Boolean(role?.privileged)
  };
}

function mapSupportGrant(grant: BackendSupportGrant, enterprises: BackendOrganisation[]): SupportGrant {
  return {
    id: grant.id,
    staff: grant.staffName || grant.staffId || "Former staff member",
    enterprise:
      grant.organisationName ||
      enterprises.find(item => item.id === grant.organisationId)?.name ||
      grant.organisationId,
    mode: grant.mode || "Read only",
    expires: when(grant.expiresAt),
    reason: grant.reason,
    status: STAFF_STATUS[grant.status] ?? capitalise(grant.status),
    ...(grant.staffId ? { staffId: grant.staffId } : null),
    enterpriseId: grant.organisationId,
    granted: when(grant.grantedAt)
  };
}

function mapAccessReview(review: BackendAccessReview): AccessReview {
  const byRole: Record<string, number> = {};
  for (const [role, count] of Object.entries(review.snapshot?.staffByRole ?? {})) {
    byRole[staffRoleLabel(role)] = count;
  }
  return {
    id: review.id,
    at: when(review.at),
    reviewer: review.reviewerName || review.reviewerId,
    staffByRole: byRole,
    privilegedCount: review.snapshot?.privilegedCount ?? 0,
    activeSupportGrants: review.snapshot?.activeSupportGrants ?? 0
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

const ENTERPRISE_STATUS: Record<string, string> = {
  suspended: "Suspended",
  onboarding: "Onboarding",
  active: "Active"
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
  // The backend derives the status on every read; an older backend without
  // the field falls back to the console's own site-based derivation.
  const status = org.status
    ? (ENTERPRISE_STATUS[org.status] ?? capitalise(org.status))
    : liveSites
      ? "Active"
      : "Onboarding";
  return {
    id: org.id,
    name: org.name,
    region: extra?.region ?? "Nigeria",
    status,
    readiness,
    adminName: extra?.adminName ?? null,
    adminEmail: extra?.adminEmail ?? org.email ?? null,
    products: extra?.products?.length ? extra.products : ["Energy workspace"],
    sites: orgSites.length,
    liveSites,
    lastActivity: when(org.createdAt, "Not reported"),
    ...(status === "Suspended" ? { suspendedSince: when(org.suspendedAt, "Not recorded") } : null),
    adminUserId: extra?.adminUserId,
    ...(extra?.adminStatus ? { adminStatus: extra.adminStatus } : null)
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

const NOTIFICATION_TYPES: Record<string, string> = {
  AccountSuspended: "Account suspended",
  AccountReinstated: "Account reinstated",
  GrantIssued: "Access grant issued",
  GrantRevoked: "Access grant revoked",
  JobBlocked: "Job blocked",
  JobReadyForAcceptance: "Job ready for acceptance",
  JobCompleted: "Job completed"
};

/** "JobReadyForAcceptance" reads as "Job ready for acceptance". */
function notificationKind(type: string): string {
  return NOTIFICATION_TYPES[type] ?? capitalise(type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase());
}

/**
 * Reduce a notification to what the inbox shows. Job and grant notifications
 * carry a ready-to-render in-app message; the account pair only renders an
 * email, so its subject stands in for the title.
 */
function mapNotification(item: BackendNotification): NotificationItem {
  const payload = item.payload ?? {};
  const inApp = payload.inApp as { message?: unknown } | undefined;
  const email = payload.email as { subject?: unknown } | undefined;
  const message = typeof inApp?.message === "string" ? inApp.message : "";
  const subject = typeof email?.subject === "string" ? email.subject : "";
  const kind = notificationKind(item.type);
  return {
    id: item.id,
    title: message || subject || kind,
    detail: kind,
    createdAt: when(item.createdAt),
    read: Boolean(item.readAt),
    ...(typeof payload.jobId === "string" && payload.jobId ? { jobId: payload.jobId } : null)
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

/**
 * True once GET /staff has answered 404, i.e. the backend predates the staff
 * roster. Staff reads and writes then use the platform user routes instead.
 */
let legacyStaffRoutes = false;

async function buildSnapshot(): Promise<Snapshot> {
  const [
    me,
    users,
    staff,
    supportGrants,
    accessReviews,
    installers,
    health,
    organisations,
    sites,
    devices,
    jobs,
    siteRequests,
    audit
  ] = await Promise.all([
    request<BackendIdentity>("/me"),
    request<unknown>("/admin/users"),
    request<unknown>(`/staff?limit=${PAGE}`),
    request<unknown>(`/support-grants?limit=${PAGE}`),
    request<unknown>("/access-reviews?limit=50"),
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

  legacyStaffRoutes = !staff.ok && staff.status === 404;

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
  const staffRows = asList<BackendStaff>(staff, "staff");
  const grantRows = asList<BackendSupportGrant>(supportGrants, "supportGrants");
  const reviewRows = asList<BackendAccessReview>(accessReviews, "accessReviews");
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
    staff: legacyStaffRoutes ? userRows.map(mapLegacyStaff) : staffRows.map(mapStaff),
    supportGrants: grantRows.map(grant => mapSupportGrant(grant, allOrgs)),
    accessReviews: reviewRows.map(mapAccessReview),
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
   * Create the organisation (POST /admin/organisations). The same call
   * invites its first administrator: an organisation-wide super_admin who
   * receives an activation email. There is no temporary password.
   *
   * The call is not transactional. A 409 "An organisation with email ..."
   * means nothing was created; a 409 "A user with this email already exists"
   * means the organisation exists but the invite could not claim that
   * address. Any other failure after creation leaves the organisation in
   * place too, so the picture is re-read and the record kept when it shows.
   */
  async createEnterprise(input: CreateEnterpriseInput) {
    const name = input.name.trim();
    const adminName = input.adminName.trim();
    const adminEmail = input.adminEmail.trim();
    const contactEmail = input.email?.trim() || adminEmail;

    const created = await post<BackendOrganisation>("/admin/organisations", {
      name,
      email: contactEmail,
      phone: input.phone?.trim() || undefined,
      adminName,
      adminEmail
    });

    const enterprise: Enterprise = {
      id: created.ok ? created.body.id : "",
      name: created.ok ? created.body.name || name : name,
      region: input.region,
      status: input.status || "Onboarding",
      readiness: 20,
      adminName,
      adminEmail,
      products: input.products.length ? input.products : ["Energy workspace"],
      sites: 0,
      liveSites: 0,
      lastActivity: "Just now"
    };

    if (!created.ok) {
      if (created.status === 409 && /^An organisation with email/i.test(created.message)) {
        return failure(
          "invalid_input",
          `${created.message.replace(/\.?\s*$/, "")}. Nothing was created; use a different organisation contact email.`
        );
      }

      // The organisation may exist even though the call failed. Only the
      // backend list can say, so read it before deciding what to tell the operator.
      const listed = asList<BackendOrganisation>(
        await request<unknown>(`/organisations?limit=${PAGE}`),
        "organisations"
      );
      const existing = listed.find(
        org => (org.email ?? "").toLowerCase() === contactEmail.toLowerCase() && org.name === name
      );
      if (!existing) return toFailure(created);

      enterprise.id = existing.id;
      rememberEnterprise(enterprise);
      const snapshot = await buildSnapshot();
      if (created.status === 409 && /A user with this email already exists/i.test(created.message)) {
        return failure(
          "invalid_input",
          `${name} was created, but ${adminEmail} already belongs to an existing account, so the administrator invitation could not be sent to it. Add the right person through Organization Admin, or use Resend invitation on the enterprise record once an administrator is listed.`,
          snapshot
        );
      }
      return toFailure(
        {
          ...created,
          message: `${name} was created, but its administrator invitation could not be sent: ${created.message} Use Resend invitation on the enterprise record.`
        },
        snapshot
      );
    }

    enterprise.adminUserId = created.body.adminUserId;
    enterprise.adminStatus = "Invited";
    rememberEnterprise(enterprise);

    const snapshot = await buildSnapshot();
    const listed = snapshot.enterprises.find(item => item.id === enterprise.id);
    return { ok: true, snapshot, data: { enterprise: listed ?? enterprise } };
  },

  /**
   * Suspend or restore an enterprise (POST /organisations/{id}/transitions).
   * Suspension revokes every support grant into the organisation and locks
   * out its users on their next request; meter data keeps flowing. The reason
   * lands on the organisation's own audit log, so it is written for the
   * customer. The backend answers 409 for a transition that changes nothing.
   */
  async transitionEnterprise({ id, transition, reason }: EnterpriseTransitionInput) {
    const result = await post<{ organisation: BackendOrganisation }>(
      `/organisations/${encodeURIComponent(id)}/transitions`,
      { transition: transition === "Suspend" ? "Suspend" : "Restore", reason }
    );
    if (!result.ok) return toFailure(result);

    const updated = result.body?.organisation;
    const snapshot = await buildSnapshot();
    const enterprise =
      snapshot.enterprises.find(item => item.id === id) ??
      mapEnterprise(updated ?? { id, name: id }, [], storedEnterprises());
    return { ok: true, snapshot, data: { enterprise } };
  },

  /**
   * Resend the first administrator's activation email
   * (POST /organisations/{id}/users/{userId}/invite). The user id comes from
   * the create response when the enterprise was created in this console;
   * otherwise the organisation-wide super_admin is looked up.
   */
  async reissueAdminInvite({ id }: ReissueAdminInviteInput) {
    const remembered = storedEnterprises().find(item => item.id === id);
    const invite = (userId: string) =>
      post<void>(`/organisations/${encodeURIComponent(id)}/users/${encodeURIComponent(userId)}/invite`);

    let admin: EnterpriseAdmin | null =
      remembered?.adminUserId && remembered.adminEmail
        ? {
            userId: remembered.adminUserId,
            name: remembered.adminName,
            email: remembered.adminEmail,
            status: remembered.adminStatus ?? "Invited"
          }
        : null;
    let sent = admin ? await invite(admin.userId) : null;

    // Nothing remembered, or the remembered id is stale: ask the organisation.
    if (!admin || !sent || (!sent.ok && sent.status === 404)) {
      const found = await findOrganisationAdmin(id);
      if (!found.ok) return toFailure(found);
      if (!found.admin) {
        return failure(
          "not_found",
          "No organisation-wide administrator is listed for this enterprise, so there is no invitation to resend. Add one through Organization Admin."
        );
      }
      admin = mapEnterpriseAdmin(found.admin);
      sent = await invite(admin.userId);
    }
    if (!sent.ok) return toFailure(sent);

    if (remembered) {
      rememberEnterprise({
        ...remembered,
        adminUserId: admin.userId,
        adminName: admin.name ?? remembered.adminName,
        adminEmail: admin.email,
        adminStatus: admin.status
      });
    }
    const snapshot = await buildSnapshot();
    const enterprise =
      snapshot.enterprises.find(item => item.id === id) ??
      mapEnterprise({ id, name: remembered?.name ?? id }, [], storedEnterprises());
    return { ok: true, snapshot, data: { enterprise } };
  },

  /** The organisation-wide super_admin and their state, or null when none is listed. */
  async getEnterpriseAdmin(enterpriseId: string) {
    const found = await findOrganisationAdmin(enterpriseId);
    return found.ok && found.admin ? mapEnterpriseAdmin(found.admin) : null;
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

  /**
   * Unlink the job's gateway (DELETE /jobs/{id}/devices/gateway). The backend
   * takes no body; the reason is kept for the operator's confirmation only.
   * Only a job in progress can be unlinked; the backend answers 409 otherwise.
   */
  async unlinkGateway({ jobId }: UnlinkGatewayInput) {
    const result = await del<{ job: BackendJob }>(`/jobs/${encodeURIComponent(jobId)}/devices/gateway`);
    if (!result.ok) return toFailure(result);
    const snapshot = await buildSnapshot();
    return { ok: true, snapshot, data: { job: jobFromSnapshot(snapshot, result.body.job) } };
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

  /**
   * Onboard an installer (POST /installers). The backend creates a pending
   * user account and emails the activation link; the roster entry is returned.
   */
  async createInstaller(input: CreateInstallerInput) {
    const result = await post<BackendInstaller | { installer: BackendInstaller }>("/installers", {
      email: input.email.trim(),
      fullName: input.fullName.trim(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      region: input.region,
      certStatus: input.certStatus,
      certExpiry: input.certExpiry || undefined
    });
    if (!result.ok) return toFailure(result);

    const body = result.body as { installer?: BackendInstaller } & Partial<BackendInstaller>;
    const created = body.installer ?? (body as BackendInstaller);
    const snapshot = await buildSnapshot();
    const installer =
      snapshot.installers.find(item => item.id === created.id) ??
      mapInstaller(
        {
          id: created.id ?? "",
          userId: created.userId ?? "",
          name: created.name ?? input.name.trim(),
          region: created.region ?? input.region,
          certStatus: created.certStatus ?? input.certStatus,
          certExpiry: created.certExpiry ?? input.certExpiry ?? null,
          phone: created.phone ?? input.phone.trim(),
          status: created.status ?? "available"
        },
        []
      );
    return { ok: true, snapshot, data: { installer } };
  },

  /**
   * Register a metering device on a site (POST /admin/sites/{id}/devices).
   * A duplicate serial is refused by the backend with 409.
   */
  async registerDevice(input: RegisterDeviceInput) {
    const result = await post<BackendDevice | { device: BackendDevice }>(
      `/admin/sites/${encodeURIComponent(input.siteId)}/devices`,
      {
        serialNumber: input.serialNumber.trim(),
        role: input.role,
        transmissionIntervalS: input.transmissionIntervalS,
        certStatus: input.certStatus,
        certExpiry: input.certExpiry || undefined
      }
    );
    if (!result.ok) return toFailure(result);

    const body = result.body as { device?: BackendDevice } & Partial<BackendDevice>;
    const created = body.device ?? (body as BackendDevice);
    const snapshot = await buildSnapshot();
    const device =
      snapshot.devices.find(item => item.id === created.id) ??
      mapDevice(
        {
          id: created.id ?? "",
          siteId: created.siteId ?? input.siteId,
          serialNumber: created.serialNumber ?? input.serialNumber.trim(),
          role: created.role ?? input.role,
          transmissionIntervalS: created.transmissionIntervalS ?? input.transmissionIntervalS,
          certStatus: created.certStatus ?? input.certStatus,
          certExpiry: created.certExpiry ?? input.certExpiry ?? null
        },
        { enterprises: [], sites: [], installers: [], siteRequests: [] },
        []
      );
    return { ok: true, snapshot, data: { device } };
  },

  /** Resume a blocked job (POST /jobs/{id}/unblock). Only a blocked job can be resumed. */
  async unblockJob({ jobId, resolutionNote }: UnblockJobInput) {
    const result = await post<{ job: BackendJob }>(`/jobs/${encodeURIComponent(jobId)}/unblock`, {
      resolutionNote: resolutionNote.trim() || undefined
    });
    if (!result.ok) return toFailure(result);
    const snapshot = await buildSnapshot();
    return { ok: true, snapshot, data: { job: jobFromSnapshot(snapshot, result.body.job) } };
  },

  /** Recorded evidence and field notes come only from the job's own record. */
  async getJobDetail(jobId: string): Promise<JobDetail> {
    const result = await request<BackendJobDetail>(`/jobs/${encodeURIComponent(jobId)}`);
    if (!result.ok) throw new Error(result.message);
    return {
      checklist: (result.body.checklistItems ?? []).map(item => item.item),
      notes: (result.body.notes ?? []).map(note => ({
        text: note.text,
        recordedAt: when(note.recordedAt)
      }))
    };
  },

  /**
   * Record one piece of staff commissioning evidence (POST /jobs/{id}/checklist).
   * Append-only; the fourth item moves the job to ready for acceptance.
   */
  async recordChecklistItem({ jobId, item }: RecordChecklistItemInput) {
    const result = await post<{ checklistItem: BackendChecklistItem }>(
      `/jobs/${encodeURIComponent(jobId)}/checklist`,
      { item }
    );
    if (!result.ok) return toFailure(result);
    const recorded = result.body.checklistItem;
    return ok({ checklistItem: { item: recorded?.item ?? item, recordedAt: when(recorded?.recordedAt) } });
  },

  /**
   * Move a site through its lifecycle (PATCH /sites/{id}/lifecycle-status).
   * The backend takes no reason; the one collected is for the operator's
   * confirmation only. An illegal transition is refused with 409.
   */
  async setSiteLifecycle({ siteId, status }: SetSiteLifecycleInput) {
    const result = await patch<BackendSite | { site: BackendSite }>(
      `/sites/${encodeURIComponent(siteId)}/lifecycle-status`,
      { status }
    );
    if (!result.ok) return toFailure(result);

    const body = result.body as { site?: BackendSite } & Partial<BackendSite>;
    const updated = body.site ?? (body as BackendSite);
    const snapshot = await buildSnapshot();
    const site =
      snapshot.sites.find(item => item.id === siteId) ??
      ({
        id: siteId,
        name: updated.name ?? siteId,
        enterpriseId: updated.organisationId ?? "",
        enterprise:
          snapshot.enterprises.find(item => item.id === updated.organisationId)?.name ??
          updated.organisationId ??
          "",
        region: regionLabel(updated.region),
        status: SITE_STATUS[updated.lifecycleStatus ?? status] ?? capitalise(status),
        created: when(updated.createdAt)
      } satisfies PlatformSite);
    return { ok: true, snapshot, data: { site } };
  },

  async listNotifications(): Promise<NotificationList> {
    const result = await request<BackendNotificationList>("/notifications?limit=50");
    if (!result.ok) throw new Error(result.message);
    const rows = asList<BackendNotification>(result, "notifications");
    return {
      items: rows.map(mapNotification),
      unreadCount:
        typeof result.body?.unreadCount === "number"
          ? result.body.unreadCount
          : rows.filter(item => !item.readAt).length
    };
  },

  /** POST /notifications/{id}/read answers 204; nothing else in the picture changes. */
  async markNotificationRead(id: string) {
    const result = await post<void>(`/notifications/${encodeURIComponent(id)}/read`);
    if (!result.ok) return toFailure(result);
    return { ok: true as const };
  },

  async unreadNotificationCount() {
    const result = await request<{ unreadCount?: number }>("/notifications/unread-count");
    return result.ok && typeof result.body?.unreadCount === "number" ? result.body.unreadCount : 0;
  },

  createIncident(_input: CreateIncidentInput) {
    return notAvailable<{ incident: Incident }>("The incidents subsystem");
  },

  transitionIncident(_input: IncidentTransitionInput) {
    return notAvailable<{ incident: Incident }>("The incidents subsystem");
  },

  /**
   * Invite a Rana54 staff member (POST /staff). The backend derives the scope
   * from the role and emails an activation link; no password is returned. A
   * support analyst holds no standing access, so their invite stays pending
   * until their first support grant is issued.
   *
   * An older backend without POST /staff (404) still provisions a Platform
   * Operator through POST /admin/users, which returns a one-time temporary
   * password instead of sending an invitation.
   */
  async inviteStaff(input: InviteStaffInput) {
    const name = input.name.trim();
    const email = input.email.trim();
    const role = STAFF_ROLES.find(item => item.value === input.role);

    const result = legacyStaffRoutes
      ? null
      : await post<{ staff: BackendStaff }>("/staff", {
          name,
          email,
          role: input.role,
          reason: input.reason.trim()
        });

    if (result?.ok) {
      const created = result.body?.staff;
      const snapshot = await buildSnapshot();
      const staff =
        snapshot.staff.find(item => item.id === created?.id) ??
        mapStaff({
          id: created?.id ?? "",
          userId: created?.userId ?? "",
          name: created?.name ?? name,
          email: created?.email ?? email,
          role: created?.role ?? input.role,
          scope: created?.scope ?? role?.scope ?? "All tenants",
          status: created?.status ?? "Invited",
          lastAccess: created?.lastAccess ?? null,
          privileged: created?.privileged ?? Boolean(role?.privileged)
        });
      return { ok: true, snapshot, data: { staff } };
    }

    if (result && result.status !== 404) return toFailure(result);

    // The staff roster route does not exist on this backend.
    legacyStaffRoutes = true;
    if (input.role !== "admin") {
      return failure(
        "server_error",
        `${role?.label ?? input.role} accounts cannot be invited until the backend exposes the staff roster. Only a Platform Operator can be provisioned here.`
      );
    }
    const provisioned = await post<BackendProvisionedUser>("/admin/users", {
      email,
      fullName: name,
      role: "admin",
      scopeType: "platform"
    });
    if (!provisioned.ok) return toFailure(provisioned);
    const staff: StaffMember = {
      id: provisioned.body.user.id,
      name,
      email,
      role: staffRoleLabel("admin"),
      roleKey: "admin",
      scope: "All tenants",
      status: "Invited",
      lastAccess: "Never",
      privileged: true,
      tempPassword: provisioned.body.tempPassword
    };
    return ok({ staff });
  },

  /**
   * Suspend or restore a staff member (POST /staff/{id}/transitions).
   * Suspending also revokes their active support grants. The backend refuses
   * to suspend the final active Platform Operator (409).
   */
  async transitionStaff({ id, transition, reason }: StaffTransitionInput) {
    if (legacyStaffRoutes) {
      const action = transition === "Restore" ? "unsuspend" : "suspend";
      const legacy = await post<unknown>(`/admin/users/${encodeURIComponent(id)}/${action}`);
      if (!legacy.ok) return toFailure(legacy);
      return ok(undefined);
    }
    const result = await post<{ staff: BackendStaff }>(`/staff/${encodeURIComponent(id)}/transitions`, {
      transition,
      reason
    });
    if (!result.ok) return toFailure(result);
    return ok(undefined);
  },

  /**
   * Issue a read-only, time-limited support grant (POST /support-grants).
   * Only an active support analyst can hold one (400 otherwise), never into
   * a suspended enterprise (409) or for a suspended staff member (409).
   */
  async createSupportGrant(input: CreateSupportGrantInput) {
    const result = await post<{ supportGrant: BackendSupportGrant }>("/support-grants", {
      staffId: input.staffId,
      organisationId: input.enterpriseId,
      durationHours: input.duration,
      reason: input.reason.trim()
    });
    if (!result.ok) return toFailure(result);

    const created = result.body?.supportGrant;
    const snapshot = await buildSnapshot();
    const grant =
      snapshot.supportGrants.find(item => item.id === created?.id) ??
      mapSupportGrant(
        {
          id: created?.id ?? "",
          staffId: created?.staffId ?? input.staffId,
          staffName:
            created?.staffName ?? snapshot.staff.find(item => item.id === input.staffId)?.name ?? null,
          organisationId: created?.organisationId ?? input.enterpriseId,
          organisationName:
            created?.organisationName ??
            snapshot.enterprises.find(item => item.id === input.enterpriseId)?.name ??
            null,
          mode: created?.mode ?? "Read only",
          status: created?.status ?? "Active",
          reason: created?.reason ?? input.reason.trim(),
          grantedAt: created?.grantedAt ?? new Date().toISOString(),
          expiresAt:
            created?.expiresAt ?? new Date(Date.now() + input.duration * 3600000).toISOString(),
          revokedAt: created?.revokedAt ?? null
        },
        []
      );
    return { ok: true, snapshot, data: { grant } };
  },

  /**
   * End a support grant early (POST /support-grants/{id}/revoke). It takes
   * effect on the analyst's next request. A grant that was already revoked
   * or already lapsed on its own is refused (409).
   */
  async revokeSupportGrant({ id, reason }: RevokeSupportGrantInput) {
    const result = await post<{ supportGrant: BackendSupportGrant }>(
      `/support-grants/${encodeURIComponent(id)}/revoke`,
      { reason: reason.trim() }
    );
    if (!result.ok) return toFailure(result);

    const revoked = result.body?.supportGrant;
    const snapshot = await buildSnapshot();
    const grant =
      snapshot.supportGrants.find(item => item.id === id) ??
      (revoked ? mapSupportGrant(revoked, []) : undefined);
    if (!grant) return failure("not_found", "That support grant is no longer in the picture.", snapshot);
    return { ok: true, snapshot, data: { grant } };
  },

  runDeviceDiagnostic(_id: string) {
    return notAvailable<{ device: Device }>("Device diagnostics");
  },

  async runServiceCheck(_id: string) {
    // Re-reads GET /health as part of rebuilding the snapshot.
    return ok(undefined);
  },

  /** POST /access-reviews takes no body and answers with the attestation written. */
  async completeAccessReview() {
    const result = await post<{ accessReview: BackendAccessReview }>("/access-reviews");
    if (!result.ok) return toFailure(result);

    const recorded = result.body?.accessReview;
    const snapshot = await buildSnapshot();
    const review =
      snapshot.accessReviews.find(item => item.id === recorded?.id) ??
      mapAccessReview(
        recorded ?? {
          id: "",
          at: new Date().toISOString(),
          reviewerId: "",
          reviewerName: snapshot.currentOperator.name,
          snapshot: {
            staffByRole: {},
            privilegedCount: snapshot.staff.filter(item => item.privileged && item.status === "Active").length,
            activeSupportGrants: snapshot.supportGrants.filter(item => item.status === "Active").length
          }
        }
      );
    return { ok: true, snapshot, data: { review } };
  },

  async recordExport(_kind: ExportKind) {
    return ok(undefined);
  }
};
