"use client";

import { useState } from "react";

import { useTabParam } from "@/hooks/use-tab-param";
import { Icon } from "@/components/ui/Icon";
import {
  Chip,
  EmptyState,
  PageHeader,
  Progress,
  RowMain,
  SearchField,
  TableWrap,
  Tabs
} from "@/components/ui/primitives";
import { monogram } from "@/lib/format";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

/** Enterprise accounts and the site requests waiting on a governed decision. */
export function EnterprisesView() {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const [tab, setTab] = useTabParam("accounts");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const enterprises = snapshot.enterprises.filter(
    item =>
      !needle ||
      [item.id, item.name, item.region].some(value =>
        String(value).toLowerCase().includes(needle)
      )
  );
  const requests = snapshot.siteRequests.filter(
    item =>
      !needle ||
      [item.id, item.enterprise, item.siteName, item.location].some(value =>
        String(value).toLowerCase().includes(needle)
      )
  );

  const pendingCount = snapshot.siteRequests.filter(
    item => item.status === "Pending review"
  ).length;

  const results = tab === "accounts" ? enterprises.length : requests.length;

  return (
    <main className="page">
      <PageHeader
        kicker="Tenant operations"
        title="Enterprises"
        description="Create and govern enterprise accounts, approve site onboarding, and issue the first organization administrator invitation."
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openOverlay({ kind: "support-grant" })}
            >
              <Icon name="shield" /> Support access
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openOverlay({ kind: "new-site" })}
            >
              <Icon name="plus" /> Provision site
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

      <div className="filters">
        <Tabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "accounts", label: "Accounts" },
            { id: "requests", label: "Site requests", count: pendingCount }
          ]}
        />
        <div className="spacer" />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search name, account ID, site, or request"
        />
      </div>

      {results === 0 ? (
        <EmptyState
          icon="enterprise"
          title="No matching enterprise record"
          description="Try an exact account or request identifier."
        />
      ) : tab === "accounts" ? (
        <div className="entity-grid">
          {enterprises.map(item => (
            <article className="entity-card" key={item.id}>
              <div className="entity-card-top">
                <span className="entity-mark">{monogram(item.name)}</span>
                <Chip>{item.status}</Chip>
              </div>
              <h3>{item.name}</h3>
              <span className="entity-id">{item.id}</span>
              <p>
                {item.region} · Initial admin {item.adminName || "Not assigned"}
              </p>
              <Progress value={item.readiness} />
              <div className="entity-stats">
                <span>
                  Readiness<strong>{item.readiness}%</strong>
                </span>
                <span>
                  Live sites
                  <strong>
                    {item.liveSites} of {item.sites}
                  </strong>
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  onClick={() => openOverlay({ kind: "enterprise", id: item.id })}
                >
                  Open account <Icon name="arrow" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Enterprise</th>
                  <th>Requested functions</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {requests.map(item => (
                  <tr key={item.id}>
                    <RowMain title={item.siteName} meta={`${item.id} · ${item.location}`} />
                    <td>{item.enterprise}</td>
                    <td>{item.functions.join(", ")}</td>
                    <td>{item.submitted}</td>
                    <td>
                      <Chip>{item.status}</Chip>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => openOverlay({ kind: "site-request", id: item.id })}
                        >
                          Review
                        </button>
                      </div>
                    </td>
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
