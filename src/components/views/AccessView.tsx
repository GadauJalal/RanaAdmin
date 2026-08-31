"use client";

import { useState } from "react";

import { useTabParam } from "@/hooks/use-tab-param";
import { Icon } from "@/components/ui/Icon";
import {
  Chip,
  EmptyState,
  PageHeader,
  Panel,
  RowMain,
  SearchField,
  TableWrap,
  Tabs
} from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

/** Rana54 staff accounts, time-limited tenant support, and privileged access review. */
export function AccessView() {
  const snapshot = useSnapshot();
  const { openOverlay, run } = useWorkspace();
  const [tab, setTab] = useTabParam("staff");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const staff = snapshot.staff.filter(
    item =>
      !needle ||
      [item.id, item.name, item.role, item.scope, item.status].some(value =>
        String(value).toLowerCase().includes(needle)
      )
  );
  const grants = snapshot.supportGrants.filter(
    item =>
      !needle ||
      [item.id, item.staff, item.enterprise, item.reason, item.status].some(value =>
        String(value).toLowerCase().includes(needle)
      )
  );
  const privileged = snapshot.staff.filter(item => item.privileged && item.status === "Active");

  function completeReview() {
    void run(() => api.completeAccessReview(), {
      failureTitle: "Review could not be recorded",
      success: () => ({
        title: "Access review recorded",
        detail: "The review result was appended to audit history."
      })
    });
  }

  return (
    <main className="page">
      <PageHeader
        kicker="Identity and access"
        title="Access"
        description="Manage Rana54 staff accounts and explicit, time-limited support access without exposing personal data or secrets."
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openOverlay({ kind: "support-grant" })}
            >
              <Icon name="shield" /> Grant support access
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openOverlay({ kind: "invite-staff" })}
            >
              <Icon name="plus" /> Invite staff
            </button>
          </>
        }
      />

      <div className="filters">
        <Tabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "staff", label: "Rana54 staff" },
            { id: "grants", label: "Support grants" },
            { id: "reviews", label: "Access review" }
          ]}
        />
        <div className="spacer" />
        {tab === "reviews" ? null : (
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search person, role, grant, or enterprise"
          />
        )}
      </div>

      {tab === "staff" ? (
        <section className="panel">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Privilege</th>
                  <th>Last access</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staff.map(person => (
                  <tr key={person.id}>
                    <RowMain title={person.name} meta={`${person.id} · ${person.email}`} />
                    <td>{person.role}</td>
                    <td>{person.scope}</td>
                    <td>
                      <Chip>{person.privileged ? "Privileged" : "Standard"}</Chip>
                    </td>
                    <td>{person.lastAccess}</td>
                    <td>
                      <Chip>{person.status}</Chip>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => openOverlay({ kind: "staff", id: person.id })}
                        >
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          {staff.length ? null : (
            <EmptyState icon="access" title="No staff account matches this search" />
          )}
        </section>
      ) : null}

      {tab === "grants" ? (
        <section className="panel">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Grant</th>
                  <th>Staff member</th>
                  <th>Enterprise</th>
                  <th>Mode</th>
                  <th>Expiry</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {grants.map(grant => (
                  <tr key={grant.id}>
                    <td className="row-id">{grant.id}</td>
                    <td>{grant.staff}</td>
                    <td>{grant.enterprise}</td>
                    <td>
                      <Chip>{grant.mode}</Chip>
                    </td>
                    <td>{grant.expires}</td>
                    <td>{grant.reason}</td>
                    <td>
                      <Chip>{grant.status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          {grants.length ? null : (
            <EmptyState
              icon="shield"
              title="No support grant matches this search"
              description="Tenant support access is created only when a specific issue requires it."
            />
          )}
        </section>
      ) : null}

      {tab === "reviews" ? (
        <div className="grid equal">
          <Panel
            title="Privileged access review"
            description="Confirm every cross-tenant operator remains appropriate"
          >
            <div className="panel-body">
              <div className="work-list">
                {privileged.map(person => (
                  <div className="work-item" key={person.id}>
                    <span className="work-icon">
                      <Icon name="shield" />
                    </span>
                    <span>
                      <strong>{person.name}</strong>
                      <small>
                        {person.role} · {person.scope}
                      </small>
                    </span>
                    <Chip>Review due</Chip>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 15 }}
                onClick={completeReview}
              >
                Complete review
              </button>
            </div>
          </Panel>

          <Panel
            title="Access safety rules"
            description="Applied by the platform, not by UI convention"
          >
            <div className="panel-body">
              <div className="check-list">
                <div className="check-row">
                  <Icon name="check" />
                  <div>
                    <strong>No staff impersonation</strong>
                    <small>
                      Support access opens a read-only tenant context with a visible audit
                      marker.
                    </small>
                  </div>
                </div>
                <div className="check-row">
                  <Icon name="check" />
                  <div>
                    <strong>Expiring grants</strong>
                    <small>
                      Every tenant support grant has a named reason and automatic expiry.
                    </small>
                  </div>
                </div>
                <div className="check-row">
                  <Icon name="check" />
                  <div>
                    <strong>Dual control for super admin changes</strong>
                    <small>Privilege escalation cannot be approved by the requester.</small>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </main>
  );
}
