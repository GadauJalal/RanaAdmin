"use client";

import { useTabParam } from "@/hooks/use-tab-param";
import { Icon } from "@/components/ui/Icon";
import { Chip, Metric, Notice, PageHeader, TableWrap, Tabs } from "@/components/ui/primitives";
import { api, IS_PROTOTYPE_DATA } from "@/lib/api";
import { downloadCsv } from "@/lib/format";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

/** Service health, safe checks, and the append-only operational history. */
export function PlatformView() {
  const snapshot = useSnapshot();
  const { run, resetToSeed, pushToast } = useWorkspace();
  const [tab, setTab] = useTabParam("health");

  const degraded = snapshot.services.filter(item => item.status !== "Operational").length;
  const activeGrants = snapshot.supportGrants.filter(item => item.status === "Active").length;

  function exportAudit() {
    void run(() => api.recordExport("audit"), {
      failureTitle: "Export could not be recorded",
      success: () => ({
        title: "Audit export prepared",
        detail: "The immutable event view was exported as CSV."
      }),
      keepOverlay: true,
      onSuccess: (_data, fresh) =>
        downloadCsv("rana54-control-center-audit.csv", [
          ["Time", "Actor", "Action", "Entity", "Outcome", "Reason"],
          ...fresh.audit.map(item => [
            item.time,
            item.actor,
            item.action,
            item.entity,
            item.outcome,
            item.reason
          ])
        ])
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
          value={snapshot.audit.length}
          detail="Append only operational history"
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
            <span className="eyebrow">Append only · {snapshot.audit.length} events</span>
            <span className="spacer" />
            <button type="button" className="btn btn-small btn-secondary" onClick={exportAudit}>
              <Icon name="download" /> Export CSV
            </button>
          </div>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.audit.map(event => (
                  <tr key={event.id}>
                    <td>{event.time}</td>
                    <td>{event.actor}</td>
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
        </section>
      )}
    </main>
  );
}
