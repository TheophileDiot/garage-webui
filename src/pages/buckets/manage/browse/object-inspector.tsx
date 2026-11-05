import { CopyLine } from "@/components/ui/copy-line";
import { Inspector, InspectorName, PropList } from "@/components/ui/inspector";
import { dayjs, readableBytes } from "@/lib/utils";
import { useBucketContext } from "../context";
import { iconFor, mimeOf } from "./file-types";
import { extOf, objectUri, typeLabel } from "./model";
import { OpenLink } from "./object-actions";
import { Object } from "./types";

/** The right-hand details: one selected file in full, or a count and total for several. */
const ObjectInspector = ({
  files,
  prefix,
}: {
  files: Object[];
  /** The listing prefix the file keys are relative to. */
  prefix: string;
}) => {
  const { globalAlias } = useBucketContext();

  if (files.length === 0) {
    return <Inspector emptyText="Select an object to see its details." />;
  }

  if (files.length > 1) {
    const total = files.reduce((sum, f) => sum + f.size, 0);
    return (
      <Inspector>
        <div className="fig">
          {files.length}
          <small>objects selected</small>
        </div>
        <p className="m-0 text-ink-2 [overflow-wrap:anywhere]">
          {readableBytes(total)} in {globalAlias}/{prefix}
        </p>
      </Inspector>
    );
  }

  const object = files[0];
  const ext = extOf(object.objectKey);
  const key = prefix + object.objectKey;
  const modified = dayjs(object.lastModified);

  return (
    <Inspector>
      <InspectorName icon={iconFor(ext)}>{object.objectKey}</InspectorName>
      <PropList
        items={[
          { label: "Size", value: readableBytes(object.size) },
          {
            label: "Type",
            value: (
              <>
                {typeLabel(object.objectKey, mimeOf(ext))}
                {mimeOf(ext) ? (
                  <span className="block text-ink-3">{mimeOf(ext)}</span>
                ) : null}
              </>
            ),
          },
          {
            label: "Modified",
            value: (
              <time dateTime={modified.toISOString()}>
                {modified.format("YYYY-MM-DD HH:mm:ss")}
                <span className="block text-ink-3">{modified.fromNow()}</span>
              </time>
            ),
          },
          {
            label: "Key",
            wide: true,
            value: <CopyLine boxed value={key} label="Copy object key" />,
          },
          {
            label: "S3 URI",
            wide: true,
            value: (
              <CopyLine
                boxed
                value={objectUri(globalAlias, prefix, object.objectKey)}
                label="Copy object S3 URI"
              />
            ),
          },
        ]}
      />
      <div className="flex flex-wrap gap-2 border-t border-line pt-3.5">
        <OpenLink
          object={{ objectKey: object.objectKey, prefix, url: object.url }}
        />
      </div>
    </Inspector>
  );
};

export default ObjectInspector;
