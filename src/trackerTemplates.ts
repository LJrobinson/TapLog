import { Notice, TFile, normalizePath, type App } from "obsidian";
import { ensureParentFolders } from "./csv";
import {
	getTaplogFromFrontmatter,
	hasMatchingTaplogCodeBlock,
	isValidGeneratedTrackerConfig,
	type TrackerTemplate
} from "./taplogConfig";

export const SNACK_TRACKER_TEMPLATE: TrackerTemplate = {
	path: "TapLog/Trackers/Snack Tracker.md",
	name: "Snack Tracker",
	taplogId: "snacks",
	content: `---
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

\`\`\`taplog
id: snacks
\`\`\`
`
};

export const CANNABIS_TRACKER_TEMPLATE: TrackerTemplate = {
	path: "TapLog/Trackers/Cannabis Tracker.md",
	name: "Cannabis Tracker",
	taplogId: "cannabis",
	content: `---
taplog:
  id: cannabis
  output_type: csv
  output_folder: TapLog/Logs
  output_file_pattern: YYYY-MM/cannabis.csv
  columns:
    - timestamp
    - strain
    - method
    - size
  defaults:
    strain: Neon Moon - Gunpowder Haze
    method: dab
  buttons:
    - label: Micro Dab
      values:
        size: micro
    - label: Small Dab
      values:
        size: small
    - label: Normal Dab
      values:
        size: normal
---

# Cannabis Tracker

Edit \`taplog.defaults.strain\` in the frontmatter to change the current strain.

\`\`\`taplog
id: cannabis
\`\`\`
`
};

export const BASIC_TRACKER_TEMPLATE: TrackerTemplate = {
	path: "TapLog/Trackers/Basic Tracker.md",
	name: "Basic Tracker",
	taplogId: "basic",
	content: `---
taplog:
  id: basic
  output_type: csv
  output_folder: TapLog/Logs
  output_file_pattern: YYYY-MM/basic.csv
  columns:
    - timestamp
    - action
    - value
  buttons:
    - label: Logged Thing
      values:
        action: Thing
        value: 1
    - label: Logged Other Thing
      values:
        action: Other Thing
        value: 1
---

# Basic Tracker

\`\`\`taplog
id: basic
\`\`\`
`
};

export const CUSTOM_TRACKER_TEMPLATE: TrackerTemplate = {
	path: "TapLog/Trackers/Custom Tracker.md",
	name: "Custom Tracker",
	taplogId: "custom",
	content: `---
taplog:
  id: custom
  output_type: csv
  output_folder: TapLog/Logs
  output_file_pattern: YYYY-MM/custom.csv
  columns:
    - timestamp
    - label
    - value
    - note
  defaults:
    note: edit me
  buttons:
    - label: Log Example A
      values:
        label: Example A
        value: 1
    - label: Log Example B
      values:
        label: Example B
        value: 1
---

# Custom Tracker

Edit the frontmatter to change the tracker id, output file pattern, columns, defaults, buttons, and button values.

\`\`\`taplog
id: custom
\`\`\`
`
};

export const BUILT_IN_TRACKER_TEMPLATES: readonly TrackerTemplate[] = [
	SNACK_TRACKER_TEMPLATE,
	CANNABIS_TRACKER_TEMPLATE,
	BASIC_TRACKER_TEMPLATE,
	CUSTOM_TRACKER_TEMPLATE
];

export const BUILT_IN_TRACKER_IDS = BUILT_IN_TRACKER_TEMPLATES.map((template) => template.taplogId);

export function getTrackerTemplateById(trackerId: string): TrackerTemplate | undefined {
	return BUILT_IN_TRACKER_TEMPLATES.find((template) => template.taplogId === trackerId);
}

export async function createTrackerNote(app: App, template: TrackerTemplate): Promise<boolean> {
	const notePath = normalizePath(template.path);

	try {
		await ensureParentFolders(app.vault, notePath);

		const existingFile = app.vault.getAbstractFileByPath(notePath);
		if (existingFile && !(existingFile instanceof TFile)) {
			throw new Error(`"${notePath}" already exists but is not a note.`);
		}

		const noteFile = existingFile ?? await app.vault.create(notePath, template.content);
		const repairedExistingNote = existingFile ? await repairInvalidGeneratedTracker(app, existingFile, template) : false;
		if (!existingFile || repairedExistingNote) {
			await waitForTrackerMetadata(app, noteFile, template.taplogId);
		}

		await app.workspace.getLeaf(false).openFile(noteFile);

		if (!existingFile) {
			new Notice(`${template.name} was created.`);
		} else if (repairedExistingNote) {
			new Notice(`${template.name} had invalid TapLog frontmatter and was repaired.`);
		} else {
			new Notice(`${template.name} already existed and was opened.`);
		}

		return true;
	} catch (error) {
		console.error("TapLog failed to create tracker note.", error);
		new Notice(`TapLog could not create the tracker note: ${getErrorMessage(error)}`);
		return false;
	}
}

async function repairInvalidGeneratedTracker(app: App, file: TFile, template: TrackerTemplate): Promise<boolean> {
	const taplogConfig = getTaplogFromFrontmatter(app.metadataCache.getFileCache(file)?.frontmatter);
	const content = await app.vault.read(file);

	if (isValidGeneratedTrackerConfig(taplogConfig, template.taplogId) && hasMatchingTaplogCodeBlock(content, template.taplogId)) {
		return false;
	}

	await app.vault.modify(file, template.content);
	return true;
}

async function waitForTrackerMetadata(app: App, file: TFile, expectedId: string): Promise<void> {
	if (hasValidTrackerMetadata(app, file, expectedId)) {
		return;
	}

	await new Promise<void>((resolve) => {
		let settled = false;
		let timeoutId = 0;
		const eventRef = app.metadataCache.on("changed", (changedFile) => {
			if (changedFile.path === file.path && hasValidTrackerMetadata(app, file, expectedId)) {
				finish();
			}
		});

		const finish = () => {
			if (settled) {
				return;
			}

			settled = true;
			window.clearTimeout(timeoutId);
			app.metadataCache.offref(eventRef);
			resolve();
		};

		timeoutId = window.setTimeout(finish, 750);

		if (hasValidTrackerMetadata(app, file, expectedId)) {
			finish();
		}
	});
}

function hasValidTrackerMetadata(app: App, file: TFile, expectedId: string): boolean {
	const taplogConfig = getTaplogFromFrontmatter(app.metadataCache.getFileCache(file)?.frontmatter);

	return isValidGeneratedTrackerConfig(taplogConfig, expectedId);
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the tracker config and try again.";
}
