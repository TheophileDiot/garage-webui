import { z } from "zod";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/app.tsx";

z.config({ jitless: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
