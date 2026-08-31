import { redirect } from "next/navigation";

/** The workspace opens on the operational summary. */
export default function RootPage() {
  redirect("/overview");
}
