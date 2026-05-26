import { Notice, TFile, normalizePath, type App } from "obsidian";
import { buildOutputPath, ensureParentFolders, formatYearMonth } from "./csv";
import {
	getTaplogFromFrontmatter,
	validateTaplogFrontmatterConfig,
	type TaplogConfig
} from "./taplogConfig";

export async function validateActiveTracker(app: App) {
	const activeFile = app.workspace.getActiveFile();

	if (!activeFile || activeFile.extension !== "md") {
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		new Notice("TapLog needs an active Markdown tracker note to validate.");
		return;
	}

	const taplogConfig = getTaplogFromFrontmatter(app.metadataCache.getFileCache(activeFile)?.frontmatter);
	const configResult = validateTaplogFrontmatterConfig(taplogConfig);

	if (!configResult.ok) {
		new Notice(`TapLog setup problem: ${configResult.message}`);
		return;
	}

	try {
		const now = new Date();
		const csvPath = buildOutputPath(configResult.config, now);
		const reportPath = buildValidationReportPath(configResult.config, now);
		const reportContent = buildValidationReportContent(configResult.config, activeFile.path, csvPath, now);

		await ensureParentFolders(app.vault, reportPath);

		const existingReportFile = app.vault.getAbstractFileByPath(reportPath);
		let reportFile: TFile;

		if (!existingReportFile) {
			reportFile = await app.vault.create(reportPath, reportContent);
		} else if (existingReportFile instanceof TFile) {
			await app.vault.modify(existingReportFile, reportContent);
			reportFile = existingReportFile;
		} else {
			throw new Error(`"${reportPath}" already exists but is not a validation note.`);
		}

		await app.workspace.getLeaf(false).openFile(reportFile);
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		new Notice("TapLog tracker config looks valid.");
	} catch (error) {
		console.error("TapLog failed to validate tracker.", error);
		new Notice(`TapLog could not write the validation report: ${getErrorMessage(error)}`);
	}
}

export function buildValidationReportPath(config: TaplogConfig, now: Date): string {
	return normalizePath(`TapLog/Summaries/${formatYearMonth(now)}/${config.id} Validation.md`);
}

export function buildValidationReportContent(config: TaplogConfig, trackerPath: string, csvPath: string, now: Date): string {
	const yearMonth = formatYearMonth(now);
	const defaultsExist = Object.keys(config.defaults).length > 0;
	const parLevelsExist = Object.keys(config.parLevels).length > 0;
	const lines = [
		`# ${config.id} Validation - ${yearMonth}`,
		"",
		"Status: config is valid",
		"",
		`Tracker id: ${config.id}`,
		`Tracker note: \`${trackerPath}\``,
		`Resolved current month CSV: \`${csvPath}\``,
		`Output type: ${config.outputType}`,
		`Defaults exist: ${defaultsExist ? "yes" : "no"}`,
		`par_levels exist: ${parLevelsExist ? "yes" : "no"}`,
		"",
		"## Columns",
		""
	];

	for (const column of config.columns) {
		lines.push(`- ${column}`);
	}

	lines.push("", `Button count: ${config.buttons.length}`, "", "## Button labels", "");

	for (const button of config.buttons) {
		lines.push(`- ${button.label}`);
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the tracker config and try again.";
}
