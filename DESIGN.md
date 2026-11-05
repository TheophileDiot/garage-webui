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
`nav` 961 (the sidebar is a fixed column from here up; below it is the phone shell), `lg` 1024.
"Phone" in this document means below `nav` (960 px and under); some list and field rules switch at
`md` (768 px) and keep that switch. Touch rules follow the pointer, not only the width: `touch:` =
`(max-width: 767px), (pointer: coarse)` and `desk:` = from 768 px with a fine or no pointer (Tailwind
variants in `tailwind.config.js`, exact complements). A phone in landscape is wider than 768 px and
still a thumb, so it gets the touch metrics with the table layout. Layout switches stay on width
(`md`, `nav`).

## Shell

`src/components/shell/`. The Dock sidebar (236 px, dark in both themes): the Garage tile and name,
groups "Storage" (Overview, Buckets, Access keys) and "Operate" (Cluster, with an amber "N staged"
tag when the layout has staged changes), then the cluster health block (status word and icon, the
16 by 16 `StatusGlyph` at 32 px, "N of M nodes · layout vN") and the account menu (Light, Dark,
System, Sign out). The top bar carries breadcrumbs (`crumbsForRoute`) and the search button
(Ctrl/⌘ K). Breadcrumbs keep the remaining width; links are at least 24 px high on desktop and
36 px (44 px hit area) on phone. Bucket labels follow the page title: first global alias, else
first local alias, else ID. Palette S3 addresses still use global aliases or IDs only.

**Phone shell (under 961 px).** There is no sidebar and no drawer. The top bar (52 px, sticky)
carries the breadcrumbs, the search icon, a health chip and the account button. The health chip is
the status glyph with its word ("Healthy", "Degraded", "Unavailable", "Checking", "Unknown"; pure
rule in `src/lib/phone-shell.ts`) and opens the health sheet: status word and icon, the partition
glyph, "N of M nodes · layout vN", the staged-change count, a way to the Cluster page. The sheet
keeps the honesty rule: an unavailable reading, a failed refresh after a healthy one included,
says why and offers "Try again" and shows no count. The account button is the avatar (initials);
its panel opens downward from the right edge with the theme choice and Sign out, so signing out is
two taps. The health sheet closes on any route change. The navigation is a bottom bar fixed to the bottom edge with
`env(safe-area-inset-bottom)` padding (`index.html` has `viewport-fit=cover`): Overview, Buckets,
Access keys, Cluster, each at least 44 px wide, 56 px tall (48 px with the icon beside the word on
a screen shorter than 480 px), the current page marked by `aria-current` and the yellow tick, the
staged-change count as a badge on Cluster ("9+" above nine, the full count in its accessible
name; in the short landscape layout, icon beside the word, the badge gets 8 px more room). The bar
is dark in both themes, like the sidebar.

**One bottom bar at a time.** A page may replace the navigation with its own contextual bar by
rendering `<BottomBarSlot>` (`bottom-bar.tsx`) while it is mounted, for example the objects
browser's selection bar; unmounting it brings the navigation back. The slot is a light surface bar
with the same fixed position; its height is free, the shell measures the bar and sets `--bar-h`
(the bar's height, safe area included) on the shell. `main` ends with `--bar-h + 4rem` of padding
so the bar never covers the last row, and the "Top" button rides `--bar-h + 1rem` above it.
`useBottomBarAvailable()` (`bottom-bar-context.ts`) is false from 961 px: keep the desktop version
of the control where it was. Toasts sit at the top centre under 961 px, never over the bar.

**Home-screen app and safe areas.** `public/site.webmanifest` makes the console installable
(`display: standalone`; `start_url`, `scope` and icon paths are relative, so they follow `BASE_PATH`;
colours `#0B0C0F`). The iOS status bar is `black` (opaque), never `black-translucent`: translucent text is
always white and a light top bar cannot carry it. A standalone window has no back, reload or address
bar, so every route must be left through the console's own controls (bottom bar, breadcrumbs, sheet
close). Anything that touches a screen edge clears the cut-outs with `max(<padding>, env(safe-area-inset-*,
0px))`, never by addition: the top bar adds the top inset to its 52 px (and `TabView`'s sticky offset
follows it), the top bar, `main`, the bottom bar and sheet header, body and footer clear left and right in
landscape. A browser tab, where the insets are 0, is unchanged. Gecko reports the system gesture bar as
`safe-area-inset-bottom` while its toolbar shows, although its viewport already ends above it, so the
bottom bar and the sheet footers drop that inset in Gecko only (`@supports (-moz-appearance: none)`
in `styles.css`); the iPhone inset is untouched.

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
  control). Copy controls are 36 px on phone, 30 px on desktop. Touch targets: the visual size
  stays 36 px and a transparent `::after` grows the hit area to 44 px under 768 px and on any coarse
  pointer, a phone in landscape included (`hit44` in
  `button-styles.ts`; every `Button`, `IconButton`, the crumb links, the avatar and the Ledger
  chevron carry it), so two neighbours 8 px apart share the gap exactly. Put a destructive control
  in its own place, never as the neighbour of a harmless one.
