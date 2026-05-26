import { Notice, Plugin, TFile, type MarkdownPostProcessorContext } from "obsidian";
import { appendCsvRow, buildOutputPath, getMergedButtonValues, valueToCsvText } from "./csv";
import { TapLogSettingTab, normalizeTapLogSettings, type TapLogSettings } from "./settings";
import { createMonthlyRollupSummary, createMonthlySummaryForActiveTracker } from "./summaries";
import { createTrackerIndexNote } from "./trackerIndex";
import {
	BASIC_TRACKER_TEMPLATE,
	CANNABIS_TRACKER_TEMPLATE,
	CUSTOM_TRACKER_TEMPLATE,
	SNACK_TRACKER_TEMPLATE,
	createTrackerNote
} from "./trackerTemplates";
import { validateActiveTracker } from "./trackerValidation";
import { getTaplogFromFrontmatter, validateTaplogConfig, type TaplogButton, type TaplogConfig } from "./taplogConfig";

export default class TapLogPlugin extends Plugin {
	settings: TapLogSettings = normalizeTapLogSettings(undefined);

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new TapLogSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor("taplog", (source, el, ctx) => {
			this.renderTaplogBlock(source, el, ctx);
		});

		this.addCommand({
			id: "create-snack-tracker-test-note",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create snack tracker",
			callback: () => {
				void createTrackerNote(this.app, SNACK_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-cannabis-tracker",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create cannabis tracker",
			callback: () => {
				void createTrackerNote(this.app, CANNABIS_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-basic-tracker-template",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create basic tracker template",
			callback: () => {
				void createTrackerNote(this.app, BASIC_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-custom-tracker-template",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create custom tracker template",
			callback: () => {
				void createTrackerNote(this.app, CUSTOM_TRACKER_TEMPLATE);
			}
		});

		this.addCommand({
			id: "create-tracker-index",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create tracker index",
			callback: () => {
				void createTrackerIndexNote(this.app, this.settings.trackerOrder);
			}
		});

		this.addCommand({
			id: "create-monthly-summary-active-tracker",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create monthly summary for active tracker",
			callback: () => {
				void createMonthlySummaryForActiveTracker(this.app);
			}
		});

		this.addCommand({
			id: "validate-active-tracker",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Validate active tracker",
			callback: () => {
				void validateActiveTracker(this.app);
			}
		});

		this.addCommand({
			id: "create-monthly-rollup-summary",
			// The requested command label intentionally includes the plugin name.
			// eslint-disable-next-line obsidianmd/commands/no-plugin-name-in-command-name, obsidianmd/ui/sentence-case
			name: "TapLog: Create monthly rollup summary",
			callback: () => {
				void createMonthlyRollupSummary(this.app, this.settings.trackerOrder);
			}
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = normalizeTapLogSettings(await this.loadData());
	}

	async saveSettings() {
		this.settings = normalizeTapLogSettings(this.settings);
		await this.saveData(this.settings);
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

function valueToDisplayText(value: unknown): string {
	return valueToCsvText(value);
}

async function wait(milliseconds: number): Promise<void> {
	await new Promise<void>((resolve) => {
		window.setTimeout(resolve, milliseconds);
	});
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the tracker config and try again.";
}
