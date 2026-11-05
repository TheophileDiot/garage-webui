import { memo, useEffect } from "react";

const DEFAULT_TITLE = "Garage · Storage console";

/** Sets `document.title` to "<title> · Garage" while mounted, the default one after. Renders nothing. */
const Page = memo(({ title }: { title?: string | null }) => {
  useEffect(() => {
    document.title = title ? `${title} · Garage` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);

  return null;
});

export default Page;