- Forms: `Input`/`TextField`/`InputField`/`SearchField`, `Toggle` (`role="switch"`, reads On or
  Off), `Checkbox`, `TagInput`, `FormControl`. react-hook-form with zod stays the form model.
  Text fields (and the palette's) are 16 px on touch, at any width, so iOS Safari does not zoom on
  focus, and 14 px with a mouse from 768 px up. Pinch zoom is never disabled.
- Overlays: `Dialog` (Radix, returns focus, not dismissible while pending) and
  `confirmAction()` from `confirm-store.ts`. A confirm with an `action` stays open with a pending
  state while it runs, and on failure shows the server's message and stays open. Toasts sit at
  the top centre under 961 px so they cannot cover sheet footer actions or the bottom bar; desktop
  stays bottom right.
- Sheets: a `Dialog` is three parts, a pinned header, a body that scrolls (`min-h-0 flex-1
overflow-y-auto`) and a pinned footer (`actions`). Under 768 px it is a bottom sheet, up to
  88 dvh, with a grab handle (visual only, no swipe) and a footer of full-width 44 px buttons,
  the primary first and Cancel under it (DOM order stays Cancel, then the primary; the footer is
  `flex-col-reverse`). From 768 px it is the centred dialog at 12 vh, capped to the room below
  it (`100dvh - 12vh - 1.5rem`), buttons in a right-aligned row. A wide but short screen (a phone
  in landscape, under 640 px high) moves it to 3 dvh so the footer stays on screen. `FormActions`
  is the Cancel and submit pair; nothing inside a dialog needs its own `max-h` scroller.
  **Back button.** While a sheet is open below 961 px or on a coarse pointer it holds one history
  entry (`lib/sheet-history.ts`, `use-sheet-back.ts`): Android Back closes it and nothing else;
  closing any other way (X, Cancel, Escape, submit) takes the entry back; a navigation started from
  a sheet (health sheet "Open cluster", a palette result, delete bucket) runs through
  `afterSheetsClosed`, so Back from the new page lands on the page the user left. Desktop dialogs
  (wide, with a mouse) do not touch history.
  **Soft keyboard.** While a text field in a sheet has focus and the keyboard covers the layout
  viewport (a VisualViewport inset of 80 px or more, never while pinch-zoomed) the sheet sits on the
  keyboard's top edge with its footer visible and the body scrolling (`data-kb`,
  `use-sheet-keyboard.ts`). On a touch screen a sheet does not autofocus its first field (the
  keyboard would cover half of it before it is seen); with a mouse it does.
