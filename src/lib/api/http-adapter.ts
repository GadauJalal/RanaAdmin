/**
 * Backend adapter.
 *
 * Every method is one request against the Rana54 operations service. The
 * routes below are the contract the backend has to satisfy; they are listed in
 * `docs/BACKEND_CONTRACT.md` with request and response bodies.
 *
 * Response shape expected from every mutation:
 *
 *   200  { "snapshot": Snapshot, "data": <endpoint payload> }
 *   4xx  { "code": FailureCode, "message": string, "snapshot"?: Snapshot }
 *
 * A rejection may still carry a snapshot: a blocked gateway link, for example,
 * opens an incident, so the workspace must re-render even though the operator's
 * action did not succeed.
 */

import type { Device, Enterprise, Incident, Job, Snapshot, StaffMember, SupportGrant } from "@/lib/types";

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

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

interface MutationEnvelope<T> {
  snapshot: Snapshot;
  data: T;
}

interface ErrorEnvelope {
  code?: FailureCode;
  message?: string;
  snapshot?: Snapshot;
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; body: T } | { ok: false; error: ErrorEnvelope }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      // Session cookies carry the operator identity. The backend derives the
      // audit actor from the session, never from the client.
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {})
      }
    });

    const text = await response.text();
    const body = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      const error = (body ?? {}) as ErrorEnvelope;
      return {
        ok: false,
        error: {
          code: error.code ?? (response.status >= 500 ? "server_error" : "invalid_input"),
          message: error.message ?? `The operations service returned ${response.status}.`,
          snapshot: error.snapshot
        }
      };
    }

    return { ok: true, body: body as T };
  } catch (error) {
    console.error("Operations API request failed", error);
    return {
      ok: false,
      error: {
        code: "network_error",
        message: "The operations service could not be reached. No change was recorded."
      }
    };
  }
}

async function mutate<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT",
  payload?: unknown
): Promise<ApiResult<T>> {
  const result = await request<MutationEnvelope<T>>(path, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });

  if (!result.ok) {
    return failure(
      result.error.code ?? "server_error",
      result.error.message ?? "The change could not be applied.",
      result.error.snapshot
    );
  }

  return { ok: true, snapshot: result.body.snapshot, data: result.body.data };
}

export const httpAdapter: OperationsApi = {
  async getSnapshot() {
    const result = await request<Snapshot>("/snapshot", { method: "GET", cache: "no-store" });
    if (!result.ok) {
      throw new Error(result.error.message ?? "The operational snapshot could not be loaded.");
    }
    return result.body;
  },

  async resetSnapshot() {
    // Seeded state is a prototype concept. Against a backend this simply
    // re-reads the authoritative picture.
    return httpAdapter.getSnapshot();
  },

  createEnterprise(input: CreateEnterpriseInput) {
    return mutate<{ enterprise: Enterprise }>("/enterprises", "POST", input);
  },

  transitionEnterprise({ id, ...body }: EnterpriseTransitionInput) {
    return mutate<{ enterprise: Enterprise }>(
      `/enterprises/${encodeURIComponent(id)}/transitions`,
      "POST",
      body
    );
  },

  reissueAdminInvite({ id, ...body }: ReissueAdminInviteInput) {
    return mutate<{ enterprise: Enterprise }>(
      `/enterprises/${encodeURIComponent(id)}/admin-invitations`,
      "POST",
      body
    );
  },

  decideSiteRequest({ id, ...body }: SiteDecisionInput) {
    return mutate<undefined>(
      `/site-requests/${encodeURIComponent(id)}/decision`,
      "POST",
      body
    );
  },

  createJob(input: CreateJobInput) {
    return mutate<{ job: Job }>("/jobs", "POST", input);
  },

  reassignJob({ id, ...body }: ReassignJobInput) {
    return mutate<{ job: Job }>(`/jobs/${encodeURIComponent(id)}/assignment`, "POST", body);
  },

  linkGateway({ jobId, ...body }: LinkGatewayInput) {
    return mutate<LinkGatewayResult>(
      `/jobs/${encodeURIComponent(jobId)}/gateway-link`,
      "POST",
      body
    );
  },

  acceptInstallation({ jobId, ...body }: AcceptInstallationInput) {
    return mutate<{ job: Job }>(
      `/jobs/${encodeURIComponent(jobId)}/acceptance`,
      "POST",
      body
    );
  },

  transitionInstaller({ id, ...body }: InstallerTransitionInput) {
    return mutate<undefined>(
      `/installers/${encodeURIComponent(id)}/transitions`,
      "POST",
      body
    );
  },

  createIncident(input: CreateIncidentInput) {
    return mutate<{ incident: Incident }>("/incidents", "POST", input);
  },

  transitionIncident({ id, ...body }: IncidentTransitionInput) {
    return mutate<{ incident: Incident }>(
      `/incidents/${encodeURIComponent(id)}/transitions`,
      "POST",
      body
    );
  },

  inviteStaff(input: InviteStaffInput) {
    return mutate<{ staff: StaffMember }>("/staff", "POST", input);
  },

  transitionStaff({ id, ...body }: StaffTransitionInput) {
    return mutate<undefined>(`/staff/${encodeURIComponent(id)}/transitions`, "POST", body);
  },

  createSupportGrant(input: CreateSupportGrantInput) {
    return mutate<{ grant: SupportGrant }>("/support-grants", "POST", input);
  },

  runDeviceDiagnostic(id: string) {
    return mutate<{ device: Device }>(
      `/devices/${encodeURIComponent(id)}/diagnostics`,
      "POST"
    );
  },

  runServiceCheck(id: string) {
    return mutate<undefined>(`/services/${encodeURIComponent(id)}/checks`, "POST");
  },

  completeAccessReview() {
    return mutate<undefined>("/access-reviews", "POST");
  },

  recordExport(kind: ExportKind) {
    return mutate<undefined>("/exports", "POST", { kind });
  }
};
