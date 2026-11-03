# Garage console design

Private administration app, not a marketing site. Theatre is scaled down: no loader, no GL,
no scroll hijack, no decorative metrics. Every number on screen comes from the Garage API.

## Concept card

```
Idea:        The console opens on what the cluster can promise right now: quorum first, files second.
Metaphor:    A workshop bay board: labelled bays, stamped numerals, hairline rules.
Signature:   Quorum band on Overview: three-state partition bar (all replicas / quorum only / no quorum)
             above a row of storage-node bays. The same status chip lives in the sidebar on every page.
Emotion:     Calm, exact, in control within three seconds.
Motion verb: "latch": 140 ms ease-out, transform and opacity only. Press sinks 1 px, bars fill once on mount.
Screenshot:  Overview at 1440, dark: large quorum numeral over the segmented bar and the bay row.
```

Idle state: the page stays still at rest on purpose. Live data refreshes every 30 s and the
refresh time is shown; nothing decorative moves. Reduced motion removes all transitions.

## Palette (daisyUI themes in `tailwind.config.js`)

| Role            | Dark                              | Light                             |
| --------------- | --------------------------------- | --------------------------------- |
| ground          | `#191f25`                         | `#f3f5f6`                         |
| surface         | `#20272e`                         | `#ffffff`                         |
| line            | `#343e48`                         | `#e0e5e8`                         |
| ink             | `#e9edf0`                         | `#1d2933`                         |
| accent          | `#f3a858`                         | `#a94d0e`                         |
| ok / warn / bad | `#8bd5ab` / `#e9c26b` / `#f29c99` | `#26734c` / `#946510` / `#b43a39` |

Status is never colour only: every dot has a text label.

## Type

Manrope (self-hosted `src/assets/manrope.ttf`, SIL OFL, licence in
`misc/licenses/Manrope-OFL.txt`), variable 200 to 800. System monospace only for ids and secrets.

| Role    | Size                           | Weight | Tracking |
| ------- | ------------------------------ | ------ | -------- |
| display | clamp(2.25rem, 4.5vw, 3.5rem)  | 800    | -0.045em |
| page h1 | clamp(1.5rem, 2.2vw, 1.875rem) | 800    | -0.03em  |
| title   | 1.0625rem                      | 700    | -0.015em |
| body    | 0.9375rem / 1.55               | 500    | 0        |
| label   | 0.6875rem uppercase            | 700    | +0.08em  |

Numbers use tabular figures.

## Grid, shape, rhythm

- Content max 72rem, 24 px gutters on desktop, 16 px on phone. Sidebar 16rem, drawer under 768 px.
- One radius rule: 0.5rem panels, 0.375rem controls, pill only for status.
- Surfaces are flat with a 1 px line; no shadows except dialogs.
- Rhythm varies: the Overview opens with one wide band, then an asymmetric 2:1 row, then a ledger.
- Lists (buckets, keys, nodes, objects) are ledgers: real tables on desktop, labelled stacks under 768 px.

## Interaction

- Primary targets answer in the verb: buttons sink 1 px on press, rows get an inset accent bar on hover,
  nav items slide an accent bar in. Utility links change colour and underline.
- Focus: 2 px accent outline, 3 px offset, on every interactive element.
- Dialogs are native `<dialog>` via `showModal()`: focus trap, Escape, labelled by title.
- Destructive actions use the in-app confirm dialog, not `window.confirm`.
- Loading uses skeleton rows, errors give a retry, empty states say what to do next.

## Composition

```
Overview            Buckets / Keys / Cluster
+---------------------+     +-------------------------+
| QUORUM BAND         |     | toolbar: search | action |
| status | numerals   |     +-------------------------+
| ███▓▓░ partitions   |     | ledger rows             |
| ▮▮▮▮▯ bays          |     |  name  usage  meta  act |
+----------+----------+     +-------------------------+
| disk free| footprint|
+----------+----------+
| bucket ledger       |
+---------------------+
```