- Layout: `PageHeader` (under 768 px a two-column grid: the title on the left, the page's primary
  action on the title row at the right, the meta line full width under both; from 768 px a wrapping
  row, as before), `Panel` (title, meta, actions, flush: it clips with `overflow-clip`, which
  rounds the corners but is no scroll container, so a `sticky` child inside it sticks),
  `SummaryStrip` (`phone="line"` turns it into one wrapping line of "label figure · label figure"
  under 768 px and drops each item's `detail` there), `Inspector` with `InspectorName` and
  `PropList`, `Notice` (icon top-aligned and the action under the text, lined up with it, on
  phone), `TabView` (a `normalize` prop rewrites legacy `?tab=` values; `sticky` keeps the tab list
  under the top bar on phone, full bleed, with no clipping or scrolling ancestor).
- Data: `Ledger` (a table on desktop, labelled stacks under 768 px; `.row-actions` appear on hover,
  focus or selection and always on touch, 8 px apart there; `selectedKey` or `selectedKeys` sets
  the selected fill; `compact` is the phone row, see below),
  `Meter` (`compact` fills grid cells without a minimum width or fixed flex basis), `Status`, `Perm`, `Chips`,
  `Code`, `Diff` (staged changes), `Kbd` (the palette footer
  and the search button only).
- States: `SkeletonRows`, `EmptyState`, `ErrorState` (code, server message, retry). A failed query
  is an error state, never an empty list.
- `PartitionPanel`, `StatusGlyph`, `StateGlyph`: the partition map.

Ledger phone labels align left, while desktop numeric columns align right. A column with
`mobile: "hide"` hides both its header and cells on phone. Responsive `hidden` utilities also
work on cells: the phone `display: flex` rule has lower specificity.

**Compact phone row.** `<Ledger compact>` replaces the labelled stack under 768 px with a short row:
the `title` cell is the name line, the `meta` cells flow on the one or two lines under it (ID,
counts, one status), a `trail` cell is the single 44 px target on the right (`LedgerChevron` for a
link, or a menu button; a column that sets `trailTop` puts it on the name line instead, for a
control that belongs to the row, such as a key's delete, while page-link chevrons stay centred),
and every other cell is dropped. A column that exists only for the phone
row (the trail) sets `phoneOnly`, which hides its head and cells from 768 px up. Desktop is the same
table with or without `compact`. Without `compact` a ledger stays the labelled stack.

**Phone rows by page** (all `<Ledger compact>`; every trail target is 44 px, and a primary action sits in
the `PageHeader` actions on the title row: Create bucket, Create key, Connect node, Refresh).

- Objects browser (rows under 768 px; the bottom bar and the Details sheet follow the shell, 961 px).
  A file row is a 44 px checkbox, the type icon or thumbnail, the name button and under it one line
  "size · modified" (`metaLine`); a click on the name selects the file, as on desktop. A folder row has
  the icon and name only (a spacer keeps the icons aligned), and a "Select all" row sits above the
  list. Row actions are not drawn in the row: the trail is an "Actions for <name>" button that opens
  the row menu sheet (`row-menu-sheet.tsx`): Open and Download (files), Share link, then Delete, set
  apart and last in the danger style. Share and Delete close that sheet and put focus back on the
  row's button first, so their dialog returns focus there. A thumbnail that fails to load (413 or 422
  for an oversized image) falls back to the type icon, on every width.
- Selection on a phone: `selectionBarPlace` puts the selection bar (`PhoneSelectionBar`) in the
  bottom slot, **replacing** the navigation; Clear brings it back. Top line: the summary ("name ·
  size", or "N selected · size total"), Details and Clear selection; second line: Download, Share
  link (one file only) and Delete, at least 16 px from the harmless ones, every control 44 px. Details
  is a sheet (`ObjectInspector sheet`) opened from the bar; it closes by itself when the selection
  goes away. From 961 px the inline bar and the Details aside stay as they were.
- Buckets list: name with the short ID (and the unfinished-uploads warning), one meta line (objects,
  size, quota only when one is set, a Website chip only when on), a `LedgerChevron` to the bucket.
  Empty values ("No quota", dashes) are not drawn on a phone. Browse, Settings and Copy are desktop
  actions.
- Bucket page: the identity card is the `s3://` address with its copy control and a "Details"
  disclosure (`aria-expanded`) holding the ID and the aliases; the facts are the `SummaryStrip` line;
  the tab list is `TabView sticky`. On the Objects tab New folder and Upload move to the title row
  (`Actions compact`) and the toolbar drops them. Allow keys is a sheet where each key is a checkbox
  row with one Read / Write / Owner segmented control (three 44 px toggles, `aria-pressed`, a tick as
  well as the fill). The Access tab's keys: name, ID with copy and grant as meta, Remove as the trail.
- Access keys: name, ID with copy and the bucket chips as meta (chips wrap inline, 8 px apart), a
  revealed secret wraps (`break-all`), Remove is the trail.
- Nodes (Cluster; the Overview list is the same row with a `LedgerChevron` to the node in place of
  Assign): name, one status, a "role · free space" line (Overview: zone and disk) as meta, Assign as
  the trail. Remove is a labelled danger button on a line of its own with room above it, and the
  icon Remove of the desktop cell is hidden. Address, tags and the capacity diff are not drawn.

## Partition map honesty rule

The health API gives counts: `partitions`, `partitionsQuorum`, `partitionsAllOk`. The map draws
exactly that and nothing more: one cell per partition (11 px cells on a 2 px gap, 206 px wide for
256), in three states (all copies reachable, quorum only, no quorum), computed by
`src/lib/partitions.ts`. It shows no zone placement, no replica count and no per-partition
detail, because the API does not provide them. A cell is three slivers lit three, two or one, so
state reads by shape as well as colour. Unknown health, an error, a failed refresh or
`partitions: 0` render a designed unavailable state with the reason and a retry, never invented
counts. The 16 by 16 sidebar glyph scales any partition count to 256 cells and never hides a
non-zero state; at 32 px every cell is 2 px. A tap or click selects the cell under it (a press in
the 2 px gap takes the nearest one), keyboard focus starts at cell 1, a lifted finger keeps its cell,
and the idle hint says "Tap a cell" on touch screens and "Point at a cell" on the others.

## Accessibility floor

- Text 4.5:1 or better in both themes (measured: `port` a11y sweep, see the lane reports).
- A visible focus ring (2 px `focus`, 2 px offset; `sb-focus` on the sidebar) on every stop.
- Targets 24 by 24 px at least; 34 px default controls on desktop (a mouse from 768 px), 36 px on
  touch (under 768 px or a coarse pointer); small controls
  (`size="sm"`) are 30 px on desktop and 36 px on touch, with no per-site override. On touch the
  hit area is 44 px (a pseudo-element, the visual size does not change) and adjacent icon buttons
  are 8 px apart. The bottom navigation items are 56 px tall.
- Text fields are 16 px on touch.
- Hover is a fill and a border, never colour alone.
- No horizontal overflow at 390 px; long names wrap or truncate with the full value in `title`.
- Dialogs trap focus, close on Escape, return focus and are labelled by their title; the footer is
  never off screen, in portrait or landscape.
- The bottom bar never covers content (the page pads its end by `--bar-h`) and toasts never cover it.
- Key caps (`.hint-kbd`) are hidden where the device cannot hover, by a
  `[@media(hover:none)]:hidden` variant on the element itself (a plain rule would lose to its
  `inline-flex` or `flex` utility).
- An accessible name that starts with the visible text (the sidebar status link).
- `prefers-reduced-motion` turns every transition and animation off (`styles.css`).

## Motion

100 to 180 ms ease-out, transform and opacity only: row hover, dialog open (a sheet rising on
phone, a 4 px settle on desktop). Nothing moves at rest; live data refreshes on its own schedule
and the updated time is shown.

## Layout

`<main>` is at most 1400 px wide with 16 px gutters (32 px from `nav`); the document scrolls, not
an inner area. On phone it ends with the bottom bar's height plus 4 rem of padding. Lists (buckets, keys, nodes, objects) are ledgers inside flush panels. Pages end
with a summary built only from real data (totals, quota usage, per-zone capacity). The Overview
re-orders itself under 961 px (`phoneOrderClass`): the health verdict, what is worth a look, a
one-line staged notice, the nodes, then stored data, disk usage and the partitions; the staged diff
and "Open cluster" stay on the Cluster page and in the bottom bar.
