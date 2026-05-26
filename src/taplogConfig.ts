export interface TaplogButton {
	label: string;
	values: Record<string, unknown>;
}

export interface TaplogConfig {
	id: string;
	outputType: "csv";
	outputFolder: string;
	outputFilePattern: string;
	columns: string[];
	defaults: Record<string, unknown>;
	parLevels: Record<string, ParLevel>;
	buttons: TaplogButton[];
}

export interface ParLevel {
	par: number;
	unit: string;
}

export interface TrackerTemplate {
	path: string;
	name: string;
	taplogId: string;
	content: string;
}

export type TaplogValidationResult =
	| {
		ok: true;
		config: TaplogConfig;
	}
	| {
		ok: false;
		message: string;
	};

export interface TaplogBlockConfig {
	id?: string;
	source?: string;
}

export function validateTaplogConfig(source: string, taplogConfig: unknown): TaplogValidationResult {
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

	const blockId = parseTaplogBlockConfig(source).id;
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

export function validateTaplogFrontmatterConfig(taplogConfig: unknown): TaplogValidationResult {
	const rawConfigId = isRecord(taplogConfig) ? taplogConfig["id"] : undefined;
	const source = typeof rawConfigId === "string" && rawConfigId.trim().length > 0
		? `id: ${rawConfigId.trim()}`
		: "id: taplog";

	return validateTaplogConfig(source, taplogConfig);
}

export function getTaplogFromFrontmatter(frontmatter: unknown): unknown {
	if (!isRecord(frontmatter)) {
		return undefined;
	}

	return frontmatter["taplog"];
}

export function isValidGeneratedTrackerConfig(taplogConfig: unknown, expectedId: string): boolean {
	const result = validateTaplogConfig(`id: ${expectedId}`, taplogConfig);

	return result.ok && result.config.id === expectedId;
}

export function hasMatchingTaplogCodeBlock(content: string, expectedId: string): boolean {
	const pattern = new RegExp(`\`\`\`taplog\\s*\\r?\\n\\s*id\\s*:\\s*${escapeRegExp(expectedId)}(?:\\s*\\r?\\n(?:source\\s*:\\s*tracker\\s*\\r?\\n)?)?\`\`\``);

	return pattern.test(content);
}

export function parseTaplogBlockConfig(source: string): TaplogBlockConfig {
	const config: TaplogBlockConfig = {};
	const lines = source.split(/\r?\n/);

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
			continue;
		}

		const match = /^(id|source)\s*:\s*(.+)$/.exec(trimmedLine);
		const key = match?.[1];
		const rawValue = match?.[2]?.trim();
		if (!key || !rawValue) {
			continue;
		}

		if (key === "id") {
			config.id = trimMatchingQuotes(rawValue);
		} else if (key === "source") {
			config.source = trimMatchingQuotes(rawValue);
		}
	}

	return config;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
