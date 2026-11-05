# Garage console design: "Dock"

Private administration app, not a marketing site. No loader, no decorative metrics, no scroll
hijack. Every number on screen comes from the Garage API; when the API does not say, the screen
says so.

The look is a quiet operations console: a dark grouped sidebar, a light or dark work area on a
near-neutral graphite palette, one blue for actions and links, status in green, amber and red,
condensed headings, and data tables as the main form. The Garage yellow appears only on the logo
tile and on the active-navigation tick and icon.

## Tokens

`src/app/tokens.css` holds every colour as a CSS variable (the Graphite palette of the prototype,
light and dark); `tailwind.config.js` only maps names to them. A Tailwind colour has the name of
its token without the dashes: `bg-surface`, `text-ink-2`, `border-line`, `bg-primary`,
`text-primary-ink`, `bg-sb-bg`, `text-ok`, `bg-warn-soft`.

| Token                           | Role                                                      |
| ------------------------------- | --------------------------------------------------------- |
| `bg`                            | page                                                      |
| `surface` / `surface-2`         | panels, dialogs, fields / table heads, hover, quiet boxes |
| `line` / `line-strong`          | hairlines / control borders                               |
| `ink` / `ink-2` / `ink-3`       | text. `ink-3` is the lowest text tone (4.5:1 or better)   |
| `primary`, `primary-hover`      | action fill; `primary-ink` is the text on it              |
| `primary-soft`                  | selected row, selected menu item, pinned legend row       |
| `link`, `focus`                 | links and the focus ring                                  |
| `bar`, `track`                  | meter fill and its track                                  |
| `ok`, `warn`, `bad` (+ `-soft`) | status text and icons / their tinted backgrounds          |
| `folder`, `brand`               | folder icon amber, Garage yellow                          |
| `sb-*`                          | the sidebar: background, ink, line, active, tick, status  |
| `pop-shadow`, `scrim`           | popovers and dialogs / the backdrop                       |

Themes: `light`, `dark` and System. Light and Dark set `data-theme` on `<html>`; System removes
the attribute and the OS preference decides through `prefers-color-scheme` in `tokens.css`. The
choice lives in the `appdata` store (`localStorage`, `theme`: `light`, `dark` or `system`); with
no stored choice the app is on System. An inline script in `index.html` sets an explicit choice
before first paint. The user menu and the sign-in page carry the choice.

Status is never colour alone: each state has an icon and a word (circle-check fine, triangle
degraded, circle-x not fine, dashed circle unknown).

## Type

Self-hosted woff2, latin subset, SIL OFL, no CDN, from `@fontsource` 5.3.0 (`ibm-plex-sans`,
`ibm-plex-sans-condensed`, `ibm-plex-mono`), in `src/assets/fonts`, declared in
`src/app/styles.css` with relative URLs so Vite emits them under `assets/`, which the Go server
serves under `BASE_PATH`. Licence text: `misc/licenses/IBMPlex-OFL.txt`.

| Family                  | Weights     | Class       | Use                                                      |
| ----------------------- | ----------- | ----------- | -------------------------------------------------------- |
| IBM Plex Sans           | 400 500 600 | `font-sans` | all UI text                                              |
| IBM Plex Sans Condensed | 500 600     | `font-cond` | page titles, big figures, panel titles, uppercase labels |
| IBM Plex Mono           | 400 500     | `font-mono` | IDs, access keys, `s3://` URIs, addresses and paths only |

| Class          | Size / line | Use                                                        |
| -------------- | ----------- | ---------------------------------------------------------- |
| `text-label`   | 12 / 14     | uppercase condensed labels (`.lbl`), key caps, table heads |
| `text-caption` | 13 / 18     | secondary text, hints, meta                                |
| `text-body`    | 14 / 21     | everything else                                            |
| `text-h3`      | 16 / 22     | panel titles (condensed)                                   |
| `text-h2`      | 20 / 26     | state headings                                             |
| `text-stat`    | 22 / 26     | values in a summary strip, legend counts (condensed)       |
| `text-title`   | 28 / 32     | page titles (condensed); 26 px under 768 px                |
| `text-figure`  | 32 / 32     | big figures (condensed), also `.fig`                       |

The type scale is replaced, not extended: Tailwind's default text sizes (`text-sm`, …) do not
exist. Radii: `sm` 4 px, default and `md` 6 px (controls), `lg` 8 px (panels), `xl` 12 px
(dialogs, palette). Numbers are tabular. Screens: `sm` 640, `md` 768 (tables become stacks),
`nav` 961 (the sidebar is a fixed column from here up, a drawer below), `lg` 1024.

## Shell

`src/components/shell/`. The Dock sidebar (236 px, dark in both themes): the Garage tile and name,
groups "Storage" (Overview, Buckets, Access keys) and "Operate" (Cluster, with an amber "N staged"
tag when the layout has staged changes), then the cluster health block (status word and icon, the
16 by 16 `StatusGlyph` at 32 px, "N of M nodes · layout vN") and the account menu (Light, Dark,
System, Sign out). The top bar carries breadcrumbs (`crumbsForRoute`) and the search button
(Ctrl/⌘ K). Under 961 px the sidebar is a modal drawer (Radix dialog: it traps focus, closes on
Escape and returns focus to the menu button), and the bar shows the menu button, a health glyph
with a screen-reader status word, and a search icon. Breadcrumbs keep the remaining width; links
are at least 24 px high on desktop and 36 px on phone. Bucket labels follow the page title:
first global alias, else first local alias, else ID. Palette S3 addresses still use global aliases
or IDs only.

