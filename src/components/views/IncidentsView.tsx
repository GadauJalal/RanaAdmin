"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import {
  Chip,
  EmptyState,
  Metric,
  PageHeader,
  RowMain,
  SearchField,
  Severity,
  TableWrap
} from "@/components/ui/primitives";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

/** One response queue for tenant, installation, gateway, data, access, and platform issues. */
export function IncidentsView() {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const incidents = snapshot.incidents.filter(
    item =>
      !needle ||
      [item.id, item.title, item.enterprise, item.scope, item.owner, item.status].some(value =>
        String(value).toLowerCase().includes(needle)
      )
  );

  const p1 = snapshot.incidents.filter(
    item => item.severity === "P1" && item.status !== "Resolved"
  ).length;
  const unassigned = snapshot.incidents.filter(
    item => item.owner === "Unassigned" && item.status !== "Resolved"
  ).length;
  const investigating = snapshot.incidents.filter(item =>
    ["Acknowledged", "Investigating"].includes(item.status)
  ).length;
  const resolved = snapshot.incidents.filter(item => item.status === "Resolved").length;

  return (
    <main className="page">
      <PageHeader
        kicker="Operational response"
        title="Incidents"
        description="A single response queue for tenant, installation, gateway, data, access, and platform issues."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openOverlay({ kind: "new-incident" })}
          >
            <Icon name="plus" /> Open incident
          </button>
        }
      />

      <section className="metric-strip">
        <Metric label="P1 open" value={p1} detail="Immediate operational response" tone="red" />
        <Metric
          label="Unassigned"
          value={unassigned}
          detail="Requires a named owner"
          tone="amber"
        />
        <Metric
          label="Under investigation"
          value={investigating}
          detail="Acknowledged and being worked"
        />
        <Metric label="Resolved" value={resolved} detail="Retained in immutable history" />
      </section>

      <div className="filters">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search incident, enterprise, owner, or scope"
        />
      </div>

      <section className="panel">
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Incident</th>
                <th>Scope</th>
                <th>Owner</th>
                <th>SLA</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {incidents.map(item => (
                <tr key={item.id}>
                  <td>
                    <Severity level={item.severity} />
                  </td>
                  <RowMain title={item.title} meta={`${item.id} · ${item.enterprise}`} />
                  <td>{item.scope}</td>
                  <td>{item.owner}</td>
                  <td>{item.sla}</td>
                  <td>
                    <Chip>{item.status}</Chip>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => openOverlay({ kind: "incident", id: item.id })}
                      >
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {incidents.length ? null : (
          <EmptyState
            icon="incident"
            title="No incident matches this search"
            description="Try an exact incident identifier, enterprise, or owner."
          />
        )}
      </section>
    </main>
  );
}
