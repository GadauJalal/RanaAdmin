"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormModal, Modal, ReasonModal } from "@/components/ui/Overlay";
import { EmptyState, Notice } from "@/components/ui/primitives";
import {
  api,
  isSupportAnalyst,
  NIGERIAN_REGIONS,
  STAFF_ROLES,
  SUPPORT_GRANT_DURATIONS,
  type DeviceCertStatus,
  type DeviceRole,
  type InstallerCertStatus,
  type StaffRole
} from "@/lib/api";
import { pastTense } from "@/lib/format";
import type { Severity } from "@/lib/types";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

/* -------------------------------------------------------------------------- */
/* Enterprises                                                                 */
/* -------------------------------------------------------------------------- */

export function NewEnterpriseModal() {
  const { run, openOverlay } = useWorkspace();

  return (
    <FormModal
      title="Create enterprise"
      description="Create the tenant and issue its first organization administrator invitation."
      formId="enterprise-form"
      submitLabel="Create and invite"
      submitIcon="plus"
      onSubmit={data =>
        void run(
          () =>
            api.createEnterprise({
              name: text(data, "name"),
              region: text(data, "region"),
              status: text(data, "status"),
              adminName: text(data, "adminName"),
              adminEmail: text(data, "adminEmail"),
              products: data.getAll("product").map(String),
              phone: text(data, "phone")
            }),
          {
            failureTitle: "Enterprise could not be created",
            success: ({ enterprise }) => ({
              title: "Enterprise created",
              detail: enterprise.adminTempPassword
                ? `${enterprise.name} is ready. The administrator's one-time temporary password is shown in the enterprise record; copy it now, it is not shown again.`
                : `${enterprise.name} is ready for onboarding and the first administrator invitation was issued.`
            }),
            onSuccess: ({ enterprise }) => openOverlay({ kind: "enterprise", id: enterprise.id })
          }
        )
      }
    >
      <div className="field full">
        <label htmlFor="enterprise-name">Legal or trading name</label>
        <input id="enterprise-name" name="name" required maxLength={90} placeholder="Enterprise name" />
      </div>
      <div className="field">
        <label htmlFor="enterprise-region">Country or region</label>
        <select id="enterprise-region" name="region" required defaultValue="">
          <option value="">Select region</option>
          <option>Nigeria</option>
          <option>Ghana</option>
          <option>Kenya</option>
          <option>South Africa</option>
          <option>Other</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="enterprise-status">Account state</label>
        <select id="enterprise-status" name="status" defaultValue="Onboarding">
          <option>Onboarding</option>
          <option>Active</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="enterprise-admin-name">First admin name</label>
        <input id="enterprise-admin-name" name="adminName" required placeholder="Full name" />
      </div>
      <div className="field">
        <label htmlFor="enterprise-admin-email">First admin email</label>
        <input
          id="enterprise-admin-email"
          name="adminEmail"
          required
          type="email"
          placeholder="name@company.com"
        />
        <small>The stored presentation is masked after invitation.</small>
      </div>
      <div className="field">
        <label htmlFor="enterprise-phone">Contact phone</label>
        <input
          id="enterprise-phone"
          name="phone"
          type="tel"
          placeholder="+234 800 000 0000"
        />
        <small>Recorded on the organisation. Required by the live backend.</small>
      </div>
      <div className="field full">
        <span className="field-label">Enabled products</span>
        <div className="check-list">
          <label className="check-row">
            <input type="checkbox" name="product" value="Energy workspace" defaultChecked />
            <span>
              <strong>Energy workspace</strong>
              <small>Sites, functions, data quality, and reporting workspace.</small>
            </span>
          </label>
          <label className="check-row">
            <input type="checkbox" name="product" value="dMRV reports" />
            <span>
              <strong>dMRV reports</strong>
              <small>Governed evidence and report workflows.</small>
            </span>
          </label>
        </div>
      </div>
    </FormModal>
  );
}

export function EnterpriseTransitionModal({
  id,
  transition
}: {
  id: string;
  transition: "Suspend" | "Reactivate";
}) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const enterprise = snapshot.enterprises.find(item => item.id === id);
  if (!enterprise) return null;

  const suspending = transition === "Suspend";

  return (
    <ReasonModal
      title={`${transition} enterprise account`}
      description={`${enterprise.name} · ${enterprise.id}`}
      formId="enterprise-transition-form"
      submitLabel={`Confirm ${transition.toLowerCase()}`}
      submitTone={suspending ? "btn-danger" : "btn-primary"}
      placeholder="Write this for the customer, e.g. contract lapsed pending renewal"
      notice={
        <Notice icon="shield" tone={suspending ? "danger" : undefined}>
          The reason is written to the organisation&apos;s own audit log and is visible to it
          once restored, so write it for the customer.{" "}
          {suspending
            ? "Suspending revokes every Rana54 support grant into this organisation and locks out its users on their next request. Meter data keeps flowing and being recorded; identifiers, evidence and audit history remain intact."
            : "Restoring lets the organisation's users sign in again. Support grants revoked at suspension are not reinstated; issue new ones if support work continues."}
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.transitionEnterprise({ id, transition, reason }), {
          failureTitle: `Enterprise account not ${pastTense(transition)}`,
          success: ({ enterprise: updated }) => ({
            title: `Enterprise account ${pastTense(transition)}`,
            detail: suspending
              ? `${updated.name} is suspended. Its users are locked out and its support grants were revoked; meter data keeps flowing.`
              : `${updated.name} is restored and its users can sign in again.`
          }),
          onSuccess: ({ enterprise: updated }) =>
            openOverlay({ kind: "enterprise", id: updated.id })
        })
      }
    />
  );
}

