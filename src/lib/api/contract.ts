/**
 * The operations API contract.
 *
 * Everything the workspace can read or change goes through this interface.
 * Two adapters implement it today:
 *
 *   - `mock-adapter.ts`  seeded prototype state held in the browser
 *   - `http-adapter.ts`  the real Rana54 operations backend
 *
 * `src/lib/api/index.ts` picks one from NEXT_PUBLIC_DATA_SOURCE. No view,
 * drawer, or form imports an adapter directly, so switching to the backend is
 * a configuration change rather than a code change.
 */

import type {
  Device,
  Enterprise,
  Incident,
  Installer,
  Job,
  PlatformSite,
  Severity,
  Snapshot,
  StaffMember,
  SupportGrant
} from "@/lib/types";

/** A rule the platform enforces regardless of what the UI offers. */
export type FailureCode =
  | "not_found"
  | "invalid_input"
  | "site_not_approved"
  | "duplicate_gateway_identity"
  | "installer_has_active_jobs"
  | "final_platform_operator"
  | "job_not_ready_for_acceptance"
  | "job_not_blocked"
  | "network_error"
  | "server_error";

export interface ApiSuccess<T> {
  ok: true;
  /** The complete operational picture after the change. */
  snapshot: Snapshot;
  data: T;
}

export interface ApiFailure {
  ok: false;
  code: FailureCode;
  message: string;
  /** Present when the platform still recorded something, e.g. a raised incident. */
  snapshot?: Snapshot;
}

export type ApiResult<T = undefined> = ApiSuccess<T> | ApiFailure;

/** A write that changes nothing in the operational picture, so carries no snapshot. */
export type PlainResult = { ok: true } | ApiFailure;

/* -------------------------------------------------------------------------- */
/* Request payloads                                                            */
/* -------------------------------------------------------------------------- */

export interface CreateEnterpriseInput {
  name: string;
  region: string;
  status: string;
  adminName: string;
  adminEmail: string;
  products: string[];
  /** Contact phone for the organisation record (the backend requires one). */
  phone?: string;
}

export interface EnterpriseTransitionInput {
  id: string;
  transition: "Suspend" | "Reactivate";
  reason: string;
}

export interface ReissueAdminInviteInput {
  id: string;
  reason: string;
}

export interface SiteDecisionInput {
  id: string;
  decision: "Approved" | "Returned";
  reason: string;
}

/** Provision a site directly for an enterprise, without a site request. */
export interface CreateSiteInput {
  enterpriseId: string;
  name: string;
  address: string;
}

export interface CreateJobInput {
  requestId: string;
  installerId: string;
  date: string;
  time: string;
  note: string;
}

export interface ReassignJobInput {
  id: string;
  installerId: string;
  reason: string;
}

export interface LinkGatewayInput {
  jobId: string;
  serial: string;
  reason: string;
}

/** Unlink a mis-scanned gateway so the job can be scanned again. */
export interface UnlinkGatewayInput {
  jobId: string;
  reason: string;
}

export interface AcceptInstallationInput {
  jobId: string;
  reason: string;
}

export interface InstallerTransitionInput {
  id: string;
  transition: "Suspend" | "Restore";
  reason: string;
}

/** The backend's region vocabulary for installers and sites. */
export const NIGERIAN_REGIONS = [
  { value: "north_central", label: "North Central" },
  { value: "north_east", label: "North East" },
  { value: "north_west", label: "North West" },
  { value: "south_east", label: "South East" },
  { value: "south_south", label: "South South" },
  { value: "south_west", label: "South West" }
] as const;

export type NigerianRegion = (typeof NIGERIAN_REGIONS)[number]["value"];

export type InstallerCertStatus = "current" | "expiring" | "expired";

/** Onboard an installer: creates their pending account and roster entry. */
export interface CreateInstallerInput {
  email: string;
  /** Name on the user account. */
  fullName: string;
  /** Name shown on the roster (usually the same). */
  name: string;
  phone: string;
  region: NigerianRegion | string;
  certStatus: InstallerCertStatus;
  /** ISO date; omitted when the certificate has no recorded expiry. */
  certExpiry?: string;
}

export type DeviceRole = "grid" | "inverter_output";

export type DeviceCertStatus = "certified" | "pending" | "expired" | "uncertified";

/** Register a metering device against a site so a job can later link it. */
export interface RegisterDeviceInput {
  siteId: string;
  serialNumber: string;
  role: DeviceRole;
  transmissionIntervalS: number;
  certStatus: DeviceCertStatus;
  /** ISO date; omitted when the certificate has no recorded expiry. */
  certExpiry?: string;
}

/** Resume a blocked job once the field blocker has been resolved. */
export interface UnblockJobInput {
  jobId: string;
  resolutionNote: string;
}

/** The four pieces of staff commissioning evidence, in the backend's exact wording. */
export const STAFF_CHECKLIST = [
  "Owner confirmed",
  "Gateway linked",
  "Functions mapped",
  "Delivery test passed"
] as const;

export type ChecklistItem = (typeof STAFF_CHECKLIST)[number];

export interface RecordChecklistItemInput {
  jobId: string;
  item: ChecklistItem;
}

/** What a job's own record adds to the list row: recorded evidence and field notes. */
export interface JobDetail {
  /** Checklist items recorded so far, by their exact wording. */
  checklist: string[];
  /** Installer field notes, newest first. */
  notes: { text: string; recordedAt: string }[];
}

