import type { Metadata } from "next";

import { IncidentsView } from "@/components/views/IncidentsView";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  return <IncidentsView />;
}
