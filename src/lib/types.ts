/**
 * Domain model for the Rana54 Network Operations workspace.
 *
 * These types are the contract between the UI and whichever data adapter is
 * active (see `src/lib/api`). A backend implementation must serialise records
 * in exactly these shapes.
 */

export type EnterpriseStatus =
  | "Active"
  | "Onboarding"
  | "Needs attention"
  | "Suspended";

export interface Enterprise {
  id: string;
  name: string;
  region: string;
  status: EnterpriseStatus | string;
  readiness: number;
  adminName: string | null;
  adminEmail: string | null;
  products: string[];
  sites: number;
  liveSites: number;
  lastActivity: string;
  /** Live backend only: the provisioned first administrator's user id. */
  adminUserId?: string;
  /**
   * Live backend only: the one-time temporary password issued when the first
   * administrator was provisioned. Held in memory for this session only and
   * never persisted, matching the backend (it is shown exactly once).
   */
  adminTempPassword?: string;
}

export type SiteRequestStatus = "Pending review" | "Approved" | "Returned";

export interface SiteRequest {
  id: string;
  enterpriseId: string;
  enterprise: string;
  siteName: string;
  location: string;
  requestedBy: string;
  submitted: string;
  status: SiteRequestStatus | string;
  functions: string[];
}

export type InstallerStatus = "Available" | "On job" | "Suspended";

export interface Installer {
  id: string;
  name: string;
  region: string;
  certification: string;
  capacity: string;
  phone: string;
  activeJobs: number;
  status: InstallerStatus | string;
}

export type JobStatus =
  | "Scheduled"
  | "In progress"
  | "Awaiting site approval"
  | "Blocked"
  | "Ready for acceptance"
  | "Completed";

export interface Job {
  id: string;
  enterpriseId: string;
  enterprise: string;
  siteRequestId: string;
  site: string;
  installerId: string;
  installer: string;
  status: JobStatus | string;
  scheduled: string;
  progress: number;
  blockers: string[];
  checklist: string[];
  linkedDevice: string | null;
}

export type DeviceStatus = "Live" | "Testing" | "Offline" | "Identity conflict";

export interface DeviceFunction {
  name: string;
  source: string;
  state: string;
}

export interface Device {
  id: string;
  serial: string;
  type: string;
  enterprise: string;
  enterpriseId: string;
  site: string;
  status: DeviceStatus | string;
  heartbeat: string;
  firmware: string;
  jobId: string;
  functions: DeviceFunction[];
  lastDiagnostic: string;
}

export type Severity = "P1" | "P2" | "P3";

export type IncidentStatus =
  | "Open"
  | "Acknowledged"
  | "Investigating"
  | "Resolved";

export interface Incident {
  id: string;
  title: string;
  scope: string;
  enterprise: string;
  severity: Severity;
  status: IncidentStatus | string;
  owner: string;
  age: string;
  sla: string;
  deviceId: string | null;
  notes: string[];
}

export type StaffStatus = "Active" | "Invited" | "Suspended";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  scope: string;
  status: StaffStatus | string;
  lastAccess: string;
  privileged: boolean;
  /** Live backend only: one-time temporary password from provisioning (memory only). */
  tempPassword?: string;
}

export type SupportGrantStatus = "Active" | "Expired" | "Revoked";

export interface SupportGrant {
  id: string;
  staff: string;
  enterprise: string;
  mode: string;
  expires: string;
  reason: string;
  status: SupportGrantStatus | string;
}

export type ServiceStatus = "Operational" | "Degraded" | "Down";

export interface PlatformService {
  id: string;
  name: string;
  status: ServiceStatus | string;
  metric: string;
  detail: string;
}

export interface AuditEvent {
  id: string;
  time: string;
  actor: string;
  action: string;
  entity: string;
  outcome: string;
  reason: string;
}

export interface Operator {
  name: string;
  scope: string;
  permission: string;
}

/**
 * The complete cross-tenant operational picture. Every mutation returns a fresh
 * snapshot so the workspace never renders a partially-updated view.
 */
export interface Snapshot {
  currentOperator: Operator;
  enterprises: Enterprise[];
  siteRequests: SiteRequest[];
  installers: Installer[];
  jobs: Job[];
  devices: Device[];
  incidents: Incident[];
  staff: StaffMember[];
  supportGrants: SupportGrant[];
  services: PlatformService[];
  audit: AuditEvent[];
}

export const SNAPSHOT_COLLECTIONS = [
  "enterprises",
  "siteRequests",
  "installers",
  "jobs",
  "devices",
  "incidents",
  "staff",
  "supportGrants",
  "services",
  "audit"
] as const;
