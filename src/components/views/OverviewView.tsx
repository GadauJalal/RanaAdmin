"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { Chip, Metric, PageHeader, Panel } from "@/components/ui/primitives";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

/** The cross-platform operational summary: what needs attention, right now. */
export function OverviewView() {
  const snapshot = useSnapshot();
  const { openOverlay, focusGlobalSearch } = useWorkspace();

  const activeEnterprises = snapshot.enterprises.filter(item => item.status === "Active").length;
  const openHigh = snapshot.incidents.filter(
    item => item.status !== "Resolved" && ["P1", "P2"].includes(item.severity)
  ).length;
  const blockedJobs = snapshot.jobs.filter(item =>
    ["Blocked", "Awaiting site approval"].includes(item.status)
  ).length;
  const delayedGateways = snapshot.devices.filter(item =>
    ["Offline", "Identity conflict"].includes(item.status)
  ).length;

  const operational = snapshot.services.filter(item => item.status === "Operational").length;
  const health = snapshot.services.length
    ? Math.round((operational / snapshot.services.length) * 100)
    : 100;
  const degradedNames = snapshot.services
    .filter(item => item.status !== "Operational")
    .map(item => item.name);

  const urgent = snapshot.incidents.filter(item => item.status !== "Resolved").slice(0, 4);
  const jobs = snapshot.jobs.filter(item => item.status !== "Completed").slice(0, 4);
  const highestPriority = urgent[0];

  return (
    <main className="page">
      <PageHeader
        kicker="Operations command"
        title="Network Operations"
        description="See what needs attention, move onboarding forward, and protect every change with traceable operational evidence."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={focusGlobalSearch}>
              <Icon name="search" /> Find a record
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openOverlay({ kind: "new-enterprise" })}
            >
              <Icon name="plus" /> Create enterprise
            </button>
          </>
        }
      />

      <section className="hero-console">
        <div className="hero-copy">
          <span className="eyebrow">Live infrastructure</span>
          <h2>One operational picture across every Rana54 account.</h2>
          <p>
            Enterprise onboarding, field delivery, gateway health, access, and incidents stay
            connected by exact identifiers and immutable history.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!highestPriority}
              onClick={() =>
                highestPriority && openOverlay({ kind: "incident", id: highestPriority.id })
              }
            >
              <Icon name="incident" /> Review highest priority
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openOverlay({ kind: "new-job" })}
            >
              <Icon name="field" /> Create field job
            </button>
          </div>
        </div>
        <div className="hero-health">
          <div className="health-top">
            <span>Platform health</span>
            <span className="status-live">
              <span className="pulse" /> Live
            </span>
          </div>
          <div>
            <div className="health-score">
              {health}
              <small>% nominal</small>
            </div>
            <p>
              {operational} of {snapshot.services.length} core services operational
              {degradedNames.length ? `. ${degradedNames.join(", ")} degraded.` : "."}
            </p>
          </div>
          <div className="mini-service-list">
            {snapshot.services.map(service => (
              <div className="mini-service" key={service.id}>
                <span>{service.name}</span>
                <b className={service.status === "Operational" ? "" : "degraded"}>
                  {service.status}
                </b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="metric-strip">
        <Metric
          label="Active enterprises"
          value={<span>{activeEnterprises}</span>}
          detail={`${snapshot.enterprises.length - activeEnterprises} in onboarding or attention`}
        />
        <Metric
          label="P1 and P2 incidents"
          value={<span>{openHigh}</span>}
          detail="Across device, installation, and platform"
          tone="red"
        />
        <Metric
          label="Blocked field work"
          value={<span>{blockedJobs}</span>}
          detail="Includes jobs waiting for site approval"
          tone="amber"
        />
        <Metric
          label="Gateway attention"
          value={<span>{delayedGateways}</span>}
          detail="Offline or identity conflict"
          tone="orange"
        />
      </section>

      <div className="grid two">
        <Panel
          title="Priority queue"
          description="Incidents ordered by severity and SLA"
          action={
            <Link className="btn btn-small btn-quiet" href="/incidents">
              View all <Icon name="arrow" />
            </Link>
          }
        >
          <div className="panel-body">
            <div className="attention-list">
              {urgent.map(item => (
                <div className="attention-item" key={item.id}>
                  <span className={`severity-bar ${item.severity.toLowerCase()}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.enterprise} · {item.scope} · {item.owner}
                    </p>
                  </div>
                  <div className="attention-meta">
                    <small>{item.sla}</small>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => openOverlay({ kind: "incident", id: item.id })}
                    >
                      Open incident
                    </button>
                  </div>
                </div>
              ))}
              {urgent.length ? null : (
                <p className="queue-clear">
                  <Icon name="check" /> No incident is currently open.
                </p>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Field work in motion"
          description="Installation progress and blockers"
          action={
            <Link className="btn btn-small btn-quiet" href="/field">
              Field queue <Icon name="arrow" />
            </Link>
          }
        >
          <div className="panel-body">
            <div className="work-list">
              {jobs.map(job => (
                <button
                  type="button"
                  className="work-item"
                  key={job.id}
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => openOverlay({ kind: "job", id: job.id })}
                >
                  <span className="work-icon">
                    <Icon name="field" />
                  </span>
                  <span>
                    <strong>{job.site}</strong>
                    <small>
                      {job.id} · {job.installer}
                    </small>
                  </span>
                  <Chip>{job.status}</Chip>
                </button>
              ))}
              {jobs.length ? null : (
                <p className="queue-clear">
                  <Icon name="check" /> Every installation job is complete.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
