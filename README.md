# TapLog

TapLog is a configurable one-tap tracker for Obsidian. A tracker is a normal Markdown note with readable `taplog` frontmatter and a `taplog` code block that renders buttons in Reading View.

TapLog is useful for small repeated logs: snacks, coffee, symptoms, habits, supplies, cannabis, chores, or any simple timestamped event you want in plain files.

## What works now

TapLog currently supports:

1. `taplog` frontmatter config in a Markdown tracker note.
2. A `taplog` code block that renders tracker buttons.
3. CSV append logging to monthly files.
4. Auto-created folders, CSV files, and CSV headers.
5. Resolved output path display.
6. Button previews using merged `defaults` plus button `values`.
7. Current values display when `taplog.defaults` exists.
8. Friendly visible setup errors for broken config.
9. Tracker template commands for snack, cannabis, basic, and custom trackers.
10. Active-tracker monthly summaries.
11. Snack par/restock guidance when `taplog.par_levels` exists.
12. Current-month rollup summaries across all TapLog CSVs.
13. A static Markdown tracker index note.
14. Active-tracker validation reports.
15. A small TapLog settings tab for creating built-in trackers, creating simple custom trackers, and ordering trackers.
16. Optional ribbon shortcuts for opening the TapLog index and one quick tracker.
17. A Markdown dashboard note that renders buttons from multiple tracker notes.

TapLog does not currently include a full custom wizard, charts, dashboards, sync, or a full inventory system.

## Current commands

- **TapLog: Create snack tracker**
- **TapLog: Create cannabis tracker**
- **TapLog: Create basic tracker template**
- **TapLog: Create custom tracker template**
- **TapLog: Create tracker index**
- **TapLog: Create dashboard**
- **TapLog: Create monthly summary for active tracker**
- **TapLog: Validate active tracker**
- **TapLog: Create monthly rollup summary**

## Settings tab

Open TapLog's settings tab in Obsidian to create built-in tracker templates, create a configurable custom tracker, and set tracker order. Tracker order affects newly generated `TapLog/TapLog Index.md` notes and the section order in **TapLog: Create monthly rollup summary**.

The custom tracker builder asks for tracker name, optional tracker id, columns, defaults, and buttons. Columns are entered one per line. Defaults are entered as `key=value` lines. Buttons can be simple labels, or labels with values:

```text
Took Vitamin | activity=Took Vitamin, quantity=1, unit=count
Headache | activity=Headache, quantity=1, unit=event
Walked Moby
```

If a button is only a label, TapLog logs `label` and `value: 1`. If button values use columns not already listed, TapLog appends those columns automatically. `timestamp` is always included as the first column.

The builder generates a plain Markdown tracker note that remains editable by the user.

The settings tab is a simple launcher, builder, and order manager, not a full advanced schema editor. Plain Markdown tracker notes remain the source of truth for tracker config.

Settings can also enable or disable TapLog ribbon actions. By default, TapLog adds shortcuts to open the TapLog index, open the dashboard, and open the Snack Tracker. The quick tracker ribbon target can be changed to another built-in tracker or a settings-built custom tracker. Ribbon actions are shortcuts; they do not replace tracker notes.

## Current vault output

Tracker notes:

```text
TapLog/Trackers/
```

Monthly CSV logs:

```text
TapLog/Logs/YYYY-MM/*.csv
```

Monthly summary notes:

```text
TapLog/Summaries/YYYY-MM/*.md
```

Examples:

```text
TapLog/TapLog Index.md
TapLog/Dashboard.md
TapLog/Trackers/Snack Tracker.md
TapLog/Logs/YYYY-MM/snacks.csv
TapLog/Summaries/YYYY-MM/snacks Summary.md
TapLog/Summaries/YYYY-MM/snacks Validation.md
TapLog/Summaries/YYYY-MM/Monthly Rollup.md
```

Run **TapLog: Create tracker index** to create or open `TapLog/TapLog Index.md`. It is a static Markdown home note with links to the built-in trackers, current vault output paths, a short command reference, and a simple usage flow. It is not a live dashboard.

