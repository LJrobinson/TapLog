import {
	parseButtonDefinitions,
	parseColumnNames,
	parseKeyValueLines,
	normalizeColumnName,
	type CustomTrackerButtonDefinition
} from "./customTracker";
import { isRecord, validateTaplogConfig, type TaplogConfig } from "./taplogConfig";
import { valueToCsvText } from "./csv";

export interface EditableButtonRow {
	label: string;
	values: EditableButtonValueRow[];
}

export interface EditableButtonValueRow {
	field: string;
	value: string;
}

export interface EditableTrackerForm {
	id: string;
	outputFolder: string;
	outputFilePattern: string;
	columnsText: string;
	defaultsText: string;
	buttons: EditableButtonRow[];
}

export type TrackerEditorResult<T> =
	| {
		ok: true;
		value: T;
	}
	| {
		ok: false;
		message: string;
	};

export function buildEditableTrackerForm(config: TaplogConfig): EditableTrackerForm {
	return {
		id: config.id,
		outputFolder: config.outputFolder,
		outputFilePattern: config.outputFilePattern,
		columnsText: config.columns.join("\n"),
		defaultsText: recordToKeyValueText(config.defaults),
		buttons: buttonConfigToEditableRows(config.buttons)
	};
}

export function parseEditableButtonLines(value: string): CustomTrackerButtonDefinition[] {
	return parseButtonDefinitions(value);
}

export function buttonConfigToEditableRows(buttons: readonly { label: string; values: Record<string, unknown> }[]): EditableButtonRow[] {
	return buttons.map((button) => ({
		label: button.label,
		values: buttonValuesToEditableRows(button.values)
	}));
}

export function addEditableButtonRow(buttons: readonly EditableButtonRow[]): EditableButtonRow[] {
	return [
		...buttons,
		{
			label: "New button",
			values: [
				{
					field: "",
					value: ""
				}
			]
		}
	];
}

export function removeEditableButtonRow(buttons: readonly EditableButtonRow[], indexToRemove: number): EditableButtonRow[] {
	return buttons.filter((_, index) => index !== indexToRemove);
}

export function addEditableValueRow(button: EditableButtonRow): EditableButtonRow {
	return {
		...button,
		values: [
			...button.values,
			{
				field: "",
				value: ""
			}
		]
	};
}

export function removeEditableValueRow(button: EditableButtonRow, indexToRemove: number): EditableButtonRow {
	return {
		...button,
		values: button.values.filter((_, index) => index !== indexToRemove)
	};
}

export function editableButtonRowsToConfig(buttons: readonly EditableButtonRow[]): TrackerEditorResult<Array<{ label: string; values: Record<string, unknown> }>> {
	if (buttons.length === 0) {
		return {
			ok: false,
			message: "Add at least one button before saving."
		};
	}

	const parsedButtons: Array<{ label: string; values: Record<string, unknown> }> = [];
	for (let index = 0; index < buttons.length; index++) {
		const button = buttons[index];
		if (!button) {
			continue;
		}

		const label = button.label.trim();
		if (!label) {
			return {
				ok: false,
				message: `Button ${index + 1} needs a label before saving.`
			};
		}

		const valuesResult = editableValueRowsToRecord(button.values, index);
		if (!valuesResult.ok) {
			return valuesResult;
		}

		parsedButtons.push({
			label,
			values: valuesResult.value
		});
	}

	if (parsedButtons.length === 0) {
		return {
			ok: false,
			message: "Add at least one button before saving."
		};
	}

	return {
		ok: true,
		value: parsedButtons
	};
}

