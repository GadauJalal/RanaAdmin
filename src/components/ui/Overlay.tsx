"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { useWorkspace } from "@/providers/workspace-provider";

/** Dark scrim shared by both overlay surfaces. Clicking it dismisses. */
function Scrim({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return (
    <button type="button" className="overlay-scrim" aria-label={label} onClick={onDismiss} />
  );
}

/**
 * Creation and state-change workflows. The submit control lives in the footer
 * and is wired to the form with the `form` attribute, so native HTML validation
 * (`required`, `minLength`, `type="email"`) still gates every submission.
 */
export function Modal({
  title,
  description,
  footer,
  children,
  onDismiss
}: {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const { closeOverlay } = useWorkspace();
  const dismiss = onDismiss ?? closeOverlay;
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const first = bodyRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), select, textarea, button"
    );
    first?.focus();
  }, []);

  return (
    <>
      <Scrim label="Close dialog" onDismiss={dismiss} />
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={dismiss}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body" ref={bodyRef}>
          {children}
        </div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </>
  );
}

/** Record details. Opens from a table row, a card, or a search result. */
export function Drawer({
  title,
  footer,
  children,
  onDismiss
}: {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const { closeOverlay } = useWorkspace();
  const dismiss = onDismiss ?? closeOverlay;
  const titleId = useId();

  return (
    <>
      <Scrim label="Close details" onDismiss={dismiss} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <div>
            <button type="button" className="icon-button" aria-label="Close" onClick={dismiss}>
              <Icon name="close" />
            </button>
          </div>
        </header>
        <div className="drawer-body">{children}</div>
        {footer ? <footer className="drawer-footer">{footer}</footer> : null}
      </aside>
    </>
  );
}

/**
 * A modal whose body is one form. `onSubmit` receives the collected fields; it
 * only runs once the browser's own validation has passed.
 */
export function FormModal({
  title,
  description,
  formId,
  submitLabel,
  submitIcon,
  submitTone = "btn-primary",
  onSubmit,
  children
}: {
  title: string;
  description?: string;
  formId: string;
  submitLabel: string;
  submitIcon?: string;
  submitTone?: "btn-primary" | "btn-danger";
  onSubmit: (data: FormData) => void;
  children: ReactNode;
}) {
  const { closeOverlay, pending } = useWorkspace();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <Modal
      title={title}
      description={description}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={closeOverlay}>
            Cancel
          </button>
          <button type="submit" form={formId} className={`btn ${submitTone}`} disabled={pending}>
            {submitIcon ? <Icon name={submitIcon} /> : null}
            {submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} className="form-grid" onSubmit={handleSubmit} noValidate={false}>
        {children}
      </form>
    </Modal>
  );
}

/** A modal that only collects the mandatory reason for a privileged change. */
export function ReasonModal({
  title,
  description,
  formId,
  submitLabel,
  submitTone = "btn-primary",
  label = "Reason",
  placeholder,
  notice,
  onSubmit,
  children
}: {
  title: string;
  description?: string;
  formId: string;
  submitLabel: string;
  submitTone?: "btn-primary" | "btn-danger";
  label?: string;
  placeholder?: string;
  notice?: ReactNode;
  onSubmit: (reason: string, data: FormData) => void;
  children?: ReactNode;
}) {
  return (
    <FormModal
      title={title}
      description={description}
      formId={formId}
      submitLabel={submitLabel}
      submitTone={submitTone}
      onSubmit={data => onSubmit(String(data.get("reason") ?? ""), data)}
    >
      {notice}
      {children}
      <div className="field full">
        <label htmlFor={`${formId}-reason`}>{label}</label>
        <textarea
          id={`${formId}-reason`}
          name="reason"
          required
          minLength={8}
          placeholder={placeholder ?? "Record the evidence and reason for this change"}
        />
      </div>
    </FormModal>
  );
}
