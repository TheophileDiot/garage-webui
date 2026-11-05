import Page from "@/context/page-context";
import Button from "@/components/ui/button";
import { Panel } from "@/components/ui/page-header";
import { useLocation } from "react-router-dom";

/** The 404 is S3's own answer for a key that is not there. It wraps on a phone: nothing here widens the page. */
const NotFoundPage = () => {
  const { pathname } = useLocation();
  const key = pathname.replace(/^\/+/, "") || "404";
  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6 py-6 md:py-10">
      <Page title="Not found" />
      <div className="grid gap-2">
        <p className="text-caption font-semibold uppercase tracking-[0.07em] text-bad">
          404
        </p>
        <h1 className="font-cond text-title font-semibold [overflow-wrap:anywhere]">
          Page not found
        </h1>
        <p className="max-w-[52ch] text-ink-2 [text-wrap:pretty]">
          Nothing lives at this address. In S3 a missing key answers 404 and
          nothing else, so this is the same message, kept.
        </p>
      </div>
      <Panel
        title="NoSuchKey"
        meta={
          <span className="[overflow-wrap:anywhere]">
            requested{" "}
            <span className="font-mono text-[12.5px] text-ink-2">/{key}</span>
          </span>
        }
        flush
      >
        <pre className="m-0 overflow-x-auto whitespace-pre-wrap px-4 py-3.5 text-[12.5px] leading-6 text-ink-2 [overflow-wrap:anywhere]">
          {`<Error>\n  <Code>NoSuchKey</Code>\n  <Message>The specified key does not exist.</Message>\n  <Key>${key}</Key>\n</Error>`}
        </pre>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <Button href="/" variant="primary">
          Open overview
        </Button>
        <Button href="/buckets">Browse buckets</Button>
      </div>
      <p className="text-ink-3">
        Use Search in the top bar (Ctrl K, or / ) to go straight to a bucket,
        key or node.
      </p>
    </div>
  );
};

export default NotFoundPage;
