"use client";

export default function WorkspaceError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="boot-screen boot-error" role="alert">
      <h1>The workspace hit an unexpected error</h1>
      <p>{error.message || "No operational change was recorded."}</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
