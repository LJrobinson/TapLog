import { Notice, TFile, normalizePath, type App } from "obsidian";
import { ensureParentFolders } from "./csv";
import { normalizeCustomTrackers, type CustomTrackerDefinition } from "./customTracker";
import { normalizeTrackerOrder, orderTrackerItems } from "./trackerOrder";
import { BUILT_IN_TRACKER_IDS, BUILT_IN_TRACKER_TEMPLATES } from "./trackerTemplates";

export const DASHBOARD_PATH = "TapLog/Dashboard.md";

export interface DashboardTrackerReference {
	id: string;
	name: string;
	path: string;
}

export async function createDashboardNote(
	app: App,
	trackerOrder: readonly string[] = BUILT_IN_TRACKER_IDS,
	customTrackers: readonly CustomTrackerDefinition[] = []
) {
	const dashboardPath = normalizePath(DASHBOARD_PATH);

	try {
		await ensureParentFolders(app.vault, dashboardPath);

		const existingFile = app.vault.getAbstractFileByPath(dashboardPath);
		if (existingFile && !(existingFile instanceof TFile)) {
			throw new Error(`"${dashboardPath}" already exists but is not a note.`);
		}

		const dashboardFile = existingFile ?? await app.vault.create(dashboardPath, buildDashboardContent(trackerOrder, customTrackers));
		await app.workspace.getLeaf(false).openFile(dashboardFile);

		if (existingFile) {
			new Notice("Dashboard already existed and was opened.");
		} else {
			new Notice("Dashboard was created.");
		}
	} catch (error) {
		console.error("TapLog failed to create dashboard.", error);
		new Notice(`TapLog could not create the dashboard: ${getErrorMessage(error)}`);
	}
}

export function buildDashboardContent(
	trackerOrder: readonly string[] = BUILT_IN_TRACKER_IDS,
	customTrackers: readonly CustomTrackerDefinition[] = []
): string {
	const trackers = getOrderedDashboardTrackers(trackerOrder, customTrackers);
	const trackerSections = trackers
		.map((tracker) => [
			`## ${tracker.name}`,
			"",
			"```taplog",
			`id: ${tracker.id}`,
			"source: tracker",
			"```"
		].join("\n"))
		.join("\n\n");

	return `# TapLog Dashboard

Tap buttons from multiple tracker notes here. Each block uses its tracker note as the source of truth.

${trackerSections}
`;
}

export function getOrderedDashboardTrackers(
	trackerOrder: readonly string[] = BUILT_IN_TRACKER_IDS,
	customTrackers: readonly CustomTrackerDefinition[] = []
): DashboardTrackerReference[] {
	const trackers = getKnownDashboardTrackers(customTrackers);
	const trackerIds = trackers.map((tracker) => tracker.id);
	const normalizedOrder = normalizeTrackerOrder(trackerOrder, trackerIds);

	return orderTrackerItems(trackers, (tracker) => tracker.id, normalizedOrder);
}

export function resolveDashboardTracker(
	trackerId: string,
	customTrackers: readonly CustomTrackerDefinition[] = []
): DashboardTrackerReference | undefined {
	return getKnownDashboardTrackers(customTrackers).find((tracker) => tracker.id === trackerId);
}

function getKnownDashboardTrackers(customTrackers: readonly CustomTrackerDefinition[]): DashboardTrackerReference[] {
	const trackers = BUILT_IN_TRACKER_TEMPLATES.map((template) => ({
		id: template.taplogId,
		name: template.name,
		path: template.path
	}));

	for (const customTracker of normalizeCustomTrackers(customTrackers)) {
		if (trackers.some((tracker) => tracker.id === customTracker.id)) {
			continue;
		}

		trackers.push({
			id: customTracker.id,
			name: customTracker.name,
			path: customTracker.path
		});
	}

	return trackers;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the vault path and try again.";
}
