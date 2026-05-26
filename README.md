# TapLog

TapLog is a one-tap tracker for Obsidian.

Use it to track snacks, cannabis, habits, symptoms, supplies, chores, inventory, or any simple event you want in plain files. Each tracker is a normal Markdown note. The tracker note contains readable `taplog` frontmatter, and a `taplog` code block renders the buttons in Reading View.

When you tap a button, TapLog appends a timestamped row to a monthly CSV file under `TapLog/Logs/YYYY-MM/`.

## Quick start

1. Install TapLog and enable it from **Settings -> Community plugins**.
2. Open the command palette.
3. Run **TapLog: Create snack tracker**.
4. Open `TapLog/Trackers/Snack Tracker.md`.
5. Switch the note to Reading View.
6. Tap **Ate Mosh Bar** or **Beef Jerky**.
7. Open `TapLog/Logs/YYYY-MM/snacks.csv` to see the logged row.

TapLog creates missing folders, CSV files, and CSV headers automatically.

## How trackers work

A tracker note has two important parts.

The editable config lives in the `taplog` frontmatter at the top of the note:

```yaml
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
---
```

The rendered buttons come from a `taplog` code block in the note body:

````markdown
```taplog
id: snacks
```
````

The code block `id` must match `taplog.id`.

## Edit a tracker

Tracker notes are the source of truth. To change buttons, columns, defaults, or output paths:

1. Open the tracker note, such as `TapLog/Trackers/Snack Tracker.md`.
2. Switch to Source mode or Editing View.
3. Edit the `taplog` section at the top of the note.
4. Save the note.
5. Switch back to Reading View.

The rendered buttons use the updated config. Existing CSV logs are not deleted when you edit a tracker note.

## Common edits

### Change a button label

Change the `label` text:

```yaml
buttons:
  - label: Ate Protein Bar
    values:
      item: Mosh Bar
      quantity: 1
      unit: bar
      category: snack
```

The label changes the button text. The `values` decide what gets written to the CSV.

### Change what a button logs

Edit the values under the button:

```yaml
buttons:
  - label: Ate Protein Bar
    values:
      item: Protein Bar
      quantity: 1
      unit: bar
      category: snack
```

Future taps use the new values. Existing CSV rows stay as they are.

### Add a new button

Copy an existing button and change the label and values:

```yaml
buttons:
  - label: Red Bull
    values:
      item: Red Bull
      quantity: 1
      unit: can
      category: drink
```

Make sure every value key you want to save also appears in `columns`.

### Remove a button

Delete the whole button block:

```yaml
  - label: Beef Jerky
    values:
      item: Beef Jerky
      quantity: 1
      unit: bag
      category: snack
```

Removing a button does not remove old CSV rows.

### Change a current value

Some trackers use `defaults`. For example, the Cannabis Tracker uses defaults for `strain` and `method`.

```yaml
defaults:
  strain: Neon Moon - Gunpowder Haze
  method: dab
```

Change the value in the tracker note:

```yaml
defaults:
  strain: New Strain Name
  method: dab
```

Buttons merge `defaults` with the button's own `values`. In this example, each dab button logs the current strain plus its own size.

### Add a column

Add the column name to `columns`:

```yaml
columns:
  - timestamp
  - item
  - quantity
  - unit
  - category
  - note
```

Then add values for that column where needed:

```yaml
buttons:
  - label: Ate Mosh Bar
    values:
      item: Mosh Bar
      quantity: 1
      unit: bar
      category: snack
      note: afternoon
```

New CSV files use the updated columns. Existing CSV files are not rewritten automatically. If the current month's CSV already exists, update its header manually or change `output_file_pattern` before logging with the new columns.

### Change the output file

Change `output_file_pattern`:

```yaml
output_file_pattern: YYYY-MM/snacks.csv
```

For example:

```yaml
output_file_pattern: YYYY-MM/snack-log.csv
```

Future taps write to the new file. Old CSV files stay where they are.

### Change the tracker id

Only change the tracker id if you also update the matching code block and any dashboard blocks that point to it.

```yaml
taplog:
  id: snacks
```

must match:

````markdown
```taplog
id: snacks
```
````

For built-in trackers, changing the output file name is usually safer than changing the tracker id. Generated dashboard blocks and settings order use tracker ids.

### Fix a generated custom tracker

Open the generated custom tracker note in `TapLog/Trackers/`, switch to Source mode or Editing View, and edit the `taplog` frontmatter directly.

If you only need to fix labels, buttons, columns, defaults, or output file names, edit the note. If you want a new custom tracker id to appear in settings and generated dashboard/index content, create a new custom tracker from settings.

### Delete or archive a tracker

Move, rename, archive, or delete the tracker note like any other Markdown file. CSV logs under `TapLog/Logs/` are separate files and are not deleted when you remove a tracker note.

If the old tracker appears in `TapLog/TapLog Index.md` or `TapLog/Dashboard.md`, edit those Markdown notes or regenerate them as described below.

## Where things are stored

Tracker notes:

```text
TapLog/Trackers/
```

Monthly CSV logs:

```text
TapLog/Logs/YYYY-MM/*.csv
```

Monthly summaries and validation reports:

```text
TapLog/Summaries/YYYY-MM/
```

Index note:

```text
TapLog/TapLog Index.md
```

Dashboard note:

```text
TapLog/Dashboard.md
```

Example output:

```text
TapLog/Trackers/Snack Tracker.md
TapLog/Logs/2026-05/snacks.csv
TapLog/Summaries/2026-05/snacks Summary.md
TapLog/Summaries/2026-05/snacks Validation.md
TapLog/Summaries/2026-05/Monthly Rollup.md
```

## Commands

- **TapLog: Create snack tracker**
- **TapLog: Create cannabis tracker**
- **TapLog: Create basic tracker template**
- **TapLog: Create custom tracker template**
- **TapLog: Create tracker index**
- **TapLog: Create dashboard**
- **TapLog: Create monthly summary for active tracker**
- **TapLog: Validate active tracker**
- **TapLog: Create monthly rollup summary**

The tracker commands create a tracker note if it does not exist, then open it. If the note already exists, TapLog opens it.

## Settings

TapLog settings are helpers, not the only way to manage trackers.

Use settings to:

- Create built-in tracker templates.
- Create a simple custom tracker.
- Change tracker order.
- Enable or disable ribbon shortcuts.
- Choose the quick tracker opened by the ribbon shortcut.

The custom tracker builder asks for a tracker name, optional tracker id, columns, defaults, and buttons.

Columns are one per line:

```text
activity
quantity
unit
category
```

Defaults are `key=value` lines:

```text
category=health
unit=count
```

Buttons are one per line. Use a plain label, or a label with values:

```text
Took Vitamin | activity=Took Vitamin, quantity=1, unit=count
Headache | activity=Headache, quantity=1, unit=event
Walked
```

If a button is only a label, TapLog logs `label` and `value: 1`. `timestamp` is always included as the first column.

After a tracker is created, edit it by opening the tracker note and changing the `taplog` frontmatter.

## Index and dashboard

Run **TapLog: Create tracker index** to create or open `TapLog/TapLog Index.md`.

The index is a normal Markdown note with links to trackers, output paths, and command names. It is not a live database view.

Run **TapLog: Create dashboard** to create or open `TapLog/Dashboard.md`.

The dashboard is a normal Markdown note that renders buttons from multiple tracker notes:

````markdown
```taplog
id: snacks
source: tracker
```
````

Dashboard blocks use the tracker notes as the source of truth. Tapping a dashboard button writes to that tracker's normal monthly CSV.

The dashboard is not an analytics dashboard. It does not include charts, live widgets, or drag-and-drop layout.

If tracker order or tracker list changes, the existing index/dashboard notes are not overwritten automatically. Edit them by hand, or delete/rename the existing index/dashboard note and run the create command again.

## Summaries and validation

Run **TapLog: Create monthly summary for active tracker** while viewing a tracker note. TapLog reads that tracker's current month CSV and creates or updates:

```text
TapLog/Summaries/YYYY-MM/{tracker-id} Summary.md
```

Snack summaries can include item totals and simple par/restock guidance when `taplog.par_levels` exists. Cannabis summaries group usage by `size` and `strain` when those columns exist.

Run **TapLog: Create monthly rollup summary** to summarize the current month's CSV files under:

```text
TapLog/Logs/YYYY-MM/
```

The rollup creates or updates:

```text
TapLog/Summaries/YYYY-MM/Monthly Rollup.md
```

Run **TapLog: Validate active tracker** while viewing a tracker note to create a validation report:

```text
TapLog/Summaries/YYYY-MM/{tracker-id} Validation.md
```

If a tracker is invalid, TapLog shows a setup problem Notice with the first issue it found.

## Troubleshooting

### Buttons do not show

- Switch the note to Reading View.
- Confirm the code block language is `taplog`.
- Confirm the code block has an `id`.
- Confirm the code block `id` matches `taplog.id` in the frontmatter.
- Confirm the frontmatter key is lowercase `taplog`.
- Look for a visible TapLog setup problem in the note.

### CSV did not update

- TapLog shows a Notice after a successful tap. Check the path in that Notice.
- Confirm the tracker uses `output_type: csv`.
- Confirm `output_folder` and `output_file_pattern` are set.
- Check whether a normal file already exists where TapLog needs to create a folder.
- Open the current month folder under `TapLog/Logs/YYYY-MM/`.

### Wrong value was logged

Edit the tracker note's button `values` or `defaults`. Future taps use the updated config. If an old CSV row is wrong, edit the CSV row directly.

### I made a bad custom tracker

Open the generated tracker note under `TapLog/Trackers/` and edit the `taplog` frontmatter. If the tracker is easier to start over, create a new custom tracker from settings and archive the old tracker note.

### I changed the note but buttons did not refresh

Switch out of Reading View and back, or close and reopen the note. Obsidian may need a moment to refresh frontmatter metadata.

### Mobile buttons are hard to tap

Use shorter button labels where practical. If a long label wraps poorly, edit the button label in the tracker note. The CSV value can stay detailed in `values`.

### A setup problem appears

Read the message shown in the TapLog block. It usually points to the missing or mismatched part of the config. You can also run **TapLog: Validate active tracker** from the command palette while viewing the tracker note.

## Known limitations

- Persistent current values are not implemented yet. Current values come from `taplog.defaults`, and you edit them in the tracker note.
- Editing existing trackers from a settings form is not implemented yet. Tracker notes are edited as Markdown today.
- Existing index and dashboard notes are not automatically regenerated when tracker order or tracker list changes.
- Validation is currently a Notice plus an optional Markdown report, not a live settings panel.
- TapLog does not include charts, sync, Dataview integration, Bases integration, external services, or a full inventory system.
