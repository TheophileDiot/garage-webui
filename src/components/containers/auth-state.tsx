import Button from "../ui/button";

export default function AuthState({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="max-w-sm text-center" role={error ? "alert" : "status"}>
        <h1 className="text-xl font-semibold">
          {error ? "Unable to reach Garage WebUI" : "Checking your session"}
        </h1>
        <p className="mt-2 text-sm text-base-content/70">
          {error
            ? "Check the connection, then try again."
            : "Connecting to the administration console…"}
        </p>
        {error && (
          <Button className="mt-4" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
