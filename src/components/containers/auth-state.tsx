import { CircleAlert, Loader2 } from "lucide-react";
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
    <div className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div
        className="grid max-w-sm justify-items-center gap-2 text-center"
        role={error ? "alert" : "status"}
      >
        <span
          aria-hidden
          className={
            error
              ? "mb-1 grid h-11 w-11 place-items-center rounded-xl bg-bad-soft text-bad"
              : "mb-1 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-ink-2"
          }
        >
          {error ? (
            <CircleAlert size={22} />
          ) : (
            <Loader2 size={22} className="animate-spin" />
          )}
        </span>
        <h1 className="font-cond text-h2 font-semibold">
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
