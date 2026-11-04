# Garage console design

Private administration app, not a marketing site. No loader, no decorative metrics, no scroll
hijack. Every number on screen comes from the Garage API; when the API does not say, the screen
says so.

The console is an address space. The bar at the top always shows where you are as an S3-style
address (`s3://media-assets/photos/`, `garage://cluster`), and the same addresses open the
palette.

## Tokens

`src/app/tokens.css` holds every colour as a CSS variable; `tailwind.config.js` only maps names
(`bg-lift`, `text-ink-3`, `border-rule`) to them. One olive-neutral hue, surfaces shift only in
lightness, the logo yellow (`gold`) is the single accent.

| Token                    | Role                                                            |
| ------------------------ | --------------------------------------------------------------- |
| `ground` / `lift`        | page / panel and dialog surfaces                                |
| `sunk`                   | inset fields                                                    |
| `rule` / `rule-strong`   | hairlines / control borders                                     |
| `wash` / `fill`          | hover wash / pressed or hovered icon control                    |
| `ink` to `ink-4`         | text. `ink-3` is the lowest text tone (4.5:1 or better on both) |
| `gold`, `gold-ink`       | accent fill and the text on it                                  |
| `gold-text`, `gold-wash` | accent as text or focus ring, and a faint accent wash           |
| `ok` / `warn` / `bad`    | status                                                          |

Themes: `light` and `dark`, keyed on `data-theme` on `<html>`. The choice lives in the
`appdata` store (`localStorage`); a first visit follows `prefers-color-scheme`. An inline script
in `index.html` sets the attribute before first paint. A document with no `data-theme` falls back
to the OS preference through a media query in `tokens.css`. `--ink-4` is decoration only
(disabled and idle marks), never text.

Status is never colour alone: each state has a shape (filled square ok, triangle degraded, hollow
square bad, dash unknown) and a word.

## Type

Self-hosted, SIL OFL, no CDN: JetBrains Mono (variable, 400 to 700) is the UI face, Bricolage
Grotesque (600 only) is for headings (`font-display`). Licences are in `misc/licenses/`. Fonts
are imported from `src/assets/fonts` through CSS, so Vite emits them under `assets/`, which the Go
server serves under `BASE_PATH`. Figures are tabular and zeros are slashed.

| Class          | Size / line | Use                      |
| -------------- | ----------- | ------------------------ |
| `text-caption` | 13 / 18     | labels, meta, hints      |
| `text-body`    | 13 / 20     | everything else          |
| `text-h4`      | 14 / 20     | row titles on phone      |
| `text-h3`      | 16 / 22     | panel and dialog titles  |
| `text-h2`      | 20 / 26     | states and page headings |

The scale is replaced, not extended: Tailwind's defaults (`text-sm`, `rounded-xl`, …) do not exist.
Radii are 2 px (`sm`), 3 px (default, `md`) and 6 px (`lg`, dialogs and the palette).

## Shell

`src/components/shell/`. A rail on desktop (nav with `g` then `o`/`b`/`k`/`c` shortcuts, live
cluster status, display name, sign out) and a labelled tab bar on phone. The address bar at the
top shows the current address and opens the palette. The palette (`Ctrl/Cmd+K` or `/`, cmdk)
resolves a typed address, bucket aliases, key names and node hostnames to routes, and offers
theme and sign-out. It returns focus to the control that opened it. On route change the main
column fades in (180 ms) while the address types itself into the bar (34 ms per character, 420 ms
at most). The rail status reads the same health and status queries the pages use.

URLs stay ID based (`/buckets/:id?tab=…&prefix=…`); names are labels, never identities.

## Primitives

All in `src/components/ui/`, named exports where there is more than one.

- Actions: `Button`, `LinkButton`, `IconButton` (label required), `CopyButton` (says "Copied" only
  after the clipboard write succeeded), `ActionSheet` (phone overflow menu).
- Forms: `Input`/`TextField`/`InputField`, `Toggle` (`role="switch"`), `Checkbox`, `TagInput`,
  `FormControl`. react-hook-form with zod stays the form model.
- Overlays: `Dialog` (Radix, bottom sheet on phone, returns focus, not dismissible while pending)
  and `confirmAction()` from `confirm-store.ts`. A confirm with an `action` stays open with a
  pending state while it runs, and on failure shows the server's message and stays open.
- Data: `Ledger` (a table on desktop, labelled stacks under 768 px), `Meter`, `Status`, `Perm`,
  `Kbd`, `Chips`, `Code`, `Diff` (staged changes), `PageHeader`, `Panel`, `AddressText`.
- States: `SkeletonRows`, `EmptyState`, `ErrorState` (code, server message, retry). A failed query
  is an error state, never an empty list.
- `PartitionPanel`, `StatusGlyph`, `StateGlyph`: the partition map.

## Partition map honesty rule

The health API gives counts: `partitions`, `partitionsQuorum`, `partitionsAllOk`. The map draws
exactly that and nothing more: one cell per partition, in three states (all copies reachable,
quorum only, no quorum), computed by `src/lib/partitions.ts`. It shows no zone placement, no
replica count and no per-partition detail, because the API does not provide them. A state glyph is
three slivers lit three, two or one, so state reads by shape as well as colour. Unknown health,
an error, or `partitions: 0` render a designed unavailable state, never invented counts. The 16 by
16 shell glyph scales any partition count to 256 cells and never hides a non-zero state.

## Accessibility floor

- Text 13 px or larger; secondary text 4.5:1 or better in both themes.
- A visible focus ring (2 px `gold-text`, 2 px offset) on every stop.
- Targets 24 by 24 px at least; 36 px on touch for default controls.
- No colour-only hover on primary or icon controls: a block wipes in under the label, icon
  controls take a fill.
- No horizontal overflow at 390 px; long names wrap or truncate with the full value in `title`.
- Dialogs trap focus, close on Escape and are labelled by their title.
- An accessible name that starts with the visible text (the rail status link).
- axe: 0 serious or critical issues on every route.

## Motion

120 ms ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`), transform and opacity only: the hover wipe on
buttons, the caret sliding in on rows, dialog open (opacity and 4 px), the route fade. Nothing
moves at rest; live data refreshes on its own schedule and the updated time is shown. Under
`prefers-reduced-motion: reduce` every transition and animation is off (`styles.css`) and the typed
address appears at once.

## Layout

`<main>` is at most 1200 px wide with 16 px gutters (20 px from `md`); the document scrolls, not an
inner area. Lists (buckets, keys, nodes, objects) are ledgers. Pages end with a summary built only
from real data (totals, quota usage, per-zone capacity), and on phone the explanation of an
unreachable node comes before the partition map.
