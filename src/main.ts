import { Notice, Plugin, TFile, TFolder, normalizePath, type MarkdownPostProcessorContext, type Vault } from "obsidian";

interface TaplogButton {
	label: string;
	values: Record<string, unknown>;
}

interface TaplogConfig {
	id: string;
	outputType: "csv";
	outputFolder: string;
	outputFilePattern: string;
	columns: string[];
	defaults: Record<string, unknown>;
	parLevels: Record<string, ParLevel>;
	buttons: TaplogButton[];
}

interface ParLevel {
	par: number;
	unit: string;
}

interface TrackerTemplate {
	path: string;
	name: string;
	taplogId: string;
	content: string;
}

type TaplogValidationResult =
	| {
		ok: true;
		config: TaplogConfig;
	}
	| {
		ok: false;
		message: string;
	};

export default class TapLogPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor("taplog", (source, el, ctx) => {
			this.renderTaplogBlock(source, el, ctx);
		});

		this.addCommand({
			id: "create-snack-tracker-test-note",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create snack tracker",
			callback: () => {
				void this.createTrackerNote(SNACK_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-cannabis-tracker",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create cannabis tracker",
			callback: () => {
				void this.createTrackerNote(CANNABIS_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-basic-tracker-template",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create basic tracker template",
			callback: () => {
				void this.createTrackerNote(BASIC_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-custom-tracker-template",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create custom tracker template",
			callback: () => {
				void this.createTrackerNote(CUSTOM_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-monthly-summary-active-tracker",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create monthly summary for active tracker",
			callback: () => {
				void this.createMonthlySummaryForActiveTracker();
			}
		});
	}

	onunload() {
	}

	private renderTaplogBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		clearElement(el);

		const taplogConfig = this.getTaplogConfig(ctx);
		const result = validateTaplogConfig(source, taplogConfig);

		if (!result.ok) {
			renderSetupError(el, result.message);
			return;
		}

		renderTaplogControls(el, result.config, (button) => this.logButtonClick(result.config, button));
	}

	private getTaplogConfig(ctx: MarkdownPostProcessorContext): unknown {
		const sourceFile = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(sourceFile instanceof TFile)) {
			return undefined;
		}

		return getTaplogFromFrontmatter(this.app.metadataCache.getFileCache(sourceFile)?.frontmatter);
	}

	private async logButtonClick(config: TaplogConfig, button: TaplogButton) {
		try {
			await appendCsvRow(this.app.vault, config, button, new Date());
			new Notice(`Logged: ${button.label}`);
		} catch (error) {
			console.error("TapLog failed to write CSV row.", error);
			new Notice(`TapLog could not write the log row: ${getErrorMessage(error)}`);
		}
	}

	private async createTrackerNote(template: TrackerTemplate) {
		const notePath = normalizePath(template.path);

		try {
			await ensureParentFolders(this.app.vault, notePath);

			const existingFile = this.app.vault.getAbstractFileByPath(notePath);
			if (existingFile && !(existingFile instanceof TFile)) {
				throw new Error(`"${notePath}" already exists but is not a note.`);
			}

			const noteFile = existingFile ?? await this.app.vault.create(notePath, template.content);
			const repairedExistingNote = existingFile ? await this.repairInvalidGeneratedTracker(existingFile, template) : false;
			if (!existingFile || repairedExistingNote) {
				await this.waitForTrackerMetadata(noteFile, template.taplogId);
			}

			await this.app.workspace.getLeaf(false).openFile(noteFile);

			if (!existingFile) {
				new Notice(`${template.name} was created.`);
			} else if (repairedExistingNote) {
				new Notice(`${template.name} had invalid TapLog frontmatter and was repaired.`);
			} else {
				new Notice(`${template.name} already existed and was opened.`);
			}
		} catch (error) {
			console.error("TapLog failed to create tracker note.", error);
			new Notice(`TapLog could not create the tracker note: ${getErrorMessage(error)}`);
		}
	}

	private async repairInvalidGeneratedTracker(file: TFile, template: TrackerTemplate): Promise<boolean> {
		const taplogConfig = getTaplogFromFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);
		const content = await this.app.vault.read(file);

		if (isValidGeneratedTrackerConfig(taplogConfig, template.taplogId) && hasMatchingTaplogCodeBlock(content, template.taplogId)) {
			return false;
		}

		await this.app.vault.modify(file, template.content);
		return true;
	}

	private async waitForTrackerMetadata(file: TFile, expectedId: string): Promise<void> {
		if (this.hasValidTrackerMetadata(file, expectedId)) {
			return;
		}

		await new Promise<void>((resolve) => {
			let settled = false;
			let timeoutId = 0;
			const eventRef = this.app.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === file.path && this.hasValidTrackerMetadata(file, expectedId)) {
					finish();
				}
			});

			const finish = () => {
				if (settled) {
					return;
				}

				settled = true;
				window.clearTimeout(timeoutId);
				this.app.metadataCache.offref(eventRef);
				resolve();
			};

			timeoutId = window.setTimeout(finish, 750);

			if (this.hasValidTrackerMetadata(file, expectedId)) {
				finish();
			}
		});
	}

	private hasValidTrackerMetadata(file: TFile, expectedId: string): boolean {
		const taplogConfig = getTaplogFromFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);

		return isValidGeneratedTrackerConfig(taplogConfig, expectedId);
	}

	private async createMonthlySummaryForActiveTracker() {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile || activeFile.extension !== "md") {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice("TapLog needs an active tracker note to create a summary.");
			return;
		}

		const configResult = validateTaplogFrontmatterConfig(getTaplogFromFrontmatter(this.app.metadataCache.getFileCache(activeFile)?.frontmatter));
		if (!configResult.ok) {
			new Notice(`TapLog summary problem: ${configResult.message}`);
			return;
		}

		try {
			const now = new Date();
			const csvPath = buildOutputPath(configResult.config, now);
			const csvFile = this.app.vault.getAbstractFileByPath(csvPath);

			if (!csvFile) {
				new Notice(`TapLog has no log file yet for this tracker/month: ${csvPath}`);
				return;
			}

			if (!(csvFile instanceof TFile)) {
				new Notice(`TapLog could not read the log file because "${csvPath}" is not a CSV file.`);
				return;
			}

			const csvContent = await this.app.vault.read(csvFile);
			const summaryPath = buildSummaryPath(configResult.config, now);
			const summaryContent = buildMonthlySummary(configResult.config, csvPath, csvContent, now);

			await ensureParentFolders(this.app.vault, summaryPath);

			const existingSummaryFile = this.app.vault.getAbstractFileByPath(summaryPath);
			let summaryFile: TFile;

			if (!existingSummaryFile) {
				summaryFile = await this.app.vault.create(summaryPath, summaryContent);
			} else if (existingSummaryFile instanceof TFile) {
				await this.app.vault.modify(existingSummaryFile, summaryContent);
				summaryFile = existingSummaryFile;
			} else {
				throw new Error(`"${summaryPath}" already exists but is not a summary note.`);
			}

			await this.app.workspace.getLeaf(false).openFile(summaryFile);
			new Notice(`Created monthly summary for ${configResult.config.id}.`);
		} catch (error) {
			console.error("TapLog failed to create monthly summary.", error);
			new Notice(`TapLog could not create the monthly summary: ${getErrorMessage(error)}`);
		}
	}
}

