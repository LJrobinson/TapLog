import { Notice, TFile, TFolder, normalizePath, type App } from "obsidian";
import { buildOutputPath, ensureParentFolders, formatYearMonth, parseCsvData } from "./csv";
import { normalizeCustomTrackers, type CustomTrackerDefinition } from "./customTracker";
import { normalizeTrackerOrder, orderTrackerItems } from "./trackerOrder";
import { BUILT_IN_TRACKER_IDS } from "./trackerTemplates";
import {
	type ParLevel,
	type TaplogConfig,
	getTaplogFromFrontmatter,
	validateTaplogFrontmatterConfig
} from "./taplogConfig";

interface RollupTrackerSummary {
	id: string;
	path: string;
	eventCount: number;
	itemCounts: Map<string, number>;
	sizeCounts: Map<string, number>;
}

export async function createMonthlySummaryForActiveTracker(app: App) {
	const activeFile = app.workspace.getActiveFile();

	if (!activeFile || activeFile.extension !== "md") {
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		new Notice("TapLog needs an active tracker note to create a summary.");
		return;
	}

	const configResult = validateTaplogFrontmatterConfig(getTaplogFromFrontmatter(app.metadataCache.getFileCache(activeFile)?.frontmatter));
	if (!configResult.ok) {
		new Notice(`TapLog summary problem: ${configResult.message}`);
		return;
	}

	try {
		const now = new Date();
		const csvPath = buildOutputPath(configResult.config, now);
		const csvFile = app.vault.getAbstractFileByPath(csvPath);

		if (!csvFile) {
			new Notice(`TapLog has no log file yet for this tracker/month: ${csvPath}`);
			return;
		}

		if (!(csvFile instanceof TFile)) {
			new Notice(`TapLog could not read the log file because "${csvPath}" is not a CSV file.`);
			return;
		}

		const csvContent = await app.vault.read(csvFile);
		const summaryPath = buildSummaryPath(configResult.config, now);
		const summaryContent = buildMonthlySummary(configResult.config, csvPath, csvContent, now);

		await ensureParentFolders(app.vault, summaryPath);

		const existingSummaryFile = app.vault.getAbstractFileByPath(summaryPath);
		let summaryFile: TFile;

		if (!existingSummaryFile) {
			summaryFile = await app.vault.create(summaryPath, summaryContent);
		} else if (existingSummaryFile instanceof TFile) {
			await app.vault.modify(existingSummaryFile, summaryContent);
			summaryFile = existingSummaryFile;
		} else {
			throw new Error(`"${summaryPath}" already exists but is not a summary note.`);
		}

		await app.workspace.getLeaf(false).openFile(summaryFile);
		new Notice(`Created monthly summary for ${configResult.config.id}.`);
	} catch (error) {
		console.error("TapLog failed to create monthly summary.", error);
		new Notice(`TapLog could not create the monthly summary: ${getErrorMessage(error)}`);
	}
}

export async function createMonthlyRollupSummary(
	app: App,
	trackerOrder: readonly string[] = BUILT_IN_TRACKER_IDS,
	customTrackers: readonly CustomTrackerDefinition[] = []
) {
	try {
		const now = new Date();
		const yearMonth = formatYearMonth(now);
		const logFolderPath = normalizePath(`TapLog/Logs/${yearMonth}`);
		const logFolder = app.vault.getAbstractFileByPath(logFolderPath);

		if (!logFolder) {
			new Notice(`TapLog has no logs for the current month: ${logFolderPath}`);
			return;
		}

		if (!(logFolder instanceof TFolder)) {
			new Notice(`TapLog could not read monthly logs because "${logFolderPath}" is not a folder.`);
			return;
		}

		const csvFiles = logFolder.children
			.filter((file): file is TFile => file instanceof TFile && file.extension === "csv")
			.sort((left, right) => left.basename.localeCompare(right.basename));

		if (csvFiles.length === 0) {
			new Notice(`TapLog has no CSV files for the current month: ${logFolderPath}`);
			return;
		}

		const trackerSummaries: RollupTrackerSummary[] = [];
		for (const csvFile of csvFiles) {
			const csvContent = await app.vault.read(csvFile);
			const csvData = parseCsvData(csvContent);
			trackerSummaries.push({
				id: csvFile.basename,
				path: csvFile.path,
				eventCount: csvData.rows.length,
				itemCounts: csvData.headers.includes("item") ? groupCountByColumn(csvData.rows, "item") : new Map<string, number>(),
				sizeCounts: csvData.headers.includes("size") ? groupCountByColumn(csvData.rows, "size") : new Map<string, number>()
			});
		}

		const orderedTrackerSummaries = orderTrackerItems(
			trackerSummaries,
			(summary) => summary.id,
			normalizeTrackerOrder(trackerOrder, getKnownRollupTrackerIds(customTrackers))
		);
		const rollupPath = normalizePath(`TapLog/Summaries/${yearMonth}/Monthly Rollup.md`);
		const rollupContent = buildMonthlyRollupSummary(yearMonth, logFolderPath, orderedTrackerSummaries);
		await ensureParentFolders(app.vault, rollupPath);

		const existingRollupFile = app.vault.getAbstractFileByPath(rollupPath);
		let rollupFile: TFile;

		if (!existingRollupFile) {
			rollupFile = await app.vault.create(rollupPath, rollupContent);
		} else if (existingRollupFile instanceof TFile) {
			await app.vault.modify(existingRollupFile, rollupContent);
			rollupFile = existingRollupFile;
		} else {
			throw new Error(`"${rollupPath}" already exists but is not a rollup note.`);
		}

		await app.workspace.getLeaf(false).openFile(rollupFile);
		new Notice(`Created monthly rollup for ${yearMonth}.`);
	} catch (error) {
		console.error("TapLog failed to create monthly rollup.", error);
		new Notice(`TapLog could not create the monthly rollup: ${getErrorMessage(error)}`);
	}
}

function getKnownRollupTrackerIds(customTrackers: readonly CustomTrackerDefinition[]): string[] {
	return [
		...BUILT_IN_TRACKER_IDS,
		...normalizeCustomTrackers(customTrackers).map((tracker) => tracker.id)
	];
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

function buildMonthlyRollupSummary(yearMonth: string, logFolderPath: string, summaries: RollupTrackerSummary[]): string {
	const totalEventCount = summaries.reduce((total, summary) => total + summary.eventCount, 0);
	const lines = [
		`# Monthly Rollup - ${yearMonth}`,
		"",
		`Month: ${yearMonth}`,
		`Source folder: \`${logFolderPath}\``,
		`Tracker count: ${summaries.length}`,
		`Total events: ${totalEventCount}`,
		""
	];

	for (const summary of summaries) {
		lines.push(`## ${summary.id}`, "");
		lines.push(`Tracker: ${summary.id}`);
		lines.push(`Source CSV: \`${summary.path}\``);
		lines.push(`Event count: ${summary.eventCount}`);
		lines.push("");

		appendOptionalRollupCounts(lines, "Top items", summary.itemCounts);
		appendOptionalRollupCounts(lines, "Usage by size", summary.sizeCounts);
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

function appendOptionalRollupCounts(lines: string[], heading: string, counts: Map<string, number>) {
	if (counts.size === 0) {
		return;
	}

	lines.push(`### ${heading}`, "");
	for (const [label, count] of sortedMapEntries(counts)) {
		lines.push(`- ${label}: ${count}`);
	}
	lines.push("");
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

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the tracker config and try again.";
}
