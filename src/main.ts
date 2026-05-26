import { Notice, Plugin, normalizePath, type MarkdownPostProcessorContext, type Vault } from "obsidian";

interface QuicklogButton {
	label: string;
	values: Record<string, unknown>;
}

interface QuicklogConfig {
	id: string;
	outputType: "csv";
	outputFolder: string;
	outputFilePattern: string;
	columns: string[];
	buttons: QuicklogButton[];
}

type QuicklogValidationResult =
	| {
		ok: true;
		config: QuicklogConfig;
	}
	| {
		ok: false;
		message: string;
	};

export default class TapLogPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor("quicklog", (source, el, ctx) => {
			this.renderQuicklogBlock(source, el, ctx);
		});

		this.addCommand({
			id: "create-snack-tracker-test-note",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create snack tracker test note",
			callback: () => {
				void this.createSnackTrackerTestNote();
			}
		});
	}

	onunload() {
	}

	private renderQuicklogBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		clearElement(el);

		const quicklogConfig = this.getQuicklogConfig(ctx);
		const result = validateQuicklogConfig(source, quicklogConfig);

		if (!result.ok) {
			renderSetupError(el, result.message);
			return;
		}

		renderButtons(el, result.config, (button) => {
			void this.logButtonClick(result.config, button);
		});
	}

	private getQuicklogConfig(ctx: MarkdownPostProcessorContext): unknown {
		const cache = this.app.metadataCache.getCache(ctx.sourcePath);
		const frontmatter = cache?.frontmatter ?? ctx.frontmatter;

		if (!isRecord(frontmatter)) {
			return undefined;
		}

		return frontmatter["quicklog"];
	}

	private async logButtonClick(config: QuicklogConfig, button: QuicklogButton) {
		try {
			await appendCsvRow(this.app.vault, config, button, new Date());
			new Notice(`Logged: ${button.label}`);
		} catch (error) {
			console.error("TapLog failed to write CSV row.", error);
			new Notice(`TapLog could not write the log row: ${getErrorMessage(error)}`);
		}
	}

	private async createSnackTrackerTestNote() {
		const notePath = normalizePath("QuickLog/Trackers/Snack Tracker.md");

		try {
			await ensureParentFolders(this.app.vault, notePath);

			const existingFile = this.app.vault.getFileByPath(notePath);
			const noteFile = existingFile ?? await this.app.vault.create(notePath, SNACK_TRACKER_TEST_NOTE);

			await this.app.workspace.getLeaf(false).openFile(noteFile);
			new Notice(existingFile ? "Opened snack tracker test note." : "Created snack tracker test note.");
		} catch (error) {
			console.error("TapLog failed to create snack tracker test note.", error);
			new Notice(`TapLog could not create the test note: ${getErrorMessage(error)}`);
		}
	}
}

const SNACK_TRACKER_TEST_NOTE = `---
quicklog:
  id: snacks
  output_type: csv
  output_folder: QuickLog/Logs
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
        item: Beef Jerky
        quantity: 1
        unit: bag
        category: snack
---

# Snack Tracker

\`\`\`quicklog
id: snacks
\`\`\`
`;

function validateQuicklogConfig(source: string, quicklogConfig: unknown): QuicklogValidationResult {
	if (!isRecord(quicklogConfig)) {
		return {
			ok: false,
			message: "Missing quicklog config in this note."
		};
	}

	const rawConfigId = quicklogConfig["id"];
	if (typeof rawConfigId !== "string" || rawConfigId.trim().length === 0) {
		return {
			ok: false,
			message: "Missing quicklog id in this note's frontmatter."
		};
	}

	const configId = rawConfigId.trim();

	const rawOutputType = quicklogConfig["output_type"];
	if (rawOutputType !== "csv") {
		return {
			ok: false,
			message: "TapLog only supports output_type: csv right now."
		};
	}

	const rawOutputFolder = quicklogConfig["output_folder"];
	if (typeof rawOutputFolder !== "string" || rawOutputFolder.trim().length === 0) {
		return {
			ok: false,
			message: "Missing output_folder in quicklog config."
		};
	}

	const rawOutputFilePattern = quicklogConfig["output_file_pattern"];
	if (typeof rawOutputFilePattern !== "string" || rawOutputFilePattern.trim().length === 0) {
		return {
			ok: false,
			message: "Missing output_file_pattern in quicklog config."
		};
	}

	const rawColumns = quicklogConfig["columns"];
	if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
		return {
			ok: false,
			message: "Missing quicklog columns. Add at least one column in frontmatter."
		};
	}

	const columns: string[] = [];
	for (let index = 0; index < rawColumns.length; index++) {
		const rawColumn = rawColumns[index];
		if (typeof rawColumn !== "string" || rawColumn.trim().length === 0) {
			return {
				ok: false,
				message: `Column ${index + 1} must be a non-empty name.`
			};
		}

		columns.push(rawColumn.trim());
	}

	const blockId = parseQuicklogBlockId(source);
	if (!blockId) {
		return {
			ok: false,
			message: `Missing quicklog code block id. Add: id: ${configId}`
		};
	}

	if (blockId !== configId) {
		return {
			ok: false,
			message: `Quicklog block id "${blockId}" does not match frontmatter id "${configId}".`
		};
	}

	const rawButtons = quicklogConfig["buttons"];
	if (!Array.isArray(rawButtons) || rawButtons.length === 0) {
		return {
			ok: false,
			message: "Missing quicklog buttons. Add at least one button in frontmatter."
		};
	}

	const buttons: QuicklogButton[] = [];
	for (let index = 0; index < rawButtons.length; index++) {
		const rawButton = rawButtons[index];
		if (!isRecord(rawButton)) {
			return {
				ok: false,
				message: `Button ${index + 1} must be a config object with a label.`
			};
		}

		const rawLabel = rawButton["label"];
		if (typeof rawLabel !== "string" || rawLabel.trim().length === 0) {
			return {
				ok: false,
				message: `Button ${index + 1} is missing a label.`
			};
		}

		const rawValues = rawButton["values"];
		if (rawValues !== undefined && !isRecord(rawValues)) {
			return {
				ok: false,
				message: `Button ${index + 1} values must be a config object.`
			};
		}

		buttons.push({
			label: rawLabel.trim(),
			values: rawValues ?? {}
		});
	}

	return {
		ok: true,
		config: {
			id: configId,
			outputType: rawOutputType,
			outputFolder: rawOutputFolder.trim(),
			outputFilePattern: rawOutputFilePattern.trim(),
			columns,
			buttons
		}
	};
}