The palette (`Ctrl/⌘ K` or `/`, cmdk) resolves a typed address (`s3://media-assets/photos/`,
bucket aliases and IDs, key names, node hostnames) to routes and offers pages, theme and sign-out.
`g` then `o`, `b`, `k`, `c` jumps between pages; there are no visible badges for them. A palette
that opens from a control returns focus to it.

When the health reading is unavailable, including a refresh that failed after a healthy reading
was cached, the sidebar block and the partition panel say so, give the reason and offer a retry,
and show no counts (`healthReading` in `src/lib/partitions.ts`).

URLs stay ID based (`/buckets/:id?tab=…&prefix=…`); names are labels, never identities. Bucket
tabs are `objects`, `access`, `settings` (`bucketTab` also reads `browse`, `permissions` and
`overview`).

## Primitives

All in `src/components/ui/`, named exports where there is more than one.

- Actions: `Button`, `LinkButton`, `IconButton` (label required), `CopyButton` (`iconOnly`; says
  "Copied" only after the clipboard write succeeded), `CopyLine` (monospace value and a copy
  control). Copy controls are 36 px on phone, 30 px on desktop.
- Forms: `Input`/`TextField`/`InputField`/`SearchField`, `Toggle` (`role="switch"`, reads On or
  Off), `Checkbox`, `TagInput`, `FormControl`. react-hook-form with zod stays the form model.
- Overlays: `Dialog` (Radix, a sheet on phone, returns focus, not dismissible while pending) and
  `confirmAction()` from `confirm-store.ts`. A confirm with an `action` stays open with a pending
  state while it runs, and on failure shows the server's message and stays open. Toasts sit at
  the top centre under 768 px so they cannot cover sheet footer actions; desktop stays bottom right.
- Layout: `PageHeader`, `Panel` (title, meta, actions, flush), `SummaryStrip`, `Inspector` with
  `InspectorName` and `PropList`, `Notice`, `TabView` (a `normalize` prop rewrites legacy `?tab=`
  values).
- Data: `Ledger` (a table on desktop, labelled stacks under 768 px; `.row-actions` appear on hover,
  focus or selection and always on touch; `selectedKey` or `selectedKeys` sets the selected fill),
  `Meter` (`compact` fills grid cells without a minimum width or fixed flex basis), `Status`, `Perm`, `Chips`,
  `Code`, `Diff` (staged changes), `Kbd` (the palette footer
  and the search button only).
- States: `SkeletonRows`, `EmptyState`, `ErrorState` (code, server message, retry). A failed query
  is an error state, never an empty list.
- `PartitionPanel`, `StatusGlyph`, `StateGlyph`: the partition map.

Ledger phone labels align left, while desktop numeric columns align right. A column with
`mobile: "hide"` hides both its header and cells on phone. Responsive `hidden` utilities also
work on cells: the phone `display: flex` rule has lower specificity.

## Partition map honesty rule

The health API gives counts: `partitions`, `partitionsQuorum`, `partitionsAllOk`. The map draws
exactly that and nothing more: one cell per partition (11 px cells on a 2 px gap, 206 px wide for
256), in three states (all copies reachable, quorum only, no quorum), computed by
`src/lib/partitions.ts`. It shows no zone placement, no replica count and no per-partition
detail, because the API does not provide them. A cell is three slivers lit three, two or one, so
state reads by shape as well as colour. Unknown health, an error, a failed refresh or
`partitions: 0` render a designed unavailable state with the reason and a retry, never invented
counts. The 16 by 16 sidebar glyph scales any partition count to 256 cells and never hides a
non-zero state; at 32 px every cell is 2 px.

## Accessibility floor

- Text 4.5:1 or better in both themes (measured: `port` a11y sweep, see the lane reports).
- A visible focus ring (2 px `focus`, 2 px offset; `sb-focus` on the sidebar) on every stop.
- Targets 24 by 24 px at least; 34 px default controls on desktop, 36 px on touch; small controls
  (`size="sm"`) are 30 px on desktop and 36 px on touch, with no per-site override.
- Hover is a fill and a border, never colour alone.
- No horizontal overflow at 390 px; long names wrap or truncate with the full value in `title`.
- Dialogs trap focus, close on Escape, return focus and are labelled by their title.
- An accessible name that starts with the visible text (the sidebar status link).
- `prefers-reduced-motion` turns every transition and animation off (`styles.css`).

## Motion

100 to 180 ms ease-out, transform and opacity only: row hover, dialog open (a sheet rising on
phone, a 4 px settle on desktop), the drawer sliding in. Nothing moves at rest; live data
refreshes on its own schedule and the updated time is shown.

## Layout

`<main>` is at most 1400 px wide with 16 px gutters (32 px from `nav`); the document scrolls, not
an inner area. Lists (buckets, keys, nodes, objects) are ledgers inside flush panels. Pages end
with a summary built only from real data (totals, quota usage, per-zone capacity).
