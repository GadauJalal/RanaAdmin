"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useSnapshot, useWorkspace, type Overlay } from "@/providers/workspace-provider";

interface SearchRecord {
  type: string;
  id: string;
  label: string;
  meta: string;
  icon: string;
  overlay: Overlay;
  aliases?: string[];
}

/**
 * Finds any governed record by exact identifier, serial, or name, and opens the
 * record itself rather than a filtered list.
 */
export function GlobalSearch() {
  const snapshot = useSnapshot();
  const { openOverlay, searchFocusSignal } = useWorkspace();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // The "/" shortcut and the "Find a record" button both raise this signal.
  useEffect(() => {
    if (searchFocusSignal > 0) inputRef.current?.focus();
  }, [searchFocusSignal]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setQuery("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const records = useMemo<SearchRecord[]>(
    () => [
      ...snapshot.enterprises.map(item => ({
        type: "Enterprise",
        id: item.id,
        label: item.name,
        meta: item.region,
        icon: "enterprise",
        overlay: { kind: "enterprise", id: item.id } as Overlay
      })),
      ...snapshot.siteRequests.map(item => ({
        type: "Site request",
        id: item.id,
        label: item.siteName,
        meta: item.enterprise,
        icon: "enterprise",
        overlay: { kind: "site-request", id: item.id } as Overlay
      })),
      ...snapshot.jobs.map(item => ({
        type: "Installation job",
        id: item.id,
        label: item.site,
        meta: item.installer,
        icon: "field",
        overlay: { kind: "job", id: item.id } as Overlay
      })),
      ...snapshot.devices.map(item => ({
        type: "Gateway",
        id: item.id,
        label: item.site,
        meta: `Serial ${item.serial}`,
        icon: "device",
        overlay: { kind: "device", id: item.id } as Overlay,
        aliases: [item.serial]
      })),
      ...snapshot.incidents.map(item => ({
        type: "Incident",
        id: item.id,
        label: item.title,
        meta: item.enterprise,
        icon: "incident",
        overlay: { kind: "incident", id: item.id } as Overlay
      })),
      ...snapshot.installers.map(item => ({
        type: "Installer",
        id: item.id,
        label: item.name,
        meta: item.region,
        icon: "field",
        overlay: { kind: "installer", id: item.id } as Overlay
      })),
      ...snapshot.staff.map(item => ({
        type: "Staff",
        id: item.id,
        label: item.name,
        meta: item.role,
        icon: "access",
        overlay: { kind: "staff", id: item.id } as Overlay
      }))
    ],
    [snapshot]
  );

  const trimmed = query.trim().toLowerCase();
  const matches =
    trimmed.length < 2
      ? []
      : records
          .filter(record =>
            [record.id, record.label, record.meta, ...(record.aliases ?? [])].some(value =>
              String(value).toLowerCase().includes(trimmed)
            )
          )
          .slice(0, 7);

  return (
    <div className="global-search" ref={containerRef}>
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        placeholder="Search exact ID, serial, site, enterprise"
        aria-label="Global search"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />
      <span className="search-key">/</span>
      <div>
        {trimmed.length >= 2 ? (
          <div className="search-results">
            {matches.length ? (
              matches.map(record => (
                <button
                  type="button"
                  className="search-result"
                  key={`${record.type}-${record.id}`}
                  onClick={() => {
                    openOverlay(record.overlay);
                    setQuery("");
                  }}
                >
                  <span className="search-result-icon">
                    <Icon name={record.icon} />
                  </span>
                  <span>
                    <strong>{record.label}</strong>
                    <small>
                      {record.type} · {record.meta}
                    </small>
                  </span>
                  <code>{record.id}</code>
                </button>
              ))
            ) : (
              <div className="search-empty">
                No record matches this exact identifier or name.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