const SNACK_TRACKER_TEMPLATE: TrackerTemplate = {
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

const CANNABIS_TRACKER_TEMPLATE: TrackerTemplate = {
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

const BASIC_TRACKER_TEMPLATE: TrackerTemplate = {
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

const CUSTOM_TRACKER_TEMPLATE: TrackerTemplate = {
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

function validateTaplogConfig(source: string, taplogConfig: unknown): TaplogValidationResult {
	if (taplogConfig === undefined || taplogConfig === null) {
		return {
			ok: false,
			message: "Missing taplog config in this note."
		};
	}

	if (!isRecord(taplogConfig)) {
		return {
			ok: false,
			message: "taplog config must be a YAML object."
		};
	}

	const rawConfigId = taplogConfig["id"];
	if (typeof rawConfigId !== "string" || rawConfigId.trim().length === 0) {
		return {
			ok: false,
			message: "Missing taplog id in this note's frontmatter."
		};
	}

	const configId = rawConfigId.trim();

	const rawOutputType = taplogConfig["output_type"];
	if (rawOutputType !== "csv") {
		return {
			ok: false,
			message: "TapLog only supports output_type: csv right now."
		};
	}

	const rawOutputFolder = taplogConfig["output_folder"];
	if (typeof rawOutputFolder !== "string" || rawOutputFolder.trim().length === 0) {
		return {
			ok: false,
			message: "Missing output_folder in taplog config."
		};
	}

	const rawOutputFilePattern = taplogConfig["output_file_pattern"];
	if (typeof rawOutputFilePattern !== "string" || rawOutputFilePattern.trim().length === 0) {
		return {
			ok: false,
			message: "Missing output_file_pattern in taplog config."
		};
	}

	const rawColumns = taplogConfig["columns"];
	if (!isUnknownArray(rawColumns) || rawColumns.length === 0) {
		return {
			ok: false,
			message: "Missing taplog columns. Add at least one column in frontmatter."
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

	const rawDefaults = taplogConfig["defaults"];
	if (rawDefaults !== undefined && !isRecord(rawDefaults)) {
		return {
			ok: false,
			message: "TapLog defaults must be a config object."
		};
	}
	const parLevels = parseParLevels(taplogConfig["par_levels"]);

	const blockId = parseTaplogBlockId(source);
	if (!blockId) {
		return {
			ok: false,
			message: `Missing taplog code block id. Add: id: ${configId}`
		};
	}

	if (blockId !== configId) {
		return {
			ok: false,
			message: `TapLog block id "${blockId}" does not match frontmatter id "${configId}".`
		};
	}

	const rawButtons = taplogConfig["buttons"];
	if (!isUnknownArray(rawButtons) || rawButtons.length === 0) {
		return {
			ok: false,
			message: "Missing taplog buttons. Add at least one button in frontmatter."
		};
	}

	const buttons: TaplogButton[] = [];
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
			defaults: rawDefaults ?? {},
			parLevels,
			buttons
		}
	};
}

function parseParLevels(value: unknown): Record<string, ParLevel> {
	if (!isRecord(value)) {
		return {};
	}

	const parLevels: Record<string, ParLevel> = {};

	for (const [name, rawParLevel] of Object.entries(value)) {
		if (!isRecord(rawParLevel)) {
			continue;
		}

		const rawPar = rawParLevel["par"];
		const rawUnit = rawParLevel["unit"];
		const par = typeof rawPar === "number" ? rawPar : Number.parseFloat(typeof rawPar === "string" ? rawPar : "");

		if (!Number.isFinite(par) || par < 0 || typeof rawUnit !== "string" || rawUnit.trim().length === 0) {
			continue;
		}

		parLevels[name] = {
			par,
			unit: rawUnit.trim()
		};
	}

	return parLevels;
}

function validateTaplogFrontmatterConfig(taplogConfig: unknown): TaplogValidationResult {
	const rawConfigId = isRecord(taplogConfig) ? taplogConfig["id"] : undefined;
	const source = typeof rawConfigId === "string" && rawConfigId.trim().length > 0
		? `id: ${rawConfigId.trim()}`
		: "id: taplog";

	return validateTaplogConfig(source, taplogConfig);
}

function parseTaplogBlockId(source: string): string | undefined {
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

const BUTTON_COOLDOWN_MS = 750;

function renderTaplogControls(el: HTMLElement, config: TaplogConfig, onButtonClick: (button: TaplogButton) => Promise<void>) {
	const controlsEl = document.createElement("div");
	controlsEl.className = "taplog-controls";

	renderCurrentValues(controlsEl, config);

	const buttonRow = document.createElement("div");
	buttonRow.className = "taplog-button-row";

	for (const button of config.buttons) {
		const buttonCard = document.createElement("div");
		buttonCard.className = "taplog-button-card";

		const buttonEl = document.createElement("button");
		buttonEl.type = "button";
		buttonEl.className = "taplog-button";
		buttonEl.textContent = button.label;
		buttonEl.title = buildButtonPreview(config, button);
		buttonEl.addEventListener("click", () => {
			void handleButtonClick(buttonEl, button, onButtonClick);
		});

		const previewEl = document.createElement("div");
		previewEl.className = "taplog-button-preview";
		previewEl.textContent = buildButtonPreview(config, button);

		buttonCard.appendChild(buttonEl);
		buttonCard.appendChild(previewEl);
		buttonRow.appendChild(buttonCard);
	}

	const outputPathEl = document.createElement("div");
	outputPathEl.className = "taplog-output-path";
	outputPathEl.textContent = `Logs to: ${buildOutputPath(config, new Date())}`;

	controlsEl.appendChild(buttonRow);
	controlsEl.appendChild(outputPathEl);
	el.appendChild(controlsEl);
}

async function handleButtonClick(buttonEl: HTMLButtonElement, button: TaplogButton, onButtonClick: (button: TaplogButton) => Promise<void>) {
	if (buttonEl.disabled) {
		return;
	}

	buttonEl.disabled = true;

	try {
		await onButtonClick(button);
		await wait(BUTTON_COOLDOWN_MS);
	} finally {
		buttonEl.disabled = false;
	}
}

function renderCurrentValues(containerEl: HTMLElement, config: TaplogConfig) {
	const currentValues = Object.entries(config.defaults)
		.map(([key, value]) => [key, valueToDisplayText(value)] as const)
		.filter(([, value]) => value.length > 0);

	if (currentValues.length === 0) {
		return;
	}

	const currentValuesEl = document.createElement("div");
	currentValuesEl.className = "taplog-current-values";

	const headingEl = document.createElement("div");
	headingEl.className = "taplog-current-values-heading";
	headingEl.textContent = "Current values";
	currentValuesEl.appendChild(headingEl);

	const listEl = document.createElement("dl");
	listEl.className = "taplog-current-values-list";

	for (const [key, value] of currentValues) {
		const termEl = document.createElement("dt");
		termEl.textContent = key;

		const valueEl = document.createElement("dd");
		valueEl.textContent = value;

		listEl.appendChild(termEl);
		listEl.appendChild(valueEl);
	}

	currentValuesEl.appendChild(listEl);
	containerEl.appendChild(currentValuesEl);
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

function getTaplogFromFrontmatter(frontmatter: unknown): unknown {
	if (!isRecord(frontmatter)) {
		return undefined;
	}

	return frontmatter["taplog"];
}

function isValidGeneratedTrackerConfig(taplogConfig: unknown, expectedId: string): boolean {
	const result = validateTaplogConfig(`id: ${expectedId}`, taplogConfig);

	return result.ok && result.config.id === expectedId;
}

function hasMatchingTaplogCodeBlock(content: string, expectedId: string): boolean {
	const pattern = new RegExp(`\`\`\`taplog\\s*\\r?\\n\\s*id\\s*:\\s*${escapeRegExp(expectedId)}\\s*\\r?\\n\`\`\``);

	return pattern.test(content);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

async function appendCsvRow(vault: Vault, config: TaplogConfig, button: TaplogButton, now: Date) {
	const outputPath = buildOutputPath(config, now);
	await ensureParentFolders(vault, outputPath);

	const rowValues = getMergedButtonValues(config, button);
	const row = buildCsvRow(config.columns, rowValues, now);
	const header = serializeCsvRow(config.columns);
	const existingFile = vault.getAbstractFileByPath(outputPath);

	if (!existingFile) {
		await vault.create(outputPath, `${header}\n${row}\n`);
		return;
	}

	if (!(existingFile instanceof TFile)) {
		throw new Error(`"${outputPath}" already exists but is not a CSV file.`);
	}

	const existingContent = await vault.read(existingFile);
	const needsHeader = existingContent.trim().length === 0;
	const needsSeparator = existingContent.length > 0 && !existingContent.endsWith("\n");
	const appendText = `${needsSeparator ? "\n" : ""}${needsHeader ? `${header}\n` : ""}${row}\n`;

	await vault.append(existingFile, appendText);
}

function buildButtonPreview(config: TaplogConfig, button: TaplogButton): string {
	const mergedValues = getMergedButtonValues(config, button);
	const previewParts: string[] = [];

	for (const column of config.columns) {
		if (column === "timestamp") {
			continue;
		}

		const value = mergedValues[column];
		if (value === undefined || value === null) {
			continue;
		}

		const text = valueToCsvText(value);
		if (text.length === 0) {
			continue;
		}

		previewParts.push(`${column} ${text}`);
	}

	if (previewParts.length === 0) {
		return `${button.label} logs a timestamped row.`;
	}

	return `${button.label} logs ${previewParts.join(", ")}.`;
}

function getMergedButtonValues(config: TaplogConfig, button: TaplogButton): Record<string, unknown> {
	return {
		...config.defaults,
		...button.values
	};
}

function buildOutputPath(config: TaplogConfig, now: Date): string {
	return normalizePath(replaceDateTokens(`${config.outputFolder}/${config.outputFilePattern}`, now));
}

function buildSummaryPath(config: TaplogConfig, now: Date): string {
	return normalizePath(`TapLog/Summaries/${formatYearMonth(now)}/${config.id} Summary.md`);
}

function buildMonthlySummary(config: TaplogConfig, csvPath: string, csvContent: string, now: Date): string {
	const csvData = parseCsvData(csvContent);
	const yearMonth = formatYearMonth(now);
	const lines = [
		`# ${config.id} Summary - ${yearMonth}`,
		"",
		`Tracker: ${config.id}`,
		`Month: ${yearMonth}`,
		`Source CSV: \`${csvPath}\``,
		`Total events: ${csvData.rows.length}`,
		""
	];

	if (csvData.headers.includes("item") && csvData.headers.includes("quantity")) {
		const itemTotals = groupQuantityByColumn(csvData.rows, "item", "quantity");
		appendQuantitySummary(lines, "Item usage totals", itemTotals);
		appendParLevelSummary(lines, itemTotals, config.parLevels);
	}

	if (csvData.headers.includes("size")) {
		appendCountSummary(lines, "Usage by size", groupCountByColumn(csvData.rows, "size"));
	}

	if (csvData.headers.includes("strain")) {
		appendCountSummary(lines, "Usage by strain", groupCountByColumn(csvData.rows, "strain"));
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

function appendParLevelSummary(lines: string[], itemTotals: Map<string, number>, parLevels: Record<string, ParLevel>) {
	const parEntries = Object.entries(parLevels).sort(([left], [right]) => left.localeCompare(right));
	if (parEntries.length === 0) {
		return;
	}

	lines.push("## Par level guidance", "");

	for (const [item, parLevel] of parEntries) {
		const used = itemTotals.get(item) ?? 0;
		const suggestedRestock = Math.max(used, parLevel.par);
		lines.push(`### ${item}`);
		lines.push("");
		lines.push(`- Used: ${formatSummaryNumber(used)} ${parLevel.unit}`);
		lines.push(`- Par: ${formatSummaryNumber(parLevel.par)} ${parLevel.unit}`);
		lines.push(`- Suggested restock: ${formatSummaryNumber(suggestedRestock)} ${parLevel.unit}`);
		lines.push("");
	}
}

function parseCsvData(content: string): { headers: string[]; rows: Array<Record<string, string>> } {
	const csvRows = parseCsvRows(content)
		.filter((row) => row.some((cell) => cell.length > 0));
	const headers = csvRows[0] ?? [];
	const rows = csvRows.slice(1).map((row) => {
		const record: Record<string, string> = {};

		for (let index = 0; index < headers.length; index++) {
			const header = headers[index];
			if (header) {
				record[header] = row[index] ?? "";
			}
		}

		return record;
	});

	return {headers, rows};
}

function parseCsvRows(content: string): string[][] {
	const rows: string[][] = [];
	const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	let row: string[] = [];
	let cell = "";
	let inQuotes = false;

	for (let index = 0; index < normalizedContent.length; index++) {
		const character = normalizedContent[index];

		if (inQuotes) {
			if (character === "\"") {
				if (normalizedContent[index + 1] === "\"") {
					cell += "\"";
					index++;
				} else {
					inQuotes = false;
				}
			} else {
				cell += character;
			}

			continue;
		}

		if (character === "\"") {
			inQuotes = true;
		} else if (character === ",") {
			row.push(cell);
			cell = "";
		} else if (character === "\n") {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += character;
		}
	}

	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}

	return rows;
}

function appendQuantitySummary(lines: string[], heading: string, totals: Map<string, number>) {
	lines.push(`## ${heading}`);

	if (totals.size === 0) {
		lines.push("", "- No usage rows found.", "");
		return;
	}

	lines.push("");
	for (const [label, total] of sortedMapEntries(totals)) {
		lines.push(`- ${label}: ${formatSummaryNumber(total)}`);
	}
	lines.push("");
}

function appendCountSummary(lines: string[], heading: string, counts: Map<string, number>) {
	lines.push(`## ${heading}`);

	if (counts.size === 0) {
		lines.push("", "- No usage rows found.", "");
		return;
	}

	lines.push("");
	for (const [label, count] of sortedMapEntries(counts)) {
		lines.push(`- ${label}: ${count}`);
	}
	lines.push("");
}

function groupQuantityByColumn(rows: Array<Record<string, string>>, groupColumn: string, quantityColumn: string): Map<string, number> {
	const totals = new Map<string, number>();

	for (const row of rows) {
		const label = row[groupColumn]?.trim();
		if (!label) {
			continue;
		}

		const quantity = Number.parseFloat(row[quantityColumn] ?? "");
		totals.set(label, (totals.get(label) ?? 0) + (Number.isFinite(quantity) ? quantity : 0));
	}

	return totals;
}

function groupCountByColumn(rows: Array<Record<string, string>>, groupColumn: string): Map<string, number> {
	const counts = new Map<string, number>();

	for (const row of rows) {
		const label = row[groupColumn]?.trim();
		if (!label) {
			continue;
		}

		counts.set(label, (counts.get(label) ?? 0) + 1);
	}

	return counts;
}

function sortedMapEntries(map: Map<string, number>): Array<[string, number]> {
	return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));
}

function formatSummaryNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
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
		const existingFile = vault.getAbstractFileByPath(currentPath);

		if (existingFile instanceof TFolder) {
			continue;
		}

		if (existingFile) {
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
		const serializedValue = JSON.stringify(value);
		return typeof serializedValue === "string" ? serializedValue : "";
	} catch {
		return "";
	}
}

function valueToDisplayText(value: unknown): string {
	return valueToCsvText(value);
}

async function wait(milliseconds: number): Promise<void> {
	await new Promise<void>((resolve) => {
		window.setTimeout(resolve, milliseconds);
	});
}

function formatLocalTimestamp(date: Date): string {
	const yearMonth = formatYearMonth(date);
	const day = String(date.getDate()).padStart(2, "0");
	const hour = String(date.getHours()).padStart(2, "0");
	const minute = String(date.getMinutes()).padStart(2, "0");
	const second = String(date.getSeconds()).padStart(2, "0");

	return `${yearMonth}-${day} ${hour}:${minute}:${second}`;
}

function formatYearMonth(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");

	return `${year}-${month}`;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the tracker config and try again.";
}
