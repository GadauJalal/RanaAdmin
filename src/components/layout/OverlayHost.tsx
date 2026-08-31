"use client";

import {
  DeviceDrawer,
  EnterpriseDrawer,
  IncidentDrawer,
  InstallerDrawer,
  JobDrawer,
  NotificationsDrawer,
  SiteRequestDrawer,
  StaffDrawer
} from "@/components/drawers/RecordDrawers";
import {
  AcceptInstallationModal,
  EnterpriseTransitionModal,
  IncidentTransitionModal,
  InstallerTransitionModal,
  InviteStaffModal,
  LinkGatewayModal,
  NewEnterpriseModal,
  NewIncidentModal,
  NewJobModal,
  ReassignJobModal,
  ReissueAdminModal,
  SiteDecisionModal,
  StaffTransitionModal,
  SupportGrantModal
} from "@/components/modals/WorkflowModals";
import { useWorkspace, type Overlay } from "@/providers/workspace-provider";

function renderOverlay(overlay: Overlay) {
  switch (overlay.kind) {
    case "enterprise":
      return <EnterpriseDrawer id={overlay.id} />;
    case "site-request":
      return <SiteRequestDrawer id={overlay.id} />;
    case "job":
      return <JobDrawer id={overlay.id} />;
    case "installer":
      return <InstallerDrawer id={overlay.id} />;
    case "device":
      return <DeviceDrawer id={overlay.id} />;
    case "incident":
      return <IncidentDrawer id={overlay.id} />;
    case "staff":
      return <StaffDrawer id={overlay.id} />;
    case "notifications":
      return <NotificationsDrawer />;
    case "new-enterprise":
      return <NewEnterpriseModal />;
    case "new-job":
      return <NewJobModal />;
    case "new-incident":
      return <NewIncidentModal />;
    case "invite-staff":
      return <InviteStaffModal />;
    case "support-grant":
      return <SupportGrantModal enterpriseId={overlay.enterpriseId} />;
    case "site-decision":
      return <SiteDecisionModal id={overlay.id} decision={overlay.decision} />;
    case "incident-transition":
      return <IncidentTransitionModal id={overlay.id} transition={overlay.transition} />;
    case "enterprise-transition":
      return <EnterpriseTransitionModal id={overlay.id} transition={overlay.transition} />;
    case "staff-transition":
      return <StaffTransitionModal id={overlay.id} transition={overlay.transition} />;
    case "installer-transition":
      return <InstallerTransitionModal id={overlay.id} transition={overlay.transition} />;
    case "reassign-job":
      return <ReassignJobModal id={overlay.id} />;
    case "link-gateway":
      return <LinkGatewayModal id={overlay.id} />;
    case "accept-installation":
      return <AcceptInstallationModal id={overlay.id} />;
    case "reissue-admin":
      return <ReissueAdminModal id={overlay.id} />;
    default:
      return null;
  }
}

/**
 * The single place an overlay can appear. Keying by identity remounts the
 * surface when the operator moves from one record to another, so form state and
 * focus never leak between records.
 */
export function OverlayHost() {
  const { overlay } = useWorkspace();

  return (
    <div id="overlay">
      {overlay ? (
        <div key={JSON.stringify(overlay)}>{renderOverlay(overlay)}</div>
      ) : null}
    </div>
  );
}
