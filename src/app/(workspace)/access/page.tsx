import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessView } from "@/components/views/AccessView";

export const metadata: Metadata = { title: "Access" };

export default function AccessPage() {
  return (
    <Suspense>
      <AccessView />
    </Suspense>
  );
}
