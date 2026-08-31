import type { Metadata } from "next";

import { DevicesView } from "@/components/views/DevicesView";

export const metadata: Metadata = { title: "Devices" };

export default function DevicesPage() {
  return <DevicesView />;
}