Run **TapLog: Create dashboard** to create or open `TapLog/Dashboard.md`. The dashboard is a Markdown control panel that renders TapLog buttons from multiple tracker notes using `source: tracker` blocks. Tracker notes remain the source of truth for config, and dashboard button clicks write to each tracker's normal monthly CSV. The generated dashboard respects tracker order.

Example dashboard block:

````markdown
```taplog
id: snacks
source: tracker
```
````

The dashboard is not a chart dashboard and does not include live analytics widgets or a drag-and-drop builder.

## Example tracker note

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

  par_levels:
    Mosh Bar:
      par: 12
      unit: bar
    Beef Jerky:
      par: 6
      unit: bag

  buttons:
    - label: Ate Mosh Bar
      values:
        item: Mosh Bar
        quantity: 1
        unit: bar
        category: snack

    - label: Beef Jerky
      values:
        item: Beef Jerky
        quantity: 1
        unit: bag
        category: snack
---

# Snack Tracker

```taplog
id: snacks
```
````

The rendered block shows buttons, a resolved CSV destination, and a short preview for each button. If the tracker has `defaults`, TapLog also shows them as current values above the buttons.

## CSV logging

Clicking **Ate Mosh Bar** appends to the current month CSV:

```text
TapLog/Logs/YYYY-MM/snacks.csv
```

Rows use the tracker columns:

```csv
timestamp,item,quantity,unit,category
2026-05-18 22:46,Mosh Bar,1,bar,snack
```

## Monthly summaries

Run **TapLog: Create monthly summary for active tracker** while viewing a tracker note. TapLog reads that tracker's current month CSV and regenerates:

```text
TapLog/Summaries/YYYY-MM/{tracker-id} Summary.md
```

Every active-tracker summary includes tracker id, month, source CSV path, and total event count. Snack summaries group item quantities and can include simple par/restock guidance when `taplog.par_levels` exists. Cannabis summaries group event counts by `size` and `strain` when those columns exist.

Run **TapLog: Create monthly rollup summary** to summarize all CSV files in:

```text
TapLog/Logs/YYYY-MM/
```

The rollup regenerates:

```text
TapLog/Summaries/YYYY-MM/Monthly Rollup.md
```

It includes month, source folder, tracker count, total event count, and one small section per tracker CSV.

Run **TapLog: Validate active tracker** while viewing a tracker note to check the `taplog` config. Valid trackers generate a small report at:

```text
TapLog/Summaries/YYYY-MM/{tracker-id} Validation.md
```

Invalid trackers show a friendly Notice with the first setup problem. This is not a live validation panel.

## Manual test checklist

1. Run each tracker command: snack, cannabis, basic, and custom.
2. Run **TapLog: Create tracker index** and confirm `TapLog/TapLog Index.md` opens.
3. Run **TapLog: Create dashboard** and confirm `TapLog/Dashboard.md` opens.
4. Confirm each tracker opens and renders buttons in Reading View.
5. Click one button in each tracker.
6. Confirm CSV rows appear under `TapLog/Logs/YYYY-MM/`.
7. Run **TapLog: Create monthly summary for active tracker** from a tracker note.
8. Confirm the tracker summary opens under `TapLog/Summaries/YYYY-MM/`.
9. Run **TapLog: Validate active tracker** from a tracker note.
10. Confirm the validation report opens under `TapLog/Summaries/YYYY-MM/`.
11. Run **TapLog: Create monthly rollup summary**.
12. Confirm `TapLog/Summaries/YYYY-MM/Monthly Rollup.md` opens.

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

Run automated helper tests:

```bash
npm run test
```

Before pushing changes, run the same validation used by CI:

```bash
npm run build
npm run lint
npm run test
```

For manual plugin testing, copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/taplog/` in a test vault, then reload Obsidian and enable TapLog from **Settings -> Community plugins**.

## Roadmap

From `TapLog Idea.md`, likely next steps are:

1. More tracker template refinement.
2. More summary types.
3. More par level tools.
4. Persistent current values.
5. Friendly setup UI.
