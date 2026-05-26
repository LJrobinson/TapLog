import type { TrackerTemplate } from "./taplogConfig";

export interface CustomTrackerDefinition {
	id: string;
	name: string;
	path: string;
	buttonLabels?: string[];
}

export interface CustomTrackerInput {
	name: string;
	id: string;
	buttonLabels: string;
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

	const buttonLabels = parseButtonLabels(input.buttonLabels);
	if (buttonLabels.length === 0) {
		return {
			ok: false,
			message: "Add at least one button label before creating a custom tracker."
		};
	}

	const path = buildCustomTrackerPath(name);
	const tracker = {
		id,
		name,
		path,
		buttonLabels
	};

	return {
		ok: true,
		tracker,
		template: {
			path,
			name,
			taplogId: id,
			content: buildCustomTrackerContent(name, id, buttonLabels)
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
	const labels: string[] = [];

	for (const line of value.split(/\r?\n/)) {
		const label = line.trim();
		if (label.length > 0 && !labels.includes(label)) {
			labels.push(label);
		}
	}

	return labels;
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
		const id = typeof rawId === "string" ? normalizeTrackerId(rawId) : "";
		const name = typeof rawName === "string" ? normalizeTrackerName(rawName) : "";
		const path = typeof rawPath === "string" && rawPath.trim().length > 0 ? rawPath.trim().replace(/\\/g, "/") : buildCustomTrackerPath(name);
		const buttonLabels = Array.isArray(rawButtonLabels)
			? rawButtonLabels.filter((label): label is string => typeof label === "string" && label.trim().length > 0).map((label) => label.trim())
			: undefined;

		if (!id || !name || trackers.some((tracker) => tracker.id === id)) {
			continue;
		}

		trackers.push({
			id,
			name,
			path,
			...(buttonLabels && buttonLabels.length > 0 ? {buttonLabels} : {})
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
	const buttonLabels = tracker.buttonLabels && tracker.buttonLabels.length > 0 ? tracker.buttonLabels : [tracker.name];

	return {
		path: tracker.path,
		name: tracker.name,
		taplogId: tracker.id,
		content: buildCustomTrackerContent(tracker.name, tracker.id, buttonLabels)
	};
}

function buildCustomTrackerContent(name: string, id: string, buttonLabels: readonly string[]): string {
	const buttons = buttonLabels
		.map((label) => [
			`    - label: ${toYamlString(label)}`,
			"      values:",
			`        label: ${toYamlString(label)}`,
			"        value: 1"
		].join("\n"))
		.join("\n");

	return `---
taplog:
  id: ${id}
  output_type: csv
  output_folder: TapLog/Logs
  output_file_pattern: YYYY-MM/${id}.csv
  columns:
    - timestamp
    - label
    - value
  buttons:
${buttons}
---

# ${name}

\`\`\`taplog
id: ${id}
\`\`\`
`;
}

function buildCustomTrackerPath(name: string): string {
	return `TapLog/Trackers/${name}.md`;
}

function toYamlString(value: string): string {
	return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
