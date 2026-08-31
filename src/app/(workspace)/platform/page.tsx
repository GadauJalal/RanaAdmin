import type { Metadata } from "next";
import { Suspense } from "react";

import { PlatformView } from "@/components/views/PlatformView";

export const metadata: Metadata = { title: "Platform" };

export default function PlatformPage() {
  return (
    <Suspense>
      <PlatformView />
    </Suspense>
  );
}
