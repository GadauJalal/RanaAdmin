import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

/**
 * Every operational view shares one frame: navigation, global search,
 * notifications, the overlay host, and the toast region.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
