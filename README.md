# TapLog

## What TapLog is

TapLog is being built as a configurable one-click/tap timestamped tracker for Obsidian.

The goal is simple: create a normal Markdown note, define what you want to track, tap a button, and append a timestamped row to a monthly CSV file. TapLog is meant to cover everyday tracking cases like snacks, coffee, medication, symptoms, habits, supplies, or other personal logs without making the user assemble QuickAdd + Buttons + Meta Bind + DataviewJS + CSV plugins into a fragile stack.

## Product shape

TapLog's core product shape is:

1. A Markdown tracker note acts as both readable config and control panel.
2. YAML frontmatter defines a `taplog` tracker config.
3. A `taplog` code block renders buttons inside the note.
4. The rendered block shows the resolved CSV output path.
5. Trackers with defaults show a small current values section.
6. Each button shows a short preview of what it will log.
7. Button clicks append timestamped rows to monthly CSV files.
8. TapLog auto-creates the needed folders, CSV files, and headers.
9. Broken config shows a friendly visible error in the note instead of failing silently.

The intended MVP output path pattern is:

```text
TapLog/Logs/YYYY-MM/snacks.csv
```

TapLog currently includes command palette starters for:

- **TapLog: Create snack tracker**
- **TapLog: Create cannabis tracker**

## MVP target

The first build target is intentionally small:

1. One tracker note with YAML frontmatter.
2. One `taplog` code block that renders buttons.
3. Current values display for tracker defaults.
4. Visible button previews and a resolved output path.
5. Button click appends to `TapLog/Logs/YYYY-MM/snacks.csv`.
6. Auto-create folder, file, and CSV header when missing.
7. Friendly visible error if the config is broken.

No charts, dashboards, sync logic, complex settings UI, summaries, or par levels are part of this first implementation pass.

## Example tracker note

This is the product shape TapLog is being built toward:

````markdown
---
taplog:
  id: snacks
  output_type: csv
  output_folder: TapLog/Logs
  output_file_pattern: YYYY-MM/snacks.csv

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
```

# Snack Tracker

```taplog
id: snacks
```
````

The rendered `taplog` block becomes tappable buttons, a resolved output destination, and a short preview for each button.

The snack tracker command creates:

```text
TapLog/Trackers/Snack Tracker.md
```

The cannabis tracker command creates:

```text
TapLog/Trackers/Cannabis Tracker.md
```

Its CSV output is:

```text
TapLog/Logs/YYYY-MM/cannabis.csv
```

## Example CSV output

Clicking **Ate Mosh Bar** in May 2026 should append to:

```text
TapLog/Logs/2026-05/snacks.csv
```

With rows shaped like:

```csv
timestamp,item,quantity,unit,category
2026-05-18 22:46,Mosh Bar,1,bar,snack
```

If the folder or CSV file does not exist yet, the MVP should create it and write the header before appending the first row.

Before clicking, the rendered button preview shows the configured values that will be logged. For example, **Ate Mosh Bar** previews item, quantity, unit, and category. Cannabis tracker buttons preview the merged tracker defaults, such as strain and method, plus the button size.

Trackers can define reusable defaults. When defaults exist, TapLog shows them as **Current values** above the buttons and uses them for previews and CSV rows. In the generated Cannabis Tracker, edit `taplog.defaults.strain` in the frontmatter, then refresh or reopen the note to use the new strain.

## Build roadmap

The roadmap from `TapLog Idea.md` is:

1. Markdown tracker note with `taplog` config.
2. `taplog` code block button renderer.
3. Button click logging to monthly CSV output.
4. Auto-created folders, files, and CSV headers.
5. Friendly visible config validation errors.
6. Additional tracker templates.
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

This repository is currently a clean TapLog foundation based on the official Obsidian sample plugin structure. The plugin can render configured `taplog` buttons from a note's frontmatter, show current values for defaults, show a resolved output path and button previews, show visible setup errors, create snack and cannabis tracker notes, and append clicked button rows to monthly CSV files. Summaries, par levels, and friendly setup UI are not implemented yet.
