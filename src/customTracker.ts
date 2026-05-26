import type { TrackerTemplate } from "./taplogConfig";

export interface CustomTrackerDefinition {
	id: string;
	name: string;
	path: string;
	buttonLabels?: string[];
	columns?: string[];
	defaults?: Record<string, string>;
	buttons?: CustomTrackerButtonDefinition[];
}

export interface CustomTrackerInput {
	name: string;
	id: string;
	columns?: string;
	defaults?: string;
	buttons?: string;
	buttonLabels?: string;
}

export interface CustomTrackerButtonDefinition {
	label: string;
	values: Record<string, string | number>;
}

export type CustomTrackerBuildResult =
	| {
		ok: true;
		tracker: CustomTrackerDefinition;
		template: TrackerTemplate;
	}
	| {
		ok: false;
		message: string;
	};

export function buildCustomTrackerTemplate(input: CustomTrackerInput): CustomTrackerBuildResult {
	const name = normalizeTrackerName(input.name);
	if (!name) {
		return {
			ok: false,
			message: "Add a tracker name before creating a custom tracker."
		};
	}

	const idSource = input.id.trim().length > 0 ? input.id : name;
	const id = normalizeTrackerId(idSource);
	if (!id) {
		return {
			ok: false,
			message: "Add a tracker id with at least one letter or number."
		};
	}

	const defaults = parseKeyValueLines(input.defaults ?? "");
	const parsedButtons = parseButtonDefinitions(input.buttons ?? input.buttonLabels ?? "");
	if (parsedButtons.length === 0) {
		return {
			ok: false,
			message: "Add at least one button label before creating a custom tracker."
		};
	}

	const columns = resolveCustomTrackerColumns(input.columns ?? "", defaults, parsedButtons);
	const path = buildCustomTrackerPath(name);
	const tracker = {
		id,
		name,
		path,
		buttonLabels: parsedButtons.map((button) => button.label),
		columns,
		defaults,
		buttons: parsedButtons
	};

	return {
		ok: true,
		tracker,
		template: {
			path,
			name,
			taplogId: id,
			content: buildCustomTrackerContent(name, id, columns, defaults, parsedButtons)
		}
	};
}

