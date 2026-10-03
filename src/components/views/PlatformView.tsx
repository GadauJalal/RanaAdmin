"use client";

import { useEffect, useState } from "react";

import { useTabParam } from "@/hooks/use-tab-param";
import { Icon } from "@/components/ui/Icon";
import { Chip, EmptyState, Metric, Notice, PageHeader, TableWrap, Tabs } from "@/components/ui/primitives";
import {
  api,
  AUDIT_ACTOR_TYPES,
  IS_PROTOTYPE_DATA,
  type AuditActorType,
  type AuditPage
} from "@/lib/api";
import { downloadCsv } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

/** The snapshot already holds the people view of the audit log. */
function peoplePage(snapshot: Snapshot): AuditPage {
  return { actorType: "user", events: snapshot.audit, total: snapshot.auditTotal };
}

/** Service health, safe checks, and the append-only operational history. */
export function PlatformView() {
  const snapshot = useSnapshot();
  const { run, resetToSeed, pushToast } = useWorkspace();
  const [tab, setTab] = useTabParam("health");

  /*
   * Which actors the audit history shows. People is the default so grants,
   * invites and approvals are never buried under ingestion rows; the System
   * and All views are read from the platform when chosen, and re-read when
   * the picture changes so they never fall behind the people view.
   */
  const [actorType, setActorType] = useState<AuditActorType>("user");
  const [loadedPage, setLoadedPage] = useState<AuditPage | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  useEffect(() => {
    if (actorType === "user") return;
    let cancelled = false;
    setAuditError(null);
    api
      .listAudit({ actorType })
      .then(page => {
        if (!cancelled) setLoadedPage(page);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAuditError(error instanceof Error ? error.message : "The audit log could not be read.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [actorType, snapshot]);

  const page: AuditPage | null =
    actorType === "user"
      ? peoplePage(snapshot)
      : loadedPage?.actorType === actorType
        ? loadedPage
        : null;
  const actorFilter = AUDIT_ACTOR_TYPES.find(item => item.value === actorType) ?? AUDIT_ACTOR_TYPES[0];

  const degraded = snapshot.services.filter(item => item.status !== "Operational").length;
  const activeGrants = snapshot.supportGrants.filter(item => item.status === "Active").length;

  function exportAudit() {
    void run(() => api.recordExport("audit"), {
      failureTitle: "Export could not be recorded",
      success: () => ({
        title: "Audit export prepared",
        detail: `The ${actorFilter.label.toLowerCase()} view of the immutable event history was exported as CSV.`
      }),
      keepOverlay: true,
      onSuccess: (_data, fresh) => {
        // The people view comes from the refreshed picture (it includes this
        // export); the other views export exactly what is on screen.
        const events = actorType === "user" ? fresh.audit : (page?.events ?? []);
        downloadCsv("rana54-control-center-audit.csv", [
          ["Time", "Actor", "Source", "Action", "Entity", "Outcome", "Reason"],
          ...events.map(item => [
            item.time,
            item.actor,
            item.source,
            item.action,
            item.entity,
            item.outcome,
            item.reason
          ])
        ]);
      }
    });
  }

  async function returnToSeed() {
    await resetToSeed();
    pushToast(
      "Seeded network restored",
      "Prototype state was cleared. Connect the backend to work against real records."
    );
  }

  function runCheck(id: string, name: string, status: string) {
    void run(() => api.runServiceCheck(id), {
      failureTitle: "Service check could not run",
      keepOverlay: true,
      success: () => ({
        title: "Service check complete",
        detail: `${name} remains ${status.toLowerCase()}. No retry or configuration change was applied.`
      })
    });
  }

  return (
    <main className="page">
      <PageHeader
        kicker="Platform operations"
        title="Platform"
        description="Observe service health, run safe diagnostics, and inspect immutable operational history without exposing credentials."
        actions={
          <button type="button" className="btn btn-secondary" onClick={exportAudit}>
            <Icon name="download" /> Export audit
          </button>
        }
      />

      <section className="metric-strip">
        <Metric
          label="Services operational"
          value={`${snapshot.services.length - degraded} of ${snapshot.services.length}`}
          detail="Current service health"
        />
        <Metric
          label="Degraded services"
          value={degraded}
          detail="Open incident required for persistent degradation"
          tone={degraded ? "amber" : ""}
        />
        <Metric
          label="Audit events"
          value={page ? page.total : "..."}
          detail={actorFilter.detail}
        />
        <Metric
          label="Active support grants"
          value={activeGrants}
          detail="Read only and time limited"
        />
      </section>

      <div className="filters">
        <Tabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "health", label: "Service health" },
            { id: "audit", label: "Audit history" }
          ]}
        />
      </div>

      {IS_PROTOTYPE_DATA && tab === "health" ? (
        <Notice icon="info">
          <span style={{ flex: 1 }}>
            This workspace is running on seeded prototype data held in this browser. Set{" "}
            <code>NEXT_PUBLIC_DATA_SOURCE=http</code> to work against the operations service.
          </span>
          <button type="button" className="link-button" onClick={() => void returnToSeed()}>
            Restore seeded network
          </button>
        </Notice>
      ) : null}

      {tab === "health" ? (
        <div className="service-grid">
          {snapshot.services.map(service => (
            <article className="service-card" key={service.id}>
              <div className="service-card-head">
                <div>
                  <span className="eyebrow">{service.id}</span>
                  <h3>{service.name}</h3>
                </div>
                <Chip>{service.status}</Chip>
              </div>
              <p>{service.detail}</p>
              <div className="service-metric">
                {service.metric} <small>last 30 days</small>
              </div>
              <button
                type="button"
                className="btn btn-small btn-secondary"
                style={{ marginTop: 16 }}
                onClick={() => runCheck(service.id, service.name, service.status)}
              >
                <Icon name="refresh" /> Run safe check
              </button>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <div className="panel-toolbar">
            <span className="eyebrow">
              {page
                ? `Append only · newest ${page.events.length} of ${page.total} events`
                : "Append only · reading the platform log"}
            </span>
            <span className="spacer" />
            <div className="audit-actors" aria-label="Audit actors">
              <Tabs
                active={actorType}
                onSelect={next => setActorType(next as AuditActorType)}
                tabs={AUDIT_ACTOR_TYPES.map(item => ({ id: item.value, label: item.label }))}
              />
            </div>
            <button type="button" className="btn btn-small btn-secondary" onClick={exportAudit}>
              <Icon name="download" /> Export CSV
            </button>
          </div>
          {auditError ? (
            <Notice icon="alert" tone="warning">
              {auditError}
            </Notice>
          ) : null}
          {page && page.events.length === 0 ? (
            <EmptyState
              icon="info"
              title={`No ${actorFilter.label.toLowerCase()} events recorded`}
              description="The platform holds no audit entries for this actor filter."
            />
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Source</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Outcome</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(page?.events ?? []).map(event => (
                    <tr key={event.id}>
                      <td>{event.time}</td>
                      <td>{event.actor}</td>
                      <td>
                        <Chip>{event.source}</Chip>
                      </td>
                      <td className="row-main">
                        <strong>{event.action}</strong>
                        <small>{event.id}</small>
                      </td>
                      <td className="row-id">{event.entity}</td>
                      <td>
                        <Chip>{event.outcome}</Chip>
                      </td>
                      <td>{event.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </section>
      )}
    </main>
  );
}
