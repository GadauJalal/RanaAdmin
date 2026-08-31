"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { OverlayHost } from "@/components/layout/OverlayHost";
import { Icon } from "@/components/ui/Icon";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { IS_PROTOTYPE_DATA } from "@/lib/api";
import { useWorkspace } from "@/providers/workspace-provider";
import type { Snapshot } from "@/lib/types";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  /** Records requiring attention, shown as an orange badge. */
  count: number;
}

function navItems(snapshot: Snapshot): NavItem[] {
  return [
    { href: "/overview", icon: "overview", label: "Overview", count: 0 },
    {
      href: "/enterprises",
      icon: "enterprise",
      label: "Enterprises",
      count: snapshot.siteRequests.filter(item => item.status === "Pending review").length
    },
    {
      href: "/field",
      icon: "field",
      label: "Field Operations",
      count: snapshot.jobs.filter(item =>
        ["Blocked", "Ready for acceptance"].includes(item.status)
      ).length
    },
    {
      href: "/devices",
      icon: "device",
      label: "Devices",
      count: snapshot.devices.filter(item =>
        ["Offline", "Identity conflict"].includes(item.status)
      ).length
    },
    {
      href: "/incidents",
      icon: "incident",
      label: "Incidents",
      count: snapshot.incidents.filter(item => item.status !== "Resolved").length
    },
    { href: "/access", icon: "access", label: "Access", count: 0 },
    {
      href: "/platform",
      icon: "platform",
      label: "Platform",
      count: snapshot.services.filter(item => item.status !== "Operational").length
    }
  ];
}

function Brand() {
  return (
    <Link className="brand" href="/overview" aria-label="Rana54 Network Operations home">
      <span className="brand-symbol">
        <Image src="/assets/rana54-mark.png" alt="" width={40} height={40} priority />
      </span>
      <span className="brand-word">
        RANA<b>54</b>
      </span>
      <span className="brand-tag">Network Ops</span>
    </Link>
  );
}

/**
 * The privileged workspace frame: navigation, global search, notifications, and
 * the single overlay host. Held back until the operational snapshot has loaded
 * so no view ever renders against a partial picture.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { snapshot, loading, loadError, reload, openOverlay, navOpen, setNavOpen } =
    useWorkspace();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="boot-screen" role="status">
        <span className="pulse" />
        <p>Loading the cross-tenant operational picture…</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="boot-screen boot-error" role="alert">
        <h1>The operational picture is unavailable</h1>
        <p>{loadError ?? "The operations service did not return a snapshot."}</p>
        <button type="button" className="btn btn-primary" onClick={() => void reload()}>
          <Icon name="refresh" /> Try again
        </button>
      </div>
    );
  }

  const items = navItems(snapshot);
  const openIncidents = snapshot.incidents.filter(item => item.status === "Open").length;

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Network Operations navigation">
          <div className="brand-wrap">
            <Brand />
          </div>
          <div className="environment-block">
            <span className="eyebrow">Environment</span>
            <div className="environment-name">
              <span className="pulse" /> Production operations
            </div>
            <small>
              {IS_PROTOTYPE_DATA
                ? "Cross-tenant, audited access · prototype data"
                : "Cross-tenant, audited access"}
            </small>
          </div>
          <nav className="side-nav">
            {items.map(item => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  className={`nav-item ${active ? "active" : ""}`}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                >
                  <span className="nav-icon">
                    <Icon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                  {item.count ? <span className="nav-count">{item.count}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-spacer" />
          <div className="side-safety">
            <strong>
              <Icon name="shield" /> Privileged workspace
            </strong>
            <p>
              Elevated actions require a reason. Tenant support access is read only, time
              limited, and audited.
            </p>
          </div>
        </aside>

        <button
          className="mobile-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />

        <section className="workspace">
          <header className="topbar">
            <button
              className="mobile-menu"
              type="button"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(!navOpen)}
            >
              <Icon name="menu" />
            </button>
            <div className="scope-copy">
              <strong>Network Operations</strong>
              <small>Rana54 live infrastructure</small>
            </div>
            <div className="topbar-spacer" />
            <GlobalSearch />
            <button
              className="icon-button"
              type="button"
              aria-label="Notifications"
              onClick={() => openOverlay({ kind: "notifications" })}
            >
              <Icon name="bell" />
              <span className="notification-count">{openIncidents}</span>
            </button>
          </header>
          {children}
        </section>
      </div>

      <OverlayHost />
      <ToastRegion />
    </>
  );
}