export function ReissueAdminModal({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { run } = useWorkspace();
  const enterprise = snapshot.enterprises.find(item => item.id === id);
  if (!enterprise) return null;

  return (
    <ReasonModal
      title="Reissue administrator invite"
      description={`${enterprise.name} · ${enterprise.adminEmail ?? "No invitation issued"}`}
      formId="reissue-admin-form"
      submitLabel="Reissue invite"
      placeholder="Why a new invitation is required"
      onSubmit={reason =>
        void run(() => api.reissueAdminInvite({ id, reason }), {
          failureTitle: "Invitation could not be reissued",
          success: ({ enterprise: updated }) => ({
            title: "Administrator invite reissued",
            detail: `A fresh invitation was issued to ${updated.adminEmail ?? updated.adminName ?? "the initial administrator"}.`
          })
        })
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Sites                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Provision a site directly for an enterprise. This is the Rana54-side path
 * when no site request was submitted; the organisation's own request goes
 * through the site request decision instead.
 */
export function NewSiteModal({ enterpriseId }: { enterpriseId?: string }) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const enterprises = snapshot.enterprises.filter(item => item.status !== "Suspended");

  return (
    <FormModal
      title="Provision site"
      description="Create a governed site identity for an enterprise. Gateway linking still requires an installation job."
      formId="site-form"
      submitLabel="Provision site"
      submitIcon="plus"
      onSubmit={data =>
        void run(
          () =>
            api.createSite({
              enterpriseId: text(data, "enterpriseId"),
              name: text(data, "name"),
              address: text(data, "address")
            }),
          {
            failureTitle: "Site could not be provisioned",
            success: ({ site }) => ({
              title: "Site provisioned",
              detail: `${site.name} (${site.id}) is provisioned for ${site.enterprise}. It goes live once an installation is accepted.`
            }),
            onSuccess: ({ site }) => openOverlay({ kind: "enterprise", id: site.enterpriseId })
          }
        )
      }
    >
      <div className="field full">
        <label htmlFor="site-enterprise">Enterprise</label>
        <select id="site-enterprise" name="enterpriseId" required defaultValue={enterpriseId ?? ""}>
          <option value="">Select enterprise</option>
          {enterprises.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field full">
        <label htmlFor="site-name">Site name</label>
        <input id="site-name" name="name" required maxLength={300} placeholder="Lekki Distribution Hub" />
      </div>
      <div className="field full">
        <label htmlFor="site-address">Address</label>
        <input
          id="site-address"
          name="address"
          required
          maxLength={500}
          placeholder="12 Admiralty Way, Lekki Phase 1, Lagos"
        />
      </div>
      <div className="field full">
        <Notice icon="shield">
          The site starts as provisioned. Readings arrive only after a gateway is linked inside an
          installation job and the installation is accepted.
        </Notice>
      </div>
    </FormModal>
  );
}

/**
 * Move a site between lifecycle states. Activation normally happens when an
 * installation is accepted; this is the direct path for sites commissioned
 * outside a job, and the only way to retire one.
 */
export function SiteLifecycleModal({
  id,
  status
}: {
  id: string;
  status: "active" | "decommissioned";
}) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const site = snapshot.sites.find(item => item.id === id);
  if (!site) return null;

  const retiring = status === "decommissioned";
  const verb = retiring ? "Decommission" : "Activate";

  return (
    <ReasonModal
      title={`${verb} site`}
      description={`${site.name} · ${site.id} · ${site.status}`}
      formId="site-lifecycle-form"
      submitLabel={`Confirm ${verb.toLowerCase()}`}
      submitTone={retiring ? "btn-danger" : "btn-primary"}
      placeholder={
        retiring
          ? "Why this site is being retired (for example the contract ended)"
          : "Why this site is going live without a job acceptance"
      }
      notice={
        <Notice icon="shield" tone={retiring ? "danger" : undefined}>
          {retiring
            ? "A decommissioned site keeps its identity, devices and readings history, and cannot be reactivated."
            : "An active site is treated as live: readings are expected and freshness is monitored."}
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.setSiteLifecycle({ siteId: id, status, reason }), {
          failureTitle: `Site not ${retiring ? "decommissioned" : "activated"}`,
          success: ({ site: updated }) => ({
            title: `Site ${retiring ? "decommissioned" : "activated"}`,
            detail: `${updated.name} is now ${String(updated.status).toLowerCase()}.`
          }),
          onSuccess: ({ site: updated }) =>
            openOverlay({ kind: "enterprise", id: updated.enterpriseId })
        })
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Devices                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Register a metering device on a site. Registration records identity and
 * certification only; the device joins a job through gateway linking.
 */
export function RegisterDeviceModal({ siteId }: { siteId?: string }) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const sites = snapshot.sites.filter(item => item.status !== "Decommissioned");

  return (
    <FormModal
      title="Register device"
      description="Record a metering device's identity and certification against a site."
      formId="register-device-form"
      submitLabel="Register device"
      submitIcon="plus"
      onSubmit={data =>
        void run(
          () =>
            api.registerDevice({
              siteId: text(data, "siteId"),
              serialNumber: text(data, "serialNumber"),
              role: text(data, "role") as DeviceRole,
              transmissionIntervalS: Number(text(data, "transmissionIntervalS")) || 60,
              certStatus: text(data, "certStatus") as DeviceCertStatus,
              certExpiry: text(data, "certExpiry") || undefined
            }),
          {
            failureTitle: "Device could not be registered",
            success: ({ device }) => ({
              title: "Device registered",
              detail: `${device.serial} is registered at ${device.site}. It can now be linked inside an installation job.`
            }),
            onSuccess: ({ device }) => openOverlay({ kind: "device", id: device.id })
          }
        )
      }
    >
      <Notice icon="shield">
        Linking a gateway to a job requires a registered device with this exact serial. The
        serial is checked for duplicates; registration never creates readings.
      </Notice>
      <div className="field full">
        <label htmlFor="device-site">Site</label>
        <select id="device-site" name="siteId" required defaultValue={siteId ?? ""}>
          <option value="">Select site</option>
          {sites.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.enterprise}
            </option>
          ))}
        </select>
      </div>
      <div className="field full">
        <label htmlFor="device-serial">Serial number</label>
        <input
          id="device-serial"
          name="serialNumber"
          required
          minLength={4}
          maxLength={120}
          placeholder="R54G-00A0-0000"
        />
      </div>
      <div className="field">
        <label htmlFor="device-role">Role</label>
        <select id="device-role" name="role" required defaultValue="grid">
          <option value="grid">Grid meter</option>
          <option value="inverter_output">Inverter output meter</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="device-interval">Transmission interval (seconds)</label>
        <input
          id="device-interval"
          name="transmissionIntervalS"
          type="number"
          required
          min={1}
          max={86400}
          defaultValue={60}
        />
      </div>
      <div className="field">
        <label htmlFor="device-cert-status">Certification</label>
        <select id="device-cert-status" name="certStatus" required defaultValue="certified">
          <option value="certified">Certified</option>
          <option value="pending">Pending certification</option>
          <option value="expired">Certificate expired</option>
          <option value="uncertified">Uncertified</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="device-cert-expiry">Certificate expiry</label>
        <input id="device-cert-expiry" name="certExpiry" type="date" />
        <small>Optional. Leave blank when the certificate has no recorded expiry.</small>
      </div>
    </FormModal>
  );
}

/* -------------------------------------------------------------------------- */
/* Site requests                                                               */
/* -------------------------------------------------------------------------- */

export function SiteDecisionModal({
  id,
  decision
}: {
  id: string;
  decision: "Approved" | "Returned";
}) {
  const snapshot = useSnapshot();
  const { run } = useWorkspace();
  const request = snapshot.siteRequests.find(item => item.id === id);
  if (!request) return null;

  const returning = decision === "Returned";

  return (
    <ReasonModal
      title={`${decision} site request`}
      description={`${request.siteName} · ${request.id}`}
      formId="site-decision-form"
      submitLabel={`Confirm ${decision.toLowerCase()}`}
      submitTone={returning ? "btn-danger" : "btn-primary"}
      label="Decision reason"
      placeholder="Record why this decision is appropriate"
      notice={
        <Notice icon={returning ? "incident" : "shield"} tone={returning ? "warning" : undefined}>
          {returning
            ? "Returning the request keeps its history and gives the enterprise a clear correction path."
            : "Approval creates a governed site identity. Gateway linking still requires an approved installation job."}
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.decideSiteRequest({ id, decision, reason }), {
          failureTitle: "Decision could not be recorded",
          success: () => ({
            title: `Site request ${pastTense(decision)}`,
            detail: returning
              ? "The request remains in history with a clear correction reason."
              : "The governed site identity is available for field operations."
          })
        })
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Field operations                                                            */
/* -------------------------------------------------------------------------- */

export function NewJobModal() {
  const snapshot = useSnapshot();
  const router = useRouter();
  const { run, openOverlay, closeOverlay } = useWorkspace();

  // A job can only begin from an approved site request that is not already
  // being delivered by an open job.
  const approved = snapshot.siteRequests.filter(
    item =>
      item.status === "Approved" &&
      !snapshot.jobs.some(job => job.siteRequestId === item.id && job.status !== "Completed")
  );
  const installers = snapshot.installers.filter(item => item.status !== "Suspended");

  if (!approved.length) {
    return (
      <Modal
        title="Create installation job"
        description="Jobs can only begin from an approved site request."
        footer={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              closeOverlay();
              router.push("/enterprises?tab=requests");
            }}
          >
            Review site requests
          </button>
        }
      >
        <EmptyState
          icon="field"
          title="No approved site is available"
          description="Approve a pending site request or finish the active job before creating another one."
        />
      </Modal>
    );
  }

  return (
    <FormModal
      title="Create installation job"
      description="Jobs can only begin from an approved site request."
      formId="job-form"
      submitLabel="Create and assign"
      onSubmit={data =>
        void run(
          () =>
            api.createJob({
              requestId: text(data, "requestId"),
              installerId: text(data, "installerId"),
              date: text(data, "date"),
              time: text(data, "time"),
              note: text(data, "note")
            }),
          {
            failureTitle: "Job could not be created",
            success: ({ job }) => ({
              title: "Installation job created",
              detail: `${job.id} was assigned to ${job.installer}.`
            }),
            onSuccess: ({ job }) => openOverlay({ kind: "job", id: job.id })
          }
        )
      }
    >
      <div className="field full">
        <label htmlFor="job-request">Approved site request</label>
        <select id="job-request" name="requestId" required defaultValue="">
          <option value="">Select approved request</option>
          {approved.map(item => (
            <option key={item.id} value={item.id}>
              {item.siteName} · {item.id}
            </option>
          ))}
        </select>
      </div>
      <div className="field full">
        <label htmlFor="job-installer">Assign installer</label>
        <select id="job-installer" name="installerId" required defaultValue="">
          <option value="">Select installer</option>
          {installers.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.region} · {item.capacity}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="job-date">Scheduled date</label>
        <input id="job-date" type="date" name="date" required />
      </div>
      <div className="field">
        <label htmlFor="job-time">Scheduled time</label>
        <input id="job-time" type="time" name="time" required />
      </div>
      <div className="field full">
        <label htmlFor="job-note">Operations note</label>
        <textarea
          id="job-note"
          name="note"
          required
          minLength={8}
          placeholder="Site access, owner contact, or delivery constraints"
        />
      </div>
    </FormModal>
  );
}

export function ReassignJobModal({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const job = snapshot.jobs.find(item => item.id === id);
  if (!job) return null;

  const installers = snapshot.installers.filter(item => item.status !== "Suspended");

  return (
    <FormModal
      title="Reassign installation job"
      description={`${job.site} · ${job.id}`}
      formId="reassign-job-form"
      submitLabel="Reassign job"
      onSubmit={data =>
        void run(
          () =>
            api.reassignJob({
              id,
              installerId: text(data, "installerId"),
              reason: text(data, "reason")
            }),
          {
            failureTitle: "Job could not be reassigned",
            success: ({ job: updated }) => ({
              title: "Job reassigned",
              detail: `${updated.id} is now assigned to ${updated.installer}.`
            }),
            onSuccess: ({ job: updated }) => openOverlay({ kind: "job", id: updated.id })
          }
        )
      }
    >
      <div className="field full">
        <label htmlFor="reassign-installer">Installer</label>
        <select
          id="reassign-installer"
          name="installerId"
          required
          defaultValue={job.installerId}
        >
          {installers.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.region} · {item.capacity}
            </option>
          ))}
        </select>
      </div>
      <div className="field full">
        <label htmlFor="reassign-reason">Reassignment reason</label>
        <textarea id="reassign-reason" name="reason" required minLength={8} />
      </div>
    </FormModal>
  );
}

