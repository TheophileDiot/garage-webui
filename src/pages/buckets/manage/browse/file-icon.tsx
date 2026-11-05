import { API_URL } from "@/lib/api";
import { useState } from "react";
import { iconFor, mimeOf, THUMBNAILS } from "./file-types";
import { Object } from "./types";

/** A 20 px thumbnail for images the app can show, else the type icon (also when the thumbnail fails, a 413 or 422 for a huge image). */
const FilePreview = ({
  ext,
  object,
}: {
  ext?: string | null;
  object: Pick<Object, "url">;
}) => {
  // The src that failed to load, so a different object (a new src) tries its own thumbnail again.
  const [failed, setFailed] = useState<string | null>(null);
  const thumb = THUMBNAILS.includes(ext || "");
  const src = API_URL + object.url + (thumb ? "?thumb=1" : "?view=1");
  if (mimeOf(ext).startsWith("image/") && failed !== src) {
    return (
      <img
        src={src}
        onError={() => setFailed(src)}
        alt=""
        loading="lazy"
        className="size-5 shrink-0 overflow-hidden rounded-sm bg-surface-2 object-cover"
      />
    );
  }
  const Icon = iconFor(ext);
  return <Icon size={16} aria-hidden className="shrink-0 text-ink-3" />;
};

export default FilePreview;
