import { LoaderCircle } from "lucide-react";
import { Status } from "@/components/ui/status";

/** Live feedback for an autosaving form: Saving, Saved, or Not saved. A shape and a word, never colour alone. */
const SaveState = ({
  mutation,
}: {
  mutation: { isPending: boolean; isSuccess: boolean; isError: boolean };
}) => (
  <p className="min-h-5 text-caption" role="status" aria-live="polite">
    {mutation.isPending ? (
      <span className="inline-flex items-center gap-1.5 font-medium text-ink-3">
        <LoaderCircle size={13} className="animate-spin" aria-hidden /> Saving
      </span>
    ) : mutation.isError ? (
      <Status tone="bad">Not saved</Status>
    ) : mutation.isSuccess ? (
      <Status tone="ok">Saved</Status>
    ) : null}
  </p>
);

export default SaveState;