export function buildEditedTaplogConfig(rawConfig: unknown, form: EditableTrackerForm): TrackerEditorResult<Record<string, unknown>> {
	if (!isRecord(rawConfig)) {
		return {
			ok: false,
			message: "The selected note does not have a readable taplog config."
		};
	}

	const id = typeof rawConfig["id"] === "string" ? rawConfig["id"].trim() : "";
	if (!id) {
		return {
			ok: false,
			message: "The selected tracker is missing a taplog id."
		};
	}

	const outputFolder = form.outputFolder.trim();
	if (!outputFolder) {
		return {
			ok: false,
			message: "Add an output folder before saving."
		};
	}

	const outputFilePattern = form.outputFilePattern.trim();
	if (!outputFilePattern) {
		return {
			ok: false,
			message: "Add an output file pattern before saving."
		};
	}

	const columns = normalizeEditedColumns(form.columnsText);
	if (columns.length === 0) {
		return {
			ok: false,
			message: "Add at least one column before saving."
		};
	}

	const buttonsResult = editableButtonRowsToConfig(form.buttons);
	if (!buttonsResult.ok) {
		return buttonsResult;
	}

	const defaults = parseKeyValueLines(form.defaultsText);
	const updatedConfig: Record<string, unknown> = {
		...rawConfig,
		id,
		output_type: "csv",
		output_folder: outputFolder,
		output_file_pattern: outputFilePattern,
		columns,
		buttons: buttonsResult.value
	};

	if (Object.keys(defaults).length > 0) {
		updatedConfig["defaults"] = defaults;
	} else {
		delete updatedConfig["defaults"];
	}

	const validationResult = validateTaplogConfig(`id: ${id}`, updatedConfig);
	if (!validationResult.ok) {
		return {
			ok: false,
			message: validationResult.message
		};
	}

	return {
		ok: true,
		value: updatedConfig
	};
}

export function updateTaplogFrontmatter(
	content: string,
	rawConfig: unknown,
	form: EditableTrackerForm
): TrackerEditorResult<string> {
	const configResult = buildEditedTaplogConfig(rawConfig, form);
	if (!configResult.ok) {
		return configResult;
	}

	return replaceTaplogFrontmatterBlock(content, configResult.value);
}

export function replaceTaplogFrontmatterBlock(content: string, taplogConfig: Record<string, unknown>): TrackerEditorResult<string> {
	const frontmatter = splitFrontmatter(content);
	if (!frontmatter.ok) {
		return {
			ok: false,
			message: "The selected note does not have frontmatter to update."
		};
	}

	const lines = frontmatter.value.frontmatter.split("\n");
	const taplogRange = findTaplogBlockRange(lines);
	if (!taplogRange) {
		return {
			ok: false,
			message: "The selected note has no taplog config in its frontmatter."
		};
	}

	const serializedTaplog = serializeTaplogConfig(taplogConfig).split("\n");
	const nextFrontmatter = [
		...lines.slice(0, taplogRange.start),
		...serializedTaplog,
		...lines.slice(taplogRange.end)
	].join("\n");

	return {
		ok: true,
		value: `---\n${nextFrontmatter}\n---${frontmatter.value.body}`
	};
}

export function serializeTaplogConfig(config: Record<string, unknown>): string {
	const lines = ["taplog:"];
	const preferredKeys = [
		"id",
		"output_type",
		"output_folder",
		"output_file_pattern",
		"columns",
		"defaults",
		"par_levels",
		"buttons"
	];
	const keys = [
		...preferredKeys.filter((key) => hasOwn(config, key)),
		...Object.keys(config).filter((key) => !preferredKeys.includes(key))
	];

	for (const key of keys) {
		appendYamlEntry(lines, 2, key, config[key]);
	}

	return lines.join("\n");
}

function splitFrontmatter(content: string): TrackerEditorResult<{ frontmatter: string; body: string }> {
	const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	if (!normalizedContent.startsWith("---\n")) {
		return {
			ok: false,
			message: "Missing frontmatter."
		};
	}

	const closingMatch = /\n---(?:\n|$)/.exec(normalizedContent.slice(4));
	if (!closingMatch || closingMatch.index < 0) {
		return {
			ok: false,
			message: "Missing closing frontmatter marker."
		};
	}

	const frontmatterEnd = 4 + closingMatch.index;
	const closingEnd = frontmatterEnd + closingMatch[0].length;
	const bodyPrefix = closingMatch[0].endsWith("\n") ? "\n" : "";

	return {
		ok: true,
		value: {
			frontmatter: normalizedContent.slice(4, frontmatterEnd),
			body: `${bodyPrefix}${normalizedContent.slice(closingEnd)}`
		}
	};
}

function findTaplogBlockRange(lines: readonly string[]): { start: number; end: number } | undefined {
	const start = lines.findIndex((line) => /^taplog:\s*$/.test(line));
	if (start === -1) {
		return undefined;
	}

	let end = lines.length;
	for (let index = start + 1; index < lines.length; index++) {
		const line = lines[index] ?? "";
		if (line.trim().length === 0) {
			continue;
		}

		if (!/^\s/.test(line) && !line.trimStart().startsWith("#")) {
			end = index;
			break;
		}
	}

	return {
		start,
		end
	};
}

