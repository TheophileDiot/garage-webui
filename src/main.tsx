import { z } from "zod";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/app.tsx";

z.config({ jitless: true });

// A deploy replaces the hashed chunks, and a tab or home-screen app that stayed open still asks for the old ones
// (the server answers 404). Reload once to pick up the new index.html; a second failure within 10 s is a real
// outage, not a stale tab, so it falls through to the route's error screen instead of looping.
window.addEventListener("vite:preloadError", (event) => {
  try {
    const key = "preload-reload";
    if (Date.now() - Number(sessionStorage.getItem(key)) < 10_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
