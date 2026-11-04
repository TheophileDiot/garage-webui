/** Tokens live in src/app/tokens.css; Tailwind only maps names to them. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // Replace form for type and radius: only the mix scale exists, nothing else compiles. `sans` is
    // the mono face too, because Tailwind's preflight reads fontFamily.sans for <html>.
    fontFamily: {
      mono: [
        "'JetBrains Mono Variable'",
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "monospace",
      ],
      sans: [
        "'JetBrains Mono Variable'",
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "monospace",
      ],
      display: [
        "'Bricolage Grotesque Variable'",
        "'JetBrains Mono Variable'",
        "ui-sans-serif",
        "sans-serif",
      ],
    },
    fontSize: {
      caption: ["13px", "18px"],
      body: ["13px", "20px"],
      h4: ["14px", "20px"],
      h3: ["16px", "22px"],
      h2: ["20px", "26px"],
    },
    borderRadius: {
      none: "0",
      sm: "2px",
      DEFAULT: "3px",
      md: "3px",
      lg: "6px",
      full: "9999px",
    },
    // Colours stay in `extend` so transparent, current and inherit keep working.
    extend: {
      colors: {
        ground: "var(--ground)",
        lift: "var(--lift)",
        "lift-2": "var(--lift-2)",
        sunk: "var(--sunk)",
        rule: "var(--rule)",
        "rule-strong": "var(--rule-strong)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "ink-4": "var(--ink-4)",
        gold: "var(--gold)",
        "gold-ink": "var(--gold-ink)",
        "gold-text": "var(--gold-text)",
        "gold-wash": "var(--gold-wash)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        bad: "var(--bad)",
        wash: "var(--wash)",
        fill: "var(--fill)",
      },
      transitionTimingFunction: { caret: "cubic-bezier(0.23, 1, 0.32, 1)" },
      transitionDuration: { caret: "120ms" },
    },
  },
  plugins: [],
};
