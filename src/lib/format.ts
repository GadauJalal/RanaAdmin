/** Presentation helpers shared by views, drawers, and the mock adapter. */

/** Masks a work email the way the platform stores it after an invitation. */
export function maskEmail(email: string): string {
  const [name, domain] = String(email).split("@");
  if (!domain) return "Masked";
  return `${name.slice(0, 1)}••••@${domain}`;
}

/** "28 Aug 14:32" - the audit and grant timestamp format. */
export function operationalTimestamp(date: Date = new Date()): string {
  return date
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    })
    .replace(",", "");
}

/** "14:32" - used by diagnostic output. */
export function clockTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Two-letter monogram for an enterprise card. */
export function monogram(name: string): string {
  return name
    .split(" ")
    .map(word => word[0])
    .slice(0, 2)
    .join("");
}

/** Chip tone from a free-text status. Mirrors the design system status colours. */
export type ChipTone = "gray" | "green" | "amber" | "orange" | "red" | "blue";

export function chipTone(value: string): ChipTone {
  const lower = String(value).toLowerCase();
  let tone: ChipTone = "gray";
  const green = [
    "active",
    "live",
    "operational",
    "approved",
    "completed",
    "current",
    "available",
    "passing",
    "resolved",
    "accepted"
  ];
  const amber = [
    "pending",
    "onboarding",
    "testing",
    "ready",
    "acknowledged",
    "investigating",
    "on job",
    "scheduled"
  ];
  const red = [
    "needs attention",
    "blocked",
    "offline",
    "conflict",
    "degraded",
    "suspended",
    "returned",
    "open"
  ];
  const blue = ["read only", "measured", "assigned"];

  if (green.some(word => lower.includes(word))) tone = "green";
  if (amber.some(word => lower.includes(word))) tone = "amber";
  if (red.some(word => lower.includes(word))) tone = lower.includes("degraded") ? "orange" : "red";
  if (blue.some(word => lower.includes(word))) tone = "blue";
  return tone;
}

/** Builds a CSV in the browser and hands it to the operator as a download. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const content = rows
    .map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

/**
 * Past tense of an operational transition, for audit actions and confirmations.
 * "Suspend" reads as "suspended", never "suspendd".
 */
const PAST_TENSE: Record<string, string> = {
  Suspend: "suspended",
  Restore: "restored",
  Reactivate: "reactivated",
  Assign: "assigned",
  Acknowledge: "acknowledged",
  Resolve: "resolved",
  Reopen: "reopened",
  Approved: "approved",
  Returned: "returned"
};

export function pastTense(transition: string): string {
  return PAST_TENSE[transition] ?? `${transition.toLowerCase()}d`;
}
