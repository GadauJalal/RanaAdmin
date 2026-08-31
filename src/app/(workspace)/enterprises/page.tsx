import type { Metadata } from "next";
import { Suspense } from "react";

import { EnterprisesView } from "@/components/views/EnterprisesView";

export const metadata: Metadata = { title: "Enterprises" };

export default function EnterprisesPage() {
  return (
    <Suspense>
      <EnterprisesView />
    </Suspense>
  );
}
