import { useEffect, useState } from "react";
import Button from "./button";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Appears after 300 px of page scroll, at the bottom right. */
const GotoTopButton = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onClick = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });

  return (
    <Button
      icon={ArrowUp}
      variant="secondary"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-20 shadow-pop transition-opacity",
        show ? "visible opacity-100" : "invisible opacity-0",
      )}
      onClick={onClick}
    >
      Top
    </Button>
  );
};

export default GotoTopButton;
