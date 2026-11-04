import Button from "../ui/button";

/** The session check, before any page: loading, or an error with a retry. Behaviour unchanged. */
export default function AuthState({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div
        className="grid max-w-sm justify-items-start gap-2"
        role={error ? "alert" : "status"}
      >
        <p className="text-ink-3" aria-hidden>
          {"garage://"}
          <span className="caret-blink ml-0.5" />
        </p>
        <h1 className="font-display text-h2 font-semibold tracking-[-0.02em]">
          {error ? "Unable to reach Garage WebUI" : "Checking your session"}
        </h1>
        <p className="text-ink-2">
          {error
            ? "Check the connection, then try again."
            : "Connecting to the administration console…"}
        </p>
        {error && (
          <Button className="mt-2" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