export function LinkGatewayModal({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const job = snapshot.jobs.find(item => item.id === id);
  if (!job) return null;

  return (
    <FormModal
      title="Link gateway"
      description={`${job.site} · ${job.id}`}
      formId="link-device-form"
      submitLabel="Check and link"
      onSubmit={data =>
        void run(
          () =>
            api.linkGateway({
              jobId: id,
              serial: text(data, "serial"),
              reason: text(data, "reason")
            }),
          {
            failureTitle: "Gateway link blocked",
            success: ({ device }) => ({
              title: "Gateway linked",
              detail: `${device.id} is now in commissioning. No readings were manually entered.`
            }),
            onSuccess: ({ device }) => openOverlay({ kind: "device", id: device.id })
          }
        )
      }
    >
      <Notice icon="shield">
        The exact serial is checked against existing identities. Link history is retained and
        cannot be silently overwritten.
      </Notice>
      <div className="field full">
        <label htmlFor="link-serial">Gateway serial</label>
        <input
          id="link-serial"
          name="serial"
          required
          minLength={8}
          placeholder="R54G-00A0-0000"
        />
      </div>
      <div className="field full">
        <label htmlFor="link-reason">Commissioning note</label>
        <textarea
          id="link-reason"
          name="reason"
          required
          minLength={8}
          placeholder="Confirm the physical identity and evidence source"
        />
      </div>
    </FormModal>
  );
}

export function UnlinkGatewayModal({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const job = snapshot.jobs.find(item => item.id === id);
  if (!job) return null;

  return (
    <ReasonModal
      title="Unlink gateway"
      description={`${job.site} · ${job.id}`}
      formId="unlink-gateway-form"
      submitLabel="Unlink and reset to scheduled"
      submitTone="btn-danger"
      label="Correction reason"
      placeholder="Why the linked gateway is wrong (for example a mis-scanned serial)"
      notice={
        <Notice icon="shield" tone="warning">
          The job returns to scheduled so the installer can scan again. Link history is retained
          in the audit trail; only a job in progress can be unlinked.
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.unlinkGateway({ jobId: id, reason }), {
          failureTitle: "Gateway could not be unlinked",
          success: ({ job: updated }) => ({
            title: "Gateway unlinked",
            detail: `${updated.id} is back to ${String(updated.status).toLowerCase()} and ready for a rescan.`
          }),
          onSuccess: ({ job: updated }) => openOverlay({ kind: "job", id: updated.id })
        })
      }
    />
  );
}

/** Resume a blocked job once the field blocker has been dealt with. */
export function UnblockJobModal({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const job = snapshot.jobs.find(item => item.id === id);
  if (!job) return null;

  return (
    <ReasonModal
      title="Unblock job"
      description={`${job.site} · ${job.id}`}
      formId="unblock-job-form"
      submitLabel="Resume job"
      label="Resolution note"
      placeholder="How the blocker was resolved (for example the correct homeowner was reached)"
      notice={
        <Notice icon="shield" tone="warning">
          {job.blockers.length ? `${job.blockers.join(" ")} ` : ""}
          The job resumes in progress when a gateway is linked, otherwise as scheduled. The
          blocker history stays in the audit trail.
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.unblockJob({ jobId: id, resolutionNote: reason }), {
          failureTitle: "Job could not be unblocked",
          success: ({ job: updated }) => ({
            title: "Job unblocked",
            detail: `${updated.id} is back to ${String(updated.status).toLowerCase()}.`
          }),
          onSuccess: ({ job: updated }) => openOverlay({ kind: "job", id: updated.id })
        })
      }
    />
  );
}

export function AcceptInstallationModal({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { run } = useWorkspace();
  const job = snapshot.jobs.find(item => item.id === id);
  if (!job) return null;

  return (
    <FormModal
      title="Accept installation"
      description={`${job.site} · ${job.id}`}
      formId="accept-installation-form"
      submitLabel="Accept installation"
      onSubmit={data =>
        void run(() => api.acceptInstallation({ jobId: id, reason: text(data, "reason") }), {
          failureTitle: "Installation not accepted",
          success: ({ job: accepted }) => ({
            title: "Installation accepted",
            detail: `${accepted.site} can now progress to waiting for first data or live status.`
          })
        })
      }
    >
      <Notice icon="shield">
        Acceptance confirms identity, mapped functions, commissioning evidence, and delivery
        testing. It does not certify future readings.
      </Notice>
      <div className="field full">
        <label htmlFor="accept-reason">Acceptance note</label>
        <textarea
          id="accept-reason"
          name="reason"
          required
          minLength={8}
          placeholder="Summarize the evidence reviewed"
        />
      </div>
      <div className="field full">
        <label className="check-row">
          <input type="checkbox" name="confirmed" required />
          <span>
            <strong>I reviewed the linked gateway and energy functions</strong>
            <small>The accepted record becomes append-only operational history.</small>
          </span>
        </label>
      </div>
    </FormModal>
  );
}

/**
 * Onboard an installer. The platform creates their pending account and sends
 * the activation link; job access is granted per assignment, not here.
 */
export function NewInstallerModal() {
  const { run, openOverlay } = useWorkspace();

  return (
    <FormModal
      title="Add installer"
      description="Create the installer's account and roster entry. They activate by email."
      formId="installer-form"
      submitLabel="Add installer"
      submitIcon="plus"
      onSubmit={data => {
        const fullName = text(data, "fullName");
        void run(
          () =>
            api.createInstaller({
              email: text(data, "email"),
              fullName,
              name: fullName,
              phone: text(data, "phone"),
              region: text(data, "region"),
              certStatus: text(data, "certStatus") as InstallerCertStatus,
              certExpiry: text(data, "certExpiry") || undefined
            }),
          {
            failureTitle: "Installer could not be added",
            success: ({ installer }) => ({
              title: "Installer added",
              detail: `${installer.name} is on the roster and can be assigned to jobs once activated.`
            }),
            onSuccess: ({ installer }) => openOverlay({ kind: "installer", id: installer.id })
          }
        );
      }}
    >
      <div className="field">
        <label htmlFor="installer-name">Full name</label>
        <input id="installer-name" name="fullName" required maxLength={120} placeholder="Full name" />
      </div>
      <div className="field">
        <label htmlFor="installer-email">Email</label>
        <input
          id="installer-email"
          name="email"
          type="email"
          required
          placeholder="name@installer.example"
        />
        <small>The activation link is sent here.</small>
      </div>
      <div className="field">
        <label htmlFor="installer-phone">Phone</label>
        <input
          id="installer-phone"
          name="phone"
          type="tel"
          required
          placeholder="+234 800 000 0000"
        />
      </div>
      <div className="field">
        <label htmlFor="installer-region">Region</label>
        <select id="installer-region" name="region" required defaultValue="">
          <option value="">Select region</option>
          {NIGERIAN_REGIONS.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="installer-cert-status">Certification</label>
        <select id="installer-cert-status" name="certStatus" required defaultValue="current">
          <option value="current">Current</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="installer-cert-expiry">Certificate expiry</label>
        <input id="installer-cert-expiry" name="certExpiry" type="date" />
        <small>Optional.</small>
      </div>
      <div className="field full">
        <Notice icon="shield">
          Installers see only the jobs assigned to them. No site or organisation access is
          granted at onboarding.
        </Notice>
      </div>
    </FormModal>
  );
}

export function InstallerTransitionModal({
  id,
  transition
}: {
  id: string;
  transition: "Suspend" | "Restore";
}) {
  const snapshot = useSnapshot();
  const { run } = useWorkspace();
  const installer = snapshot.installers.find(item => item.id === id);
  if (!installer) return null;

  const suspending = transition === "Suspend";

  return (
    <ReasonModal
      title={`${transition} installer`}
      description={`${installer.name} · ${installer.id}`}
      formId="installer-transition-form"
      submitLabel={`Confirm ${transition.toLowerCase()}`}
      submitTone={suspending ? "btn-danger" : "btn-primary"}
      notice={
        <Notice icon="shield" tone={suspending ? "danger" : undefined}>
          The installer identity and completed job history will be retained. Active jobs must be
          reassigned separately.
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.transitionInstaller({ id, transition, reason }), {
          failureTitle: `Installer not ${pastTense(transition)}`,
          success: () => ({
            title: `Installer ${pastTense(transition)}`,
            detail: "The installer identity and prior job history were retained."
          })
        })
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Incidents                                                                   */
/* -------------------------------------------------------------------------- */

export function NewIncidentModal() {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();

  return (
    <FormModal
      title="Open incident"
      description="Create a governed operational record and assign initial severity."
      formId="incident-form"
      submitLabel="Open incident"
      onSubmit={data =>
        void run(
          () =>
            api.createIncident({
              title: text(data, "title"),
              severity: text(data, "severity") as Severity,
              scope: text(data, "scope"),
              enterprise: text(data, "enterprise"),
              owner: text(data, "owner"),
              note: text(data, "note")
            }),
          {
            failureTitle: "Incident could not be opened",
            success: ({ incident }) => ({
              title: "Incident opened",
              detail: `${incident.id} is now in the operational response queue.`
            }),
            onSuccess: ({ incident }) => openOverlay({ kind: "incident", id: incident.id })
          }
        )
      }
    >
      <div className="field full">
        <label htmlFor="incident-title">Title</label>
        <input id="incident-title" name="title" required maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="incident-severity">Severity</label>
        <select id="incident-severity" name="severity" defaultValue="P2">
          <option>P1</option>
          <option>P2</option>
          <option>P3</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="incident-scope">Scope</label>
        <select id="incident-scope" name="scope" defaultValue="Platform">
          <option>Platform</option>
          <option>Tenant</option>
          <option>Installation</option>
          <option>Device and data</option>
          <option>Access</option>
          <option>Field operations</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="incident-enterprise">Enterprise</label>
        <select id="incident-enterprise" name="enterprise" defaultValue="Multiple tenants">
          <option>Multiple tenants</option>
          {snapshot.enterprises.map(item => (
            <option key={item.id}>{item.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="incident-owner">Initial owner</label>
        <select id="incident-owner" name="owner" defaultValue="Unassigned">
          <option>Unassigned</option>
          <option>Platform operations</option>
          <option>Device operations</option>
          <option>Field operations</option>
        </select>
      </div>
      <div className="field full">
        <label htmlFor="incident-note">Initial evidence</label>
        <textarea id="incident-note" name="note" required minLength={8} />
      </div>
    </FormModal>
  );
}

export function IncidentTransitionModal({
  id,
  transition
}: {
  id: string;
  transition: "Assign" | "Acknowledge" | "Resolve" | "Reopen";
}) {
  const snapshot = useSnapshot();
  const { run, openOverlay } = useWorkspace();
  const incident = snapshot.incidents.find(item => item.id === id);
  if (!incident) return null;

  const assigning = transition === "Assign";

  return (
    <ReasonModal
      title={`${transition} incident`}
      description={`${incident.id} · ${incident.title}`}
      formId="incident-transition-form"
      submitLabel={`Confirm ${transition.toLowerCase()}`}
      label={transition === "Resolve" ? "Resolution" : "Reason"}
      onSubmit={(reason, data) =>
        void run(
          () =>
            api.transitionIncident({
              id,
              transition,
              owner: assigning ? text(data, "owner") : undefined,
              reason
            }),
          {
            failureTitle: `Incident not ${pastTense(transition)}`,
            success: ({ incident: updated }) => ({
              title: `Incident ${pastTense(transition)}`,
              detail: `${updated.id} is now ${String(updated.status).toLowerCase()}.`
            }),
            onSuccess: ({ incident: updated }) =>
              openOverlay({ kind: "incident", id: updated.id })
          }
        )
      }
    >
      {assigning ? (
        <div className="field full">
          <label htmlFor="incident-assign-owner">Assign to</label>
          <select id="incident-assign-owner" name="owner" required defaultValue="">
            <option value="">Select owner</option>
            <option>Platform operations</option>
            <option>Device operations</option>
            <option>Field operations</option>
            <option>Data operations</option>
          </select>
        </div>
      ) : null}
    </ReasonModal>
  );
}

/* -------------------------------------------------------------------------- */
/* Access                                                                      */
/* -------------------------------------------------------------------------- */

export function InviteStaffModal() {
  const router = useRouter();
  const { run } = useWorkspace();
  const [role, setRole] = useState<StaffRole>("support_analyst");
  const selected = STAFF_ROLES.find(item => item.value === role) ?? STAFF_ROLES[3];
  const analyst = role === "support_analyst";

  return (
    <FormModal
      title="Invite Rana54 staff"
      description="Invite a staff member with an explicit role. The platform derives their operating scope from it."
      formId="staff-form"
      submitLabel="Send invitation"
      onSubmit={data =>
        void run(
          () =>
            api.inviteStaff({
              name: text(data, "name"),
              email: text(data, "email"),
              role: text(data, "role"),
              reason: text(data, "reason")
            }),
          {
            failureTitle: "Invitation could not be sent",
            success: ({ staff }) => ({
              title: "Staff invitation sent",
              detail: staff.tempPassword
                ? `Provisioned. One-time temporary password for ${staff.email}: ${staff.tempPassword} (copy it now, it is not shown again).`
                : isSupportAnalyst(staff)
                  ? `${staff.name} was invited as a Support Analyst. They cannot activate their account until their first support grant is issued, so the invitation stays pending until then.`
                  : staff.privileged
                    ? `${staff.name} was invited. Privileged cross-tenant access is covered by the next access review.`
                    : `${staff.name} was invited and an activation email was sent.`
            }),
            onSuccess: () => router.push("/access?tab=staff")
          }
        )
      }
    >
      <div className="field">
        <label htmlFor="staff-name">Full name</label>
        <input id="staff-name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="staff-email">Work email</label>
        <input id="staff-email" name="email" type="email" required />
      </div>
      <div className="field">
        <label htmlFor="staff-role">Role</label>
        <select
          id="staff-role"
          name="role"
          required
          value={role}
          onChange={event => setRole(event.target.value as StaffRole)}
        >
          {STAFF_ROLES.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="staff-scope">Scope</label>
        <input
          id="staff-scope"
          value={analyst ? "Assigned tenants, via support grants" : selected.scope}
          disabled
          readOnly
        />
        <small>
          {analyst
            ? "No standing access. Every read into a tenant goes through a time-limited support grant."
            : "Standing access across every tenant on the Rana54 platform."}
        </small>
      </div>
      <div className="field full">
        <label htmlFor="staff-reason">Access reason</label>
        <textarea
          id="staff-reason"
          name="reason"
          required
          minLength={8}
          placeholder="Why this staff access is required"
        />
      </div>
      <div className="field full">
        <Notice icon="shield">
          {analyst
            ? "A Support Analyst cannot accept their invitation until their first support grant is issued; that wait is expected, not a stuck invite."
            : "An activation email is sent. Privileged cross-tenant access is reviewed separately and cannot be self-approved."}
        </Notice>
      </div>
    </FormModal>
  );
}

export function StaffTransitionModal({
  id,
  transition
}: {
  id: string;
  transition: "Suspend" | "Restore";
}) {
  const snapshot = useSnapshot();
  const { run } = useWorkspace();
  const person = snapshot.staff.find(item => item.id === id);
  if (!person) return null;

  const suspending = transition === "Suspend";

  return (
    <ReasonModal
      title={`${transition} staff access`}
      description={`${person.name} · ${person.id}`}
      formId="staff-transition-form"
      submitLabel={`Confirm ${transition.toLowerCase()}`}
      submitTone={suspending ? "btn-danger" : "btn-primary"}
      notice={
        <Notice icon="shield" tone={suspending ? "danger" : undefined}>
          History and assignments are retained. This action does not delete the staff identity.
          {suspending
            ? " Any active support grants held by this member are revoked in the same step."
            : ""}
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.transitionStaff({ id, transition, reason }), {
          failureTitle: suspending ? "Suspension blocked" : "Access not restored",
          success: () => ({
            title: `Staff access ${pastTense(transition)}`,
            detail: suspending
              ? "Identity history and prior assignments were retained. Active support grants were revoked."
              : "Identity history and prior assignments were retained."
          })
        })
      }
    />
  );
}

/**
 * Issue a read-only, time-limited support grant. Only a Support Analyst can
 * hold one (every other role already reaches every tenant), so the roster is
 * filtered to analysts. An invited analyst is offered too: their first grant
 * is what lets them activate their account at all.
 */
export function SupportGrantModal({ enterpriseId }: { enterpriseId?: string }) {
  const snapshot = useSnapshot();
  const router = useRouter();
  const { run } = useWorkspace();
  const analysts = snapshot.staff.filter(
    item => isSupportAnalyst(item) && item.status !== "Suspended"
  );
  const enterprises = snapshot.enterprises.filter(item => item.status !== "Suspended");

  return (
    <FormModal
      title="Grant tenant support access"
      description="Create a read-only, time-limited, audited support session for a Support Analyst."
      formId="support-form"
      submitLabel="Grant temporary access"
      onSubmit={data =>
        void run(
          () =>
            api.createSupportGrant({
              staffId: text(data, "staffId"),
              enterpriseId: text(data, "enterpriseId"),
              duration: Number(text(data, "duration")),
              reason: text(data, "reason")
            }),
          {
            failureTitle: "Support access could not be granted",
            success: ({ grant }) => ({
              title: "Temporary support access granted",
              detail: `${grant.staff} has read-only access to ${grant.enterprise} until ${grant.expires}.`
            }),
            onSuccess: () => router.push("/access?tab=grants")
          }
        )
      }
    >
      <div className="field">
        <label htmlFor="support-staff">Support Analyst</label>
        <select id="support-staff" name="staffId" required defaultValue="">
          <option value="">Select analyst</option>
          {analysts.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.status === "Invited" ? " · Invited, first grant" : ""}
            </option>
          ))}
        </select>
        {analysts.length ? null : (
          <small>No Support Analyst is on the roster. Invite one first.</small>
        )}
      </div>
      <div className="field">
        <label htmlFor="support-enterprise">Enterprise</label>
        <select
          id="support-enterprise"
          name="enterpriseId"
          required
          defaultValue={enterpriseId ?? ""}
        >
          <option value="">Select enterprise</option>
          {enterprises.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <small>A suspended enterprise cannot receive support access.</small>
      </div>
      <div className="field">
        <label htmlFor="support-duration">Duration</label>
        <select id="support-duration" name="duration" required defaultValue="2">
          {SUPPORT_GRANT_DURATIONS.map(hours => (
            <option key={hours} value={hours}>
              {hours} hours
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="support-mode">Mode</label>
        <input id="support-mode" value="Read only" disabled readOnly />
        <small>Support access is always read only.</small>
      </div>
      <div className="field full">
        <label htmlFor="support-reason">Support reason</label>
        <textarea
          id="support-reason"
          name="reason"
          required
          minLength={8}
          placeholder="Specific issue this access will support"
        />
      </div>
      <div className="field full">
        <Notice icon="lock">
          This does not impersonate the enterprise user. Personal data stays masked, every view
          is audited on the tenant&apos;s own log, and the reason is visible to the customer.
        </Notice>
      </div>
    </FormModal>
  );
}

/** End an active support grant early. It takes effect on the analyst's next request. */
export function RevokeGrantModal({ id }: { id: string }) {
  const snapshot = useSnapshot();
  const { run } = useWorkspace();
  const grant = snapshot.supportGrants.find(item => item.id === id);
  if (!grant) return null;

  return (
    <ReasonModal
      title="Revoke support access"
      description={`${grant.staff} · ${grant.enterprise} · expires ${grant.expires}`}
      formId="revoke-grant-form"
      submitLabel="Revoke access"
      submitTone="btn-danger"
      placeholder="Why the support session is being ended early"
      notice={
        <Notice icon="shield" tone="danger">
          Access ends on the analyst&apos;s very next request, not at token expiry. The grant
          stays in history as revoked; a grant that has already expired on its own is left as
          it is.
        </Notice>
      }
      onSubmit={reason =>
        void run(() => api.revokeSupportGrant({ id, reason }), {
          failureTitle: "Support access not revoked",
          success: ({ grant: revoked }) => ({
            title: "Support access revoked",
            detail: `${revoked.staff} no longer has access to ${revoked.enterprise}.`
          })
        })
      }
    />
  );
}