export function normalizeTrackerId(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function normalizeTrackerName(value: string): string {
	return value
		.trim()
		.replace(/[\\/:*?"<>|]+/g, "-")
		.replace(/\s+/g, " ")
		.replace(/^[. ]+|[. ]+$/g, "");
}

export function parseButtonLabels(value: string): string[] {
	return parseButtonDefinitions(value).map((button) => button.label);
}

export function parseColumnNames(value: string): string[] {
	const columns: string[] = [];

	for (const line of value.split(/\r?\n/)) {
		const column = normalizeColumnName(line);
		if (column.length > 0 && !columns.includes(column)) {
			columns.push(column);
		}
	}

	return columns;
}

export function normalizeColumnName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

export function parseKeyValueLines(value: string): Record<string, string> {
	const values: Record<string, string> = {};

	for (const line of value.split(/\r?\n/)) {
		const separatorIndex = line.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const key = normalizeColumnName(line.slice(0, separatorIndex));
		const rawValue = line.slice(separatorIndex + 1).trim();
		if (key.length > 0) {
			values[key] = rawValue;
		}
	}

	return values;
}

export function parseButtonDefinitions(value: string): CustomTrackerButtonDefinition[] {
	const buttons: CustomTrackerButtonDefinition[] = [];

	for (const line of value.split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0) {
			continue;
		}

		const [rawLabel = "", rawValues = ""] = trimmedLine.split("|", 2);
		const label = rawLabel.trim();
		if (label.length === 0 || buttons.some((button) => button.label === label)) {
			continue;
		}

		const parsedValues = parseInlineKeyValues(rawValues);
		const values = Object.keys(parsedValues).length > 0
			? parsedValues
			: {
				label,
				value: 1
			};

		buttons.push({
			label,
			values
		});
	}

	return buttons;
}

export function resolveCustomTrackerColumns(
	columnInput: string,
	defaults: Record<string, string>,
	buttons: readonly CustomTrackerButtonDefinition[]
): string[] {
	const columns = parseColumnNames(columnInput).filter((column) => column !== "timestamp");
	const resolvedColumns = ["timestamp", ...columns];

	if (resolvedColumns.length === 1) {
		resolvedColumns.push("label", "value");
	}

	for (const key of Object.keys(defaults)) {
		if (!resolvedColumns.includes(key)) {
			resolvedColumns.push(key);
		}
	}

	for (const button of buttons) {
		for (const key of Object.keys(button.values)) {
			const column = normalizeColumnName(key);
			if (column.length > 0 && !resolvedColumns.includes(column)) {
				resolvedColumns.push(column);
			}
		}
	}

	return resolvedColumns;
}

export function normalizeCustomTrackers(value: unknown): CustomTrackerDefinition[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const trackers: CustomTrackerDefinition[] = [];
	for (const rawTracker of value) {
		if (!isRecord(rawTracker)) {
			continue;
		}

		const rawId = rawTracker["id"];
		const rawName = rawTracker["name"];
		const rawPath = rawTracker["path"];
		const rawButtonLabels = rawTracker["buttonLabels"];
		const rawColumns = rawTracker["columns"];
		const rawDefaults = rawTracker["defaults"];
		const rawButtons = rawTracker["buttons"];
		const id = typeof rawId === "string" ? normalizeTrackerId(rawId) : "";
		const name = typeof rawName === "string" ? normalizeTrackerName(rawName) : "";
		const path = typeof rawPath === "string" && rawPath.trim().length > 0 ? rawPath.trim().replace(/\\/g, "/") : buildCustomTrackerPath(name);
		const buttonLabels = Array.isArray(rawButtonLabels)
			? rawButtonLabels.filter((label): label is string => typeof label === "string" && label.trim().length > 0).map((label) => label.trim())
			: undefined;
		const columns = Array.isArray(rawColumns)
			? rawColumns.filter((column): column is string => typeof column === "string").map(normalizeColumnName).filter((column) => column.length > 0)
			: undefined;
		const defaults = isRecord(rawDefaults) ? normalizeStringRecord(rawDefaults) : undefined;
		const buttons = normalizeButtonDefinitions(rawButtons);

		if (!id || !name || trackers.some((tracker) => tracker.id === id)) {
			continue;
		}

		trackers.push({
			id,
			name,
			path,
			...(buttonLabels && buttonLabels.length > 0 ? {buttonLabels} : {}),
			...(columns && columns.length > 0 ? {columns: ensureTimestampFirst(columns)} : {}),
			...(defaults && Object.keys(defaults).length > 0 ? {defaults} : {}),
			...(buttons.length > 0 ? {buttons} : {})
		});
	}

	return trackers;
}

export function upsertCustomTracker(trackers: readonly CustomTrackerDefinition[], tracker: CustomTrackerDefinition): CustomTrackerDefinition[] {
	const normalizedTrackers = normalizeCustomTrackers(trackers);
	const nextTrackers = normalizedTrackers.filter((existingTracker) => existingTracker.id !== tracker.id);

	return [
		...nextTrackers,
		tracker
	];
}

export function buildCustomTrackerTemplateFromDefinition(tracker: CustomTrackerDefinition): TrackerTemplate {
	const buttons = tracker.buttons && tracker.buttons.length > 0
		? tracker.buttons
		: parseButtonDefinitions((tracker.buttonLabels && tracker.buttonLabels.length > 0 ? tracker.buttonLabels : [tracker.name]).join("\n"));
	const defaults = tracker.defaults ?? {};
	const columns = tracker.columns && tracker.columns.length > 0
		? ensureTimestampFirst(tracker.columns)
		: resolveCustomTrackerColumns("", defaults, buttons);

	return {
		path: tracker.path,
		name: tracker.name,
		taplogId: tracker.id,
		content: buildCustomTrackerContent(tracker.name, tracker.id, columns, defaults, buttons)
	};
}

function buildCustomTrackerContent(
	name: string,
	id: string,
	columns: readonly string[],
	defaults: Record<string, string>,
	buttons: readonly CustomTrackerButtonDefinition[]
): string {
	const columnsYaml = ensureTimestampFirst(columns)
		.map((column) => `    - ${column}`)
		.join("\n");
	const defaultsYaml = Object.entries(defaults)
		.map(([key, value]) => `    ${key}: ${toYamlValue(value)}`)
		.join("\n");
	const buttonsYaml = buttons
		.map((button) => [
			`    - label: ${toYamlValue(button.label)}`,
			"      values:",
			...Object.entries(button.values).map(([key, value]) => `        ${normalizeColumnName(key)}: ${toYamlValue(value)}`)
		].join("\n"))
		.join("\n");

	return `---
taplog:
  id: ${id}
  output_type: csv
  output_folder: TapLog/Logs
  output_file_pattern: YYYY-MM/${id}.csv
  columns:
${columnsYaml}
${defaultsYaml.length > 0 ? `  defaults:\n${defaultsYaml}\n` : ""}  buttons:
${buttonsYaml}
---

# ${name}

\`\`\`taplog
id: ${id}
\`\`\`
`;
}

function parseInlineKeyValues(value: string): Record<string, string | number> {
	const values: Record<string, string | number> = {};

	for (const pair of value.split(",")) {
		const separatorIndex = pair.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const key = normalizeColumnName(pair.slice(0, separatorIndex));
		const parsedValue = parseScalarValue(pair.slice(separatorIndex + 1).trim());
		if (key.length > 0) {
			values[key] = parsedValue;
		}
	}

	return values;
}

function parseScalarValue(value: string): string | number {
	if (/^-?\d+(?:\.\d+)?$/.test(value)) {
		const numericValue = Number(value);
		if (Number.isFinite(numericValue)) {
			return numericValue;
		}
	}

	return value;
}

function ensureTimestampFirst(columns: readonly string[]): string[] {
	const normalizedColumns = columns
		.map(normalizeColumnName)
		.filter((column) => column.length > 0 && column !== "timestamp");

	return [
		"timestamp",
		...Array.from(new Set(normalizedColumns))
	];
}

function normalizeStringRecord(value: Record<string, unknown>): Record<string, string> {
	const record: Record<string, string> = {};

	for (const [rawKey, rawValue] of Object.entries(value)) {
		const key = normalizeColumnName(rawKey);
		if (key.length > 0 && (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean")) {
			record[key] = String(rawValue);
		}
	}

	return record;
}

function normalizeButtonDefinitions(value: unknown): CustomTrackerButtonDefinition[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const buttons: CustomTrackerButtonDefinition[] = [];
	for (const rawButton of value) {
		if (!isRecord(rawButton)) {
			continue;
		}

		const rawLabel = rawButton["label"];
		const rawValues = rawButton["values"];
		if (typeof rawLabel !== "string" || !isRecord(rawValues)) {
			continue;
		}

		const values: Record<string, string | number> = {};
		for (const [rawKey, rawValue] of Object.entries(rawValues)) {
			const key = normalizeColumnName(rawKey);
			if (key.length > 0 && (typeof rawValue === "string" || typeof rawValue === "number")) {
				values[key] = rawValue;
			}
		}

		if (rawLabel.trim().length > 0 && Object.keys(values).length > 0) {
			buttons.push({
				label: rawLabel.trim(),
				values
			});
		}
	}

	return buttons;
}

function buildCustomTrackerPath(name: string): string {
	return `TapLog/Trackers/${name}.md`;
}

function toYamlValue(value: string | number): string {
	if (typeof value === "number") {
		return String(value);
	}

	return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
