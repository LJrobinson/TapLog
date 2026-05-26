import { Notice, Plugin, type MarkdownPostProcessorContext } from "obsidian";

interface QuicklogButton {
	label: string;
}

interface QuicklogConfig {
	id: string;
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

		renderButtons(el, result.config);
	}

	private getQuicklogConfig(ctx: MarkdownPostProcessorContext): unknown {
		const cache = this.app.metadataCache.getCache(ctx.sourcePath);
		const frontmatter = cache?.frontmatter ?? ctx.frontmatter;

		if (!isRecord(frontmatter)) {
			return undefined;
		}

		return frontmatter["quicklog"];
	}
}

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

		buttons.push({
			label: rawLabel.trim()
		});
	}

	return {
		ok: true,
		config: {
			id: configId,
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

function renderButtons(el: HTMLElement, config: QuicklogConfig) {
	const buttonRow = document.createElement("div");
	buttonRow.className = "taplog-button-row";

	for (const button of config.buttons) {
		const buttonEl = document.createElement("button");
		buttonEl.type = "button";
		buttonEl.className = "taplog-button";
		buttonEl.textContent = button.label;
		buttonEl.addEventListener("click", () => {
			new Notice(`Logged: ${button.label}`);
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
