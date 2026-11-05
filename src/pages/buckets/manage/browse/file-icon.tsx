import { API_URL } from "@/lib/api";
import { iconFor, mimeOf, THUMBNAILS } from "./file-types";
import { Object } from "./types";

/** A 20 px thumbnail for images the app can show, else the type icon. */
const FilePreview = ({
  ext,
  object,
}: {
  ext?: string | null;
  object: Pick<Object, "url">;
}) => {
  if (mimeOf(ext).startsWith("image/")) {
    const thumb = THUMBNAILS.includes(ext || "");
    return (
      <img
        src={API_URL + object.url + (thumb ? "?thumb=1" : "?view=1")}
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
