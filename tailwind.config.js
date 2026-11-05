/** Tokens live in src/app/tokens.css; Tailwind only maps names to them. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    // Replace form for type, radius and screens: only the Dock scale exists, nothing else compiles.
    screens: {
      sm: "640px",
      md: "768px",
      // The sidebar shows from here up; below it the sidebar is a drawer.
      nav: "961px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    fontFamily: {
      sans: [
        "'IBM Plex Sans'",
        "system-ui",
        "-apple-system",
        "'Segoe UI'",
        "sans-serif",
      ],
      // Page titles, big figures and uppercase column labels.
      cond: [
        "'IBM Plex Sans Condensed'",
        "'IBM Plex Sans'",
        "system-ui",
        "sans-serif",
      ],
      // IDs, access keys, s3:// URIs, addresses and paths only.
      mono: [
        "'IBM Plex Mono'",
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "monospace",
      ],
    },
    fontSize: {
      // 12 px: uppercase condensed labels, key caps, table headers.
      label: ["12px", "14px"],
      // 13 px: secondary text, hints, meta lines.
      caption: ["13px", "18px"],
      // 14 px: body.
      body: ["14px", "21px"],
      // 16 px: panel titles (condensed).
      h3: ["16px", "22px"],
      h2: ["20px", "26px"],
      // 22 px: stat values in a summary strip.
      stat: ["22px", "26px"],
      // 28 px: page titles (condensed). 26 px under 760 px is set in components.
      title: ["28px", "32px"],
      // 32 px: big figures (condensed).
      figure: ["32px", "32px"],
    },
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      md: "6px",
      lg: "8px",
      xl: "12px",
      full: "9999px",
    },
    // Colours stay in `extend` so transparent, current and inherit keep working.
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          ink: "var(--primary-ink)",
          soft: "var(--primary-soft)",
        },
        link: "var(--link)",
        focus: "var(--focus)",
        bar: "var(--bar)",
        track: "var(--track)",
        ok: { DEFAULT: "var(--ok)", soft: "var(--ok-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        bad: { DEFAULT: "var(--bad)", soft: "var(--bad-soft)" },
        folder: "var(--folder)",
        brand: "var(--brand)",
        scrim: "var(--scrim)",
        "sb-bg": "var(--sb-bg)",
        "sb-ink": "var(--sb-ink)",
        "sb-ink-2": "var(--sb-ink-2)",
        "sb-strong": "var(--sb-strong)",
        "sb-line": "var(--sb-line)",
        "sb-active": "var(--sb-active)",
        "sb-hover": "var(--sb-hover)",
        "sb-icon-on": "var(--sb-icon-on)",
        "sb-tick": "var(--sb-tick)",
        "sb-focus": "var(--sb-focus)",
        "sb-ok": "var(--sb-ok)",
        "sb-warn": "var(--sb-warn)",
        "sb-bad": "var(--sb-bad)",
        "sb-tag-line": "var(--sb-tag-line)",
        "sb-avatar-bg": "var(--sb-avatar-bg)",
        "sb-avatar-ink": "var(--sb-avatar-ink)",
      },
      boxShadow: { pop: "var(--pop-shadow)" },
    },
  },
  plugins: [],
};
