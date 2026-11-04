import Page from "@/context/page-context";
import Button from "@/components/ui/button";
import { AddressText } from "@/components/ui/page-header";
import { useLocation } from "react-router-dom";

/** The 404 is S3's own answer for a key that is not there. It wraps on a phone: nothing here widens the page. */
const NotFoundPage = () => {
  const { pathname } = useLocation();
  const key = pathname.replace(/^\/+/, "") || "404";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 py-10 md:py-16">
      <Page title="Not found" />
      <div className="grid gap-3">
        <p className="font-medium text-bad">404</p>
        <h1 className="font-display text-[clamp(2.5rem,1.4rem+5vw,5rem)] font-semibold leading-none tracking-[-0.04em] [overflow-wrap:anywhere]">
          NoSuchKey
        </h1>
        <p className="max-w-[52ch] text-ink-2 [text-wrap:pretty]">
          Nothing lives at this address. In S3 a missing key answers 404 and
          nothing else, so this is the same message, kept.
        </p>
      </div>
      <figure className="m-0 min-w-0 max-w-xl rounded border border-rule bg-lift">
        <figcaption className="flex items-center justify-between border-b border-rule px-3 py-1.5 text-ink-3">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            requested{" "}
            <AddressText scheme="garage" segments={[{ label: key }]} />
          </span>
        </figcaption>
        <pre className="m-0 overflow-x-auto whitespace-pre-wrap px-3 py-3 font-[inherit] leading-6 text-ink-2 [overflow-wrap:anywhere]">
          {`<Error>\n  <Code>NoSuchKey</Code>\n  <Message>The specified key does not exist.</Message>\n  <Key>${key}</Key>\n</Error>`}
        </pre>
      </figure>
      <div className="flex flex-wrap gap-2">
        <Button href="/" variant="primary">
          Open overview
        </Button>
        <Button href="/buckets">Browse buckets</Button>
      </div>
      <p className="text-ink-3">
        Press{" "}
        <kbd className="rounded-sm border border-rule-strong px-1">ctrl</kbd>{" "}
        <kbd className="rounded-sm border border-rule-strong px-1">k</kbd> and
        type an address to go straight to a bucket, key or node.
      </p>
    </div>
  );
};

export default NotFoundPage;
