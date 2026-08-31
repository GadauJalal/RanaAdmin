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
  TableWrap
} from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/format";
import { useSnapshot, useWorkspace } from "@/providers/workspace-provider";

const STATUS_FILTERS = ["Live", "Testing", "Offline", "Identity conflict"];

/** Gateway identity, mapped energy functions, firmware, and heartbeat. */
export function DevicesView() {
  const snapshot = useSnapshot();
  const { openOverlay, run } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const needle = query.trim().toLowerCase();
  const devices = snapshot.devices.filter(item => {
    const matchesQuery =
      !needle ||
      [item.id, item.serial, item.site, item.enterprise, item.status].some(value =>
        String(value).toLowerCase().includes(needle)
      );
    const matchesStatus = status === "All" || item.status === status;
    return matchesQuery && matchesStatus;
  });

  const live = snapshot.devices.filter(item => item.status === "Live").length;
  const testing = snapshot.devices.filter(item => item.status === "Testing").length;
  const attention = snapshot.devices.filter(item =>
    ["Offline", "Identity conflict"].includes(item.status)
  ).length;

  function exportInventory() {
    void run(() => api.recordExport("devices"), {
      failureTitle: "Export could not be recorded",
      success: () => ({
        title: "Gateway inventory exported",
        detail:
          "The export contains identities and function states, not raw readings or secrets."
      }),
      keepOverlay: true,
      onSuccess: (_data, fresh) =>
        downloadCsv("rana54-gateway-inventory.csv", [
          [
            "Rana ID",
            "Serial",
            "Enterprise",
            "Site",
            "Functions",
            "Firmware",
            "Heartbeat",
            "Status"
          ],
          ...fresh.devices.map(item => [
            item.id,
            item.serial,
            item.enterprise,
            item.site,
            item.functions.map(fn => fn.name).join("; "),
            item.firmware,
            item.heartbeat,
            item.status
          ])
        ])
    });
  }

  return (
    <main className="page">
      <PageHeader
        kicker="Fleet operations"
        title="Devices"
        description="Inspect gateway identity, firmware, heartbeat, and mapped energy functions. Raw readings remain immutable."
        actions={
          <button type="button" className="btn btn-secondary" onClick={exportInventory}>
            <Icon name="download" /> Export inventory
          </button>
        }
      />

      <section className="metric-strip">
        <Metric
          label="Gateways live"
          value={live}
          detail="Receiving within the current freshness window"
        />
        <Metric
          label="Commissioning"
          value={testing}
          detail="Testing functions before site acceptance"
          tone="amber"
        />
        <Metric
          label="Needs attention"
          value={attention}
          detail="Offline or duplicate identity"
          tone="red"
        />
        <Metric
          label="Firmware baseline"
          value="4.8.2"
          detail="Current approved production release"
        />
      </section>

      <div className="filters">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search Rana ID, serial, site, or enterprise"
        />
        <select
          className="select"
          value={status}
          aria-label="Filter by device status"
          onChange={event => setStatus(event.target.value)}
        >
          <option>All</option>
          {STATUS_FILTERS.map(value => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>

      <section className="panel">
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Gateway</th>
                <th>Assignment</th>
                <th>Energy functions</th>
                <th>Firmware</th>
                <th>Heartbeat</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {devices.map(device => (
                <tr key={device.id}>
                  <RowMain title={device.id} meta={`Serial ${device.serial}`} />
                  <RowMain title={device.site} meta={device.enterprise} />
                  <td>
                    {device.functions.length} mapped
                    <br />
                    <span className="cell-note">
                      {device.functions.map(fn => fn.name).join(", ")}
                    </span>
                  </td>
                  <td>{device.firmware}</td>
                  <td>{device.heartbeat}</td>
                  <td>
                    <Chip>{device.status}</Chip>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-small btn-secondary"
                        onClick={() => openOverlay({ kind: "device", id: device.id })}
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
        {devices.length ? null : (
          <EmptyState
            icon="device"
            title="No device found"
            description="Use an exact gateway ID or serial to find a specific identity."
          />
        )}
      </section>
    </main>
  );
}
