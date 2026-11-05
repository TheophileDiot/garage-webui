import mime from "mime/lite";
import { FileArchive, FileIcon, FileType, LucideIcon } from "lucide-react";

const ARCHIVES = ["zip", "rar", "7z", "iso", "tar", "gz", "bz2", "xz"];
export const THUMBNAILS = ["jpg", "jpeg", "png", "gif"];

/** The MIME type for an extension without its dot, or "" when unknown. */
export const mimeOf = (ext?: string | null) => mime.getType(ext || "") ?? "";

export const iconFor = (ext?: string | null): LucideIcon => {
  if (ARCHIVES.includes(ext || "")) return FileArchive;
  if (mimeOf(ext).startsWith("text/")) return FileType;
  return FileIcon;
};
