import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { chipTone } from "@/lib/format";
import type { Severity as SeverityLevel } from "@/lib/types";

/** Status pill. The tone is derived from the status text, not hard-coded per view. */
export function Chip({ children }: { children: string }) {
  return <span className={`chip ${chipTone(children)}`}>{children}</span>;
}

export function Severity({ level }: { level: SeverityLevel | string }) {
  return <span className={`severity ${String(level).toLowerCase()}`}>{level}</span>;
}

export function PageHeader({
  kicker,
  title,
  description,
  actions
}: {
  kicker: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-title-group">
        <span className="eyebrow">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = ""
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: "" | "red" | "amber" | "orange";
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        <span className={`dot ${tone}`} />
        {label}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Notice({
  icon = "info",
  tone,
  children
}: {
  icon?: string;
  tone?: "warning" | "danger";
  children: ReactNode;
}) {
  return (
    <div className={`notice ${tone ?? ""}`.trim()}>
      <Icon name={icon} /> {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description
}: {
  icon?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      {icon ? <Icon name={icon} /> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export interface TabDefinition {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onSelect
}: {
  tabs: TabDefinition[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tab ${active === tab.id ? "active" : ""}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
          {tab.count ? <span>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-field">
      <Icon name="search" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

/** Two-line table cell: a bold identity above its exact identifier. */
export function RowMain({ title, meta }: { title: string; meta: string }) {
  return (
    <td className="row-main">
      <strong>{title}</strong>
      <small>{meta}</small>
    </td>
  );
}
