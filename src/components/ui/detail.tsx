import type { ReactNode } from "react";

/** Building blocks shared by every record drawer. */

export function DetailHero({
  kicker,
  title,
  meta
}: {
  kicker: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="detail-hero">
      <span className="eyebrow">{kicker}</span>
      <h2>{title}</h2>
      <p>{meta}</p>
    </div>
  );
}

export function DetailGrid({ cells }: { cells: { label: string; value: ReactNode }[] }) {
  return (
    <div className="detail-grid">
      {cells.map(cell => (
        <div className="detail-cell" key={cell.label}>
          <span>{cell.label}</span>
          <strong>{cell.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function DetailSection({
  title,
  action,
  children
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      {title ? (
        <div className="detail-section-head">
          <h3>{title}</h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FunctionList({ children }: { children: ReactNode }) {
  return <div className="function-list">{children}</div>;
}

export function FunctionRow({
  title,
  meta,
  trailing
}: {
  title: string;
  meta?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="function-row">
      <div>
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </div>
      {trailing}
    </div>
  );
}

/** A function row that navigates to the record it describes. */
export function FunctionRowButton({
  title,
  meta,
  trailing,
  onClick
}: {
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="function-row"
      style={{ width: "100%", textAlign: "left" }}
      onClick={onClick}
    >
      <div>
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </div>
      {trailing}
    </button>
  );
}

export function Timeline({ items }: { items: { title: string; meta: string }[] }) {
  return (
    <div className="timeline">
      {items.map((item, index) => (
        <div className="timeline-item" key={`${item.title}-${index}`}>
          <strong>{item.title}</strong>
          <small>{item.meta}</small>
        </div>
      ))}
    </div>
  );
}