function normalizeEditedColumns(value: string): string[] {
	const parsedColumns = parseColumnNames(value);
	const nonTimestampColumns = parsedColumns.filter((column) => column !== "timestamp");

	return [
		"timestamp",
		...nonTimestampColumns
	];
}

function recordToKeyValueText(record: Record<string, unknown>): string {
	return Object.entries(record)
		.map(([key, value]) => `${key}=${valueToEditableText(value)}`)
		.join("\n");
}

function buttonValuesToEditableRows(values: Record<string, unknown>): EditableButtonValueRow[] {
	return Object.entries(values).map(([field, value]) => ({
		field,
		value: valueToEditableText(value)
	}));
}

function appendYamlEntry(lines: string[], indentSpaces: number, key: string, value: unknown) {
	const indent = " ".repeat(indentSpaces);
	if (isRecord(value) && Object.keys(value).length === 0) {
		lines.push(`${indent}${key}: {}`);
		return;
	}

	if (Array.isArray(value) || isRecord(value)) {
		lines.push(`${indent}${key}:`);
		appendYamlValue(lines, indentSpaces + 2, value);
		return;
	}

	lines.push(`${indent}${key}: ${toYamlScalar(value)}`);
}

function appendYamlValue(lines: string[], indentSpaces: number, value: unknown) {
	const indent = " ".repeat(indentSpaces);

	if (Array.isArray(value)) {
		for (const item of value) {
			if (!isRecord(item)) {
				lines.push(`${indent}- ${toYamlScalar(item)}`);
				continue;
			}

			const entries = Object.entries(item);
			if (entries.length === 0) {
				lines.push(`${indent}- {}`);
				continue;
			}

			const [firstKey, firstValue] = entries[0] ?? ["", ""];
			if (Array.isArray(firstValue) || isRecord(firstValue)) {
				lines.push(`${indent}- ${firstKey}:`);
				appendYamlValue(lines, indentSpaces + 4, firstValue);
			} else {
				lines.push(`${indent}- ${firstKey}: ${toYamlScalar(firstValue)}`);
			}

			for (const [key, entryValue] of entries.slice(1)) {
				appendYamlEntry(lines, indentSpaces + 2, key, entryValue);
			}
		}
		return;
	}

	if (isRecord(value)) {
		for (const [key, recordValue] of Object.entries(value)) {
			appendYamlEntry(lines, indentSpaces, key, recordValue);
		}
	}
}

function valueToEditableText(value: unknown): string {
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	return valueToCsvText(value);
}

function toYamlScalar(value: unknown): string {
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	if (value === null || value === undefined) {
		return "\"\"";
	}

	return JSON.stringify(valueToEditableText(value));
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(record, key);
}

function editableValueRowsToRecord(rows: readonly EditableButtonValueRow[], buttonIndex: number): TrackerEditorResult<Record<string, unknown>> {
	const values: Record<string, unknown> = {};
	const seenKeys = new Set<string>();

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		if (!row) {
			continue;
		}

		const rawField = row.field.trim();
		const rawValue = row.value.trim();
		if (!rawField && !rawValue) {
			continue;
		}

		if (!rawField && rawValue) {
			return {
				ok: false,
				message: `Button ${buttonIndex + 1} logged value ${index + 1} needs a field before saving.`
			};
		}

		const key = normalizeColumnName(rawField);
		if (!key) {
			return {
				ok: false,
				message: `Button ${buttonIndex + 1} logged value ${index + 1} needs a usable field name.`
			};
		}

		if (seenKeys.has(key)) {
			return {
				ok: false,
				message: `Button ${buttonIndex + 1} has duplicate value key "${key}".`
			};
		}

		seenKeys.add(key);
		values[key] = parseEditableScalarValue(rawValue);
	}

	return {
		ok: true,
		value: values
	};
}

function parseEditableScalarValue(value: string): string | number | boolean {
	if (/^-?\d+(?:\.\d+)?$/.test(value)) {
		const numericValue = Number(value);
		if (Number.isFinite(numericValue)) {
			return numericValue;
		}
	}

	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	return value;
}
