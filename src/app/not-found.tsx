import Link from "next/link";

export default function NotFound() {
  return (
    <div className="boot-screen">
      <h1>That workspace route does not exist</h1>
      <p>
        Network Operations covers Overview, Enterprises, Field Operations, Devices, Incidents,
        Access, and Platform.
      </p>
      <Link className="btn btn-primary" href="/overview">
        Back to Overview
      </Link>
    </div>
  );
}
