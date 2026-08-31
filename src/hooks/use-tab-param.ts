"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Keeps the active tab in the URL so a tab is linkable and survives a reload,
 * and so one view can send the operator straight to another view's tab.
 */
export function useTabParam(defaultTab: string) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = searchParams.get("tab") ?? defaultTab;

  const setTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultTab) params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [defaultTab, pathname, router, searchParams]
  );

  return [tab, setTab] as const;
}