function parseQuicklogBlockId(source: string): string | undefined {
	const lines = source.split(/\r?\n/);

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
			continue;
		}

		const match = /^id\s*:\s*(.+)$/.exec(trimmedLine);
		const rawId = match?.[1]?.trim();
		if (rawId) {
			return trimMatchingQuotes(rawId);
		}
	}

	return undefined;
}

function trimMatchingQuotes(value: string): string {
	const firstCharacter = value[0];
	const lastCharacter = value[value.length - 1];

	if (
		value.length >= 2
		&& ((firstCharacter === "\"" && lastCharacter === "\"") || (firstCharacter === "'" && lastCharacter === "'"))
	) {
		return value.slice(1, -1).trim();
	}

	return value;
}

function renderButtons(el: HTMLElement, config: QuicklogConfig, onButtonClick: (button: QuicklogButton) => void) {
	const buttonRow = document.createElement("div");
	buttonRow.className = "taplog-button-row";

	for (const button of config.buttons) {
		const buttonEl = document.createElement("button");
		buttonEl.type = "button";
		buttonEl.className = "taplog-button";
		buttonEl.textContent = button.label;
		buttonEl.addEventListener("click", () => {
			onButtonClick(button);
		});

		buttonRow.appendChild(buttonEl);
	}

	el.appendChild(buttonRow);
}

function renderSetupError(el: HTMLElement, message: string) {
	const errorEl = document.createElement("div");
	errorEl.className = "taplog-error";
	errorEl.textContent = `TapLog setup problem: ${message}`;
	el.appendChild(errorEl);
}

function clearElement(el: HTMLElement) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function appendCsvRow(vault: Vault, config: QuicklogConfig, button: QuicklogButton, now: Date) {
	const outputPath = buildOutputPath(config, now);
	await ensureParentFolders(vault, outputPath);

	const row = buildCsvRow(config.columns, button.values, now);
	const header = serializeCsvRow(config.columns);
	const existingFile = vault.getFileByPath(outputPath);

	if (!existingFile) {
		await vault.create(outputPath, `${header}\n${row}\n`);
		return;
	}

	const existingContent = await vault.read(existingFile);
	const needsHeader = existingContent.trim().length === 0;
	const needsSeparator = existingContent.length > 0 && !existingContent.endsWith("\n");
	const appendText = `${needsSeparator ? "\n" : ""}${needsHeader ? `${header}\n` : ""}${row}\n`;

	await vault.append(existingFile, appendText);
}

function buildOutputPath(config: QuicklogConfig, now: Date): string {
	return normalizePath(replaceDateTokens(`${config.outputFolder}/${config.outputFilePattern}`, now));
}

function replaceDateTokens(value: string, now: Date): string {
	const year = String(now.getFullYear());
	const month = String(now.getMonth() + 1).padStart(2, "0");

	return value
		.replace(/YYYY/g, year)
		.replace(/MM/g, month);
}

async function ensureParentFolders(vault: Vault, filePath: string) {
	const lastSlashIndex = filePath.lastIndexOf("/");
	if (lastSlashIndex === -1) {
		return;
	}

	const folderPath = filePath.slice(0, lastSlashIndex);
	const parts = folderPath.split("/").filter((part) => part.length > 0);
	let currentPath = "";

	for (const part of parts) {
		currentPath = currentPath.length === 0 ? part : `${currentPath}/${part}`;

		if (vault.getFolderByPath(currentPath)) {
			continue;
		}

		if (vault.getAbstractFileByPath(currentPath)) {
			throw new Error(`Cannot create folder "${currentPath}" because a file already exists there.`);
		}

		await vault.createFolder(currentPath);
	}
}

function buildCsvRow(columns: string[], values: Record<string, unknown>, now: Date): string {
	return serializeCsvRow(columns.map((column) => {
		if (column === "timestamp") {
			return formatLocalTimestamp(now);
		}

		return values[column] ?? "";
	}));
}

function serializeCsvRow(values: unknown[]): string {
	return values.map(csvEscape).join(",");
}

function csvEscape(value: unknown): string {
	const text = valueToCsvText(value);

	if (/[",\r\n]/.test(text)) {
		return `"${text.replace(/"/g, "\"\"")}"`;
	}

	return text;
}

function valueToCsvText(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function formatLocalTimestamp(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hour = String(date.getHours()).padStart(2, "0");
	const minute = String(date.getMinutes()).padStart(2, "0");
	const second = String(date.getSeconds()).padStart(2, "0");

	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the tracker config and try again.";
}
