import { TFile, TFolder, normalizePath, type Vault } from "obsidian";
import type { TaplogButton, TaplogConfig } from "./taplogConfig";

export interface CsvData {
	headers: string[];
	rows: Array<Record<string, string>>;
}

export async function appendCsvRow(vault: Vault, config: TaplogConfig, button: TaplogButton, now: Date) {
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

export function buildOutputPath(config: TaplogConfig, now: Date): string {
	return normalizePath(replaceDateTokens(`${config.outputFolder}/${config.outputFilePattern}`, now));
}

export function getMergedButtonValues(config: TaplogConfig, button: TaplogButton): Record<string, unknown> {
	return {
		...config.defaults,
		...button.values
	};
}

export function parseCsvData(content: string): CsvData {
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

export async function ensureParentFolders(vault: Vault, filePath: string) {
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

export function valueToCsvText(value: unknown): string {
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

export function formatYearMonth(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");

	return `${year}-${month}`;
}

function buildCsvRow(columns: string[], values: Record<string, unknown>, now: Date): string {
	return serializeCsvRow(columns.map((column) => {
		if (column === "timestamp") {
			return formatLocalTimestamp(now);
		}

		return values[column] ?? "";
	}));
}

export function serializeCsvRow(values: unknown[]): string {
	return values.map(csvEscape).join(",");
}

function csvEscape(value: unknown): string {
	const text = valueToCsvText(value);

	if (/[",\r\n]/.test(text)) {
		return `"${text.replace(/"/g, "\"\"")}"`;
	}

	return text;
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

function replaceDateTokens(value: string, now: Date): string {
	const year = String(now.getFullYear());
	const month = String(now.getMonth() + 1).padStart(2, "0");

	return value
		.replace(/YYYY/g, year)
		.replace(/MM/g, month);
}

function formatLocalTimestamp(date: Date): string {
	const yearMonth = formatYearMonth(date);
	const day = String(date.getDate()).padStart(2, "0");
	const hour = String(date.getHours()).padStart(2, "0");
	const minute = String(date.getMinutes()).padStart(2, "0");
	const second = String(date.getSeconds()).padStart(2, "0");

	return `${yearMonth}-${day} ${hour}:${minute}:${second}`;
}
