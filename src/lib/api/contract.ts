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
  Job,
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

export interface AcceptInstallationInput {
  jobId: string;
  reason: string;
}

export interface InstallerTransitionInput {
  id: string;
  transition: "Suspend" | "Restore";
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

  createJob(input: CreateJobInput): Promise<ApiResult<{ job: Job }>>;

  reassignJob(input: ReassignJobInput): Promise<ApiResult<{ job: Job }>>;

  linkGateway(input: LinkGatewayInput): Promise<ApiResult<LinkGatewayResult>>;

  acceptInstallation(
    input: AcceptInstallationInput
  ): Promise<ApiResult<{ job: Job }>>;

  transitionInstaller(
    input: InstallerTransitionInput
  ): Promise<ApiResult<undefined>>;

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
