import type { Metadata } from "next";
import { Suspense } from "react";

import { FieldView } from "@/components/views/FieldView";

export const metadata: Metadata = { title: "Field Operations" };

export default function FieldPage() {
  return (
    <Suspense>
      <FieldView />
    </Suspense>
  );
}