export type SiteLifecycleTarget = "active" | "decommissioned";

export interface SetSiteLifecycleInput {
  siteId: string;
  status: SiteLifecycleTarget;
  /** Kept for the audit trail; the backend takes no reason. */
  reason: string;
}

export interface CreateIncidentInput {
  title: string;
  severity: Severity;
  scope: string;
  enterprise: string;
  owner: string;
  note: string;
}

export interface IncidentTransitionInput {
  id: string;
  transition: "Assign" | "Acknowledge" | "Resolve" | "Reopen";
  owner?: string;
  reason: string;
}

export interface InviteStaffInput {
  name: string;
  email: string;
  role: string;
  scope: string;
  reason: string;
}

export interface StaffTransitionInput {
  id: string;
  transition: "Suspend" | "Restore";
  reason: string;
}

export interface CreateSupportGrantInput {
  staffId: string;
  enterpriseId: string;
  /** Duration in hours. */
  duration: number;
  reason: string;
}

export type ExportKind = "audit" | "devices";

/* -------------------------------------------------------------------------- */
/* Response payloads                                                           */
/* -------------------------------------------------------------------------- */

export interface LinkGatewayResult {
  device: Device;
}

export interface ChecklistRecord {
  item: string;
  recordedAt: string;
}

/** One inbox entry, already reduced to what the console shows. */
export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
  /** Present when the notification is about an installation job. */
  jobId?: string;
}

export interface NotificationList {
  items: NotificationItem[];
  unreadCount: number;
}

/* -------------------------------------------------------------------------- */
/* The interface                                                               */
/* -------------------------------------------------------------------------- */

export interface OperationsApi {
  /** The full cross-tenant picture. Called once on load and after a reset. */
  getSnapshot(): Promise<Snapshot>;

  /** Return to seeded demo data. Mock adapter only; a no-op against a backend. */
  resetSnapshot(): Promise<Snapshot>;

  createEnterprise(
    input: CreateEnterpriseInput
  ): Promise<ApiResult<{ enterprise: Enterprise }>>;

  transitionEnterprise(
    input: EnterpriseTransitionInput
  ): Promise<ApiResult<{ enterprise: Enterprise }>>;

  reissueAdminInvite(
    input: ReissueAdminInviteInput
  ): Promise<ApiResult<{ enterprise: Enterprise }>>;

  decideSiteRequest(input: SiteDecisionInput): Promise<ApiResult<undefined>>;

  createSite(input: CreateSiteInput): Promise<ApiResult<{ site: PlatformSite }>>;

  createJob(input: CreateJobInput): Promise<ApiResult<{ job: Job }>>;

  reassignJob(input: ReassignJobInput): Promise<ApiResult<{ job: Job }>>;

  linkGateway(input: LinkGatewayInput): Promise<ApiResult<LinkGatewayResult>>;

  unlinkGateway(input: UnlinkGatewayInput): Promise<ApiResult<{ job: Job }>>;

  acceptInstallation(
    input: AcceptInstallationInput
  ): Promise<ApiResult<{ job: Job }>>;

  transitionInstaller(
    input: InstallerTransitionInput
  ): Promise<ApiResult<undefined>>;

  createInstaller(input: CreateInstallerInput): Promise<ApiResult<{ installer: Installer }>>;

  registerDevice(input: RegisterDeviceInput): Promise<ApiResult<{ device: Device }>>;

  unblockJob(input: UnblockJobInput): Promise<ApiResult<{ job: Job }>>;

  /** The job's recorded evidence and field notes. Rejects when the job cannot be read. */
  getJobDetail(jobId: string): Promise<JobDetail>;

  recordChecklistItem(
    input: RecordChecklistItemInput
  ): Promise<ApiResult<{ checklistItem: ChecklistRecord }>>;

  setSiteLifecycle(input: SetSiteLifecycleInput): Promise<ApiResult<{ site: PlatformSite }>>;

  /** The operator's inbox, newest first. Rejects when it cannot be read. */
  listNotifications(): Promise<NotificationList>;

  markNotificationRead(id: string): Promise<PlainResult>;

  /** The badge number. Never rejects; an unreadable inbox reads as zero. */
  unreadNotificationCount(): Promise<number>;

  createIncident(
    input: CreateIncidentInput
  ): Promise<ApiResult<{ incident: Incident }>>;

  transitionIncident(
    input: IncidentTransitionInput
  ): Promise<ApiResult<{ incident: Incident }>>;

  inviteStaff(input: InviteStaffInput): Promise<ApiResult<{ staff: StaffMember }>>;

  transitionStaff(input: StaffTransitionInput): Promise<ApiResult<undefined>>;

  createSupportGrant(
    input: CreateSupportGrantInput
  ): Promise<ApiResult<{ grant: SupportGrant }>>;

  runDeviceDiagnostic(id: string): Promise<ApiResult<{ device: Device }>>;

  runServiceCheck(id: string): Promise<ApiResult<undefined>>;

  completeAccessReview(): Promise<ApiResult<undefined>>;

  /** Records that an operator exported data. The file itself is built client-side. */
  recordExport(kind: ExportKind): Promise<ApiResult<undefined>>;
}

export function failure(
  code: FailureCode,
  message: string,
  snapshot?: Snapshot
): ApiFailure {
  return { ok: false, code, message, snapshot };
}
