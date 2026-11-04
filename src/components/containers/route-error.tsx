import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import Button from "../ui/button";
import { ErrorState } from "../ui/state";

/** Route-level error: a page that throws shows this inside the shell, never React Router's default screen. */
const RouteError = () => {
  const thrown = useRouteError();
  const error = isRouteErrorResponse(thrown)
    ? new Error(thrown.statusText || `Request failed (${thrown.status})`)
    : thrown instanceof Error
      ? thrown
      : new Error("Something went wrong while drawing this page.");
  return (
    <ErrorState
      title="This page failed to draw"
      error={error}
      action={
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      }
    />
  );
};

export default RouteError;
