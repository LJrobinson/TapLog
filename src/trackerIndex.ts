import { Notice, TFile, normalizePath, type App } from "obsidian";
import { ensureParentFolders } from "./csv";

export const TRACKER_INDEX_PATH = "TapLog/TapLog Index.md";

export async function createTrackerIndexNote(app: App) {
	const indexPath = normalizePath(TRACKER_INDEX_PATH);

	try {
		await ensureParentFolders(app.vault, indexPath);

		const existingFile = app.vault.getAbstractFileByPath(indexPath);
		if (existingFile && !(existingFile instanceof TFile)) {
			throw new Error(`"${indexPath}" already exists but is not a note.`);
		}

		const indexFile = existingFile ?? await app.vault.create(indexPath, buildTrackerIndexContent());
		await app.workspace.getLeaf(false).openFile(indexFile);

		if (existingFile) {
			new Notice("Tracker index already existed and was opened.");
		} else {
			new Notice("Tracker index was created.");
		}
	} catch (error) {
		console.error("TapLog failed to create tracker index.", error);
		new Notice(`TapLog could not create the tracker index: ${getErrorMessage(error)}`);
	}
}

export function buildTrackerIndexContent(): string {
	return `# TapLog Index

Use this note as a simple home base for TapLog trackers, logs, summaries, and commands.

## Trackers

- [[TapLog/Trackers/Snack Tracker|Snack Tracker]]
- [[TapLog/Trackers/Cannabis Tracker|Cannabis Tracker]]
- [[TapLog/Trackers/Basic Tracker|Basic Tracker]]
- [[TapLog/Trackers/Custom Tracker|Custom Tracker]]

If a tracker note does not exist yet, run its create command from the command palette.

## Vault output

- Trackers: \`TapLog/Trackers/\`
- Logs: \`TapLog/Logs/YYYY-MM/\`
- Summaries: \`TapLog/Summaries/YYYY-MM/\`

## Commands

- TapLog: Create tracker index
- TapLog: Create snack tracker
- TapLog: Create cannabis tracker
- TapLog: Create basic tracker template
- TapLog: Create custom tracker template
- TapLog: Create monthly summary for active tracker
- TapLog: Create monthly rollup summary

## Usage flow

1. Create or open a tracker.
2. Switch to Reading View.
3. Click buttons to log events.
4. Run the monthly summary for the active tracker.
5. Run the monthly rollup summary.
`;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the vault path and try again.";
}
