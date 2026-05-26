# TapLog

## What TapLog is

TapLog is being built as a configurable one-click/tap timestamped tracker for Obsidian.

The goal is simple: create a normal Markdown note, define what you want to track, tap a button, and append a timestamped row to a monthly CSV file. TapLog is meant to cover everyday tracking cases like snacks, coffee, medication, symptoms, habits, supplies, or other personal logs without making the user assemble QuickAdd + Buttons + Meta Bind + DataviewJS + CSV plugins into a fragile stack.

## Product shape

TapLog's core product shape is:

1. A Markdown tracker note acts as both readable config and control panel.
2. YAML frontmatter defines a `quicklog` tracker config.
3. A `quicklog` code block renders buttons inside the note.
4. Button clicks append timestamped rows to monthly CSV files.
5. TapLog auto-creates the needed folders, CSV files, and headers.
6. Broken config shows a friendly visible error in the note instead of failing silently.

The intended MVP output path pattern is:

```text
QuickLog/Logs/YYYY-MM/snacks.csv
```

## MVP target

The first build target is intentionally small:

1. One tracker note with YAML frontmatter.
2. One `quicklog` code block that renders buttons.
3. Button click appends to `QuickLog/Logs/YYYY-MM/snacks.csv`.
4. Auto-create folder, file, and CSV header when missing.
5. Friendly visible error if the config is broken.

No charts, dashboards, sync logic, complex settings UI, summaries, par levels, or templates are part of this first implementation pass.

## Example tracker note

This is the product shape TapLog is being built toward:

````markdown
---
quicklog:
  id: snacks
  output_type: csv
  output_folder: QuickLog/Logs/YYYY-MM
  output_file: snacks.csv

  columns:
    - timestamp
    - item
    - quantity
    - unit
    - category

  buttons:
    - label: Ate Mosh Bar
      values:
        item: Mosh Bar
        quantity: 1
        unit: bar
        category: snack

    - label: Beef Jerky
      values:
        item: beef jerky
        quantity: 1
        unit: bag
        category: snack

    - label: Red Bull
      values:
        item: red bull
        quantity: 1
        unit: can
        category: drink
---

# Snack Tracker

```quicklog
id: snacks
```
````

The rendered `quicklog` block should become tappable buttons for the configured tracker.

## Example CSV output

Clicking **Ate Mosh Bar** in May 2026 should append to:

```text
QuickLog/Logs/2026-05/snacks.csv
```

With rows shaped like:

```csv
timestamp,item,quantity,unit,category
2026-05-18 22:46,Mosh Bar,1,bar,snack
```

If the folder or CSV file does not exist yet, the MVP should create it and write the header before appending the first row.

## Build roadmap

The roadmap from `TapLog Idea.md` is:

1. Markdown tracker note with `quicklog` config.
2. `quicklog` code block button renderer.
3. Button click logging to monthly CSV output.
4. Auto-created folders, files, and CSV headers.
5. Friendly visible config validation errors.
6. Tracker templates.
7. Monthly summaries.
8. Par level suggestions.
9. Persistent current values.
10. Friendly setup UI.

## Development setup

Install dependencies:

```bash
npm install
```

Run the development build in watch mode:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

For manual testing, copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/taplog/` in a test vault, then reload Obsidian and enable TapLog from **Settings -> Community plugins**.

## Current status

This repository is currently a clean TapLog foundation based on the official Obsidian sample plugin structure. The README documents the intended product direction, but the `quicklog` renderer and CSV logging MVP are not implemented yet.
