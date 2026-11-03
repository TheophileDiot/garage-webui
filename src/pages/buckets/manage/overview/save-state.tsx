import { Check, LoaderCircle } from "lucide-react";

/** Live feedback for an autosaving form. */
const SaveState = ({
  mutation,
}: {
  mutation: { isPending: boolean; isSuccess: boolean; isError: boolean };
}) => (
  <p
    className="inline-flex items-center gap-1.5 text-xs font-bold text-base-content/70"
    role="status"
    aria-live="polite"
  >
    {mutation.isPending ? (
      <>
        <LoaderCircle size={14} className="animate-spin" aria-hidden /> Saving
      </>
    ) : mutation.isError ? (
      <span className="text-error">Not saved</span>
    ) : mutation.isSuccess ? (
      <>
        <Check size={14} className="text-success" aria-hidden /> Saved
      </>
    ) : null}
  </p>
);

export default SaveState;
