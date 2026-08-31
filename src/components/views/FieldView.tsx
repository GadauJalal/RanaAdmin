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
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

/** Installation jobs and the installers delivering them. */
export function FieldView() {
  const snapshot = useSnapshot();
  const { openOverlay } = useWorkspace();
  const [tab, setTab] = useTabParam("jobs");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const jobs = snapshot.jobs.filter(
    item =>
      !needle ||
      [item.id, item.site, item.enterprise, item.installer, item.status].some(value =>
        String(value).toLowerCase().includes(needle)
      )
  );
  const installers = snapshot.installers.filter(
    item =>
      !needle ||
      [item.id, item.name, item.region, item.status].some(value =>
        String(value).toLowerCase().includes(needle)
      )
  );

  const rows = tab === "jobs" ? jobs.length : installers.length;

  return (
    <main className="page">
      <PageHeader
        kicker="Field delivery"
        title="Field Operations"
        description="Move approved sites through assignment, commissioning evidence, and final acceptance without bypassing safety controls."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openOverlay({ kind: "new-job" })}
          >
            <Icon name="plus" /> Create job
          </button>
        }
      />

      <div className="filters">
        <Tabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: "jobs", label: "Installation jobs" },
            { id: "installers", label: "Installers" }
          ]}
        />
        <div className="spacer" />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search job, site, installer, or exact ID"
        />
      </div>

      <section className="panel">
        {rows === 0 ? (
          <EmptyState
            icon="field"
            title="No matching field record"
            description="Try an exact job, site, or installer identifier."
          />
        ) : tab === "jobs" ? (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Enterprise</th>
                  <th>Installer</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id}>
                    <RowMain title={job.site} meta={`${job.id} · ${job.scheduled}`} />
                    <td>{job.enterprise}</td>
                    <RowMain title={job.installer} meta={job.installerId} />
                    <td>
                      <div className="progress-wrap">
                        <Progress value={job.progress} />
                        <small>{job.progress}% complete</small>
                      </div>
                    </td>
                    <td>
                      <Chip>{job.status}</Chip>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => openOverlay({ kind: "job", id: job.id })}
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Installer</th>
                  <th>Region</th>
                  <th>Certification</th>
                  <th>Current load</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {installers.map(installer => (
                  <tr key={installer.id}>
                    <RowMain
                      title={installer.name}
                      meta={`${installer.id} · ${installer.phone}`}
                    />
                    <td>{installer.region}</td>
                    <td>
                      <Chip>{installer.certification}</Chip>
                    </td>
                    <td>
                      {installer.activeJobs} active · {installer.capacity}
                    </td>
                    <td>
                      <Chip>{installer.status}</Chip>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          onClick={() => openOverlay({ kind: "installer", id: installer.id })}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>
    </main>
  );
}
